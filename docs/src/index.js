import { listenAuth, refreshUser, signIn, register } from './auth.js';

const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const toDash = () => location.replace(buildRedirect());

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

/** Lee el valor del primer input que exista según una lista de IDs. */
function readInput(ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && typeof el.value === 'string') return el.value;
  }
  return '';
}

/** Wirea el login aunque cambien IDs (usa varias alternativas). */
function wireLogin() {
  // ⚠️ IMPORTANTE: no uses tu $ = getElementById para selectores CSS.
  const form =
    document.querySelector('#loginForm') ||
    document.querySelector('[data-role="login-form"]') ||
    document.querySelector('form[action*="login"]') ||
    document.querySelector('form#entrar') ||
    document.querySelector('form'); // último recurso

  if (!form) return;

  // Evita que el form meta "?" si por algo se dispara submit nativo
  try { form.setAttribute('action', '#'); } catch {}

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
      const { error } = await signIn(email, pass);
      if (error) throw error;

      if (window.supabase?.auth?.getSession) {
        const { data, error: se } = await window.supabase.auth.getSession();
        if (se) console.warn('getSession warn:', se);
        console.log('SESSION OK', !!data?.session);
      }

      // Clean up URL if it ends with '?'
      if (location.search === '?') {
        history.replaceState({}, '', location.pathname);
      }

      const url = buildRedirect();
      console.log('REDIRIGIENDO A:', url);
      window.location.replace(url);
    } catch (err) {
      console.error('SIGNIN ERROR', err);
      showMsg('msgLogin', err?.message || 'No se pudo iniciar sesión.');
      showMsg('msg', err?.message || 'Error'); // compat
    }
  });
}

/* Llama a wireLogin al cargar */
document.addEventListener('DOMContentLoaded', wireLogin);

/* (Opcional) Si alguien ensució la URL con "?" vacío, limpiá. */
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
  console.log('User from refreshUser:', user, 'Path:', pathname);
  if (user && (onEntrar || pathname.endsWith('/index.html') || pathname.endsWith('/'))) {
    console.log('Redirecting to dashboard.html');
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
    $$('.btn[href$=\"/login.html\"], .btn[href=\"/register.html\"]').forEach(a => a.setAttribute('href','login.html'));
  }
});

/** Redirige siempre a /dashboard.html respetando subcarpetas (GH Pages). */
function buildRedirect() {
  // location.pathname = /social-time-bank/login.html  (o /entrar.html)
  const base = location.pathname.replace(/(?:index|entrar|login)\.html?$/i, '');
  return `${location.origin}${base}dashboard.html`;
}
