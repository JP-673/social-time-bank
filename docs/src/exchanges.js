// /src/exchanges.js
import { supabase } from './supabaseClient.js';
import { getState } from './state.js';

const TABLE = 'exchanges';

export async function takeOffer(offerId) {
  const user = getState().currentUser;
  if (!user) throw new Error('Necesitás iniciar sesión.');
  const { data, error } = await supabase.rpc('take_offer', { p_offer_id: offerId });
  if (error) throw error;
  return data; // exchange creado
}

export async function acceptExchange(exchangeId) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'accepted' })
    .eq('id', exchangeId)
    .eq('status', 'pending')
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function completeExchange(exchangeId) {
  const { data, error } = await supabase
    .rpc('settle_exchange', { p_exchange_id: exchangeId });
  if (error) throw error;
  return data;
}


export async function cancelExchange(exchangeId, reason = '') {
  const user = getState().currentUser;
  if (!user) throw new Error('Necesitás iniciar sesión.');
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'cancelled', cancelled_by: user.id, cancelled_reason: reason })
    .eq('id', exchangeId)
    .in('status', ['pending', 'accepted'])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markNoShow(exchangeId, againstUserId) {
  const user = getState().currentUser;
  if (!user) throw new Error('Necesitás iniciar sesión.');
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'no_show', no_show_by: user.id, no_show_against: againstUserId })
    .eq('id', exchangeId)
    .eq('status', 'accepted')
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Devuelve mis intercambios con la oferta y los nombres de requester/provider.
 * IMPORTANTE: si el nombre de tus constraints difiere, ajustá los sufijos !exchanges_*_fkey.
 * Si no querés depender del nombre de la FK, usá la versión fallback comentada abajo.
 */
// exchanges.js


export async function getMyExchanges() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return []; // 👈 evita romper la UI si la sesión aún no se hidrató

  const { data, error } = await supabase
    .from('exchanges')
    .select(`id, status, minutes, provider_id, requester_id,
             offers:offer_id ( id, title, duration_minutes )`)
    .or(`provider_id.eq.${user.id},requester_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
