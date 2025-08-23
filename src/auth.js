// /src/auth.js
import { supabase } from './supabaseClient.js';
import { setState } from './state.js';

// Iniciar sesión con email/password
export async function signIn(email, password) {
  setState({ isLoading: true });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  console.log('[auth] signIn', { data, error });
  if (error) { 
    setState({ isLoading: false });
    throw error;
  }
  await refreshUser(); // hidrata después de login
  setState({ isLoading: false });
  return data;
}

// Registrar cuenta
export async function register(email, password, metadata = {}) {
  setState({ isLoading: true });
  const { data, error } = await supabase.auth.signUp({
    email, 
    password, 
    options: { data: metadata }
  });
  console.log('[auth] signUp', { data, error });
  setState({ isLoading: false });
  if (error) throw error;
  return data;
}

// Cerrar sesión
export async function logout() {
  setState({ isLoading: true });
  const { error } = await supabase.auth.signOut();
  setState({ isLoading: false });
  if (error) throw error;
}

// Refrescar usuario actual (lee localStorage/session)
export async function refreshUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.error('[auth] getSession error', error);
  const user = session?.user ?? null;
  console.log('[auth] refreshUser ->', !!user, user?.email);
  setState({ currentUser: user });
  return user;
}

// Escuchar cambios de sesión
let listenerAttached = false;
export function listenAuth() {
  if (listenerAttached) return;  // evita múltiples suscripciones
  listenerAttached = true;

  supabase.auth.onAuthStateChange((ev, session) => {
    console.log('[auth] onAuthStateChange', ev, !!session?.user, session?.user?.email);
    setState({ currentUser: session?.user ?? null });
  });
}
