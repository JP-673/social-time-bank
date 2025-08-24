// docs/src/chat.js
import { supabase } from './supabase.js'; // tu createClient centralizado
import { getCurrentUser } from './auth.js'; // asume retorna { id, ... }

const TABLE_CONV = 'conversations';
const TABLE_MSG  = 'messages';
const TABLE_READ = 'message_reads';

// === Conversations ===
export async function getOrCreateConversation({ offerId = null, otherUserId }) {
  const me = await getCurrentUser();
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    p_offer: offerId,
    p_user_a: me.id,
    p_user_b: otherUserId,
  });
  if (error) throw error;
  return data; // conversation_id (uuid)
}

export async function listConversations() {
  const { data, error } = await supabase
    .from(TABLE_CONV)
    .select('id, offer_id, user_a, user_b, last_message_at')
    .order('last_message_at', { ascending: false });
  if (error) throw error;
  return data;
}

// === Messages ===
export async function listMessages(conversationId, { limit = 50, before = null } = {}) {
  let q = supabase
    .from(TABLE_MSG)
    .select('id, sender_id, body, attachment_url, created_at, edited_at, deleted_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) q = q.lt('created_at', before);

  const { data, error } = await q;
  if (error) throw error;
  return data.reverse(); // cronológico asc
}

export async function sendMessage(conversationId, body, { attachmentUrl = null } = {}) {
  const me = await getCurrentUser();
  const payload = {
    conversation_id: conversationId,
    sender_id: me.id,
    body: body.trim(),
    attachment_url: attachmentUrl,
  };
  const { data, error } = await supabase.from(TABLE_MSG).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function markConversationRead(conversationId) {
  const me = await getCurrentUser();
  // upsert last_read_at = now()
  const { error } = await supabase
    .from(TABLE_READ)
    .upsert({ conversation_id: conversationId, user_id: me.id, last_read_at: new Date().toISOString() });
  if (error) throw error;
}

// === Unread count por conversación ===
export async function countUnread(conversationId) {
  const me = await getCurrentUser();

  // Obtenemos mi last_read_at
  const { data: readRow, error: rerr } = await supabase
    .from(TABLE_READ)
    .select('last_read_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', me.id)
    .single();
  if (rerr) throw rerr;

  const { count, error } = await supabase
    .from(TABLE_MSG)
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .gt('created_at', readRow?.last_read_at ?? 'epoch')
    .neq('sender_id', me.id);
  if (error) throw error;

  return count ?? 0;
}

// === Realtime ===
// onMessage: (msg) => {...}
export function subscribeConversation(conversationId, onMessage) {
  const channel = supabase.channel(`conv:${conversationId}`, {
    config: { broadcast: { self: false } }
  });

  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: TABLE_MSG, filter: `conversation_id=eq.${conversationId}` },
    (payload) => onMessage?.(payload.new)
  );

  channel.subscribe();

  return () => supabase.removeChannel(channel);
}
