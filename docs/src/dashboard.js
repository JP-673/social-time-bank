// docs/src/dashboard.js
import { listenAuth, refreshUser, logout } from './auth.js';
import { bootUI } from './ui.js';
import * as Profiles from './profile.js';   // tu helper actual
import { setState } from './state.js';
import { getBalance, getLedger } from './wallet.js'; // para saldo y movimientos

function gotoLanding() { location.replace('index.html'); }

// ----- Sidebar renderers -----
async function renderSidebarProfile(user) {
  const $name = document.getElementById('sbUserName');
  const $hood = document.getElementById('sbUserHood');
  const $bal  = document.getElementById('sbHdrBalance');

  // nombre + hood (desde profiles si existe, si no fallback a email)
  try {
    const prof = await Profiles.getProfileWithHood(); // { display_name, hood:{name} }
    $name.textContent = prof?.display_name || user.email;
    $hood.textContent = prof?.hood?.name ? `(${prof.hood.name})` : '';
  } catch {
    $name.textContent = user.email;
    $hood.textContent = '';
  }

  // saldo
  try {
    const bal = await getBalance(user.id); // minutos o horas según tu impl
    $bal.textContent = bal ?? 0;
  } catch {
    $bal.textContent = 0;
  }
}

async function renderMiniLedger(user) {
  const wrap = document.getElementById('miniLedger');
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
        <strong>${tx.delta > 0 ? '+' : ''}${formatHours(tx.delta)}</strong>
      </div>
    `).join('');
  } catch {
    wrap.innerHTML = '<p class="muted">No se pudo cargar.</p>';
  }
}

function escapeHtml(s=''){
  return s.replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}
function formatHours(deltaMinutes=0){
  // si delta está en minutos en tu backend:
  const h = (deltaMinutes/60);
  return `${h>0?'+':''}${h.toFixed(2)} h`.replace('++','+');
}

// ----- UI wiring -----
function wireSidebarLogout() {
  document.getElementById('sbLogoutBtn')?.addEventListener('click', async () => {
    await logout();
    setState({ currentUser: null });
    gotoLanding();
  });
}

function wireQuickActions() {
  document.querySelectorAll('.quick-actions [data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelector(`.tabs .tab[data-tab="${tab}"]`)?.click();
    });
  });
}

// ----- Guard + boot -----
async function guard() {
  listenAuth();
  const user = await refreshUser();
  if (!user) { gotoLanding(); return null; }

  // Sidebar profile + ledger
  await renderSidebarProfile(user);
  await renderMiniLedger(user);

  // Logout (sidebar)
  wireSidebarLogout();
  // Accesos rápidos → tabs
  wireQuickActions();

  return user;
}

window.addEventListener('DOMContentLoaded', async () => {
  const user = await guard();
  if (user) bootUI(); // enciende tabs/renderers existentes
});
