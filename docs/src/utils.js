export const $ = id => document.getElementById(id);
export const toast = m => {
  $('toastMsg').textContent = m;
  $('toast').classList.add('show');
  setTimeout(()=> $('toast').classList.remove('show'), 2500);
};
export const slug = s => (s||'').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
