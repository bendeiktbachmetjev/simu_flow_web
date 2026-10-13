import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Card, EmptyState, LiveDot } from '../ui';
import { useAdmin } from '../context/AdminContext.jsx';
import { useSupport } from '../context/SupportContext.jsx';
import { STORAGE } from '../data/constants.js';
import { findThread } from '../data/support/threads.js';
import Conversation from './messages/Conversation.jsx';
import ThreadList from './messages/ThreadList.jsx';

const CLOCK_TICK_MS = 60 * 1000; // "Today" / "Yesterday" and list times move on at midnight

// The open conversation is remembered for this browser tab only and is never put in the URL:
// user ids stay out of addresses, and a section is exactly one path segment (nav.js).
// It is stored with the administrator's id, so another account in the same tab starts empty.
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

function useNow(tickMs) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), tickMs);
    return () => window.clearInterval(timer);
  }, [tickMs]);
  return nowMs;
}

function LiveStatus({ live }) {
  return (
    <p className="inline-flex items-center gap-2 text-xs font-semibold text-[#414141]/70">
      <LiveDot active={live} />
      {live ? 'Live: new messages appear at once' : 'Checking for new messages every 30 seconds'}
    </p>
  );
}

/**
 * Support chat with the people who use the app: conversations on the left, the open one on the
 * right. On narrow screens one pane at a time, with a back button in the conversation.
 * The data comes from SupportProvider (mounted in the shell), so the list is already there when
 * the page opens and the "Messages" pill and the page never disagree.
 */
export default function MessagesPage() {
  const { admin } = useAdmin();
  const support = useSupport();
  const adminId = admin?.id ?? null;
  const nowMs = useNow(CLOCK_TICK_MS);

  const [selectedId, setSelectedId] = useState(() => readSelected(adminId));
  const draftsRef = useRef(new Map()); // unsent text per conversation, in memory only

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

  const clientId = thread?.clientId ?? null;
  const onDraftChange = useCallback(
    (text) => {
      if (!clientId) return;
      if (text) draftsRef.current.set(clientId, text);
      else draftsRef.current.delete(clientId);
    },
    [clientId]
  );

  return (
    <div>
      <div className="pt-2 pb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {admin?.university && (
            <p className="mb-1 text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#414141]/60">
              {admin.university}
            </p>
          )}
          <h1 className="text-3xl font-extrabold tracking-tight text-[#414141]">Messages</h1>
          <p className="hidden sm:block mt-1 text-sm font-medium text-[#414141]/75">
            Support chat with the people who use the SimuFlow app. Your reply reaches them in the app.
          </p>
        </div>
        {support.status !== 'error' && <LiveStatus live={support.live} />}
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)] lg:grid-cols-[352px_minmax(0,1fr)] h-[calc(100dvh-15rem)] min-h-[480px]">
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
                    : 'Conversations appear on the left as soon as someone writes to support.'
                }
                className="flex-1"
              />
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
