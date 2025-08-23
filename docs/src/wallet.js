// /src/wallet.js
import { supabase } from './supabase.js';
import { $, toast } from './utils.js';

export async function renderWallet() {
  const balEl = $('walletBalance');
  const list  = $('ledgerList');
  const meId  = window.state?.me?.id;

  if (!balEl || !list || !meId) return;

  const { data: rows, error } = await supabase
    .from('ledgers')
    .select('*')
    .eq('user_id', meId)
    .order('created_at', { ascending: false });

  if (error) {
    list.innerHTML = `<div class="muted">${error.message}</div>`;
    return;
  }

  // saldo total (minutos → horas)
  const totalMin   = (rows || []).reduce((a, x) => a + Number(x.delta_minutes || 0), 0);
  const totalHoras = (totalMin / 60).toFixed(2);

  balEl.textContent = totalHoras;
  const hdr = $('hdrBalance');
  if (hdr) hdr.textContent = totalHoras;

  // historial
  list.innerHTML = '';
  (rows || []).forEach(l => {
    const h = (Number(l.delta_minutes || 0) / 60).toFixed(2);
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <div>${l.reason ?? '-'}</div>
      <div class="${l.delta_minutes < 0 ? 'danger' : ''}">
        ${l.delta_minutes >= 0 ? '+' : ''}${h} h
      </div>
    `;
    list.appendChild(item);
  });
}
