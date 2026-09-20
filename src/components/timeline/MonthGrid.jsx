import React from 'react';
import moment from 'moment';
import { Headset, Ticket } from 'lucide-react';
import { MAX_VISIBLE_CHIPS, PILL_GRADIENTS, formatTime } from './model';

// Mon … Sun column headers; computed once, the locale never changes at runtime.
const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, i) =>
  moment().isoWeekday(i + 1).format('ddd').toUpperCase()
);

// Compact one-line chip: 'HH:mm teacher' for a class, 'HH:mm title' for an event.
// Entries share the reservation item shape, so the container's tooltip works unchanged.
function MonthChip({ item, onOpenDay, onEditEvent, onHoverItem, onLeaveItem }) {
  const isEvent = item.kind === 'event';
  const gradient = item.gradient || PILL_GRADIENTS[0];

  const hover = (e) => onHoverItem?.(item, e.currentTarget.getBoundingClientRect());
  const leave = () => onLeaveItem?.();

  return (
    <button
      type="button"
      className={`w-full min-w-0 h-[22px] rounded-full px-2 flex items-center gap-1 text-left text-[10px] leading-none transition-[filter,background-color] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40 ${
        isEvent
          ? `bg-[#78003F]/8 border-[1.5px] border-[#78003F] text-[#78003F] hover:bg-[#78003F]/15 ${
              item.placed ? '' : 'border-dashed'
            }`
          : 'text-white shadow-[0_2px_6px_rgba(120,0,63,0.18)] hover:brightness-95'
      }`}
      style={
        isEvent
          ? undefined
          : { backgroundImage: `linear-gradient(90deg, ${gradient[0]}, ${gradient[1]})` }
      }
      aria-label={`${item.timeLabel} ${
        isEvent ? `guest event ${item.title}, edit` : `${item.teacher}, open day`
      }`}
      onMouseEnter={hover}
      onFocus={hover}
      onMouseLeave={leave}
      onBlur={leave}
      onClick={() => {
        if (isEvent) onEditEvent?.(item.raw);
        else onOpenDay?.(item.date, null);
      }}
    >
      {isEvent && <Ticket className="w-2.5 h-2.5 shrink-0" />}
      {!isEvent && item.needsAssistance && <Headset className="w-2.5 h-2.5 shrink-0" />}
      <span className="font-semibold tabular-nums opacity-80 shrink-0">
        {formatTime(item.startMin)}
      </span>
      <span className="font-bold truncate">{isEvent ? item.title : item.teacherShort}</span>
    </button>
  );
}

function MonthCell({ day, isFirstInRow, onOpenDay, onEditEvent, onHoverItem, onLeaveItem }) {
  const visible = day.entries.slice(0, MAX_VISIBLE_CHIPS);
  const more = day.entries.length - visible.length;
  const longDate = moment(day.date, 'YYYY-MM-DD').format('dddd D MMMM');

  const numberClass = day.isToday
    ? 'bg-[#78003F] text-white'
    : day.isAnchor
      ? 'ring-1 ring-[#78003F] text-[#78003F] hover:bg-[#78003F]/8'
      : `${day.inMonth ? 'text-[#414141]' : 'text-[#414141]/35'} hover:bg-[#DCDCDC]/30`;
  const cellBg = day.isToday
    ? 'bg-[#78003F]/4'
    : !day.inMonth || day.isWeekend
      ? 'bg-[#DCDCDC]/10'
      : '';
  const hours = Math.round((day.bookedMinutes / 60) * 10) / 10;

  return (
    <div
      className={`flex flex-col gap-1 min-h-[112px] min-w-0 px-1.5 py-1.5 ${
        isFirstInRow ? '' : 'border-l border-[#DCDCDC]/40'
      } ${cellBg}`}
    >
      <button
        type="button"
        className={`w-7 h-7 rounded-full flex items-center justify-center self-start text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40 ${numberClass}`}
        title={`Open ${longDate} in day view`}
        onClick={() => onOpenDay?.(day.date, null)}
      >
        {day.dayNum}
      </button>

      {/* Load bar: planned hours that day against an 8-hour day (or the month's busiest day). */}
      {day.loadPercent > 0 && (
        <div
          className="h-[3px] rounded-full bg-[#DCDCDC]/60 overflow-hidden"
          title={`${hours} h planned`}
        >
          <div className="h-full rounded-full bg-[#78003F]" style={{ width: `${day.loadPercent}%` }} />
        </div>
      )}

      {visible.map(item => (
        <MonthChip
          key={item.id}
          item={item}
          onOpenDay={onOpenDay}
          onEditEvent={onEditEvent}
          onHoverItem={onHoverItem}
          onLeaveItem={onLeaveItem}
        />
      ))}
      {more > 0 && (
        <button
          type="button"
          className="h-[22px] px-2 rounded-full text-[11px] font-semibold text-[#78003F] hover:bg-[#78003F]/8 self-start"
          onClick={() => onOpenDay?.(day.date, null)}
        >
          +{more} more
        </button>
      )}
    </div>
  );
}

// Month view: Mon–Sun rows of day cells from buildMonthGrid. Day numbers and class
// chips open the day view; event chips open the edit modal, like the week grid.
export default function MonthGrid({ grid, onOpenDay, onEditEvent, onHoverItem, onLeaveItem }) {
  if (!grid) return null;

  return (
    <div className="min-w-[840px]">
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`h-8 flex items-center justify-center rounded-[12px] text-[10px] font-extrabold tracking-[0.08em] uppercase text-[#414141]/45 ${
              i >= 5 ? 'bg-[#DCDCDC]/10' : ''
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="rounded-[16px] border border-[#DCDCDC]/50 overflow-clip bg-gradient-to-b from-[#FFFFFF] to-[#DCDCDC]/10">
        {grid.weeks.map((week, weekIndex) => (
          <div
            key={week.key}
            className={`grid grid-cols-7 ${weekIndex > 0 ? 'border-t border-[#DCDCDC]/40' : ''}`}
          >
            {week.days.map((day, dayIndex) => (
              <MonthCell
                key={day.date}
                day={day}
                isFirstInRow={dayIndex === 0}
                onOpenDay={onOpenDay}
                onEditEvent={onEditEvent}
                onHoverItem={onHoverItem}
                onLeaveItem={onLeaveItem}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
