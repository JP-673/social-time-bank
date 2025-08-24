// /src/offers.js
import { supabase } from './supabaseClient.js';

const TABLE = 'offers';

// Espera hasta 2.5s a que la sesión esté hidratada (evita falsos "no logeado")
async function waitUserId(maxMs = 2500) {
  const t0 = performance.now();
  for (;;) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (user?.id) return user.id;
    if (error) console.warn('[offers] getUser error (retry)', error);
    if (performance.now() - t0 > maxMs) return null;
    await new Promise(r => setTimeout(r, 120));
  }
}

/** Crear/publicar oferta */
export async function createOffer({
  title,
  minutes,            // number
  description = '',
  category = null,
  locationHint = null
}) {
  const owner_id = await waitUserId();
  if (!owner_id) throw new Error('Necesitás iniciar sesión para crear ofertas.');

  const row = {
    owner_id,
    title: (title || '').trim(),
    description: (description || '').trim(),
    category,
    location_hint: locationHint,
    duration_minutes: Number(minutes) || 0,
    active: true,
    status: 'open'
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert([row])
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

/** Listar ofertas (con JOIN a profiles) */
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
  // normaliza para que dashboard.js pueda usar o.author.display_name
  return (data || []).map(o => ({ ...o, author: o.author || null }));
}

/** Tomar oferta (usa RPC) */
export async function takeOffer(offerId) {
  const { data, error } = await supabase.rpc('take_offer', { p_offer_id: offerId });
  if (error) throw error;
  return data;
}

/** Cerrar oferta propia */
export async function closeOffer(offerId) {
  const owner_id = await waitUserId();
  if (!owner_id) throw new Error('Necesitás iniciar sesión.');

  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'cancelled', active: false })
    .eq('id', offerId)
    .eq('owner_id', owner_id)
    .eq('status', 'open')
    .select('id, status')
    .single();

  if (error) throw error;
  return data;
}
