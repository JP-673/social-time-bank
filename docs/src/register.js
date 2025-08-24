// /src/register.js
import { register } from './auth.js';
import { listHoods } from './profile.js';

const $ = s => document.querySelector(s);
const msg = (t) => { const m = $('#msgRegister'); if (m) m.textContent = String(t || ''); };

function deriveDisplayName(email) {
  const local = (email || '').split('@')[0] || 'Usuario';
  return local.replace(/[._-]+/g,' ')
              .split(' ')
              .filter(Boolean)
              .map(s => s.charAt(0).toUpperCase() + s.slice(1))
              .join(' ');
}

async function loadHoods() {
  try {
    const sel = $('#hoodSelect');
    if (!sel) return;
    const rows = await listHoods(); // [{id,name},...]
    rows.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = h.name;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.warn('[register] listHoods error', e);
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadHoods();

  $('#registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg('');

    const email = $('#regEmail')?.value?.trim();
    const pass1 = $('#regPassword')?.value || '';
    const pass2 = $('#regPassword2')?.value || '';
    let displayName = $('#displayName')?.value?.trim();
    const hood_id = $('#hoodSelect')?.value || null;

    if (!email || !pass1 || !pass2) { msg('Completá los campos obligatorios.'); return; }
    if (pass1.length < 8) { msg('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (pass1 !== pass2) { msg('Las contraseñas no coinciden.'); return; }
    if (!displayName) displayName = deriveDisplayName(email);

    msg('Creando cuenta…');

    try {
      // podés pasar meta como objeto; tu auth.js ya lo soporta
      await register(email, pass1, { display_name: displayName, hood_id });

      // Si tu proyecto requiere verificación por email:
      msg('¡Listo! Te enviamos un correo para confirmar. Luego podés ingresar.');
      // Si NO exige verificación, podrías redirigir directo:
      // location.replace('./tablero.html');
    } catch (err) {
      console.error('[register] error', err);
      msg(err?.message || 'No se pudo crear la cuenta.');
    }
  });
});
