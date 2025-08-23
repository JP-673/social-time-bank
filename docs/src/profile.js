
import { supabase } from './supabaseClient.js';
import { getState } from './state.js';

export async function getProfileWithHood() {
  const uid = getState().currentUser?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, hood:hoods(name)')
    .eq('id', uid)
    .single();
  if (error) throw error;
  return data;
}
