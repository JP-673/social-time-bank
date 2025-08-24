// docs/src/profile.js
import { supabase } from './supabaseClient.js';

/* =========================
   Cachecito simple en memoria
   ========================= */
const cache = new Map(); // id -> { id, display_name }

/* =========================
   Lectura del propio perfil (con hood)
   ========================= */
/** Lee display_name y el barrio (JOIN a hoods). */
export async function getProfileWithHood() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      display_name,
      hood_id,
      hood:hood_id ( name )
    `)
    .eq('id', user.id)
    .single();

  // PGRST116 = no rows found
  if (error && error.code !== 'PGRST116') {
    console.error('getProfileWithHood error:', error);
    return null;
  }

  // cachea lo básico para chat
  if (data?.id) cache.set(data.id, { id: data.id, display_name: data.display_name ?? null });

  return data ?? { id: null, display_name: null, hood_id: null, hood: null };
}

/* =========================
   Hoods
   ========================= */
export async function listHoods() {
  const { data, error } = await supabase
    .from('hoods')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) {
    console.error('listHoods error:', error);
    return [];
  }
  return data || [];
}

/* =========================
   Upserts / setters de perfil
   ========================= */
export async function upsertProfile({ display_name = null, hood_id = null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No session');

  const clean = (display_name ?? '').trim() || null;

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, display_name: clean, hood_id, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
    .select('id, display_name, hood_id')
    .single();

  if (error) throw error;

  // cache
  cache.set(data.id, { id: data.id, display_name: data.display_name ?? null });

  return data;
}

/** Guarda solo el display_name y sincroniza metadata de Auth (opcional). */
export async function setDisplayName(newName) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No session');

  const clean = (newName || '').trim();

  // 1) profiles
  await upsertProfile({ display_name: clean });

  // 2) auth metadata (para que la sesión también lo tenga)
  await supabase.auth.updateUser({ data: { display_name: clean } });
}

/** Guarda solo el barrio por id. */
export async function setHood(hood_id) {
  if (!hood_id) throw new Error('hood_id requerido');
  await upsertProfile({ hood_id });
}

/* =========================
   Helpers para CHAT (alias-only)
   ========================= */

/** Nombre a mostrar con fallback elegante. */
export function displayName(profile) {
  return (profile?.display_name && profile.display_name.trim())
    ? profile.display_name.trim()
    : (profile?.id ? profile.id.slice(0,6) : 'Usuario');
}

/** Lee perfil por id (solo id + display_name), con cache. */
export async function getProfileById(userId) {
  if (!userId) return null;
  if (cache.has(userId)) return cache.get(userId);

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('id', userId)
    .single();

  if (error) {
    // si no existe fila, devolvemos fallback
    if (error.code !== 'PGRST116') console.warn('getProfileById error:', error);
    const fallback = { id: userId, display_name: null };
    cache.set(userId, fallback);
    return fallback;
  }

  cache.set(userId, data);
  return data;
}

/** Lee varios perfiles en lote (id + display_name), respetando cache. */
export async function getProfilesBulk(userIds = []) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const missing = ids.filter(id => !cache.has(id));
  if (missing.length) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', missing);

    if (error) {
      console.warn('getProfilesBulk error:', error);
    } else if (data) {
      data.forEach(p => cache.set(p.id, { id: p.id, display_name: p.display_name ?? null }));
      // si faltó alguno, cachea fallback
      const got = new Set(data.map(p => p.id));
      missing.filter(id => !got.has(id))
             .forEach(id => cache.set(id, { id, display_name: null }));
    }
  }
  return ids.map(id => cache.get(id) || { id, display_name: null });
}
