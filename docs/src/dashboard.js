// src/dashboard.js
import { listenAuth, refreshUser, logout } from './auth.js';
import { bootUI } from './ui-dashboard.js';
import * as Profiles from './profiles.js';
import { setState } from './state.js';

const guard = async () => {
  listenAuth();
  const user = await refreshUser();
  if (!user) { location.replace('index.html'); return false; }

  // pinta header con nombre/hood
  const $user = document.getElementById('userName');
  const $hood = document.getElementById('userHood');
  const prof = await Profiles.getProfileWithHood().catch(()=>null);
  if (prof) {
    $user.textContent = prof.display_name || user.email;
    $hood.textContent = prof.hood?.name ? `(${prof.hood.name})` : '';
  } else {
    $user.textContent = user.email;
    $hood.textContent = '';
  }

  // botón salir
  document.getElementById('logoutBtn')?.addEventListener('click', async ()=>{
    await logout();
    setState({ currentUser: null });
    location.replace('/index.html');
  });

  return true;
};

window.addEventListener('DOMContentLoaded', async () => {
  const ok = await guard();
  if (ok) bootUI(); // tu UI de tabs renderActiveOffers etc.
});
