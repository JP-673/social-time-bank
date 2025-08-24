// docs/src/dashboard.js
import { supabase } from './supabaseClient.js';
import { getCurrentUser } from './auth.js';
import * as Profile from './profile.js';
import * as Offers from './offers.js';
import * as Exchanges from './exchanges.js';
import { getBalance, getLedger } from './wallet.js';

// util chico
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmtH = mins => ((mins ?? 0)/60).toFixed(2);

export async function initDashboard() {
  // pinta header (nombre, barrio, saldo)
  const user = await getCurrentUser();
  if (!user) return; // controls.js se encarga de redirigir si no hay sesión

  try {
    const prof = await Profile.getProfileWithHood(); // { id, display_name, hood:{name} }
    document.getElementById('sbUserName')?.replaceChildren(document.createTextNode(prof?.display_name || user.email));
    document.getElementById('sbUserHood')?.replaceChildren(document.createTextNode(prof?.hood?.name ? `(${prof.hood.name})` : ''));
  } catch {}
  try {
    const balMin = await getBalance(user.id);
    document.getElementById('sbHdrBalance')?.replaceChildren(document.createTextNode(String(fmtH(balMin))));
    document.getElementById('walletBalance')?.replaceChildren(document.createTextNode(String(fmtH(balMin))));
  } catch {
    document.getElementById('sbHdrBalance')?.replaceChildren(document.createTextNode('0'));
  }
  // mini ledger
  try {
    const ledger = await getLedger(user.id);
    const wrap = document.getElementById('miniLedger');
    if (wrap) {
      wrap.innerHTML = ledger?.length
        ? ledger.slice(0,6).map(tx => `
            <div class="tx">
              <div>
                <div>${esc(tx.note ?? '—')}</div>
                <small class="muted">${esc(tx.when ?? '')}</small>
              </div>
              <strong>${tx.delta>0?'+':''}${fmtH(tx.delta)} h</strong>
            </div>`).join('')
        : '<p class="muted">Sin movimientos.</p>';
    }
  } catch {
    const wrap = document.getElementById('miniLedger');
    if (wrap) wrap.innerHTML = '<p class="muted">No se pudo cargar.</p>';
  }

  // muestra tab inicial (no agrega listeners)
  await showTab('active');
}

export async function showTab(name) {
  const panes = {
    active:     document.getElementById('pane-active'),
    mine:       document.getElementById('pane-mine'),
    exchanges:  document.getElementById('pane-exchanges'),
    create:     document.getElementById('pane-create'),
    orders:     document.getElementById('pane-orders'),
    wallet:     document.getElementById('pane-wallet'),
  };
  Object.values(panes).forEach(p => p && (p.hidden = true));

  const target = panes[name] || panes.active;
  if (!target) return;

  try {
    if (name === 'active')        await renderActiveOffers(target);
    else if (name === 'mine')     await renderMyOffers(target);
    else if (name === 'exchanges')await renderMyExchanges(target);
    else if (name === 'orders')   await renderOrders(target);
    else if (name === 'wallet')   await renderWallet(target);
    // 'create' no requiere fetch
  } catch (e) {
    console.error('[dashboard] showTab error', e);
    target.innerHTML = `<p>Error: ${esc(e?.message || e)}</p>`;
  }
  target.hidden = false;
}

/* --------- renders --------- */

async function renderActiveOffers(pane) {
  pane.innerHTML = 'Cargando…';
  const rows = await Offers.getOffers({});          // ajusta tu getOffers
  const open = (rows||[]).filter(r => r.status === 'open');

  if (!open.length) { pane.innerHTML = '<p class="muted">No hay ofertas abiertas.</p>'; return; }

  pane.innerHTML = `<div class="grid cols-2"></div>`;
  const grid = pane.querySelector('.grid');

  for (const o of open) {
    const author = o.author?.display_name || o.owner_id?.slice(0,8) || '—';
    grid.insertAdjacentHTML('beforeend', `
      <article class="offer">
        <header><strong>${esc(o.title)}</strong> · <small>${o.duration_minutes ?? 0} min</small></header>
        <p>${esc(o.description ?? '')}</p>
        <footer class="row end">
          <small>${esc(author)}</small>
          <button class="btn take" data-offer-id="${o.id}" data-owner-id="${o.owner_id}" type="button">Tomar</button>
        </footer>
      </article>`);
  }
}

async function renderMyOffers(pane) {
  pane.innerHTML = 'Cargando…';
  const me = (await getCurrentUser())?.id;
  if (!me) { pane.innerHTML = '<p>Sin sesión.</p>'; return; }

  const rows = await Offers.getOffers({ ownerId: me });
  if (!rows?.length) { pane.innerHTML = '<p>Todavía no creaste ofertas.</p>'; return; }

  pane.innerHTML = `<div class="grid cols-2"></div>`;
  const grid = pane.querySelector('.grid');
  for (const o of rows) {
    const canClose = o.status === 'open';
    grid.insertAdjacentHTML('beforeend', `
      <article class="offer">
        <header><strong>${esc(o.title)}</strong> · <small>${o.duration_minutes ?? 0} min</small> · <em>${esc(o.status)}</em></header>
        <p>${esc(o.description ?? '')}</p>
        ${canClose ? `<div class="end"><button class="btn ghost close-offer" data-offer-id="${o.id}" type="button">Cerrar</button></div>` : ''}
      </article>`);
  }
}

async function renderMyExchanges(pane) {
  pane.innerHTML = 'Cargando…';
  const rows = await Exchanges.getMyExchanges({});
  if (!rows?.length) { pane.innerHTML = '<p class="muted">Sin intercambios por ahora.</p>'; return; }

  pane.innerHTML = `<div class="list"></div>`;
  const list = pane.querySelector('.list');

  for (const x of rows) {
    list.insertAdjacentHTML('beforeend', `
      <article class="xchg">
        <header><strong>${esc(x?.offers?.title ?? '(sin título)')}</strong> · <small>${x.minutes ?? x?.offers?.duration_minutes ?? 0} min</small></header>
        <p>Estado: <em>${esc(x.status)}</em></p>
      </article>`);
  }
}

async function renderOrders(pane) {
  pane.innerHTML = 'Cargando…';
  const rows = await Exchanges.getMyExchanges({}) || [];
  if (!rows.length) { pane.innerHTML = '<p>No tenés órdenes por ahora.</p>'; return; }

  pane.innerHTML = `<div class="list"></div>`;
  const list = pane.querySelector('.list');

  for (const x of rows) {
    const actions = [];
    if (x.status === 'pending') actions.push('accept','cancel');
    if (x.status === 'accepted') actions.push('complete','cancel','noshow');

    const buttons = actions.map(a => `<button class="btn sm" data-action="${a}" data-id="${x.id}" ${a==='noshow' ? `data-against="${x.requester_id || x.provider_id}"`:''} type="button">${a}</button>`).join(' ');

    list.insertAdjacentHTML('beforeend', `
      <article class="xchg">
        <header style="display:flex;justify-content:space-between;gap:.5rem;align-items:center">
          <div><strong>${esc(x?.offers?.title ?? '(sin título)')}</strong> · <small>${x.minutes ?? x?.offers?.duration_minutes ?? 0} min</small></div>
          <em>${esc(x.status)}</em>
        </header>
        <div class="row end">${buttons}</div>
      </article>`);
  }
}

async function renderWallet(pane) {
  // ya pintamos saldo arriba; acá podrías listar movimientos completos
  pane.querySelector('#ledgerList')?.replaceChildren(document.createTextNode('Pronto…'));
}
