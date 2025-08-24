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

// exchanges.js
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
export async function getMyExchanges({ limit = 50 } = {}) {
  const user = getState().currentUser;
  if (!user) throw new Error('Necesitás iniciar sesión.');

  const { data, error } = await supabase
    .from(TABLE)
    .select(`
      *,
      offers(*),
      requester:profiles!exchanges_requester_id_fkey ( id, display_name ),
      provider:profiles!exchanges_provider_id_fkey  ( id, display_name )
    `)
    .or(`requester_id.eq.${user.id},provider_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/*  🔁 Fallback si no conocés los nombres exactos de las FK:
export async function getMyExchanges({ limit = 50 } = {}) {
  const user = getState().currentUser;
  if (!user) throw new Error('Necesitás iniciar sesión.');

  const { data, error } = await supabase
    .from(TABLE)
    .select(`
      *,
      offers(*),
      req:profiles ( id, display_name ),
      prov:profiles!exchanges_provider_id_fkey ( id, display_name )
    `)
    .or(`requester_id.eq.${user.id},provider_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  // accederías como row.req / row.prov (o req/prov podrían venir null según el join implícito)
  return data;
}
*/
