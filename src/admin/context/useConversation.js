// Messages of the open conversation: read when it is opened, then kept current from the
// SupportProvider's realtime channel (no second channel). When realtime is down, the provider's
// timed threads read shows a newer last message than the one on screen, and the conversation is
// read again.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAdmin } from './AdminContext';
import { useSupport } from './SupportContext.jsx';
import { toDataError } from '../data/errors.js';
import { toSendError } from '../data/support/loadSupport.js';
import {
  findThread,
  mergeMessages,
  normalizeMessage,
  normalizeMessages,
  prepareReply,
} from '../data/support/threads.js';

const initialFor = (clientId) => ({
  clientId,
  status: clientId ? 'loading' : 'idle',
  messages: [],
  error: null,
  sending: false,
  sendError: null,
});

/**
 * useConversation(clientId) → { status: 'idle'|'loading'|'ready'|'error', messages, error,
 *                               sending, sendError, retry(), send(text) → Promise<boolean> }
 * `send` resolves true once the reply is stored; on false, `sendError` says why.
 */
export function useConversation(clientId) {
  const { admin } = useAdmin();
  const adminId = admin?.id ?? null;
  const { threads, onMessage, receive, getSource } = useSupport();

  const [state, setState] = useState(() => initialFor(clientId));
  if (state.clientId !== clientId) setState(initialFor(clientId));

  const controllerRef = useRef(null); // the read in flight, if any
  const caughtUpRef = useRef(null); // last message id a catch-up read was started for

  // Updates the state only while it still belongs to `clientId`.
  const update = useCallback(
    (change) => setState((current) => (current.clientId === clientId ? change(current) : current)),
    [clientId]
  );

  const load = useCallback(async () => {
    if (!clientId) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const source = await getSource();
      const rows = await source.loadMessages(clientId, controller.signal);
      if (controller.signal.aborted) return;
      const loaded = normalizeMessages(rows);
      // Merged, not replaced: a message that came in over realtime during the read stays.
      update((current) => ({ ...current, status: 'ready', error: null, messages: mergeMessages(current.messages, loaded) }));
    } catch (err) {
      const error = toDataError(err);
      if (error.code === 'ABORTED' || controller.signal.aborted) return;
      // A failed catch-up read keeps the conversation on screen; the next one tries again.
      update((current) => (current.status === 'ready' ? current : { ...current, status: 'error', error }));
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [clientId, getSource, update]);

  useEffect(() => {
    if (!clientId) return undefined;
    load();
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [clientId, load]);

  const retry = useCallback(() => {
    update((current) => ({ ...current, status: 'loading', error: null }));
    load();
  }, [load, update]);

  // New messages of this conversation from the shared channel.
  useEffect(() => {
    if (!clientId) return undefined;
    let active = true;
    const unsubscribe = onMessage((message) => {
      if (message.clientId !== clientId) return;
      update((current) => ({ ...current, messages: mergeMessages(current.messages, [message]) }));
      // Another administrator's reply arrives as a bare row; the view adds the name shown above it.
      if (!message.hasProfile && message.senderId !== clientId && message.senderId !== adminId) {
        getSource()
          .then((source) => source.loadMessage(message.id))
          .then((row) => {
            const full = normalizeMessage(row);
            if (active && full) update((current) => ({ ...current, messages: mergeMessages(current.messages, [full]) }));
          })
          .catch(() => {
            // The bubble then shows "Administrator" instead of the name.
          });
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [clientId, adminId, onMessage, getSource, update]);

  // Catch-up: the threads list knows a newer last message than this conversation has.
  const lastMessageId = findThread(threads, clientId)?.lastMessageId ?? null;
  const hasLastMessage = !lastMessageId || state.messages.some((message) => message.id === lastMessageId);
  useEffect(() => {
    if (state.status !== 'ready' || hasLastMessage || caughtUpRef.current === lastMessageId) return;
    caughtUpRef.current = lastMessageId;
    load();
  }, [state.status, hasLastMessage, lastMessageId, load]);

  const send = useCallback(
    async (text) => {
      const reply = prepareReply(text);
      if (!clientId || !adminId || reply.error) return false;
      update((current) => ({ ...current, sending: true, sendError: null }));
      try {
        const source = await getSource();
        const row = await source.sendReply({ clientId, adminId, content: reply.content });
        const message = normalizeMessage(row);
        update((current) => ({
          ...current,
          sending: false,
          messages: message ? mergeMessages(current.messages, [message]) : current.messages,
        }));
        // The thread list moves on at once; the realtime echo of this insert then changes nothing.
        if (row) receive(row);
        return true;
      } catch (err) {
        update((current) => ({ ...current, sending: false, sendError: toSendError(err) }));
        return false;
      }
    },
    [clientId, adminId, getSource, receive, update]
  );

  return {
    status: state.status,
    messages: state.messages,
    error: state.error,
    sending: state.sending,
    sendError: state.sendError,
    retry,
    send,
  };
}
