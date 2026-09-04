import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Headset,
  Ticket,
} from 'lucide-react';
import moment from 'moment';
import EventModal from './EventModal';
import WeekGrid from './timeline/WeekGrid';
import EventsStrip from './timeline/EventsStrip';
import {
  LABEL_COL_WIDTH,
  LANE_HEIGHT,
  ROW_PADDING,
  PILL_HEIGHT,
  PILL_GRADIENTS,
  formatTime,
  shortName,
  getWeek,
  formatWeekLabel,
  buildDayTimeline,
  buildWeekGrid,
  buildPeriodEvents,
} from './timeline/model';

const NO_UNIVERSITY_MESSAGE =
  'Your admin profile has no university, so events cannot be created';

const VIEW_STORAGE_KEY = 'simuflow.timeline.view';

const EVENT_SELECT =
  'id, code, event_name, university, allowed_simulators, rooms, starts_at, ends_at';

// Header toggle chips (Empty rooms, Events) share one look.
const toggleChipClass = (pressed) =>
  `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
    pressed
      ? 'bg-[#78003F]/10 text-[#78003F] border-[#78003F]/40'
      : 'bg-[#FFFFFF] text-[#414141]/80 border-[#DCDCDC] hover:bg-[#DCDCDC]/20'
  }`;

const readStoredViewMode = () => {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'week' ? 'week' : 'day';
  } catch {
    return 'day';
  }
};

export default function SimulatorTimeline() {
  // The single navigation anchor in both modes ('YYYY-MM-DD').
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [viewMode, setViewMode] = useState(readStoredViewMode); // 'day' | 'week'
  const [showEmptyRooms, setShowEmptyRooms] = useState(false);
  const [eventsListOpen, setEventsListOpen] = useState(false);
  const [modal, setModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', event }
  const [focusRowKey, setFocusRowKey] = useState(null); // row to highlight after a week → day drill-down
  const [base, setBase] = useState(null); // { userId, university, simulators, rooms, teacherMap, teacherIds }
  const [schedules, setSchedules] = useState([]);
  const [events, setEvents] = useState([]);
  const [unscheduledEvents, setUnscheduledEvents] = useState([]); // events with no dates (starts_at null)
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);
  const [hovered, setHovered] = useState(null); // { item, x, top, bottom }
  const focusRowRef = useRef(null);

  // ISO week (Monday first) containing the anchor day; DST-safe (no millisecond day math).
  const week = useMemo(() => getWeek(selectedDate), [selectedDate]);

  const today = moment().format('YYYY-MM-DD');
  const isToday = selectedDate === today;
  const isThisWeek = week.days.includes(today);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch {
      /* storage unavailable (private mode, blocked) — the choice just does not persist */
    }
  }, [viewMode]);

  useEffect(() => {
    const loadBase = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        let university = null;
        if (user?.id) {
          const { data: adminRow } = await supabase
            .from('admins')
            .select('university')
            .eq('id', user.id)
            .maybeSingle();
          university = adminRow?.university || null;
        }

        let simQuery = supabase.from('simulators').select('id, number, name');
        if (university) simQuery = simQuery.eq('university', university);
        const { data: sims, error: simErr } = await simQuery;
        if (simErr) throw simErr;

        let roomQuery = supabase.from('rooms').select('name');
        if (university) roomQuery = roomQuery.eq('university', university);
        const { data: rms, error: roomErr } = await roomQuery;
        if (roomErr) throw roomErr;

        let teacherQuery = supabase.from('teachers').select('id, name, surname');
        if (university) teacherQuery = teacherQuery.eq('university', university);
        const { data: tchs, error: tchErr } = await teacherQuery;
        if (tchErr) throw tchErr;

        const teacherMap = {};
        (tchs || []).forEach((t, index) => {
          teacherMap[t.id] = {
            fullName: [t.name, t.surname].filter(Boolean).join(' '),
            shortName: shortName(t.name, t.surname),
            gradient: PILL_GRADIENTS[index % PILL_GRADIENTS.length],
          };
        });

        setBase({
          userId: user?.id || null,
          university,
          simulators: [...(sims || [])].sort(
            (a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0)
          ),
          rooms: [...(rms || [])].map(r => r.name).sort((a, b) => a.localeCompare(b)),
          teacherMap,
          teacherIds: (tchs || []).map(t => t.id),
        });
      } catch (err) {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    };
    loadBase();
  }, []);

  // One ISO week is fetched in both modes, so Day ↔ Week and moving inside the week never refetch.
  useEffect(() => {
    if (!base) return undefined;
    let cancelled = false; // a slower response for a previous week must not overwrite the current one

    const loadSchedules = async () => {
      try {
        setLoading(true);
        setError(null);
        setHovered(null); // pill may unmount without firing mouseleave

        // A scoped university with no teachers cannot have reservations.
        let scheduleQuery;
        if (base.university && base.teacherIds.length === 0) {
          scheduleQuery = Promise.resolve({ data: [], error: null });
        } else {
          scheduleQuery = supabase
            .from('teacher_schedules')
            .select('id, teacher_id, session_date, start_time, end_time, simulators, rooms, notes, course, groups, needs_assistance')
            .gte('session_date', week.days[0])
            .lte('session_date', week.days[6]);
          if (base.university) scheduleQuery = scheduleQuery.in('teacher_id', base.teacherIds);
        }

        // Events overlapping the local week, compared as UTC instants.
        let eventQuery = supabase
          .from('event_codes')
          .select(EVENT_SELECT)
          .lt('starts_at', week.weekEnd.toISOString())
          .gt('ends_at', week.weekStart.toISOString())
          .order('starts_at', { ascending: true });
        if (base.university) eventQuery = eventQuery.eq('university', base.university);

        // Events whose dates were cleared are invisible to the overlap query; list them separately.
        const unscheduledQuery = base.university
          ? supabase
              .from('event_codes')
              .select(EVENT_SELECT)
              .is('starts_at', null)
              .eq('university', base.university)
              .order('created_at')
          : Promise.resolve({ data: [], error: null });

        const [
          { data: schedData, error: schedErr },
          { data: eventData, error: eventErr },
          { data: unscheduledData, error: unscheduledErr },
        ] = await Promise.all([scheduleQuery, eventQuery, unscheduledQuery]);
        if (cancelled) return;
        // Keep whatever loaded; a failed source must not leave the previous week's pills on screen.
        setSchedules(schedErr ? [] : schedData || []);
        setEvents(eventErr ? [] : eventData || []);
        setUnscheduledEvents(unscheduledErr ? [] : unscheduledData || []);
        if (schedErr) throw schedErr;
        if (eventErr) throw eventErr;
        if (unscheduledErr) throw unscheduledErr;
        setHasLoaded(true);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadSchedules();

    return () => {
      cancelled = true;
    };
  }, [base, week.weekKey, refreshKey]);

  const timeline = useMemo(
    () =>
      base
        ? buildDayTimeline({ base, schedules, events, date: selectedDate, showEmptyRooms })
        : null,
    [base, schedules, events, selectedDate, showEmptyRooms]
  );

  const weekGrid = useMemo(
    () =>
      base && viewMode === 'week'
        ? buildWeekGrid({ base, schedules, events, days: week.days, selectedDate, showEmptyRooms })
        : null,
    [base, schedules, events, week, selectedDate, showEmptyRooms, viewMode]
  );

  const periodEvents = useMemo(
    () => buildPeriodEvents({ events, mode: viewMode, date: selectedDate, days: week.days }),
    [events, viewMode, selectedDate, week]
  );

  const hasUnplacedEvents = periodEvents.some(ev => !ev.placed);
  const eventsCount = periodEvents.length + unscheduledEvents.length;

  // Whichever view is active drives the count chip, the legend and the empty state.
  const active = viewMode === 'week' ? weekGrid : timeline;
  const activeTotal = active?.total ?? 0;

  const canCreate = Boolean(base?.university);

  const showTooltip = (item, rect) =>
    setHovered({
      item,
      x: rect.left + rect.width / 2,
      top: rect.top,
      bottom: rect.bottom,
    });
  const hideTooltip = () => setHovered(null);

  const switchView = (mode) => {
    setHovered(null);
    setViewMode(mode);
  };

  // Week ±7 keeps the weekday (Wed → Wed); day ±1.
  const shiftPeriod = (dir) => {
    setHovered(null);
    setSelectedDate(
      moment(selectedDate, 'YYYY-MM-DD')
        .add(dir * (viewMode === 'week' ? 7 : 1), 'day')
        .format('YYYY-MM-DD')
    );
  };

  const goToToday = () => {
    setHovered(null);
    setSelectedDate(moment().format('YYYY-MM-DD'));
  };

  const toggleEmptyRooms = () => {
    setHovered(null);
    setShowEmptyRooms(v => !v);
  };

  const openDay = (date, rowKey) => {
    setHovered(null);
    setSelectedDate(date);
    setViewMode('day');
    setFocusRowKey(rowKey ?? null);
  };

  const openEdit = (raw) => {
    setHovered(null);
    setModal({ mode: 'edit', event: raw });
  };

  const openCreate = () => {
    setHovered(null);
    setModal({ mode: 'create' });
  };

  const handleEventSaved = ({ starts_at }) => {
    if (starts_at) {
      const d = moment(starts_at).format('YYYY-MM-DD');
      if (d !== selectedDate) setSelectedDate(d); // week mode lands on that week automatically
    }
    setRefreshKey(k => k + 1);
  };

  const handleEventDeleted = () => setRefreshKey(k => k + 1);

  // After a week → day drill-down, scroll the row into view and highlight it briefly.
  useEffect(() => {
    if (!focusRowKey || !hasLoaded || loading) return undefined;
    focusRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const timer = setTimeout(() => setFocusRowKey(null), 1500);
    return () => clearTimeout(timer);
  }, [focusRowKey, loading, hasLoaded]);

  // Escape clears a keyboard-opened tooltip; the modal handles its own Escape.
  useEffect(() => {
    if (modal !== null) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setHovered(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modal]);

  const renderRow = (row, rowIndex) => {
    const focused = row.key === focusRowKey;
    return (
      <div
        key={row.key}
        ref={focused ? focusRowRef : undefined}
        className={`flex hover:bg-[#DCDCDC]/10 transition-colors ${
          rowIndex > 0 ? 'border-t border-[#DCDCDC]/40' : ''
        } ${focused ? 'bg-[#78003F]/5' : ''}`}
        style={{ height: row.height }}
      >
        <div
          style={{ width: LABEL_COL_WIDTH }}
          className="shrink-0 flex flex-col justify-center px-4 border-r border-[#DCDCDC]/40"
        >
          <span className="text-sm font-bold text-[#414141] truncate leading-tight">
            {row.title}
          </span>
          {row.subtitle && (
            <span className="text-[11px] font-semibold text-[#414141]/40 mt-0.5">
              {row.subtitle}
            </span>
          )}
        </div>

        <div className="relative flex-1">
          {timeline.hours
            .filter(h => {
              const pct = timeline.toPercent(h * 60);
              return pct > 0.5 && pct < 99.5;
            })
            .map(h => (
              <div
                key={h}
                className="absolute top-0 bottom-0 border-l border-[#DCDCDC]/40"
                style={{ left: `${timeline.toPercent(h * 60)}%` }}
              />
            ))}

          {timeline.nowPercent !== null && (
            <div
              className="absolute top-0 bottom-0 w-px bg-[#E64164] z-10"
              style={{ left: `${timeline.nowPercent}%` }}
            />
          )}

          {row.items.map(item => {
            const isEvent = item.kind === 'event';
            const eventProps = isEvent
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': `Guest event ${item.title}, edit`,
                  onClick: () => openEdit(item.raw),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openEdit(item.raw);
                    }
                  },
                }
              : {};
            return (
              <div
                key={item.id}
                className={`absolute z-[5] rounded-full flex items-center px-3.5 transition-transform duration-150 hover:scale-[1.02] ${
                  isEvent
                    ? 'cursor-pointer bg-[#78003F]/8 border-[1.5px] border-[#78003F] text-[#78003F] shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40'
                    : 'cursor-default text-white shadow-[0_4px_12px_rgba(120,0,63,0.25)]'
                }`}
                style={{
                  left: `${timeline.toPercent(item.startMin)}%`,
                  width: `${timeline.toPercent(item.endMin) - timeline.toPercent(item.startMin)}%`,
                  top: ROW_PADDING / 2 + item.lane * LANE_HEIGHT + (LANE_HEIGHT - PILL_HEIGHT) / 2,
                  height: PILL_HEIGHT,
                  minWidth: 44,
                  backgroundImage: isEvent
                    ? undefined
                    : `linear-gradient(90deg, ${item.gradient[0]}, ${item.gradient[1]})`,
                }}
                onMouseEnter={(e) => showTooltip(item, e.currentTarget.getBoundingClientRect())}
                onMouseLeave={hideTooltip}
                onFocus={(e) => showTooltip(item, e.currentTarget.getBoundingClientRect())}
                onBlur={hideTooltip}
                {...eventProps}
              >
                {isEvent ? (
                  <>
                    <Ticket className="w-3 h-3 mr-1 shrink-0" />
                    <span className="text-[11px] font-bold truncate shrink-0 max-w-full">
                      {item.title}
                    </span>
                  </>
                ) : (
                  <>
                    {item.needsAssistance && (
                      <Headset className="w-3 h-3 shrink-0 mr-1" />
                    )}
                    <span className="text-[11px] font-bold truncate shrink-0 max-w-full">
                      {item.teacher}
                    </span>
                    {item.note && (
                      <span className="text-[11px] font-medium text-white/75 truncate ml-1.5">
                        · {item.note}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Day view: the rooms box ends with the same toggle line as the week grid.
  const renderRoomsFooter = (section) => {
    const hidden = section.hiddenCount || 0;
    let text = null;
    if (section.rows.length === 0 && hidden > 0) {
      text = 'No room bookings today · Show all rooms';
    } else if (hidden > 0) {
      text = `${hidden} empty room${hidden === 1 ? '' : 's'} hidden · Show all rooms`;
    } else if (showEmptyRooms) {
      text = 'Hide empty rooms';
    }
    if (!text) return null;
    return (
      <button
        type="button"
        className={`w-full text-left px-4 py-2 text-[11px] font-medium text-[#414141]/45 hover:text-[#78003F] transition-colors ${
          section.rows.length > 0 ? 'border-t border-[#DCDCDC]/40' : ''
        }`}
        onClick={toggleEmptyRooms}
      >
        {text}
      </button>
    );
  };

  const hasResources = Boolean(base && (base.simulators.length > 0 || base.rooms.length > 0));

  return (
    <div className="bg-[#FFFFFF] rounded-[24px] shadow-[0_8px_20px_rgba(65,65,65,0.08)] border border-[#DCDCDC]/60 p-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
        <div>
          <h3 className="text-lg font-extrabold text-[#414141] flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#78003F]" />
            Simulator Schedule
          </h3>
          <p className="text-xs font-semibold text-[#414141]/60 mt-1">
            {viewMode === 'week'
              ? 'Reservations for every simulator and room in your center for the selected week'
              : 'Reservations for every simulator and room in your center on the selected day'}
          </p>
        </div>

        <span
          className="inline-flex shrink-0"
          title={base && !canCreate ? NO_UNIVERSITY_MESSAGE : undefined}
        >
          <button
            type="button"
            onClick={openCreate}
            disabled={!canCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-gradient-to-br from-[#78003F] to-[#E64164] text-white shadow-[0_4px_12px_rgba(120,0,63,0.25)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CalendarPlus className="w-4 h-4" />
            Create event
          </button>
        </span>
      </div>

      {base && !canCreate && (
        <p className="text-[11px] font-medium text-[#414141]/60 -mt-2 mb-4 sm:text-right">
          {NO_UNIVERSITY_MESSAGE}
        </p>
      )}

      {/* Toolbar: navigation on the left, state chips on the right. Wraps as two
          groups on narrow screens instead of scattering single buttons. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex p-0.5 rounded-full border border-[#DCDCDC] bg-[#FFFFFF]"
            role="group"
            aria-label="View"
          >
            {[
              ['day', 'Day'],
              ['week', 'Week'],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={viewMode === mode}
                onClick={() => switchView(mode)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  viewMode === mode
                    ? 'bg-[#78003F] text-white'
                    : 'text-[#414141]/70 hover:bg-[#DCDCDC]/20'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => shiftPeriod(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-[#DCDCDC] text-[#414141]/70 hover:bg-[#DCDCDC]/20 transition-colors"
            aria-label={viewMode === 'week' ? 'Previous week' : 'Previous day'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (!e.target.value) return;
                setHovered(null);
                setSelectedDate(e.target.value);
              }}
              onClick={(e) => {
                // Browsers only open the native calendar from the (invisible)
                // picker icon; showPicker() opens it from anywhere in the pill.
                try {
                  e.currentTarget.showPicker?.();
                } catch {
                  /* non-gesture or unsupported: input stays focusable */
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label={viewMode === 'week' ? 'Pick a week' : 'Pick a day'}
            />
            <div
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border border-[#DCDCDC] bg-[#FFFFFF] text-[#414141] pointer-events-none text-center ${
                viewMode === 'week' ? 'min-w-[190px]' : 'min-w-[130px]'
              }`}
            >
              {viewMode === 'week' ? (
                <>
                  <span className="text-[#414141]/45 mr-1">W{week.isoWeek} ·</span>
                  {formatWeekLabel(week.weekStart)}
                </>
              ) : (
                moment(selectedDate, 'YYYY-MM-DD').format('ddd, MMM D YYYY')
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => shiftPeriod(1)}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-[#DCDCDC] text-[#414141]/70 hover:bg-[#DCDCDC]/20 transition-colors"
            aria-label={viewMode === 'week' ? 'Next week' : 'Next day'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goToToday}
            className={toggleChipClass(viewMode === 'week' ? isThisWeek : isToday)}
          >
            {viewMode === 'week' ? 'This week' : 'Today'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {active && activeTotal > 0 && (
            <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#DCDCDC]/30 text-[#414141]/70">
              {active.countLabel}
            </span>
          )}
          <button
            type="button"
            onClick={toggleEmptyRooms}
            aria-pressed={showEmptyRooms}
            title="Show or hide rooms with no bookings"
            className={toggleChipClass(showEmptyRooms)}
          >
            {showEmptyRooms ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Empty rooms
          </button>
          {eventsCount > 0 && (
            <button
              type="button"
              onClick={() => setEventsListOpen(open => !open)}
              aria-expanded={eventsListOpen}
              className={toggleChipClass(eventsListOpen)}
            >
              <Ticket className="w-3.5 h-3.5" />
              {`Events · ${eventsCount}`}
              {hasUnplacedEvents && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#E64164]"
                  title="Some events reserve no simulator or room"
                />
              )}
            </button>
          )}
        </div>
      </div>

      {active && activeTotal > 0 && (
        <div className="flex flex-wrap items-center gap-4 -mt-1 mb-4 text-[11px] font-semibold text-[#414141]/60">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#78003F] to-[#E64164]" />
            Teacher class
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#78003F]/8 border-[1.5px] border-[#78003F]" />
            Guest event
          </span>
        </div>
      )}

      {eventsListOpen && eventsCount > 0 && (
        <EventsStrip
          title={
            viewMode === 'week'
              ? `Events · ${formatWeekLabel(week.weekStart)}`
              : `Events on ${moment(selectedDate, 'YYYY-MM-DD').format('ddd, D MMM')}`
          }
          events={periodEvents}
          unscheduled={unscheduledEvents}
          onEdit={openEdit}
        />
      )}

      {error && (
        <div className="text-sm font-semibold text-[#E64164] mb-4">{error}</div>
      )}

      {!timeline || (loading && !hasLoaded) ? (
        <div className="h-48 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-t-2 border-[#78003F] border-opacity-40"></div>
        </div>
      ) : !hasResources ? (
        <div className="h-48 flex items-center justify-center text-[#414141]/60 font-medium">
          No simulators or rooms found for your center.
        </div>
      ) : (
        <div
          className={`overflow-x-auto pb-2 pr-5 ${
            loading && hasLoaded ? 'transition-opacity opacity-60 pointer-events-none' : ''
          }`}
        >
          {viewMode === 'week' && weekGrid ? (
            <>
              <WeekGrid
                grid={weekGrid}
                showEmptyRooms={showEmptyRooms}
                onToggleEmptyRooms={toggleEmptyRooms}
                onOpenDay={openDay}
                onEditEvent={openEdit}
                onHoverItem={showTooltip}
                onLeaveItem={hideTooltip}
              />
              {weekGrid.total === 0 && !loading && (
                <div className="text-center text-sm font-medium text-[#414141]/50 mt-4">
                  No reservations from {week.weekStart.format('D MMM')} to{' '}
                  {week.weekStart.clone().add(6, 'day').format('D MMM')} — all simulators and rooms are free.
                </div>
              )}
            </>
          ) : (
            <div className="min-w-[780px]">
              {/* Hour axis */}
              <div className="flex">
                <div style={{ width: LABEL_COL_WIDTH }} className="shrink-0" />
                <div className="relative flex-1 h-7">
                  {timeline.hours.map(h => (
                    <span
                      key={h}
                      className="absolute top-0 -translate-x-1/2 text-[11px] font-semibold text-[#414141]/50"
                      style={{ left: `${timeline.toPercent(h * 60)}%` }}
                    >
                      {String(h).padStart(2, '0')}:00
                    </span>
                  ))}
                  {timeline.nowPercent !== null && (
                    <span
                      className="absolute bottom-0 -translate-x-1/2 w-2 h-2 rounded-full bg-[#E64164] shadow-[0_0_6px_rgba(230,65,100,0.6)]"
                      style={{ left: `${timeline.nowPercent}%` }}
                    />
                  )}
                </div>
              </div>

              {/* Resource sections: simulators, then rooms */}
              {timeline.sections.map((section, sectionIndex) => {
                const isRooms = section.key === 'rooms' || section.label === 'Rooms';
                return (
                  <div key={section.label} className={sectionIndex > 0 ? 'mt-5' : ''}>
                    <div className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#414141]/45 mb-1.5 pl-1">
                      {section.label}
                    </div>
                    <div className="rounded-[16px] border border-[#DCDCDC]/50 overflow-hidden bg-gradient-to-b from-[#FFFFFF] to-[#DCDCDC]/10">
                      {section.rows.map((row, rowIndex) => renderRow(row, rowIndex))}
                      {isRooms && renderRoomsFooter(section)}
                    </div>
                  </div>
                );
              })}

              {timeline.total === 0 && !loading && (
                <div className="text-center text-sm font-medium text-[#414141]/50 mt-4">
                  No reservations on {moment(selectedDate, 'YYYY-MM-DD').format('MMMM D')} — all simulators and rooms are free.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fixed-position tooltip escapes the overflow container */}
      {hovered && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: Math.min(
              Math.max(hovered.x, 150),
              (typeof window !== 'undefined' ? window.innerWidth : 1280) - 150
            ),
            top: hovered.top > 170 ? hovered.top - 10 : hovered.bottom + 10,
            transform:
              hovered.top > 170
                ? 'translate(-50%, -100%)'
                : 'translate(-50%, 0)',
          }}
        >
          <div className="bg-[#414141] text-white rounded-[12px] px-3.5 py-2.5 shadow-xl max-w-[280px] w-max">
            {hovered.item.kind === 'event' ? (
              <>
                <div className="text-xs font-bold whitespace-nowrap">
                  {viewMode === 'week' && hovered.item.dateLabel ? `${hovered.item.dateLabel} · ` : ''}
                  {hovered.item.spansBeyondDay
                    ? `${moment(hovered.item.startsAt).format('D MMM HH:mm')} – ${moment(hovered.item.endsAt).format('D MMM HH:mm')}`
                    : `${formatTime(hovered.item.startMin)} – ${formatTime(hovered.item.endMin)}`}
                </div>
                <div className="text-[11px] font-semibold text-white/70 mt-1 flex items-center gap-1">
                  <Ticket className="w-3 h-3 shrink-0" />
                  Guest event
                </div>
                <div className="text-xs font-bold text-white/90 mt-0.5">
                  {hovered.item.title}
                </div>
                <div className="text-[11px] font-medium text-white/60 mt-0.5 font-mono tracking-wide">
                  Code: {hovered.item.code}
                </div>
                {hovered.item.simNames?.length > 0 && (
                  <div className="text-[11px] font-medium text-white/60 mt-0.5">
                    Simulators: {hovered.item.simNames.join(', ')}
                  </div>
                )}
                {hovered.item.roomNames?.length > 0 && (
                  <div className="text-[11px] font-medium text-white/60 mt-0.5">
                    Rooms: {hovered.item.roomNames.join(', ')}
                  </div>
                )}
                <div className="text-[10px] font-medium text-white/50 mt-1.5">Click to edit</div>
              </>
            ) : (
              <>
                <div className="text-xs font-bold whitespace-nowrap">
                  {viewMode === 'week' && hovered.item.dateLabel ? `${hovered.item.dateLabel} · ` : ''}
                  {formatTime(hovered.item.startMin)} – {formatTime(hovered.item.endMin)}
                </div>
                <div className="text-xs font-semibold text-white/90 mt-1 whitespace-nowrap">
                  {hovered.item.teacher}
                </div>
                {(hovered.item.course || hovered.item.groups.length > 0) && (
                  <div className="text-[11px] font-medium text-white/60 mt-0.5">
                    {hovered.item.course && `Course ${hovered.item.course}`}
                    {hovered.item.course && hovered.item.groups.length > 0 && ' · '}
                    {hovered.item.groups.length > 0 &&
                      `Group${hovered.item.groups.length > 1 ? 's' : ''} ${hovered.item.groups.join(', ')}`}
                  </div>
                )}
                {hovered.item.simNames.length > 0 && (
                  <div className="text-[11px] font-medium text-white/60 mt-0.5">
                    Simulators: {hovered.item.simNames.join(', ')}
                  </div>
                )}
                {hovered.item.roomNames.length > 0 && (
                  <div className="text-[11px] font-medium text-white/60 mt-0.5">
                    Rooms: {hovered.item.roomNames.join(', ')}
                  </div>
                )}
                {hovered.item.needsAssistance && (
                  <div className="text-[11px] font-bold text-[#FB7185] mt-1 flex items-center gap-1">
                    <Headset className="w-3 h-3 shrink-0" />
                    Simulation specialist needed
                  </div>
                )}
                {hovered.item.note && (
                  <div className="text-[11px] font-medium text-white/75 mt-1 border-t border-white/10 pt-1.5">
                    {hovered.item.note}
                  </div>
                )}
                {viewMode === 'week' && (
                  <div className="text-[10px] font-medium text-white/50 mt-1.5">Click to open the day</div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <EventModal
        open={modal !== null}
        mode={modal?.mode ?? 'create'}
        event={modal?.event ?? null}
        onClose={() => setModal(null)}
        onSaved={handleEventSaved}
        onDeleted={handleEventDeleted}
        university={base?.university || null}
        userId={base?.userId || null}
        simulators={base?.simulators || []}
        rooms={base?.rooms || []}
        defaultDate={selectedDate}
      />
    </div>
  );
}
