import { supabase } from './supabaseClient.js';

// profile.js
export async function getProfileWithHood() {
  const { supabase } = await import('./supabaseClient.js');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select(`display_name, hood:hood_id ( name )`)
    .eq('id', user.id)
    .single();
  return data;
}

export async function listHoods() {
  const { data, error } = await supabase.from('hoods').select('id,name').order('name');
  if (error) return [];
  return data;
}

export async function upsertProfile({ display_name=null, hood_id=null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No session');
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, display_name, hood_id, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}
