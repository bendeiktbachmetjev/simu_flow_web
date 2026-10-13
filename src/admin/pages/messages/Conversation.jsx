import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ClipboardList, Flag, MessageSquare } from 'lucide-react';
import { EmptyState, ErrorBanner, useReducedMotion } from '../../ui';
import { useConversation } from '../../context/useConversation.js';
import {
  displayName,
  groupByDay,
  isClassPlanMessage,
  isStaffMessage,
  isWaiting,
  messageTimeTitle,
  needsSpecialist,
  vilniusClock,
} from '../../data/support/threads.js';
import { Avatar, RoleBadge } from './Person.jsx';
import ReplyBox from './ReplyBox.jsx';

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';
const ROUND_ICON =
  'w-9 h-9 shrink-0 flex items-center justify-center rounded-full border border-[#DCDCDC] text-[#414141]/70 hover:bg-[#DCDCDC]/20 transition-colors';

// Closer than this to the bottom counts as "reading the newest messages".
const NEAR_BOTTOM_PX = 80;
// Messages of one sender closer together than this sit in one tight group.
const RUN_GAP_MS = 5 * 60 * 1000;

const TAG = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold';

function ClassPlanTags({ content }) {
  return (
    <span className="mb-1.5 flex flex-wrap gap-1">
      <span className={`${TAG} bg-[#78003F]/10 text-[#78003F]`}>
        <ClipboardList className="w-3 h-3" aria-hidden="true" />
        Class plan
      </span>
      {needsSpecialist(content) && (
        <span className={`${TAG} bg-[#E64164]/10 text-[#B3205A]`}>
          <Flag className="w-3 h-3" aria-hidden="true" />
          Specialist needed
        </span>
      )}
    </span>
  );
}

// Staff on the right in cherry, the client on the left in light gray. Another administrator's
// reply carries that person's name above the first bubble of a run.
function Bubble({ message, thread, adminId, firstOfRun }) {
  const staff = isStaffMessage(message, thread.clientId);
  const mine = message.senderId === adminId;
  const knownName = message.senderName || message.senderSurname;
  let sender = thread.displayName;
  if (mine) sender = 'You';
  else if (staff) sender = knownName ? displayName(message.senderName, message.senderSurname) : 'Administrator';

  return (
    <li className={`flex flex-col ${staff ? 'items-end' : 'items-start'} ${firstOfRun ? 'mt-3' : 'mt-1'}`}>
      {staff && !mine && firstOfRun && (
        <span aria-hidden="true" className="mb-1 px-1 text-[11px] font-semibold text-[#414141]/60">
          {sender}
        </span>
      )}
      <div
        className={`max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-[20px] ${
          staff ? 'bg-[#78003F] text-white rounded-br-[6px]' : 'bg-[#DCDCDC]/35 text-[#414141] rounded-bl-[6px]'
        }`}
      >
        {isClassPlanMessage(message.content) && <ClassPlanTags content={message.content} />}
        <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          <span className="sr-only">{`${sender}: `}</span>
          {message.content}
        </p>
        {Number.isFinite(message.createdMs) && (
          <time
            dateTime={new Date(message.createdMs).toISOString()}
            title={messageTimeTitle(message.createdMs)}
            className={`mt-1 block text-right text-[11px] font-semibold ${staff ? 'text-white/70' : 'text-[#414141]/60'}`}
          >
            {vilniusClock(message.createdMs)}
          </time>
        )}
      </div>
    </li>
  );
}

function Header({ thread, onBack }) {
  return (
    <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-[#DCDCDC]/60">
      <button type="button" onClick={onBack} aria-label="Back to all conversations" className={`md:hidden ${ROUND_ICON} ${RING}`}>
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
      </button>
      <Avatar name={thread.name} surname={thread.surname} size="sm" />
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-[#414141]">
          <span className="truncate">{thread.displayName}</span>
          <RoleBadge role={thread.role} />
        </h2>
        {thread.university && <p className="truncate text-xs font-semibold text-[#414141]/60">{thread.university}</p>}
      </div>
      {isWaiting(thread) && (
        <span className="hidden sm:inline-flex shrink-0 px-3 py-1 rounded-full bg-[#E64164]/10 text-xs font-bold text-[#B3205A]">
          Waiting for reply
        </span>
      )}
    </div>
  );
}

/**
 * Right pane: one conversation, oldest message at the top. Opens at the newest message and
 * follows new ones while the administrator is at the bottom (or when the new one is their own
 * reply); someone reading older messages is not pulled down — a "New message" button appears.
 * Mounted with key = client id, so every conversation starts fresh.
 */
export default function Conversation({ thread, adminId, nowMs, onBack, draft, onDraftChange }) {
  const { status, messages, error, sending, sendError, retry, send } = useConversation(thread.clientId);
  const groups = useMemo(() => groupByDay(messages, nowMs), [messages, nowMs]);
  const reducedMotion = useReducedMotion();

  const scrollRef = useRef(null);
  const atBottomRef = useRef(true);
  const lastIdRef = useRef(null);
  const [unseen, setUnseen] = useState(false);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    const box = scrollRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior });
  }, []);

  const handleScroll = () => {
    const box = scrollRef.current;
    if (!box) return;
    atBottomRef.current = box.scrollHeight - box.scrollTop - box.clientHeight < NEAR_BOTTOM_PX;
    if (atBottomRef.current) setUnseen(false);
  };

  // Runs before paint, so a conversation never flashes at its top before jumping down.
  // The same last message with more content around it (the first read finished after a realtime
  // message, or a name was added above a bubble): someone at the bottom stays at the bottom.
  useLayoutEffect(() => {
    const last = messages[messages.length - 1] ?? null;
    const lastId = last?.id ?? null;
    if (lastId === lastIdRef.current) {
      if (last && atBottomRef.current) scrollToBottom();
      return;
    }
    const opening = lastIdRef.current === null;
    lastIdRef.current = lastId;
    if (!last) return;
    if (opening || atBottomRef.current || last.senderId === adminId) {
      scrollToBottom();
      atBottomRef.current = true;
      setUnseen(false);
    } else {
      setUnseen(true);
    }
  }, [messages, adminId, scrollToBottom]);

  // The reply box grows and the window resizes: someone at the bottom stays at the bottom.
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) scrollToBottom();
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  let body;
  if (status === 'loading' && messages.length === 0) {
    body = <p className="py-10 text-center text-xs font-medium text-[#414141]/60">Loading messages…</p>;
  } else if (status === 'error' && messages.length === 0) {
    body = <ErrorBanner title="Could not load this conversation" error={error} onRetry={retry} />;
  } else if (messages.length === 0) {
    body = <EmptyState size="sm" icon={MessageSquare} title="No messages in this conversation" />;
  } else {
    body = groups.map((group) => (
      <section key={group.key} aria-label={group.label} className="mt-5 first:mt-1">
        <div className="flex items-center gap-3 mb-1">
          <span aria-hidden="true" className="h-px flex-1 bg-[#DCDCDC]/60" />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#414141]/60">{group.label}</h3>
          <span aria-hidden="true" className="h-px flex-1 bg-[#DCDCDC]/60" />
        </div>
        <ol>
          {group.messages.map((message, index) => {
            const previous = group.messages[index - 1];
            const firstOfRun =
              !previous ||
              previous.senderId !== message.senderId ||
              !(message.createdMs - previous.createdMs < RUN_GAP_MS);
            return (
              <Bubble key={message.id} message={message} thread={thread} adminId={adminId} firstOfRun={firstOfRun} />
            );
          })}
        </ol>
      </section>
    ));
  }

  return (
    <>
      <Header thread={thread} onBack={onBack} />
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          role="log"
          aria-label={`Messages with ${thread.displayName}`}
          className="h-full overflow-y-auto px-4 sm:px-6 pb-4 pt-2"
        >
          {body}
        </div>
        {unseen && (
          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center pointer-events-none">
            <button
              type="button"
              onClick={() => {
                scrollToBottom(reducedMotion ? 'auto' : 'smooth');
                setUnseen(false);
              }}
              className={`pointer-events-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FFFFFF] border border-[#DCDCDC] text-xs font-bold text-[#78003F] shadow-[0_8px_20px_rgba(65,65,65,0.12)] hover:bg-[#DCDCDC]/20 transition-colors ${RING}`}
            >
              <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
              New message
            </button>
          </div>
        )}
      </div>
      <ReplyBox
        recipient={thread.displayName}
        initialText={draft}
        onTextChange={onDraftChange}
        onSend={send}
        sending={sending}
        error={sendError}
      />
    </>
  );
}
