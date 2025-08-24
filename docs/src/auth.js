// /src/auth.js
import { supabase } from './supabaseClient.js';
import { setState } from './state.js';

/* ---------------- utils ---------------- */
function deriveDisplayName(email) {
  const local = (email || '').split('@')[0] || 'Usuario';
  return local.replace(/[._-]+/g,' ')
              .split(' ')
              .filter(Boolean)
              .map(s => s.charAt(0).toUpperCase() + s.slice(1))
              .join(' ');
}

// Construye URL a tablero.html respetando subcarpetas (p.ej. /docs/)
function dashboardURL() {
  const base = location.pathname.replace(/(index|entrar|login|ingresar)\.html?$/i, '');
  return new URL(base + 'tablero.html', location.origin).href;
}
function goToDashboard() {
  // limpia “/?” si quedó colgado
  if (location.search === '?') {
    history.replaceState(null, '', location.pathname);
  }
  location.replace(dashboardURL());
}

/* ---------------- profiles helpers ---------------- */
async function upsertProfileRow({ id, email, display_name }) {
  const clean = (display_name && display_name.trim()) || deriveDisplayName(email);
  const { error } = await supabase
    .from('profiles')
    .upsert(
      { id, display_name: clean, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
  if (error) console.warn('[auth] profiles upsert error', error);
  return clean;
}

/* ------------- sesión ------------- */
export async function signIn(email, password) {
  setState({ isLoading: true });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  console.log('[auth] signIn', { data, error });
  if (error) { 
    setState({ isLoading: false });
    throw error;
  }

  // Asegura profile.display_name
  try {
    const user = data.user;
    if (user) {
      const dn = user.user_metadata?.display_name || deriveDisplayName(user.email);
      await upsertProfileRow({ id: user.id, email: user.email, display_name: dn });
    }
  } catch (e) {
    console.warn('[auth] ensure profile on signIn', e);
  }

  await refreshUser();
  setState({ isLoading: false });

  // 🔥 siempre al tablero tras iniciar sesión
  goToDashboard();
  return data;
}

/**
 * Registrar cuenta
 * - register(email, password, 'Juan Pérez')
 * - register(email, password, { display_name:'Juan Pérez', ... })
 */
export async function register(email, password, displayNameOrMeta = {}) {
  setState({ isLoading: true });

  // Normaliza metadata
  let meta = {};
  if (typeof displayNameOrMeta === 'string') {
    meta.display_name = displayNameOrMeta.trim();
  } else if (displayNameOrMeta && typeof displayNameOrMeta === 'object') {
    meta = { ...displayNameOrMeta };
  }
  if (!meta.display_name) meta.display_name = deriveDisplayName(email);

  // Alta en Auth con metadata OBJETO y redirect al tablero
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: meta,
      emailRedirectTo: dashboardURL()
    }
  });
  console.log('[auth] signUp', { data, error });
  if (error) { setState({ isLoading: false }); throw error; }

  // Crear/actualizar fila en profiles
  try {
    if (data.user) {
      await upsertProfileRow({
        id: data.user.id,
        email: data.user.email,
        display_name: meta.display_name
      });
    }
  } catch (e) {
    console.warn('[auth] profiles upsert catch', e);
  }

  setState({ isLoading: false });
  return data;
}

/* ------------- cambiar alias ------------- */
export async function updateDisplayName(displayName) {
  const clean = (displayName || '').trim();
  if (!clean) throw new Error('display_name vacío');

  // auth metadata
  const { data: udata, error: uerr } = await supabase.auth.updateUser({
    data: { display_name: clean }
  });
  if (uerr) throw uerr;

  // profiles
  const user = udata?.user;
  if (user) await upsertProfileRow({ id: user.id, email: user.email, display_name: clean });
  return clean;
}

/* ------------- logout ------------- */
export async function logout() {
  setState({ isLoading: true });
  const { error } = await supabase.auth.signOut();
  setState({ isLoading: false });
  if (error) throw error;
}

/* ------------- usuario actual ------------- */
export async function refreshUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.error('[auth] getSession error', error);
  const user = session?.user ?? null;
  console.log('[auth] refreshUser ->', !!user, user?.email);
  setState({ currentUser: user });
  return user;
}

// Handy
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) { console.warn('[auth] getUser error', error); return null; }
  return data.user ?? null;
}

/* ------------- listener ------------- */
let listenerAttached = false;
export function listenAuth() {
  if (listenerAttached) return;
  listenerAttached = true;

  supabase.auth.onAuthStateChange(async (ev, session) => {
    console.log('[auth] onAuthStateChange', ev, !!session?.user, session?.user?.email);
    const user = session?.user ?? null;
    setState({ currentUser: user });

    // Sincroniza perfil cuando corresponde
    if (user && (ev === 'SIGNED_IN' || ev === 'USER_UPDATED')) {
      try {
        const dn = user.user_metadata?.display_name || deriveDisplayName(user.email);
        await upsertProfileRow({ id: user.id, email: user.email, display_name: dn });
      } catch (e) {
        console.warn('[auth] ensure profile on event', e);
      }
      // Si estamos en index/entrar, saltamos al tablero
      if (/(index|entrar|login|ingresar)\.html?$/i.test(location.pathname) || /\/$/.test(location.pathname)) {
        goToDashboard();
      }
    }
  });
}
