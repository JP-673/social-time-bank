// reports.js
import { supabase } from './supabaseClient.js';
import { getState } from './state.js';

const TABLE = 'reports';

export async function createReport({ targetUserId, offerId, exchangeId, reason, note }) {
  const user = getState().currentUser;
  if (!user) throw new Error('Necesitás iniciar sesión.');

  const { data, error } = await supabase
    .from(TABLE)
    .insert([{ 
      reporter_id: user.id, 
      target_user_id: targetUserId, 
      offer_id: offerId, 
      exchange_id: exchangeId, 
      reason, 
      note 
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getMyReports() {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
