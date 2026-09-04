import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Headset,
  Ticket,
} from 'lucide-react';
import moment from 'moment';
import CreateEventModal from './CreateEventModal';

const NO_UNIVERSITY_MESSAGE =
  'Your admin profile has no university, so events cannot be created';

// Center working hours shown by default; the window expands if a reservation falls outside it.
const DEFAULT_OPEN_HOUR = 8;
const DEFAULT_CLOSE_HOUR = 20;

const LABEL_COL_WIDTH = 190;
const LANE_HEIGHT = 44;
const ROW_PADDING = 12;
const PILL_HEIGHT = 34;

// Per-teacher pill gradients, all within the brand family.
const PILL_GRADIENTS = [
  ['#78003F', '#E64164'],
  ['#4C1D95', '#8B5CF6'],
  ['#831843', '#EC4899'],
  ['#414141', '#737373'],
  ['#9D174D', '#FB7185'],
];

const timeToMinutes = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':');
  return parseInt(h, 10) * 60 + (parseInt(m, 10) || 0);
};

const formatTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// Assign overlapping reservations of one resource to stacked lanes.
const assignLanes = (items) => {
  const laneEnds = [];
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const placed = sorted.map(item => {
    let lane = laneEnds.findIndex(end => end <= item.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMin);
    } else {
      laneEnds[lane] = item.endMin;
    }
    return { ...item, lane };
  });
  return { items: placed, laneCount: Math.max(laneEnds.length, 1) };
};

export default function SimulatorTimeline() {
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [base, setBase] = useState(null); // { userId, university, simulators, rooms, teacherMap, teacherIds }
  const [schedules, setSchedules] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);
  const [hovered, setHovered] = useState(null); // { item, x, top, bottom }
  const [createOpen, setCreateOpen] = useState(false);

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

  useEffect(() => {
    if (!base) return undefined;
    let cancelled = false; // a slower response for a previous day must not overwrite the current one

    const loadSchedules = async () => {
      try {
        setLoading(true);
        setError(null);
        setHovered(null); // pill may unmount without firing mouseleave

        const dayStart = moment(selectedDate, 'YYYY-MM-DD').startOf('day');
        const dayEnd = dayStart.clone().add(1, 'day');

        // A scoped university with no teachers cannot have reservations.
        let scheduleQuery;
        if (base.university && base.teacherIds.length === 0) {
          scheduleQuery = Promise.resolve({ data: [], error: null });
        } else {
          scheduleQuery = supabase
            .from('teacher_schedules')
            .select('id, teacher_id, start_time, end_time, simulators, rooms, notes, course, groups, needs_assistance')
            .eq('session_date', selectedDate);
          if (base.university) scheduleQuery = scheduleQuery.in('teacher_id', base.teacherIds);
        }

        let eventQuery = supabase
          .from('event_codes')
          .select('id, code, event_name, university, allowed_simulators, starts_at, ends_at')
          .lt('starts_at', dayEnd.toISOString())
          .gt('ends_at', dayStart.toISOString())
          .order('starts_at', { ascending: true });
        if (base.university) eventQuery = eventQuery.eq('university', base.university);

        const [
          { data: schedData, error: schedErr },
          { data: eventData, error: eventErr },
        ] = await Promise.all([scheduleQuery, eventQuery]);
        if (cancelled) return;
        // Keep whatever loaded; a failed source must not leave the previous day's pills on screen.
        setSchedules(schedErr ? [] : schedData || []);
        setEvents(eventErr ? [] : eventData || []);
        if (schedErr) throw schedErr;
        if (eventErr) throw eventErr;
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
  }, [base, selectedDate, refreshKey]);

  const timeline = useMemo(() => {
    if (!base) return null;

    const simNameByNumber = Object.fromEntries(
      base.simulators.map(s => [String(s.number), s.name])
    );

    const simReservations = [];
    const roomReservations = [];
    let scheduleCount = 0;
    let eventCount = 0;

    schedules.forEach(s => {
      const startMin = timeToMinutes(s.start_time);
      const endMin = timeToMinutes(s.end_time);
      if (startMin === null || endMin === null || endMin <= startMin) return;
      scheduleCount += 1;

      const common = {
        startMin,
        endMin,
        teacher: base.teacherMap[s.teacher_id]?.fullName || 'Unknown teacher',
        gradient: base.teacherMap[s.teacher_id]?.gradient || PILL_GRADIENTS[0],
        note: s.notes || '',
        course: s.course || '',
        groups: Array.isArray(s.groups) ? s.groups.filter(Boolean) : [],
        needsAssistance: s.needs_assistance === true,
        simNames: (s.simulators || []).map(n => simNameByNumber[String(n)] || `Simulator ${n}`),
        roomNames: Array.isArray(s.rooms) ? s.rooms.filter(Boolean) : [],
      };

      (s.simulators || []).forEach(simNumber => {
        simReservations.push({
          ...common,
          id: `${s.id}-sim-${simNumber}`,
          simNumber: String(simNumber),
        });
      });
      (s.rooms || []).filter(Boolean).forEach(room => {
        roomReservations.push({
          ...common,
          id: `${s.id}-room-${room}`,
          room,
        });
      });
    });

    // Events are absolute instants; clip them to the selected local day.
    const dayStart = moment(selectedDate, 'YYYY-MM-DD').startOf('day');
    const dayEnd = dayStart.clone().add(1, 'day');
    // Wall-clock minutes since local midnight, like the axis and the now-line.
    // Elapsed-minute differences would drift by an hour on 23/25-hour DST days.
    const wall = (m) => m.hours() * 60 + m.minutes();

    events.forEach(ev => {
      if (!ev.starts_at || !ev.ends_at) return;
      const rawStart = moment(ev.starts_at);
      const rawEnd = moment(ev.ends_at);
      if (!rawStart.isBefore(dayEnd) || !rawEnd.isAfter(dayStart)) return; // outside this day
      const startMin = rawStart.isBefore(dayStart) ? 0 : wall(rawStart);
      const endMin = rawEnd.isSameOrAfter(dayEnd) ? 1440 : wall(rawEnd);
      if (endMin <= startMin) return;

      const numbers = Array.isArray(ev.allowed_simulators)
        ? ev.allowed_simulators.map(n => String(n)).filter(Boolean)
        : [];
      if (numbers.length === 0) return; // occupies no row, so nothing to show or count

      eventCount += 1;
      const common = {
        kind: 'event',
        startMin,
        endMin,
        title: ev.event_name || ev.code,
        code: ev.code,
        simNames: numbers.map(n => simNameByNumber[n] || `Simulator ${n}`),
        startsAt: ev.starts_at,
        endsAt: ev.ends_at,
        spansBeyondDay: rawStart.isBefore(dayStart) || rawEnd.isAfter(dayEnd),
      };
      numbers.forEach(n => {
        simReservations.push({ ...common, id: `${ev.id}-sim-${n}`, simNumber: n });
      });
    });

    const allReservations = [...simReservations, ...roomReservations];

    let openHour = DEFAULT_OPEN_HOUR;
    let closeHour = DEFAULT_CLOSE_HOUR;
    allReservations.forEach(r => {
      openHour = Math.min(openHour, Math.floor(r.startMin / 60));
      closeHour = Math.max(closeHour, Math.ceil(r.endMin / 60));
    });

    const windowStart = openHour * 60;
    const windowLength = (closeHour - openHour) * 60;
    const toPercent = (minutes) => ((minutes - windowStart) / windowLength) * 100;

    const hourStep = closeHour - openHour > 14 ? 2 : 1;
    const hours = [];
    for (let h = openHour; h <= closeHour; h += hourStep) hours.push(h);

    const simRows = base.simulators.map(sim => {
      const own = simReservations.filter(r => r.simNumber === String(sim.number));
      const { items, laneCount } = assignLanes(own);
      return {
        key: `sim-${sim.id}`,
        title: sim.name,
        subtitle: `№ ${sim.number}`,
        items,
        laneCount,
        height: laneCount * LANE_HEIGHT + ROW_PADDING,
      };
    });

    const roomRows = base.rooms.map(room => {
      const own = roomReservations.filter(r => r.room === room);
      const { items, laneCount } = assignLanes(own);
      return {
        key: `room-${room}`,
        title: room,
        subtitle: '',
        items,
        laneCount,
        height: laneCount * LANE_HEIGHT + ROW_PADDING,
      };
    });

    const sections = [
      ...(simRows.length ? [{ label: 'Simulators', rows: simRows }] : []),
      ...(roomRows.length ? [{ label: 'Rooms', rows: roomRows }] : []),
    ];

    const now = moment();
    const isToday = selectedDate === now.format('YYYY-MM-DD');
    const nowMin = now.hours() * 60 + now.minutes();
    const nowPercent =
      isToday && nowMin >= windowStart && nowMin <= windowStart + windowLength
        ? toPercent(nowMin)
        : null;

    const countParts = [];
    if (scheduleCount > 0) {
      countParts.push(`${scheduleCount} reservation${scheduleCount === 1 ? '' : 's'}`);
    }
    if (eventCount > 0) {
      countParts.push(`${eventCount} event${eventCount === 1 ? '' : 's'}`);
    }

    return {
      sections,
      hours,
      toPercent,
      nowPercent,
      total: scheduleCount + eventCount,
      countLabel: countParts.join(' · '),
    };
  }, [base, schedules, events, selectedDate]);

  const handleEventCreated = ({ starts_at }) => {
    const startDay = moment(starts_at).format('YYYY-MM-DD');
    if (startDay !== selectedDate) setSelectedDate(startDay);
    setRefreshKey(k => k + 1);
  };

  const canCreate = Boolean(base?.university);

  const shiftDay = (days) =>
    setSelectedDate(moment(selectedDate).add(days, 'day').format('YYYY-MM-DD'));

  const isToday = selectedDate === moment().format('YYYY-MM-DD');

  const renderRow = (row, rowIndex) => (
    <div
      key={row.key}
      className={`flex hover:bg-[#DCDCDC]/10 transition-colors ${
        rowIndex > 0 ? 'border-t border-[#DCDCDC]/40' : ''
      }`}
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
          return (
            <div
              key={item.id}
              className={`absolute z-[5] rounded-full flex items-center px-3.5 cursor-default transition-transform duration-150 hover:scale-[1.02] ${
                isEvent
                  ? 'bg-[#78003F]/8 border-[1.5px] border-[#78003F] text-[#78003F] shadow-none'
                  : 'text-white shadow-[0_4px_12px_rgba(120,0,63,0.25)]'
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
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHovered({
                  item,
                  x: rect.left + rect.width / 2,
                  top: rect.top,
                  bottom: rect.bottom,
                });
              }}
              onMouseLeave={() => setHovered(null)}
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

  return (
    <div className="bg-[#FFFFFF] rounded-[24px] shadow-[0_8px_20px_rgba(65,65,65,0.08)] border border-[#DCDCDC]/60 p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-extrabold text-[#414141] flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#78003F]" />
            Simulator Schedule
          </h3>
          <p className="text-xs font-semibold text-[#414141]/60 mt-1">
            Reservations for every simulator and room in your center on the selected day
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {timeline && timeline.total > 0 && (
            <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#DCDCDC]/30 text-[#414141]/70 mr-1">
              {timeline.countLabel}
            </span>
          )}
          <button
            onClick={() => shiftDay(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-[#DCDCDC] text-[#414141]/70 hover:bg-[#DCDCDC]/20 transition-colors"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
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
              aria-label="Pick a day"
            />
            <div className="px-4 py-1.5 rounded-full text-xs font-semibold border border-[#DCDCDC] bg-[#FFFFFF] text-[#414141] pointer-events-none min-w-[130px] text-center">
              {moment(selectedDate).format('ddd, MMM D YYYY')}
            </div>
          </div>
          <button
            onClick={() => shiftDay(1)}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-[#DCDCDC] text-[#414141]/70 hover:bg-[#DCDCDC]/20 transition-colors"
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSelectedDate(moment().format('YYYY-MM-DD'))}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              isToday
                ? 'bg-[#78003F] text-white border-transparent'
                : 'bg-[#FFFFFF] text-[#414141]/80 border-[#DCDCDC] hover:bg-[#DCDCDC]/20'
            }`}
          >
            Today
          </button>
          <div className="hidden md:block w-px h-6 bg-[#DCDCDC]/80 mx-1" />
          <span
            className="inline-flex"
            title={base && !canCreate ? NO_UNIVERSITY_MESSAGE : undefined}
          >
            <button
              type="button"
              onClick={() => {
                setHovered(null);
                setCreateOpen(true);
              }}
              disabled={!canCreate}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-br from-[#78003F] to-[#E64164] text-white shadow-[0_4px_12px_rgba(120,0,63,0.25)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CalendarPlus className="w-4 h-4" />
              Create event
            </button>
          </span>
        </div>
      </div>

      {base && !canCreate && (
        <p className="text-[11px] font-medium text-[#414141]/60 -mt-3 mb-4 md:text-right">
          {NO_UNIVERSITY_MESSAGE}
        </p>
      )}

      {timeline && timeline.total > 0 && (
        <div className="flex flex-wrap items-center gap-4 -mt-2 mb-4 text-[11px] font-semibold text-[#414141]/60">
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

      {error && (
        <div className="text-sm font-semibold text-[#E64164] mb-4">{error}</div>
      )}

      {!timeline || (loading && !hasLoaded) ? (
        <div className="h-48 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-t-2 border-[#78003F] border-opacity-40"></div>
        </div>
      ) : timeline.sections.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-[#414141]/60 font-medium">
          No simulators or rooms found for your center.
        </div>
      ) : (
        <div className="overflow-x-auto pb-2 pr-5">
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
            {timeline.sections.map((section, sectionIndex) => (
              <div key={section.label} className={sectionIndex > 0 ? 'mt-5' : ''}>
                <div className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#414141]/45 mb-1.5 pl-1">
                  {section.label}
                </div>
                <div className="rounded-[16px] border border-[#DCDCDC]/50 overflow-hidden bg-gradient-to-b from-[#FFFFFF] to-[#DCDCDC]/10">
                  {section.rows.map((row, rowIndex) => renderRow(row, rowIndex))}
                </div>
              </div>
            ))}

            {timeline.total === 0 && !loading && (
              <div className="text-center text-sm font-medium text-[#414141]/50 mt-4">
                No reservations on {moment(selectedDate).format('MMMM D')} — all simulators and rooms are free.
              </div>
            )}
          </div>
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
                {hovered.item.simNames.length > 0 && (
                  <div className="text-[11px] font-medium text-white/60 mt-0.5">
                    Simulators: {hovered.item.simNames.join(', ')}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-xs font-bold whitespace-nowrap">
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
              </>
            )}
          </div>
        </div>
      )}

      <CreateEventModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleEventCreated}
        university={base?.university || null}
        userId={base?.userId || null}
        simulators={base?.simulators || []}
        defaultDate={selectedDate}
      />
    </div>
  );
}
