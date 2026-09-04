import React, { useState } from 'react';
import { Ticket } from 'lucide-react';

const MAX_CHIPS = 8;

const LABEL_CLASS =
  'text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#414141]/45 mr-1';

const CHIP_CLASS =
  'inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-bold bg-[#78003F]/8 border-[1.5px] border-[#78003F] text-[#78003F] hover:bg-[#78003F]/15 transition-colors max-w-[320px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';

// Every event of the visible period as a clickable chip, so an event that
// reserves nothing (or has no dates) is still one click away from editing.
// `events` come from buildPeriodEvents; `unscheduled` are raw event_codes rows
// with no dates (starts_at null) for the admin's university.
export default function EventsStrip({ title, events = [], unscheduled = [], onEdit }) {
  // Expansion is remembered for the title it was opened under, so a new day
  // or week starts collapsed again without an effect.
  const [expandedFor, setExpandedFor] = useState(null);
  const expanded = expandedFor === title;

  const visible = expanded ? events : events.slice(0, MAX_CHIPS);
  const hiddenCount = events.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-2 -mt-1 mb-4">
      <span className={LABEL_CLASS}>{title}</span>

      {visible.map(ev => (
        <button
          key={ev.id}
          type="button"
          className={`${CHIP_CLASS} ${ev.placed ? '' : 'border-dashed'}`}
          title={ev.placed ? 'Edit this event' : 'This event reserves no simulator or room'}
          onClick={() => onEdit?.(ev.raw)}
        >
          <Ticket className="w-3 h-3 shrink-0" />
          <span className="truncate">{ev.title}</span>
          <span className="font-semibold tabular-nums opacity-70 shrink-0">{ev.timeLabel}</span>
          {!ev.placed && (
            <span className="font-medium text-[#78003F]/60 shrink-0">· no simulator or room</span>
          )}
        </button>
      ))}

      {hiddenCount > 0 && (
        <button
          type="button"
          className={CHIP_CLASS}
          onClick={() => setExpandedFor(title)}
        >
          +{hiddenCount} more
        </button>
      )}

      {unscheduled.length > 0 && (
        <>
          <span className={`${LABEL_CLASS} ${events.length > 0 ? 'ml-2' : ''}`}>
            Unscheduled
          </span>
          {unscheduled.map(ev => {
            const raw = ev.raw ?? ev; // accept raw rows or already-shaped entries
            const name = ev.title || raw.event_name || raw.code;
            return (
              <button
                key={raw.id ?? ev.id}
                type="button"
                className={`${CHIP_CLASS} border-dashed`}
                title="This event has no dates, so it is not on the calendar"
                onClick={() => onEdit?.(raw)}
              >
                <Ticket className="w-3 h-3 shrink-0" />
                <span className="truncate">{name}</span>
                <span className="font-mono font-semibold tracking-wide opacity-70 shrink-0">
                  {raw.code}
                </span>
                <span className="font-medium text-[#78003F]/60 shrink-0">· no dates</span>
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}
