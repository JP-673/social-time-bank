// src/index.js (lógica de la landing)
import { listenAuth, refreshUser, signIn, register } from './auth.js';

const msg = (t)=> document.getElementById('msg').textContent = t || '';

window.addEventListener('DOMContentLoaded', async () => {
  listenAuth();
  const user = await refreshUser();
  if (user) { location.href = 'dashboard.html'; return; }

  const form = document.getElementById('loginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg('Ingresando…');
    try {
      await signIn(form.email.value.trim(), form.password.value.trim());
      location.href = '/dashboard.html';
    } catch (e) { msg(e?.message || String(e)); }
  });
  document.getElementById('registerBtn').addEventListener('click', async () => {
    msg('Creando cuenta…');
    try {
      await register(form.email.value.trim(), form.password.value.trim());
      msg('Cuenta creada. Revisá tu email y luego iniciá sesión.');
    } catch (e) { msg(e?.message || String(e)); }
  });
});
