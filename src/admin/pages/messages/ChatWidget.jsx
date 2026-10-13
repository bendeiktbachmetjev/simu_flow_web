import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, MessageSquare, X } from 'lucide-react';
import { EmptyState, LiveDot } from '../../ui';
import { useAdmin } from '../../context/AdminContext.jsx';
import { useSupport } from '../../context/SupportContext.jsx';
import { STORAGE } from '../../data/constants.js';
import { findThread } from '../../data/support/threads.js';
import Conversation from './Conversation.jsx';
import ThreadList from './ThreadList.jsx';

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';
const CLOCK_TICK_MS = 60 * 1000; // "Today" / "Yesterday" and list times move on at midnight

// The open conversation is remembered for this browser tab only and is never put in the URL:
// user ids stay out of addresses. It is stored with the administrator's id, so another account
// in the same tab starts empty.
const readSelected = (adminId) => {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(STORAGE.supportThread));
    return stored && stored.adminId === adminId && typeof stored.clientId === 'string' ? stored.clientId : null;
  } catch {
    return null;
  }
};

const storeSelected = (adminId, clientId) => {
  try {
    if (clientId) window.sessionStorage.setItem(STORAGE.supportThread, JSON.stringify({ adminId, clientId }));
    else window.sessionStorage.removeItem(STORAGE.supportThread);
  } catch {
    // Storage can be blocked; the choice then lasts until the page is left.
  }
};

// Old bookmarks of the former Messages section open the panel (the shell redirects the path).
const openedFromOldLink = () => /^\/admin\/messages\/?$/i.test(window.location.pathname);

function useNow(tickMs) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), tickMs);
    return () => window.clearInterval(timer);
  }, [tickMs]);
  return nowMs;
}

function WaitingBadge({ count }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#FFFFFF] text-[#78003F] text-xs font-extrabold leading-[22px] text-center shadow-[0_2px_8px_rgba(65,65,65,0.25)]"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/**
 * Support chat as a floating button in the bottom-right corner of every admin screen. The panel
 * opens above the page and stays open while the admin moves between sections: conversations on
 * the left, the open one on the right; on narrow screens one pane at a time, full screen.
 * The data comes from SupportProvider (mounted in the shell), so the badge and the panel never
 * disagree. z-index stays at 30: the calendar tooltip (50) and the event modal (60) stay on top.
 */
export default function ChatWidget() {
  const { admin } = useAdmin();
  const support = useSupport();
  const adminId = admin?.id ?? null;
  const nowMs = useNow(CLOCK_TICK_MS);

  const [open, setOpen] = useState(openedFromOldLink);
  const [selectedId, setSelectedId] = useState(() => readSelected(adminId));
  const draftsRef = useRef(new Map()); // unsent text per conversation, in memory only
  const panelRef = useRef(null);

  const select = useCallback(
    (clientId) => {
      setSelectedId(clientId);
      storeSelected(adminId, clientId);
    },
    [adminId]
  );

  const thread = findThread(support.threads, selectedId);

  // A remembered conversation that is no longer listed (the person deleted the account).
  useEffect(() => {
    if (support.status === 'ready' && selectedId && !thread) select(null);
  }, [support.status, selectedId, thread, select]);

  // Move focus into the panel when it opens, so keyboard users land in the chat.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const clientId = thread?.clientId ?? null;
  const onDraftChange = useCallback(
    (text) => {
      if (!clientId) return;
      if (text) draftsRef.current.set(clientId, text);
      else draftsRef.current.delete(clientId);
    },
    [clientId]
  );

  const waiting = support.waitingCount;
  const buttonLabel = waiting > 0 ? `Messages, ${waiting} waiting for a reply` : 'Messages';

  return (
    <>
      {open && (
        <section
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-label="Messages"
          className="fixed z-30 inset-0 sm:inset-auto sm:right-6 sm:bottom-24 sm:w-[min(900px,calc(100vw-3rem))] sm:h-[min(680px,calc(100dvh-8rem))] flex flex-col bg-[#FFFFFF] sm:rounded-[24px] border border-[#DCDCDC]/60 shadow-[0_16px_40px_rgba(65,65,65,0.18)] overflow-hidden focus:outline-none"
        >
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-[#DCDCDC]/60">
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-[#414141]">Messages</h2>
              {support.status !== 'error' && (
                <p className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#414141]/60">
                  <LiveDot active={support.live} />
                  {support.live ? 'Live' : 'Checking every 30 seconds'}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close messages"
              className={`w-9 h-9 rounded-full flex items-center justify-center text-[#414141]/70 hover:bg-[#DCDCDC]/30 transition-colors ${RING}`}
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]">
            <div className={`${thread ? 'hidden md:flex' : 'flex'} min-h-0 flex-col md:border-r md:border-[#DCDCDC]/60`}>
              <ThreadList
                threads={support.threads}
                status={support.status}
                error={support.error}
                isStale={support.isStale}
                updatedAt={support.updatedAt}
                selectedId={clientId}
                onSelect={select}
                onRetry={support.refresh}
                nowMs={nowMs}
                adminId={adminId}
              />
            </div>
            <div className={`${thread ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-col`}>
              {thread ? (
                <Conversation
                  key={thread.clientId}
                  thread={thread}
                  adminId={adminId}
                  nowMs={nowMs}
                  onBack={() => select(null)}
                  draft={draftsRef.current.get(thread.clientId) ?? ''}
                  onDraftChange={onDraftChange}
                />
              ) : (
                <EmptyState
                  icon={MessageSquare}
                  title={support.threads.length > 0 ? 'Choose a conversation' : 'No conversation open'}
                  hint={
                    support.threads.length > 0
                      ? 'Pick a person on the left to read the messages and reply.'
                      : 'Conversations appear here as soon as someone writes to support.'
                  }
                  className="flex-1"
                />
              )}
            </div>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close messages' : buttonLabel}
        aria-expanded={open}
        className={`${open ? 'hidden sm:flex' : 'flex'} fixed z-30 right-6 bottom-6 w-14 h-14 rounded-full items-center justify-center bg-gradient-to-br from-[#78003F] to-[#E64164] text-white shadow-[0_8px_24px_rgba(120,0,63,0.35)] hover:shadow-[0_10px_28px_rgba(120,0,63,0.45)] transition-shadow print:hidden ${RING}`}
      >
        {open ? <X className="w-6 h-6" aria-hidden="true" /> : <MessageCircle className="w-6 h-6" aria-hidden="true" />}
        {!open && <WaitingBadge count={waiting} />}
      </button>
    </>
  );
}
