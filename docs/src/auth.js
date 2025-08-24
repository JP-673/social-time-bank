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
function buildRedirect() {
  // /docs/index.html -> /docs/dashboard.html  |  /index.html -> /dashboard.html
  const base = location.pathname.replace(/index\.html?$/i, '');
  return `${location.origin}${base}dashboard.html`;
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
  await refreshUser();
  setState({ isLoading: false });
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

  // 1) alta en Auth con metadata OBJETO
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: meta,                               // <- objeto, no stringify
      emailRedirectTo: buildRedirect()
    }
  });
  console.log('[auth] signUp', { data, error });
  if (error) { setState({ isLoading: false }); throw error; }

  // 2) crear/actualizar fila en profiles (para joins con hoods)
  try {
    if (data.user) {
      const up = await supabase
        .from('profiles')
        .upsert(
          { id: data.user.id, display_name: meta.display_name, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        )
        .select('id')
        .single();
      if (up.error) console.warn('[auth] profiles upsert error', up.error);
    }
  } catch (e) {
    console.warn('[auth] profiles upsert catch', e);
  }

  setState({ isLoading: false });
  return data;
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

/* ------------- listener ------------- */
let listenerAttached = false;
export function listenAuth() {
  if (listenerAttached) return;
  listenerAttached = true;

  supabase.auth.onAuthStateChange((ev, session) => {
    console.log('[auth] onAuthStateChange', ev, !!session?.user, session?.user?.email);
    setState({ currentUser: session?.user ?? null });
  });
}
