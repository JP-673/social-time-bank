// docs/src/profile.js
import { supabase } from './supabaseClient.js';

/** Lee display_name y el barrio (JOIN a hoods). */
export async function getProfileWithHood() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(`
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
  return data ?? { display_name: null, hood_id: null, hood: null };
}

/** Lista de barrios para <select>. */
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

/** Crea/actualiza tu fila en profiles. */
export async function upsertProfile({ display_name = null, hood_id = null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No session');

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, display_name, hood_id, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
    .select('id, display_name, hood_id')
    .single();

  if (error) throw error;
  return data;
}

/** Guarda solo el display_name y sincroniza metadata de Auth (opcional). */
export async function setDisplayName(newName) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No session');

  // 1) profiles
  await upsertProfile({ display_name: (newName || '').trim() || null });

  // 2) auth metadata (para que la sesión también lo tenga)
  await supabase.auth.updateUser({ data: { display_name: newName } });
}

/** Guarda solo el barrio por id. */
export async function setHood(hood_id) {
  if (!hood_id) throw new Error('hood_id requerido');
  await upsertProfile({ hood_id });
}
