// Support chat reads and writes for the admin "Messages" section.
// Unlike the analytics loaders, these rows carry names and message text by design. They are
// only ever shown in the chat: never in the metrics, a CSV export or a URL.
// RLS limits every read and the realtime feed to the administrator's own university, and
// (since 042) an administrator may only write as themselves.
import { supabase } from '../../../lib/supabase';
import { DataError, toDataError } from '../errors.js';
import { fetchAllPages } from '../query.js';
import { prepareReply } from './threads.js';

const THREAD_COLUMNS =
  'client_id, client_name, client_surname, client_university, client_role, ' +
  'last_message_id, last_message_sender_id, last_message_content, last_message_created_at';
const MESSAGE_COLUMNS = 'id, client_id, sender_id, content, created_at, sender_name, sender_surname, sender_role';
const ROW_COLUMNS = 'id, client_id, sender_id, content, created_at';

// The same codes as every other load, worded for a reply that did not go out. The reply box keeps
// the text, so "send again" is always one click.
const SEND_MESSAGES = {
  NETWORK: 'The server could not be reached. Check your connection and press Send again.',
  TIMEOUT: 'The server took too long to answer. Press Send again in a moment.',
  AUTH: 'Your session may have expired, or this account may not answer this conversation. Sign out, sign in again and retry.',
  QUERY: 'Something went wrong on the server. Press Send again.',
};

// Any failure of a send → a DataError with the wording above. useConversation runs every failed
// send through it as well (the dev demo throws plain errors), so they all read the same.
export const toSendError = (err, status = null) => {
  const error = toDataError(err, { table: 'support_messages', status });
  return new DataError(error.code, SEND_MESSAGES[error.code] ?? SEND_MESSAGES.QUERY, {
    table: 'support_messages',
    cause: err,
  });
};

// One row per conversation of this university, newest first (rows: support_chat_threads columns).
export async function loadThreads(signal) {
  try {
    return await fetchAllPages(
      (selectOpts) =>
        supabase
          .from('support_chat_threads')
          .select(THREAD_COLUMNS, selectOpts)
          .order('last_message_created_at', { ascending: false })
          .order('client_id'),
      { signal, table: 'support_chat_threads' }
    );
  } catch (err) {
    if (err?.code !== 'ABORTED') console.error(err);
    throw err;
  }
}

// Every message of one conversation, oldest first, with the sender's name and role.
export async function loadMessages(clientId, signal) {
  try {
    return await fetchAllPages(
      (selectOpts) =>
        supabase
          .from('support_messages_with_profiles')
          .select(MESSAGE_COLUMNS, selectOpts)
          .eq('client_id', clientId)
          .order('created_at')
          .order('id'),
      { signal, table: 'support_messages_with_profiles' }
    );
  } catch (err) {
    if (err?.code !== 'ABORTED') console.error(err);
    throw err;
  }
}

// One message with the sender's name (a realtime row has ids only), or null when it is gone.
export async function loadMessage(id, signal) {
  const table = 'support_messages_with_profiles';
  let response;
  try {
    let query = supabase.from(table).select(MESSAGE_COLUMNS).eq('id', id);
    if (signal) query = query.abortSignal(signal);
    response = await query.maybeSingle();
  } catch (err) {
    throw toDataError(err, { table });
  }
  if (signal?.aborted) throw new DataError('ABORTED', null, { table });
  if (response.error) throw toDataError(response.error, { table, status: response.status });
  return response.data ?? null;
}

/**
 * Sends a reply as the signed-in administrator and returns the stored row (view columns when the
 * follow-up read works, the plain table row otherwise — the message is sent either way).
 * created_at comes from the server clock. The push to the person's phone is sent by the database
 * trigger on insert (024); the browser never calls the push function.
 */
export async function sendReply({ clientId, adminId, content }) {
  const reply = prepareReply(content);
  if (!clientId || !adminId || reply.error) throw new DataError('QUERY', SEND_MESSAGES.QUERY);

  let response;
  try {
    response = await supabase
      .from('support_messages')
      .insert({ client_id: clientId, sender_id: adminId, content: reply.content })
      .select(ROW_COLUMNS)
      .single();
  } catch (err) {
    throw toSendError(err);
  }
  if (response.error) throw toSendError(response.error, response.status);

  const row = response.data;
  try {
    return (await loadMessage(row.id)) ?? row;
  } catch {
    return row;
  }
}

// Realtime topics must be unique: supabase.channel() hands back an existing channel of the same
// name, and StrictMode mounts every effect twice.
let channelSeq = 0;

/**
 * New messages as they are written: `onInsert(row)` gets the bare support_messages row,
 * `onStatus(status)` the channel state ('SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED').
 * Only INSERT is followed: the app never edits or deletes chat messages. Returns the unsubscribe.
 */
export function subscribeToMessages({ onInsert, onStatus }) {
  channelSeq += 1;
  const channel = supabase
    .channel(`admin-support-${Date.now().toString(36)}-${channelSeq}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) =>
      onInsert(payload?.new)
    )
    .subscribe((status) => onStatus(status));
  return () => {
    supabase.removeChannel(channel);
  };
}

// The data source the Messages section runs on; the dev demo (dev/demoSupport.js) has the same shape.
export const liveSupport = {
  loadThreads,
  loadMessages,
  loadMessage,
  sendReply,
  subscribe: subscribeToMessages,
};
