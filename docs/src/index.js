// /src/index.js (landing)
import { listenAuth, refreshUser, signIn, register } from './auth.js';

const $ = (id) => document.getElementById(id);
const showMsg = (id, t='') => { const el = $(id); if (el) el.textContent = t; };
const toDash = () => { location.href = './dashboard.html'; };

function deriveDisplayName(email){
  const local = (email || '').split('@')[0] || 'Usuario';
  return local.replace(/[._-]+/g,' ')
              .split(' ')
              .filter(Boolean)
              .map(s => s.charAt(0).toUpperCase() + s.slice(1))
              .join(' ');
}

window.addEventListener('DOMContentLoaded', async () => {
  listenAuth();
  const user = await refreshUser();
  if (user) { toDash(); return; }

  // ===== Variante A: formulario de LOGIN (si existe) =====
  const loginForm = $('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showMsg('msgLogin','Ingresando…'); // si no existe, no pasa nada
      try {
        await signIn(loginForm.loginEmail?.value?.trim() ?? loginForm.email?.value?.trim(),
                     loginForm.loginPassword?.value ?? loginForm.password?.value);
        toDash();
      } catch (err) {
        showMsg('msgLogin', err?.message || String(err));
        showMsg('msg', err?.message || String(err)); // compat con tu msg original
      }
    });
  }

  // ===== Variante A-1: botón "Crear cuenta" dentro del mismo form (si existe) =====
  const registerBtn = $('registerBtn');
  if (registerBtn && loginForm) {
    registerBtn.addEventListener('click', async () => {
      const email = (loginForm.email?.value || loginForm.loginEmail?.value || '').trim();
      const password = (loginForm.password?.value || loginForm.loginPassword?.value || '');
      if (!email || !password) { showMsg('msg','Completá email y contraseña.'); return; }

      // intenta leer displayName si hay un input con ese id
      let displayName = $('signupDisplay')?.value?.trim();
      if (!displayName) {
        const suggested = deriveDisplayName(email);
        displayName = (prompt('Elegí tu nombre visible:', suggested) || '').trim() || suggested;
      }

      showMsg('msg','Creando cuenta…');
      try {
        await register(email, password, displayName); // tu auth.js debe aceptar el 3er arg
        showMsg('msg','Cuenta creada. Revisá tu email y luego iniciá sesión.');
      } catch (err) {
        showMsg('msg', err?.message || String(err));
      }
    });
  }

  // ===== Variante B: formulario de SIGNUP separado (si existe) =====
  const signupForm = $('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (signupForm.signupEmail?.value || signupForm.email?.value || '').trim();
      const password = (signupForm.signupPassword?.value || signupForm.password?.value || '');
      let displayName = (signupForm.signupDisplay?.value || '').trim() || deriveDisplayName(email);

      showMsg('msgSignup','Creando cuenta…');
      try {
        await register(email, password, displayName);
        showMsg('msgSignup','Cuenta creada. Revisá tu correo y luego iniciá sesión.');
      } catch (err) {
        showMsg('msgSignup', err?.message || String(err));
      }
    });
  }
});
