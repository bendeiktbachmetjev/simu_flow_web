import React from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { ROLE_ORDER } from '../data/constants.js';
import { fmt } from '../format.js';
import InfoHint from './InfoHint.jsx';
import LiveDot from './LiveDot.jsx';
import Meter from './Meter.jsx';

const ROLE_WORDS = {
  student: ['student', 'students'],
  teacher: ['teacher', 'teachers'],
  resident: ['resident', 'residents'],
  guest: ['guest', 'guests'],
};

const REFRESH_CLASS =
  'w-8 h-8 flex items-center justify-center rounded-full border border-[#DCDCDC] text-[#414141]/70 hover:bg-[#DCDCDC]/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';
const LINK_CLASS =
  'rounded-[4px] font-bold text-[#78003F] hover:text-[#E64164] transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';

const DASH = '—'; // shown until the first live answer arrives

const count = (n, [one, many]) => `${fmt.int(n)} ${n === 1 ? one : many}`;

// The value is re-keyed so a changed number fades in instead of snapping.
function Cell({ value, label, children }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span key={value} className="sf-fade text-xl font-extrabold leading-none text-[#414141]">
          {value}
        </span>
        {children}
      </div>
      <div className="mt-1 text-[11px] font-semibold text-[#414141]/75">{label}</div>
    </div>
  );
}

const centerCell = (inCenter) => {
  const total = inCenter?.total ?? 0;
  if (total === 0) return { value: '0', label: 'Nobody inside right now' };
  const roles = ROLE_ORDER.filter((role) => (inCenter.byRole?.[role] ?? 0) > 0).map((role) =>
    count(inCenter.byRole[role], ROLE_WORDS[role]),
  );
  return { value: fmt.int(total), label: ['in the center', ...roles].join(' · ') };
};

const simulatorsCell = (simulators) => {
  const total = simulators?.total ?? 0;
  const inUse = simulators?.inUse ?? 0;
  const bookedNow = simulators?.bookedNow ?? 0;
  const lead = inUse > 0 ? 'in use' : 'No simulator in use';
  return {
    value: `${fmt.int(inUse)} / ${fmt.int(total)}`,
    label: inUse > 0 || bookedNow > 0 ? `${lead} · ${fmt.int(bookedNow)} booked now` : lead,
    share: total > 0 ? inUse / total : 0,
  };
};

const roomsCell = (rooms) => ({
  value: `${fmt.int(rooms?.freeNow ?? 0)} / ${fmt.int(rooms?.total ?? 0)}`,
  label: 'rooms free · from bookings',
});

const todayCell = (today) => {
  const classes = today?.classes ?? 0;
  const events = today?.events ?? 0;
  if (classes + events === 0) return { value: '0', label: 'Nothing booked today' };
  const value = [
    classes > 0 ? count(classes, ['class', 'classes']) : null,
    events > 0 ? count(events, ['event', 'events']) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  if (today.now) return { value, label: `Now: ${today.now.label} until ${fmt.clock(today.now.untilMin)}` };
  if (today.next) return { value, label: `Next ${fmt.clock(today.next.startMin)}` };
  return { value, label: 'No more bookings today' };
};

/**
 * Live strip above the filter row of the Overview. `live` is the result of useLive().
 * It ignores the selected period. When a refresh fails the last numbers stay, the dot turns
 * gray and the lead says so; before the first answer every cell holds a dash so the strip
 * already has its final height.
 */
export default function RightNowStrip({ live }) {
  const { data = null, error = null, isStale = false, updatedAt = null, refresh } = live || {};
  const failed = Boolean(isStale || error);
  const stamp = updatedAt ?? data?.updatedAt ?? null;
  const leadText = failed ? "Couldn't refresh" : 'Right now';

  const center = data ? centerCell(data.inCenter) : { value: DASH, label: 'in the center' };
  const simulators = data ? simulatorsCell(data.simulators) : { value: DASH, label: 'simulators in use', share: 0 };
  const rooms = data ? roomsCell(data.rooms) : { value: DASH, label: 'rooms free · from bookings' };
  const today = data ? todayCell(data.today) : { value: DASH, label: 'booked today' };

  return (
    <section
      data-print="hide"
      aria-label="Right now in the center"
      className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3 rounded-[20px] bg-[#FFFFFF] border border-[#DCDCDC]/60 shadow-[0_4px_12px_rgba(65,65,65,0.06)]"
    >
      <div className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-[#E64164]/8 text-xs font-bold text-[#414141]">
        <LiveDot active={!failed && Boolean(data)} />
        <span>
          {leadText}
          {stamp ? ` · ${fmt.time(stamp)}` : ''}
        </span>
      </div>

      <Cell value={center.value} label={center.label} />

      <Cell value={simulators.value} label={simulators.label}>
        {/* Decorative: the same share is already spoken as "3 / 10". */}
        <div className="w-12" aria-hidden="true">
          <Meter tone="live" size="sm" value={simulators.share} />
        </div>
      </Cell>

      <Cell value={rooms.value} label={rooms.label} />

      <Cell
        value={today.value}
        label={
          <>
            {today.label}
            {' · '}
            <Link to="/admin/calendar" className={LINK_CLASS}>
              Open calendar →
            </Link>
          </>
        }
      />

      <div className="ml-auto flex items-center gap-2">
        {failed && typeof refresh === 'function' && (
          <button type="button" aria-label="Refresh live numbers" onClick={() => refresh()} className={REFRESH_CLASS}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
        <InfoHint hintKey="liveNow" label="Right now" />
      </div>
    </section>
  );
}
