import React, { useMemo, useState } from 'react';
import { CheckCircle2, MessageSquare, Search } from 'lucide-react';
import { EmptyState, ErrorBanner, Segmented } from '../../ui';
import {
  filterThreads,
  isWaiting,
  messagePreview,
  threadTimeLabel,
  waitingCount,
} from '../../data/support/threads.js';
import { Avatar, RoleBadge } from './Person.jsx';

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';

const SEARCH_CLASS =
  'w-full pl-9 pr-3 py-2 rounded-full border border-[#DCDCDC] bg-[#FFFFFF] text-sm font-medium text-[#414141] placeholder:text-[#414141]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';

function ThreadRow({ thread, selected, onSelect, nowMs, adminId }) {
  const waiting = isWaiting(thread);
  const fromStaff = Boolean(thread.lastSenderId) && thread.lastSenderId !== thread.clientId;
  let prefix = '';
  if (fromStaff) prefix = thread.lastSenderId === adminId ? 'You: ' : 'Staff: ';

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(thread.clientId)}
        aria-current={selected ? 'true' : undefined}
        className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-[16px] transition-colors ${
          selected ? 'bg-[#78003F]/10' : 'hover:bg-[#DCDCDC]/20'
        } ${RING}`}
      >
        <Avatar name={thread.name} surname={thread.surname} waiting={waiting} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`truncate text-sm text-[#414141] ${waiting ? 'font-extrabold' : 'font-semibold'}`}>
              {thread.displayName}
            </span>
            <RoleBadge role={thread.role} />
            <span
              className={`ml-auto shrink-0 pl-1 text-[11px] font-semibold ${waiting ? 'text-[#B3205A]' : 'text-[#414141]/60'}`}
            >
              {threadTimeLabel(thread.lastMs, nowMs)}
            </span>
          </span>
          <span
            className={`mt-0.5 block truncate text-xs ${waiting ? 'font-semibold text-[#414141]/80' : 'font-medium text-[#414141]/60'}`}
          >
            {prefix}
            {messagePreview(thread.lastContent)}
          </span>
          {waiting && <span className="sr-only">Waiting for a reply.</span>}
        </span>
      </button>
    </li>
  );
}

/**
 * Left pane: search by name, "All / Waiting for reply" and one row per conversation, newest first.
 * The row of a person who waits for a reply has a red dot and bold text.
 */
export default function ThreadList({
  threads,
  status,
  error,
  isStale,
  updatedAt,
  selectedId,
  onSelect,
  onRetry,
  nowMs,
  adminId,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const waiting = waitingCount(threads);
  const visible = useMemo(
    () => filterThreads(threads, { query, waitingOnly: filter === 'waiting' }),
    [threads, query, filter]
  );

  const options = [
    { value: 'all', label: 'All' },
    { value: 'waiting', label: waiting > 0 ? `Waiting for reply (${waiting})` : 'Waiting for reply' },
  ];

  let content;
  if (threads.length === 0 && status === 'loading') {
    content = <p className="px-4 py-10 text-center text-xs font-medium text-[#414141]/60">Loading conversations…</p>;
  } else if (threads.length === 0 && status === 'error') {
    content = <ErrorBanner title="Could not load conversations" error={error} onRetry={onRetry} className="m-2" />;
  } else if (threads.length === 0) {
    content = (
      <EmptyState
        size="sm"
        icon={MessageSquare}
        title="No conversations yet"
        hint="When someone writes to support in the SimuFlow app, the conversation appears here."
        className="py-10"
      />
    );
  } else if (visible.length === 0 && query.trim()) {
    content = (
      <EmptyState
        size="sm"
        icon={Search}
        title={`Nobody matches “${query.trim()}”`}
        hint="The search looks at first names and surnames."
        className="py-10"
      />
    );
  } else if (visible.length === 0) {
    content = (
      <EmptyState
        size="sm"
        icon={CheckCircle2}
        title="Nobody is waiting for a reply"
        hint="Every conversation ends with an answer from the center."
        className="py-10"
      />
    );
  } else {
    content = (
      <ul aria-label="Conversations" className="space-y-1">
        {visible.map((thread) => (
          <ThreadRow
            key={thread.clientId}
            thread={thread}
            selected={thread.clientId === selectedId}
            onSelect={onSelect}
            nowMs={nowMs}
            adminId={adminId}
          />
        ))}
      </ul>
    );
  }

  return (
    <>
      <div className="p-4 space-y-3 border-b border-[#DCDCDC]/60">
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-[#414141]/50" aria-hidden="true" />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name"
            aria-label="Search conversations by name"
            autoComplete="off"
            className={SEARCH_CLASS}
          />
        </div>
        <Segmented options={options} value={filter} onChange={setFilter} ariaLabel="Show conversations" />
      </div>
      {isStale && threads.length > 0 && <ErrorBanner staleAt={updatedAt} className="mx-3 mt-3" />}
      <div className="flex-1 min-h-0 overflow-y-auto p-2">{content}</div>
    </>
  );
}
