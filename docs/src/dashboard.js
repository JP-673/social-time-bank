// docs/src/dashboard.js
import { listenAuth, refreshUser, logout } from './auth.js';
import { bootUI } from './ui.js';
import * as Profiles from './profile.js';
import { setState } from './state.js';
import { getBalance, getLedger } from './wallet.js';

// >>> CHAT
import * as Chat from './chat.js';                  // list/send/subscribe/...
import { getProfileById, getProfilesBulk, displayName } from './profile.js';

// <<< CHAT

// -------- utils --------
const $ = (idA, idB = null) =>
  document.getElementById(idA) || (idB ? document.getElementById(idB) : null);
const gotoLanding = () => location.replace('index.html');
const escapeHtml = (s = '') =>
  s.replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const fmtH = (mins = 0) => (mins / 60).toFixed(2) + ' h';

// ===============================
// SIDEBAR
// ===============================
async function renderSidebarProfile(user) {
  const $name = $('sbUserName', 'userName');
  const $hood = $('sbUserHood', 'userHood');
  const $bal  = $('sbHdrBalance', 'hdrBalance');

  try {
    const prof = await Profiles.getProfileWithHood(); // { display_name, hood:{ name } }
    if ($name) $name.textContent = prof?.display_name || user.email;
    if ($hood) $hood.textContent = prof?.hood?.name ? `(${prof.hood.name})` : '';
  } catch {
    if ($name) $name.textContent = user.email;
    if ($hood) $hood.textContent = '';
  }

  try {
    const balMin = await getBalance(user.id);             // minutos
    const balHrs = (balMin ?? 0) / 60;
    const balFmt = balHrs % 1 === 0 ? balHrs.toFixed(0) : balHrs.toFixed(2); // solo número
    if ($bal) $bal.textContent = balFmt;                  // el " h" lo pone el HTML
  } catch {
    if ($bal) $bal.textContent = 0;
  }
}

async function renderMiniLedger(user) {
  const wrap = $('miniLedger');
  if (!wrap) return;

  try {
    const ledger = await getLedger(user.id);
    if (!ledger?.length) {
      wrap.innerHTML = '<p class="muted">Sin movimientos.</p>';
      return;
    }
    wrap.innerHTML = ledger.slice(0, 6).map(tx => `
      <div class="tx">
        <div>
          <div>${escapeHtml(tx.note ?? '—')}</div>
          <small class="muted">${escapeHtml(tx.when ?? '')}</small>
        </div>
        <strong>${tx.delta > 0 ? '+' : ''}${fmtH(tx.delta)}</strong>
      </div>
    `).join('');
  } catch {
    wrap.innerHTML = '<p class="muted">No se pudo cargar.</p>';
  }
}

// ===============================
// AUTH / WIRING
// ===============================
function wireSidebarLogout() {
  const btn = $('sbLogoutBtn', 'logoutBtn');
  btn?.addEventListener('click', async () => {
    await logout();
    setState({ currentUser: null });
    gotoLanding();
  }, { once: true });
}

function wireQuickActions() {
  document.querySelectorAll('.quick-actions [data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document
        .querySelector(`.tabs .tab[data-tab="${btn.dataset.tab}"]`)
        ?.click();
    });
  });
}

// ===============================
// CHAT: UI HELPERS (alias-only)
// ===============================
let currentConversationId = null;
let unsubscribeConv = null;

function showChatPanel() {
  $('chat-panel')?.classList.remove('hidden');
}
function hideChatPanel() {
  $('chat-panel')?.classList.add('hidden');
  if (unsubscribeConv) { unsubscribeConv(); unsubscribeConv = null; }
  currentConversationId = null;
}

function renderConversationItem(conv, meId) {
  const other = conv.user_a === meId ? conv.profile_b : conv.profile_a;
  return `
    <div class="item" data-cid="${conv.id}">
      <div class="title">${displayName(other)}</div>
      <small>${new Date(conv.last_message_at).toLocaleString()}</small>
      <div class="unread" id="unread-${conv.id}"></div>
    </div>`;
}

function renderMessage(m, meId, senderProfile) {
  const cls = m.sender_id === meId ? 'me' : 'other';
  const text = m.deleted_at ? '🗑️ mensaje eliminado' : (m.body || '');
  return `
    <div class="msg ${cls}">
      <div class="bubble">
        ${text}
        <div class="meta"><small>${displayName(senderProfile)} · ${new Date(m.created_at).toLocaleTimeString()}</small></div>
      </div>
    </div>`;
}

function scrollMessagesToEnd() {
  const box = $('chat-messages');
  if (box) box.scrollTop = box.scrollHeight;
}

async function loadConversationsList(meId) {
  const list = await Chat.listConversationsWithProfiles(); // ya trae profile_a/b con display_name
  $('chat-conversations').innerHTML = list.map(c => renderConversationItem(c, meId)).join('');
  document.querySelectorAll('.chat-conversations .item').forEach(el=>{
    el.addEventListener('click', () => openConversation(el.dataset.cid));
  });
  // unread badges
  for (const c of list) {
    const n = await Chat.countUnread(c.id);
    const spot = $(`unread-${c.id}`);
    if (spot) spot.textContent = n > 0 ? `${n} nuevo${n>1?'s':''}` : '';
  }
}

async function openConversation(cid) {
  const me = await getCurrentUser();
  currentConversationId = cid;

  document.querySelectorAll('.chat-conversations .item').forEach(el=>{
    el.classList.toggle('active', el.dataset.cid === cid);
  });

  const msgs = await Chat.listMessages(cid);
  const senderIds = [...new Set(msgs.map(m=>m.sender_id))];
  const profs = await Promise.all(senderIds.map(id => getProfile(id)));
  const pmap = new Map(profs.filter(Boolean).map(p => [p.id, p]));

  $('chat-messages').innerHTML =
    msgs.map(m => renderMessage(m, me.id, pmap.get(m.sender_id))).join('');
  scrollMessagesToEnd();
  await Chat.markConversationRead(cid);

  if (unsubscribeConv) unsubscribeConv();
  unsubscribeConv = Chat.subscribeConversation(cid, async (newMsg) => {
    const sp = pmap.get(newMsg.sender_id) || await getProfile(newMsg.sender_id);
    $('chat-messages')
      .insertAdjacentHTML('beforeend', renderMessage(newMsg, me.id, sp));
    scrollMessagesToEnd();
    if (newMsg.sender_id !== me.id) await Chat.markConversationRead(cid);
  });
}

function wireChatForm() {
  const form = $('chat-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('chat-input');
    const text = input?.value?.trim();
    if (!text || !currentConversationId) return;
    await Chat.sendMessage(currentConversationId, text);
    input.value = '';
  });
}

function wireChatPanelChrome() {
  $('close-chat')?.addEventListener('click', hideChatPanel);
}

async function bootChatUI() {
  const me = await getCurrentUser();
  if (!$('chat-panel')) return;         // si el HTML no tiene el panel, no hacemos nada
  await loadConversationsList(me.id);
  wireChatForm();
  wireChatPanelChrome();
}

// Permite abrir chat desde cualquier botón .btn.chat con data-offer-id y data-user-id
function wireGlobalContactButtons() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('button.btn.chat, a.btn.chat');
    if (!btn) return;
    const offerId = btn.dataset.offerId || null;
    const otherUserId = btn.dataset.userId;
    if (!otherUserId) return;

    showChatPanel();
    // crea/obtiene conversación y la abre
    const cid = await Chat.getOrCreateConversation({ offerId, otherUserId });
    const me = await getCurrentUser();
    await loadConversationsList(me.id);
    await openConversation(cid);
  });
}

// ===============================
// GUARD + BOOT
// ===============================
async function guard() {
  listenAuth();
  const user = await refreshUser();
  if (!user) { gotoLanding(); return null; }

  await renderSidebarProfile(user);
  await renderMiniLedger(user);
  wireSidebarLogout();
  wireQuickActions();

  return user;
}

window.addEventListener('DOMContentLoaded', async () => {
  const user = await guard();
  if (!user) return;

  // UI general
  bootUI();

  // CHAT
  await bootChatUI();
  wireGlobalContactButtons();
});
