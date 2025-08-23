// docs/src/dashboard.js
import { listenAuth, refreshUser, logout } from './auth.js';
import { bootUI } from './ui.js';
import * as Profiles from './profiles.js';
import { setState } from './state.js';

function gotoLanding() { location.replace('index.html'); }

async function guard() {
  listenAuth();
  const user = await refreshUser();
  if (!user) { gotoLanding(); return false; }

  // Header: nombre y barrio
  const $user = document.getElementById('userName');
  const $hood = document.getElementById('userHood');
  try {
    const prof = await Profiles.getProfileWithHood();
    if (prof) {
      $user.textContent = prof.display_name || user.email;
      $hood.textContent = prof.hood?.name ? `(${prof.hood.name})` : '';
    } else {
      $user.textContent = user.email;
      $hood.textContent = '';
    }
  } catch {
    $user.textContent = user.email;
    $hood.textContent = '';
  }

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await logout();
    setState({ currentUser: null });
    gotoLanding();
  });

  return true;
}

window.addEventListener('DOMContentLoaded', async () => {
  const ok = await guard();
  if (ok) bootUI(); // esto enciende tus tabs y renderers
});
