// docs/src/controls.js
import { logout } from './auth.js';
import * as Offers from './offers.js';
import * as Exchanges from './exchanges.js';
import { getCurrentUser, refreshUser } from './auth.js';
import { initDashboard } from './dashboard.js';

const $ = s => document.querySelector(s);

function gotoLogin() { location.replace('login.html'); }

function wireTabs() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.tabs .tab');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();

    document.querySelectorAll('.tabs .tab').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    const name = btn.dataset.tab;
    showTab(name);
  });
}

function wireLogout() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('#logoutBtn,[data-action="logout"]');
    if (!btn) return;
    try { await logout(); } catch (err) { console.warn('logout error', err); }
    // limpieza mínima
    Object.keys(localStorage).forEach(k => { if (k.startsWith('sb-')) localStorage.removeItem(k); });
    Object.keys(sessionStorage).forEach(k => { if (k.startsWith('sb-')) sessionStorage.removeItem(k); });
    gotoLogin();
  });
}

function wireOfferForm() {
  const btn = $('#offerBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const title = $('#title')?.value?.trim();
    const minutes = Number($('#minutes')?.value || '0');
    const description = $('#desc')?.value || '';
    const category = $('#category')?.value || null;
    const locationHint = $('#location')?.value || null;

    if (!title) return alert('Falta el título');
    if (!minutes || minutes <= 0) return alert('Minutos inválidos');

    try {
      await Offers.createOffer({ title, minutes, description, category, locationHint });
      alert('Oferta creada');
      ['#title','#minutes','#desc','#category','#location'].forEach(s=>{ const n=$(s); if(n) n.value=''; });
      await showTab('mine');
    } catch (e) {
      console.error('[controls] create offer', e);
      alert(e?.message || 'Error creando oferta');
    }
  });
}

function wireDynamicActions() {
  document.addEventListener('click', async (e) => {
    // tomar oferta
    const take = e.target.closest('button.take[data-offer-id]');
    if (take) {
      try { await Offers.takeOffer(take.dataset.offerId); alert('Intercambio creado'); await showTab('active'); }
      catch (err) { alert(err?.message || 'Error'); }
      return;
    }
    // cerrar oferta
    const close = e.target.closest('button.close-offer[data-offer-id]');
    if (close) {
      const reason = prompt('Motivo para cerrar (opcional)') || null;
      try { await Offers.closeOffer(close.dataset.offerId, reason); alert('Oferta cerrada'); await showTab('mine'); }
      catch (err) { alert(err?.message || 'Error'); }
      return;
    }
    // acciones de órdenes
    const act = e.target.closest('button[data-action][data-id]');
    if (act && act.dataset.action) {
      const id = act.dataset.id;
      try {
        if (act.dataset.action === 'accept')        await Exchanges.acceptExchange(id);
        else if (act.dataset.action === 'complete') await Exchanges.completeExchange(id);
        else if (act.dataset.action === 'cancel')   await Exchanges.cancelExchange(id, prompt('Motivo (opcional)') || '');
        else if (act.dataset.action === 'noshow')   await Exchanges.markNoShow(id, act.dataset.against);
        alert(`Acción ${act.dataset.action} ejecutada`);
        await showTab('orders');
      } catch (err) {
        alert(err?.message || 'Error');
      }
    }
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  // 1) Listeners primero (no dependen del user)
  wireTabs();
  wireLogout();
  wireOfferForm();
  wireDynamicActions();

  // 2) Guard de sesión (antes de render)
  let user = await getCurrentUser();
  if (!user) {
    // pequeño retry por la hidratación de Supabase
    await new Promise(r => setTimeout(r, 120));
    user = await refreshUser();
  }
  if (!user) {
    location.replace('login.html');
    return;
  }

  // 3) Render de datos (una sola vez)
  await initDashboard();
});