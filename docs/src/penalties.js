// penalties.js
import { supabase } from './supabaseClient.js';

const TABLE = 'penalties';

export async function getMyPenalties() {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
