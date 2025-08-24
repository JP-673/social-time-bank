// /src/index.js (landing)
import { supabase } from './supabaseClient.js';
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

/* Cargar barrios en el select del signup (si existe) */
async function loadHoodsIntoSelect() {
  const sel = $('signupHood');
  if (!sel) return; // si tu HTML no tiene el select, no hacemos nada
  sel.disabled = true;
  try {
    const { data, error } = await supabase
      .from('hoods')
      .select('id,name')
      .order('name', { ascending: true });
    if (error) throw error;
    sel.innerHTML = `<option value="">Elegí tu barrio</option>` +
      (data || []).map(h => `<option value="${h.id}">${h.name}</option>`).join('');
  } catch (e) {
    showMsg('msgSignup','No se pudieron cargar los barrios.');
  } finally {
    sel.disabled = false;
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  listenAuth();
  const user = await refreshUser();
  if (user) { toDash(); return; }

  // ===== LOGIN =====
  const loginForm = $('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showMsg('msgLogin','Ingresando…');
      try {
        await signIn(
          loginForm.loginEmail?.value?.trim() ?? loginForm.email?.value?.trim(),
          loginForm.loginPassword?.value ?? loginForm.password?.value
        );
        toDash();
      } catch (err) {
        const msg = err?.message || String(err);
        showMsg('msgLogin', msg);
        showMsg('msg', msg); // compat con layouts viejos
      }
    });
  }

  // ===== REGISTRO (variante botón dentro del login) =====
  const registerBtn = $('registerBtn');
  if (registerBtn && loginForm) {
    registerBtn.addEventListener('click', async () => {
      const email = (loginForm.email?.value || loginForm.loginEmail?.value || '').trim();
      const password = (loginForm.password?.value || loginForm.loginPassword?.value || '');
      if (!email || !password) { showMsg('msg','Completá email y contraseña.'); return; }

      // display name
      let display_name = $('signupDisplay')?.value?.trim();
      if (!display_name) {
        const suggested = deriveDisplayName(email);
        display_name = (prompt('Elegí tu nombre visible:', suggested) || '').trim() || suggested;
      }

      // hood_id (si existiera el select en el DOM)
      const hood_id = $('signupHood')?.value || null;

      showMsg('msg','Creando cuenta…');
      try {
        await register(email, password, hood_id ? { display_name, hood_id } : { display_name });
        showMsg('msg','Cuenta creada. Revisá tu email y luego iniciá sesión.');
      } catch (err) {
        showMsg('msg', err?.message || String(err));
      }
    });
  }

  // ===== REGISTRO (variante formulario separado) =====
  await loadHoodsIntoSelect(); // llena el select si existe
  const signupForm = $('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (signupForm.signupEmail?.value || signupForm.email?.value || '').trim();
      const password = (signupForm.signupPassword?.value || signupForm.password?.value || '');
      const display_name = (signupForm.signupDisplay?.value || '').trim() || deriveDisplayName(email);
      const hood_id = $('signupHood')?.value || '';

      if (!display_name) { showMsg('msgSignup','Poné un nombre visible.'); return; }
      if ($('signupHood') && !hood_id) { showMsg('msgSignup','Elegí tu barrio.'); return; }

      showMsg('msgSignup','Creando cuenta…');
      try {
        await register(email, password, hood_id ? { display_name, hood_id } : { display_name });
        showMsg('msgSignup','Cuenta creada. Revisá tu correo y luego iniciá sesión.');
      } catch (err) {
        showMsg('msgSignup', err?.message || 'No se pudo crear la cuenta.');
      }
    });
  }
});
