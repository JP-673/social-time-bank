// docs/src/dashboard.js
import { listenAuth, refreshUser, logout } from './auth.js';
import { bootUI } from './ui.js';
import * as Profiles from './profile.js';      // getProfileWithHood()
import { setState } from './state.js';
import { getBalance, getLedger } from './wallet.js';

// -------- utils --------
const $ = (idA, idB=null) => document.getElementById(idA) || (idB ? document.getElementById(idB) : null);
const gotoLanding = () => location.replace('index.html');
const escapeHtml = (s='') => s.replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const fmtH = (mins=0) => (mins/60).toFixed(2) + ' h';

// -------- sidebar renderers --------
async function renderSidebarProfile(user) {
  const $name = $('sbUserName','userName');
  const $hood = $('sbUserHood','userHood');
  const $bal  = $('sbHdrBalance','hdrBalance');

  try {
    const prof = await Profiles.getProfileWithHood(); // { display_name, hood:{ name } }
    if ($name) $name.textContent = prof?.display_name || user.email;
    if ($hood) $hood.textContent = prof?.hood?.name ? `(${prof.hood.name})` : '';
  } catch {
    if ($name) $name.textContent = user.email;
    if ($hood) $hood.textContent = '';
  }

try {
  const balHrs = (balMin ?? 0) / 60;
  const balFmt = balHrs % 1 === 0 ? balHrs.toFixed(0) : balHrs.toFixed(2);
  if ($bal) $bal.textContent = balFmt;
} catch {
  if ($bal) $bal.textContent = 0;
}


async function renderMiniLedger(user) {
  const wrap = $('miniLedger');
  if (!wrap) return;

  try {
    const ledger = await getLedger(user.id);
    if (!ledger?.length) {
      wrap.innerHTML = '<p class="muted">Sin movimientos.</p>';
      return;
    }
    wrap.innerHTML = ledger.slice(0, 6).map(tx => `
      <div class="tx">
        <div>
          <div>${escapeHtml(tx.note ?? '—')}</div>
          <small class="muted">${escapeHtml(tx.when ?? '')}</small>
        </div>
        <strong>${tx.delta > 0 ? '+' : ''}${fmtH(tx.delta)}</strong>
      </div>
    `).join('');
  } catch {
    wrap.innerHTML = '<p class="muted">No se pudo cargar.</p>';
  }
}

// -------- wiring --------
function wireSidebarLogout() {
  const btn = $('sbLogoutBtn','logoutBtn');
  btn?.addEventListener('click', async () => {
    await logout();
    setState({ currentUser: null });
    gotoLanding();
  }, { once:true });
}

function wireQuickActions() {
  document.querySelectorAll('.quick-actions [data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector(`.tabs .tab[data-tab="${btn.dataset.tab}"]`)?.click();
    });
  });
}

// -------- guard + boot --------
async function guard() {
  listenAuth();
  const user = await refreshUser();
  if (!user) { gotoLanding(); return null; }

  await renderSidebarProfile(user);
  await renderMiniLedger(user);
  wireSidebarLogout();
  wireQuickActions();

  return user;
}

window.addEventListener('DOMContentLoaded', async () => {
  const user = await guard();
  if (user) bootUI(); // enciende tabs/renderers
});
