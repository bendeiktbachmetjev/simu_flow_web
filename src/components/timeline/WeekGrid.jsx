import React from 'react';
import moment from 'moment';
import { Headset, Ticket } from 'lucide-react';
import {
  DAY_COL_MIN,
  LABEL_COL_WIDTH,
  MAX_VISIBLE_CHIPS,
  PILL_GRADIENTS,
  WEEK_MIN_WIDTH,
} from './model';

// Every grid row shares this template so the label column and the seven day
// columns line up from the header down to the last room.
export const WEEK_GRID_STYLE = {
  gridTemplateColumns: `${LABEL_COL_WIDTH}px repeat(7, minmax(${DAY_COL_MIN}px, 1fr))`,
};

const roomsFooterText = (section, showEmptyRooms) => {
  if (section.hiddenCount > 0 && section.rows.length === 0) {
    return 'No room bookings this week · Show all rooms';
  }
  if (section.hiddenCount > 0) {
    return `${section.hiddenCount} empty room${section.hiddenCount === 1 ? '' : 's'} hidden · Show all rooms`;
  }
  if (showEmptyRooms) return 'Hide empty rooms';
  return null;
};

function WeekChip({ item, isToday, nowMin, rowKey, onOpenDay, onEditEvent, onHoverItem, onLeaveItem }) {
  const isEvent = item.kind === 'event';
  const inProgress = isToday && nowMin >= item.startMin && nowMin < item.endMin;
  const gradient = item.gradient || PILL_GRADIENTS[0];

  const hover = (e) => onHoverItem?.(item, e.currentTarget.getBoundingClientRect());
  const leave = () => onLeaveItem?.();

  return (
    <button
      type="button"
      className={`w-full min-w-0 h-[34px] rounded-full px-3 flex items-center gap-1.5 text-left transition-[filter,background-color] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40 ${
        isEvent
          ? 'bg-[#78003F]/8 border-[1.5px] border-[#78003F] text-[#78003F] hover:bg-[#78003F]/15'
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
        else onOpenDay?.(item.date, rowKey);
      }}
    >
      {isEvent && <Ticket className="w-3 h-3 shrink-0" />}
      {!isEvent && item.needsAssistance && <Headset className="w-3 h-3 shrink-0" />}
      {inProgress && (
        <span className="w-1.5 h-1.5 rounded-full bg-[#E64164] shrink-0" title="In progress" />
      )}
      <span className="flex flex-col min-w-0 leading-none">
        {/* Only the name truncates; the time is short enough to always fit. */}
        <span className="text-[10px] font-semibold tabular-nums opacity-80 truncate">
          {item.timeLabel}
        </span>
        <span className="text-[11px] font-bold truncate mt-[3px]">{item.label}</span>
      </span>
    </button>
  );
}

export default function WeekGrid({
  grid,
  showEmptyRooms = false,
  onToggleEmptyRooms,
  onOpenDay,
  onEditEvent,
  onHoverItem,
  onLeaveItem,
}) {
  if (!grid) return null;

  return (
    <div style={{ minWidth: WEEK_MIN_WIDTH }}>
      {/* Day header row: Mon … Sun, each a button that opens that day */}
      <div className="grid mb-1" style={WEEK_GRID_STYLE}>
        <div className="sticky left-0 z-[2] bg-[#FFFFFF]" />
        {grid.days.map(d => (
          <button
            key={d.date}
            type="button"
            className={`group flex flex-col items-center justify-center gap-0.5 h-16 rounded-[12px] hover:bg-[#DCDCDC]/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40 ${
              d.isWeekend ? 'bg-[#DCDCDC]/10' : ''
            }`}
            title={`Open ${moment(d.date, 'YYYY-MM-DD').format('dddd D MMMM')} in day view`}
            onClick={() => onOpenDay?.(d.date, null)}
          >
            <span className="text-[10px] font-extrabold tracking-[0.08em] uppercase text-[#414141]/45">
              {d.weekday}
            </span>
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                d.isToday
                  ? 'bg-[#78003F] text-white'
                  : d.isAnchor
                    ? 'ring-1 ring-[#78003F] text-[#78003F]'
                    : 'text-[#414141]'
              }`}
            >
              {d.dayNum}
            </span>
            <span className="text-[10px] font-semibold text-[#414141]/40 truncate max-w-full px-1">
              {d.countLabel}
            </span>
          </button>
        ))}
      </div>

      {/* Resource sections: simulators (never filtered), then rooms */}
      {grid.sections.map((section, sectionIndex) => {
        const isRooms = section.key === 'rooms';
        const footerText = isRooms ? roomsFooterText(section, showEmptyRooms) : null;
        return (
          <div key={section.key || section.label} className={sectionIndex > 0 ? 'mt-5' : ''}>
            <div className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#414141]/45 mb-1.5 pl-1">
              {section.label}
            </div>
            {/* overflow-clip (not hidden): a hidden overflow would stop the sticky label column */}
            <div className="rounded-[16px] border border-[#DCDCDC]/50 overflow-clip bg-gradient-to-b from-[#FFFFFF] to-[#DCDCDC]/10">
              {section.rows.map((row, rowIndex) => (
                <div
                  key={row.key}
                  className={`grid min-h-[46px] hover:bg-[#DCDCDC]/10 transition-colors ${
                    rowIndex > 0 ? 'border-t border-[#DCDCDC]/40' : ''
                  }`}
                  style={WEEK_GRID_STYLE}
                >
                  <div className="sticky left-0 z-[2] bg-[#FFFFFF] flex flex-col justify-center px-4 border-r border-[#DCDCDC]/40 min-w-0">
                    <span className="text-sm font-bold text-[#414141] truncate leading-tight">
                      {row.title}
                    </span>
                    {row.subtitle && (
                      <span className="text-[11px] font-semibold text-[#414141]/40 mt-0.5">
                        {row.subtitle}
                      </span>
                    )}
                  </div>

                  {row.cells.map((cell, dayIndex) => {
                    const day = grid.days[dayIndex];
                    const visible = cell.items.slice(0, MAX_VISIBLE_CHIPS);
                    const more = cell.items.length - visible.length;
                    return (
                      <div
                        key={cell.date}
                        className={`flex flex-col gap-1 px-1.5 py-1.5 min-w-0 border-l border-[#DCDCDC]/40 ${
                          day?.isToday
                            ? 'bg-[#78003F]/4'
                            : day?.isWeekend
                              ? 'bg-[#DCDCDC]/10'
                              : ''
                        }`}
                      >
                        {section.key === 'simulators' && !row.hasAny && dayIndex === 0 && (
                          <span className="text-[11px] font-medium text-[#414141]/35 px-1 self-start">
                            Free all week
                          </span>
                        )}
                        {visible.map(item => (
                          <WeekChip
                            key={item.id}
                            item={item}
                            isToday={Boolean(day?.isToday)}
                            nowMin={grid.nowMin}
                            rowKey={row.key}
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
                            onClick={() => onOpenDay?.(cell.date, row.key)}
                          >
                            +{more} more
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {footerText && (
                <button
                  type="button"
                  className={`w-full text-left px-4 py-2 text-[11px] font-medium text-[#414141]/45 hover:text-[#78003F] transition-colors ${
                    section.rows.length > 0 ? 'border-t border-[#DCDCDC]/40' : ''
                  }`}
                  onClick={onToggleEmptyRooms}
                >
                  {footerText}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
