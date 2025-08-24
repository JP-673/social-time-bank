// /src/index.js (lógica de la landing)
import { listenAuth, refreshUser, signIn, register } from './auth.js';

const $ = (id) => document.getElementById(id);
const msg = (t)=> { const m=$('msg'); if (m) m.textContent = t || ''; };

function toDashboard() { location.href = './dashboard.html'; }

function deriveDisplayName(email){
  const local = (email || '').split('@')[0] || 'Usuario';
  // Capitaliza algo básico: "juan.perez" -> "Juan Perez"
  return local.replace(/[._-]+/g,' ')
              .split(' ')
              .filter(Boolean)
              .map(s => s.charAt(0).toUpperCase() + s.slice(1))
              .join(' ');
}

window.addEventListener('DOMContentLoaded', async () => {
  listenAuth();

  // Si ya está logueado, vamos directo
  const user = await refreshUser();
  if (user) { toDashboard(); return; }

  const form = $('loginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg('Ingresando…');
    try {
      await signIn(form.email.value.trim(), form.password.value.trim());
      toDashboard();
    } catch (e) {
      msg(e?.message || String(e));
    }
  });

  $('registerBtn').addEventListener('click', async () => {
    const email = form.email.value.trim();
    const password = form.password.value.trim();
    if (!email || !password) { msg('Completá email y contraseña.'); return; }

    // 1) intentá tomar un input #signupDisplay si existiera en el HTML
    let displayNameEl = $('signupDisplay');
    let displayName = displayNameEl?.value?.trim();

    // 2) si no existe o está vacío, pedilo con prompt
    if (!displayName) {
      const suggested = deriveDisplayName(email);
      displayName = (prompt('Elegí tu nombre visible:', suggested) || '').trim();
      if (!displayName) displayName = suggested; // 3) fallback: derivado del email
    }

    msg('Creando cuenta…');
    try {
      // register debe aceptar (email, password, displayName)
      await register(email, password, displayName);
      msg('Cuenta creada. Revisá tu email y luego iniciá sesión.');
    } catch (e) {
      msg(e?.message || String(e));
    }
  });
});
