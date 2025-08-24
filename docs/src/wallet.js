// docs/src/wallet.js
import { supabase } from './supabase.js'; // o './supabaseClient.js' si ese es tu archivo
import { $, toast } from './utils.js';

/**
 * Devuelve el saldo total del usuario en MINUTOS (como en tu DB).
 * Si preferís horas, transforma donde lo muestres.
 */
export async function getBalance(userId) {
  let uid = userId;
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser();
    uid = user?.id ?? null;
  }
  if (!uid) return 0;

  const { data, error } = await supabase
    .from('ledgers')
    .select('delta_minutes')
    .eq('user_id', uid);

  if (error) {
    console.error('getBalance error:', error);
    return 0;
  }
  return (data || []).reduce((acc, r) => acc + Number(r.delta_minutes || 0), 0);
}

/**
 * Devuelve el historial (ledger) del usuario en un formato amigable.
 * delta -> minutos (igual que en DB), quien consuma decide si lo muestra en horas.
 */
export async function getLedger(userId) {
  let uid = userId;
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser();
    uid = user?.id ?? null;
  }
  if (!uid) return [];

  const { data, error } = await supabase
    .from('ledgers')
    .select('id, delta_minutes, reason, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getLedger error:', error);
    return [];
  }
  return (data || []).map(r => ({
    id: r.id,
    delta: Number(r.delta_minutes || 0),           // minutos
    note: r.reason ?? '-',
    when: new Date(r.created_at).toLocaleString(),
  }));
}

/**
 * Render de la pestaña "Billetera" (usa las funciones de arriba)
 * Muestra saldo en HORAS (con dos decimales) y lista de movimientos.
 */
export async function renderWallet() {
  const balEl = $('walletBalance');
  const list  = $('ledgerList');

  if (!balEl || !list) return;

  // saldo total (minutos -> horas)
  const totalMin   = await getBalance();
  const totalHoras = (totalMin / 60).toFixed(2);

  balEl.textContent = totalHoras;
  const hdr = $('hdrBalance'); // por si querés reflejar en el header
  if (hdr) hdr.textContent = totalHoras;

  // historial
  const rows = await getLedger();
  if (!rows.length) {
    list.innerHTML = '<div class="muted">Sin movimientos.</div>';
    return;
  }

  list.innerHTML = '';
  rows.forEach(l => {
    const h = (l.delta / 60).toFixed(2);
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <div>${l.note}</div>
      <div ${l.delta < 0 ? 'style="color:#f19999"' : ''}>
        ${l.delta >= 0 ? '+' : ''}${h} h
      </div>
    `;
    list.appendChild(item);
  });
}
