// users.js
import { supabase } from './supabaseClient.js';

const TABLE = 'profiles'; // asumiendo una tabla "profiles" en Supabase

export async function upsertProfile({ id, username, bio, skills, avatar_url }) {
  // id debería ser el user.id de auth
  const { data, error } = await supabase
    .from(TABLE)
    .upsert({ id, username, bio, skills, avatar_url })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function searchUsers({ q = '', limit = 20 }) {
  // Búsqueda simple por username/bio
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .or(`username.ilike.%${q}%,bio.ilike.%${q}%`)
    .limit(limit);
  if (error) throw error;
  return data;
}
