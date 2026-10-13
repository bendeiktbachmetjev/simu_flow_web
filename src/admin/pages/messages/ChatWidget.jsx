import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Maximize2, MessageCircle, MessageSquare, Minimize2, X } from 'lucide-react';
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

// Old bookmarks of the former Messages page open the chat full size, as that page was (the
// shell redirects the path to Overview).
const OLD_PAGE = /^\/admin\/messages\/?$/i;
const openedFromOldLink = () => OLD_PAGE.test(window.location.pathname);

// Small: a window above the bottom-right button (full screen on phones). Expanded: the whole
// area under the site header, like a page of its own.
const SMALL_FRAME =
  'fixed z-30 inset-0 sm:inset-auto sm:right-6 sm:bottom-24 sm:w-[min(900px,calc(100vw-3rem))] sm:h-[min(680px,calc(100dvh-8rem))]';
const EXPANDED_FRAME = 'fixed z-30 inset-x-0 bottom-0 top-16 bg-[#FFFFFF] sm:px-6 sm:py-6';
const CARD =
  'h-full flex flex-col bg-[#FFFFFF] sm:rounded-[24px] border border-[#DCDCDC]/60 shadow-[0_16px_40px_rgba(65,65,65,0.18)] overflow-hidden';
const ROUND_BUTTON = `w-9 h-9 rounded-full flex items-center justify-center text-[#414141]/70 hover:bg-[#DCDCDC]/30 transition-colors ${RING}`;

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
 * The expand button in its header makes it fill the area under the site header; moving to another
 * section shrinks it back, so the page that was asked for is visible.
 * The data comes from SupportProvider (mounted in the shell), so the badge and the panel never
 * disagree. z-index stays at 30: the calendar tooltip (50) and the event modal (60) stay on top.
 */
export default function ChatWidget() {
  const { admin } = useAdmin();
  const support = useSupport();
  const adminId = admin?.id ?? null;
  const nowMs = useNow(CLOCK_TICK_MS);

  const [open, setOpen] = useState(openedFromOldLink);
  const [expanded, setExpanded] = useState(openedFromOldLink);
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

  // A click on a section in the header while the chat fills the screen: shrink it, so the page
  // shows. The redirect away from an old /admin/messages link is not such a click.
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);
  useEffect(() => {
    const previous = previousPath.current;
    previousPath.current = pathname;
    if (previous !== pathname && !OLD_PAGE.test(previous)) setExpanded(false);
  }, [pathname]);

  const close = () => {
    setOpen(false);
    setExpanded(false);
  };

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
          className={`${expanded ? EXPANDED_FRAME : SMALL_FRAME} focus:outline-none`}
        >
          <div className={expanded ? `max-w-7xl mx-auto ${CARD}` : CARD}>
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
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  aria-label={expanded ? 'Make the chat window small' : 'Open the chat full size'}
                  title={expanded ? 'Small window' : 'Full size'}
                  className={`hidden sm:flex ${ROUND_BUTTON}`}
                >
                  {expanded ? (
                    <Minimize2 className="w-[18px] h-[18px]" aria-hidden="true" />
                  ) : (
                    <Maximize2 className="w-[18px] h-[18px]" aria-hidden="true" />
                  )}
                </button>
                <button type="button" onClick={close} aria-label="Close messages" title="Close" className={ROUND_BUTTON}>
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div
              className={`flex-1 min-h-0 grid grid-cols-1 ${
                expanded ? 'md:grid-cols-[360px_minmax(0,1fr)]' : 'md:grid-cols-[320px_minmax(0,1fr)]'
              }`}
            >
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
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? 'Close messages' : buttonLabel}
        aria-expanded={open}
        className={`${open && expanded ? 'hidden' : open ? 'hidden sm:flex' : 'flex'} fixed z-30 right-6 bottom-6 w-14 h-14 rounded-full items-center justify-center bg-gradient-to-br from-[#78003F] to-[#E64164] text-white shadow-[0_8px_24px_rgba(120,0,63,0.35)] hover:shadow-[0_10px_28px_rgba(120,0,63,0.45)] transition-shadow print:hidden ${RING}`}
      >
        {open ? <X className="w-6 h-6" aria-hidden="true" /> : <MessageCircle className="w-6 h-6" aria-hidden="true" />}
        {!open && <WaitingBadge count={waiting} />}
      </button>
    </>
  );
}
