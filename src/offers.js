// /src/offers.js
import { supabase } from './supabaseClient.js';
import { getState } from './state.js';

const TABLE = 'offers';

/**
 * Crea oferta con el esquema real:
 * owner_id (FK a profiles.id)
 * duration_minutes (int)
 * title, description, category, location_hint
 * active (bool), status ('open'|'taken'|'closed'|'cancelled')
 */
export async function createOffer({
  title,
  minutes,           // <- number
  description = '',
  category = null,    // <- opcional
  locationHint = null // <- opcional
}) {
  const user = getState().currentUser;
  if (!user) throw new Error('Necesitás iniciar sesión para crear ofertas.');

  const { data, error } = await supabase
    .from(TABLE)
    .insert([{
      owner_id: user.id,
      title,
      description,
      category,
      location_hint: locationHint,
      duration_minutes: minutes,
      active: true,
      status: 'open'
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Listado con JOIN correcto:
 * FK: offers.owner_id -> profiles.id (usa el nombre REAL del constraint)
 * Si tu constraint se llama distinto, ajustá el sufijo !offers_owner_id_fkey
 */
export async function getOffers({ limit = 50, ownerId = null, category = null } = {}) {
  let query = supabase
    .from(TABLE)
    .select(`
      id, owner_id, title, description, category, location_hint,
      duration_minutes, active, status, created_at,
      author:profiles!offers_owner_id_fkey ( id, display_name )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (ownerId)  query = query.eq('owner_id', ownerId);
  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Tomar oferta (devuelve el exchange creado por el RPC)
 */
export async function takeOffer(offerId) {
  const { data, error } = await supabase.rpc('take_offer', { p_offer_id: offerId });
  if (error) throw error;
  return data;
}


export async function closeOffer(offerId) {
  const user = getState().currentUser;
  if (!user) throw new Error('Necesitás iniciar sesión.');
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'cancelled', active: false })
    .eq('id', offerId)
    .eq('owner_id', user.id)
    .eq('status', 'open')
    .select()
    .single();
  if (error) throw error;
  return data;
}