import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { fmt } from '../format.js';

const RETRY_CLASS =
  'ml-auto shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-[#DCDCDC] bg-[#FFFFFF] text-[#414141]/80 hover:bg-[#DCDCDC]/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';

/**
 * Two uses. Nothing could be loaded: `message` (or `error`, a DataError whose message is
 * already written for people) plus `onRetry`. A background refresh failed but older data is
 * still on screen: pass `staleAt` (ms of the last good load) and the banner says so instead.
 * A missing university cannot be fixed by retrying, so that case gets no button.
 */
export default function ErrorBanner({ title = 'Could not load data', message, error, onRetry, staleAt, className = '' }) {
  const heading = staleAt ? `Couldn't refresh — showing data from ${fmt.time(staleAt)}.` : title;
  const body = message ?? error?.message ?? null;
  const canRetry = typeof onRetry === 'function' && error?.code !== 'NO_UNIVERSITY';

  return (
    <div
      role="alert"
      className={['flex items-start gap-3 p-4 rounded-[16px] bg-[#E64164]/10 border border-[#E64164]/20', className]
        .filter(Boolean)
        .join(' ')}
    >
      <AlertTriangle className="w-5 h-5 text-[#E64164] shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-bold text-[#B3205A]">{heading}</p>
        {body && <p className="text-sm font-medium text-[#414141]/80">{body}</p>}
      </div>
      {canRetry && (
        <button type="button" onClick={() => onRetry()} className={RETRY_CLASS}>
          Retry
        </button>
      )}
    </div>
  );
}
