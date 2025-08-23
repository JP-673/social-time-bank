import { $, toast } from './utils.js';
import { refreshOffers } from './offers.js';
import { renderProfile } from './profile.js';
import { renderWallet } from './wallet.js';
import { renderExchanges } from './exchanges.js';

export function wireNav(){
  document.querySelectorAll('#mainTabs button')
    .forEach(b => b.onclick = () => setView(b.dataset.view));
}

export function setView(v){
  console.log('[setView]', v);
  const views = ['login','market','new-offer','exchanges','wallet','profile'];
  views.forEach(name=>{
    const el = $(`view-${name}`);
    if (!el) return;
    el.style.display = (name===v) ? 'block' : 'none';
    el.classList.toggle('hidden', name!==v);
  });
  if (v==='market') refreshOffers();
  if (v==='profile') renderProfile();
  if (v==='wallet')  renderWallet();
  if (v==='exchanges') renderExchanges();
}

export async function afterLogin(){
  // encender UI superior
  $('mainTabs')?.classList.remove('hidden');
  $('badgeWallet')?.classList.remove('hidden');
  $('btnLogout')?.classList.remove('hidden');
  $('currentUserName').textContent = window.state.profile?.display_name || window.state.me?.email || '';
  setView('market');
}
