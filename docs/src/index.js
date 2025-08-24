// /docs/src/index.js  (sirve para landing y para entrar.html)
import { supabase } from './supabaseClient.js';
import { listenAuth, refreshUser, signIn, register } from './auth.js';

const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const toDash = () => location.replace('./dashboard.html');

const showMsg = (id, t='') => {
  const el = document.getElementById(id);
  if (el) el.textContent = t;
};

function deriveDisplayName(email=''){
  const local = email.split('@')[0] || 'Usuario';
  return local.replace(/[._-]+/g,' ')
              .split(' ')
              .filter(Boolean)
              .map(s => s.charAt(0).toUpperCase() + s.slice(1))
              .join(' ');
}

/** Lee value de múltiples posibles inputs (by id o name). */
function readInput(candidates = []) {
  for (const c of candidates) {
    const el = document.getElementById(c) || $(`[name="${c}"]`);
    if (el && typeof el.value === 'string') return el.value;
  }
  return '';
}

async function loadHoodsIntoSelect() {
  const sel = document.getElementById('signupHood');
  if (!sel) return;
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

/** Redirige siempre a /dashboard.html respetando subcarpetas (GH Pages). */
function buildRedirect() {
  const base = location.pathname.replace(/(index|entrar)\.html?$/i, '');
  return `${location.origin}${base}dashboard.html`;
}

/** Wirea el login aunque cambien IDs (usa varias alternativas). */
function wireLogin() {
  const form =
    $('#loginForm') ||
    $('[data-role="login-form"]') ||
    $('form[action*="login"]') ||
    $('form#entrar') ||
    $('form'); // último recurso

  if (!form) return;

  // Evita que un action="" genere "?"
  try { form.setAttribute('action', ''); } catch {}

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMsg('msgLogin', 'Ingresando…');

    const email = readInput(['loginEmail','email','user','correo']).trim();
    const pass  = readInput(['loginPassword','password','pass','clave']);

    if (!email || !pass) {
      showMsg('msgLogin','Completá email y contraseña.');
      return;
    }

    try {
      const { error } = await signIn(email, pass); // tu auth con Supabase
      if (error) throw error;

      // Asegura que la sesión esté asentada antes de navegar
      await (window.supabase?.auth?.getSession?.() ?? Promise.resolve());

      // Redirección limpia y absoluta (sin "?")
      window.location.assign(buildRedirect());
    } catch (err) {
      showMsg('msgLogin', err?.message || 'No se pudo iniciar sesión.');
      showMsg('msg', err?.message || 'Error'); // compat
    }
  });
}

/* (Opcional) Limpia "?" huérfano si alguien lo metió antes */
if (location.search === '?') {
  history.replaceState({}, '', location.pathname);
}


/** Wirea el registro si existe (en mismo HTML o separado). */
function wireRegister() {
  // botón “crear cuenta” dentro del login
  const registerBtn = document.getElementById('registerBtn');
  if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
      const email = readInput(['email','loginEmail','regEmail','signupEmail']).trim();
      const password = readInput(['password','loginPassword','regPassword','signupPassword']);
      if (!email || !password) { showMsg('msg','Completá email y contraseña.'); return; }

      let display_name = readInput(['signupDisplay','display_name']).trim();
      if (!display_name) {
        const suggested = deriveDisplayName(email);
        display_name = (prompt('Elegí tu nombre visible:', suggested) || '').trim() || suggested;
      }
      const hood_id = (document.getElementById('signupHood')?.value) || null;

      showMsg('msg','Creando cuenta…');
      try {
        await register(email, password, hood_id ? { display_name, hood_id } : { display_name });
        showMsg('msg','Cuenta creada. Revisá tu email y luego iniciá sesión.');
      } catch (err) {
        showMsg('msg', err?.message || 'No se pudo crear la cuenta.');
      }
    });
  }

  // formulario de signup dedicado
  const signupForm =
    $('#signupForm') ||
    $('[data-role="signup-form"]') ||
    $('form[action*="register"]') ||
    $('form#crear');

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = readInput(['signupEmail','email','regEmail']).trim();
      const password = readInput(['signupPassword','password','regPassword']);
      const display_name = (readInput(['signupDisplay','display_name']) || deriveDisplayName(email)).trim();
      const hood_id = document.getElementById('signupHood')?.value || '';

      if (!display_name) { showMsg('msgSignup','Poné un nombre visible.'); return; }
      if (document.getElementById('signupHood') && !hood_id) {
        showMsg('msgSignup','Elegí tu barrio.'); return;
      }

      showMsg('msgSignup','Creando cuenta…');
      try {
        await register(email, password, hood_id ? { display_name, hood_id } : { display_name });
        showMsg('msgSignup','Cuenta creada. Revisá tu correo y luego iniciá sesión.');
      } catch (err) {
        showMsg('msgSignup', err?.message || 'No se pudo crear la cuenta.');
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  listenAuth();

  // Si ya está autenticado y estamos en landing o entrar → directo al dashboard
  const { pathname } = location;
  const onEntrar = pathname.endsWith('/entrar.html') || pathname.endsWith('entrar.html');
  const user = await refreshUser();
  if (user && (onEntrar || pathname.endsWith('/index.html') || pathname.endsWith('/'))) {
    toDash();
    return;
  }

  // Solo si existe UI de login/registro en esta página, lo wireamos
  if (onEntrar) {
    wireLogin();
    await loadHoodsIntoSelect();
    wireRegister();
  } else {
    // estás en la landing: los botones deberían apuntar a entrar.html
    // (si querés, acá podrías forzar el href de CTA)
    $$('.btn[href$=\"/login.html\"], .btn[href=\"/register.html\"]').forEach(a => a.setAttribute('href','entrar.html'));
  }
});
