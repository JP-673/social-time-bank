// /src/ui.js
import { signIn, register, logout } from './auth.js';
import * as Offers from './offers.js';
import * as Exchanges from './exchanges.js';
import { getState, subscribe } from './state.js';
import { renderWallet as renderWalletLegacy } from './wallet.js';

export function bootUI() {
  wireAuth();
  wireTabs();

  // wire del botón "Publicar" (tab Crear oferta)
  const $offerBtn = document.querySelector('#offerBtn');
  if ($offerBtn) $offerBtn.addEventListener('click', onCreateOffer);

  // Mostrar login o dashboard según sesión
  subscribe(() => {
    const { currentUser } = getState();

    // bridge para wallet.js (usa window.state.me.id)
    window.state = window.state || {};
    window.state.me = currentUser ? { id: currentUser.id } : null;

    const $form = document.querySelector('#loginForm');
    const $dash = document.querySelector('#dashboard');
    const $user = document.querySelector('#userName');

    if ($user) $user.textContent = currentUser?.email ?? 'Invitado';
    if ($form) $form.hidden = !!currentUser;
    if ($dash) $dash.hidden = !currentUser;

    if (currentUser && !document.body.dataset.dashBooted) {
      document.body.dataset.dashBooted = '1';
      showTab('active');
    }
  });
}

/* Tabs */
function wireTabs() {
  document.querySelectorAll('.tabs .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabs .tab').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      showTab(btn.dataset.tab);
    });
  });
}

async function showTab(name) {
  const panes = {
    active:    document.querySelector('#pane-active'),
    mine:      document.querySelector('#pane-mine'),
    exchanges: document.querySelector('#pane-exchanges'),
    create:    document.querySelector('#pane-create'),
    wallet:    document.querySelector('#pane-wallet'),
    orders:    document.querySelector('#pane-orders'),
  };
  Object.values(panes).forEach(p => p && (p.hidden = true));
  const pane = panes[name];
  if (!pane) return;

  if (name === 'active')         await renderActiveOffers(pane);
  else if (name === 'mine')      await renderMyOffers(pane);
  else if (name === 'exchanges') await renderMyExchanges(pane);
  else if (name === 'wallet')    await renderWalletLegacy();
  else if (name === 'orders')    await renderOrders(pane);

  pane.hidden = false;
}

/* Renderers */
async function renderActiveOffers(pane) {
  pane.innerHTML = 'Cargando…';
  try {
    const rows = await Offers.getOffers({});
    const open = rows.filter(r => r.status === 'open');
    if (!open.length) { pane.innerHTML = '<p>No hay ofertas abiertas.</p>'; return; }

    pane.innerHTML = `<div class="grid cols-2"></div>`;
    const grid = pane.querySelector('.grid');
    const me = getState().currentUser?.id;

    for (const off of open) {
      const isOwner = off.owner_id === me;
      const name = off?.author?.display_name ?? off.owner_id?.slice(0,8) ?? 'anon';

      grid.appendChild(el(`
        <article class="offer">
          <header><strong>${esc(off.title)}</strong> · <small>${off.duration_minutes ?? 0} min</small></header>
          <p>${esc(off.description ?? '')}</p>
          <footer style="display:flex;justify-content:space-between;align-items:center;gap:.5rem">
            <small>${esc(name)}</small>
            ${isOwner
              ? `<button class="close-offer" data-id="${off.id}">Cerrar</button>`
              : `<button class="take" data-id="${off.id}">Tomar</button>`}
          </footer>
        </article>
      `));
    }

    // handler para tomar
    grid.querySelectorAll('button.take').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await Offers.takeOffer(btn.dataset.id);
          toast('Intercambio creado');
          showTab('active');
        } catch (e) { toast(msg(e)); }
      });
    });

    // handler para cerrar (usa Offers.closeOffer del módulo offers.js)
    grid.querySelectorAll('button.close-offer').forEach(btn => {
      btn.addEventListener('click', async () => {
        const reason = prompt('Motivo para cerrar (opcional)') || null;
        try {
          await Offers.closeOffer(btn.dataset.id, reason);
          toast('Oferta cerrada');
          showTab('active');
        } catch (e) { toast(msg(e)); }
      });
    });

  } catch (e) {
    pane.innerHTML = `<p>Error: ${esc(msg(e))}</p>`;
  }
}

async function renderMyOffers(pane) {
  const me = getState().currentUser;
  pane.innerHTML = 'Cargando…';
  try {
    const rows = await Offers.getOffers({ ownerId: me.id });
    if (!rows.length) { pane.innerHTML = '<p>Todavía no creaste ofertas.</p>'; return; }
    pane.innerHTML = `<div class="grid cols-2"></div>`;
    const grid = pane.querySelector('.grid');
    for (const off of rows) {
      const canClose = off.status === 'open';
      const card = el(`
        <article class="offer">
          <header><strong>${esc(off.title)}</strong> · <small>${off.duration_minutes ?? 0} min</small> · <em>${esc(off.status)}</em></header>
          <p>${esc(off.description ?? '')}</p>
          ${canClose ? `<div style="text-align:right"><button class="close-offer" data-id="${off.id}">Cerrar</button></div>` : ''}
        </article>
      `);
      grid.appendChild(card);
    }
    grid.querySelectorAll('button.close-offer').forEach(btn => {
      btn.addEventListener('click', async () => {
        const reason = prompt('Motivo para cerrar (opcional)') || null;
        try {
          await Offers.closeOffer(btn.dataset.id, reason);
          toast('Oferta cerrada');
          await renderMyOffers(pane);
        } catch (e) { toast(msg(e)); }
      });
    });
  } catch (e) { pane.innerHTML = `<p>Error: ${esc(msg(e))}</p>`; }
}

async function renderMyExchanges(pane) {
  pane.innerHTML = 'Cargando…';
  try {
    const rows = await Exchanges.getMyExchanges({});
    if (!rows.length) { pane.innerHTML = '<p>Sin intercambios por ahora.</p>'; return; }
    pane.innerHTML = `<div class="grid"></div>`;
    const grid = pane.querySelector('.grid');
    for (const x of rows) {
      const role = who(x);
      grid.appendChild(el(`
        <article class="xchg">
          <header><strong>${esc(x?.offers?.title ?? '(sin título)')}</strong> · <small>${x.minutes ?? x?.offers?.duration_minutes ?? 0} min</small></header>
          <p>Estado: <em>${esc(x.status)}</em> · Rol: ${role}</p>
        </article>
      `));
    }
  } catch (e) { pane.innerHTML = `<p>Error: ${esc(msg(e))}</p>`; }
}

async function renderOrders(pane) {
  pane.innerHTML = 'Cargando…';
  try {
    const rows = await Exchanges.getMyExchanges({});
    if (!rows.length) { pane.innerHTML = '<p>No tenés órdenes por ahora.</p>'; return; }

    const rank = { pending:1, accepted:2, completed:3, cancelled:4, no_show:5 };
    rows.sort((a,b)=>(rank[a.status]||99)-(rank[b.status]||99));

    pane.innerHTML = `<div class="grid"></div>`;
    const grid = pane.querySelector('.grid');

    for (const x of rows) {
      const me = getState().currentUser?.id;
      const role = (x.provider_id === me) ? 'Proveedor' :
                   (x.requester_id === me) ? 'Solicitante' : 'Otro';
      const title = esc(x?.offers?.title ?? '(sin título)');
      const mins  = x.minutes ?? x?.offers?.duration_minutes ?? 0;
      const status = x.status;

      const actions = [];
      if (status === 'pending') {
        if (role === 'Proveedor') actions.push(['accept','Aceptar'], ['cancel','Cancelar']);
        if (role === 'Solicitante') actions.push(['cancel','Cancelar']);
      } else if (status === 'accepted') {
        actions.push(['complete','Completar'], ['cancel','Cancelar']);
        const against = role === 'Proveedor' ? x.requester_id : x.provider_id;
        actions.push(['noshow','No-show', against]);
      }

      const card = el(`
        <article class="xchg">
          <header style="display:flex;justify-content:space-between;gap:.5rem;align-items:center">
            <div><strong>${title}</strong> · <small>${mins} min</small></div>
            <em>${esc(status)}</em>
          </header>
          <p>Rol: ${role}</p>
          <div class="row" data-actions></div>
        </article>
      `);
      const row = card.querySelector('[data-actions]');

      actions.forEach(([key,label,against]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.dataset.action = key;
        b.dataset.id = x.id;
        if (key === 'noshow') b.dataset.against = against;
        row.appendChild(b);
      });

      grid.appendChild(card);
    }

    grid.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        try {
          if (action === 'accept')        await Exchanges.acceptExchange(id);
          else if (action === 'complete') await Exchanges.completeExchange(id);
          else if (action === 'cancel')   await Exchanges.cancelExchange(id, prompt('Motivo (opcional)') || '');
          else if (action === 'noshow')   await Exchanges.markNoShow(id, btn.dataset.against);

          toast(`Acción ${action} ejecutada`);
          await renderOrders(pane);
        } catch (e) { toast(msg(e)); }
      });
    });

  } catch (e) {
    pane.innerHTML = `<p>Error: ${esc(msg(e))}</p>`;
  }
}

function who(x) {
  const me = getState().currentUser?.id;
  if (!me) return '—';
  if (x.provider_id === me) return 'Proveedor';
  if (x.requester_id === me) return 'Solicitante';
  return '—';
}

/* Crear oferta dentro del tab */
async function onCreateOffer() {
  const title = document.querySelector('#title')?.value?.trim();
  const minutes = Number(document.querySelector('#minutes')?.value || '0');
  const description = document.querySelector('#desc')?.value || '';
  const category = document.querySelector('#category')?.value || null;
  const locationHint = document.querySelector('#location')?.value || null;
  try {
    if (!title) throw new Error('Falta el título');
    if (!minutes || minutes <= 0) throw new Error('Minutos inválidos');
    await Offers.createOffer({ title, minutes, description, category, locationHint });
    toast('Oferta creada');
    ['#title','#minutes','#desc','#category','#location'].forEach(s => { const n=document.querySelector(s); if(n) n.value=''; });
    await showTab('mine');
  } catch (e) { toast(msg(e)); }
}

/* Auth wiring */
function wireAuth() {
  const $form = document.querySelector('#loginForm');
  if ($form) $form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.querySelector('#email')?.value?.trim();
    const pass  = document.querySelector('#password')?.value?.trim();
    try { await signIn(email, pass); toast('Sesión iniciada'); }
    catch (e) { toast(msg(e)); }
  });

  const $register = document.querySelector('#registerBtn');
  if ($register) $register.addEventListener('click', async () => {
    const email = document.querySelector('#email')?.value?.trim();
    const pass  = document.querySelector('#password')?.value?.trim();
    try { await register(email, pass); toast('Cuenta creada. Revisá tu email.'); }
    catch (e) { toast(msg(e)); }
  });

  const $logout = document.querySelector('#logoutBtn');
  if ($logout) $logout.addEventListener('click', async () => {
    try { await logout(); toast('Sesión cerrada'); }
    catch (e) { toast(msg(e)); }
  });
}

/* Utils */
function el(str){ const t=document.createElement('template'); t.innerHTML=str.trim(); return t.content.firstElementChild; }
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function msg(e){ return e?.message ?? String(e); }
function toast(txt){ const t=document.querySelector('#toast'); if(!t) return; t.textContent=String(txt); t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1600); }
