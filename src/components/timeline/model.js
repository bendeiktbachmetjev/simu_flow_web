// Pure helpers and constants for the simulator timeline (day, week + month views).
// No React here: everything is plain data in, plain data out, so the container
// (SimulatorTimeline.jsx) and the presentational grids can share one model.
import moment from 'moment';

// Center working hours shown by default; the window expands if a reservation falls outside it.
export const DEFAULT_OPEN_HOUR = 8;
export const DEFAULT_CLOSE_HOUR = 20;

export const LABEL_COL_WIDTH = 190;
export const LANE_HEIGHT = 44;
export const ROW_PADDING = 12;
export const PILL_HEIGHT = 34;

// Week grid: one label column plus seven day columns; below this the card scrolls sideways.
export const DAY_COL_MIN = 132;
export const WEEK_MIN_WIDTH = LABEL_COL_WIDTH + 7 * DAY_COL_MIN; // 1114
export const WEEK_CHIP_HEIGHT = 34;
export const MAX_VISIBLE_CHIPS = 3;

// Per-teacher pill gradients, all within the brand family.
export const PILL_GRADIENTS = [
  ['#78003F', '#E64164'],
  ['#4C1D95', '#8B5CF6'],
  ['#831843', '#EC4899'],
  ['#414141', '#737373'],
  ['#9D174D', '#FB7185'],
];

export const timeToMinutes = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':');
  return parseInt(h, 10) * 60 + (parseInt(m, 10) || 0);
};

export const formatTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// Assign overlapping reservations of one resource to stacked lanes.
export const assignLanes = (items) => {
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

// 'V. Petrauskienė'; falls back to whichever part exists.
export const shortName = (name, surname) => {
  const first = (name || '').trim();
  const last = (surname || '').trim();
  if (first && last) return `${first[0]}. ${last}`;
  return last || first || '';
};

// ISO week (Monday first) containing dateStr. Calendar-day arithmetic only:
// Vilnius DST weeks are 167/169 h, so millisecond math would drift.
export const getWeek = (dateStr) => {
  const weekStart = moment(dateStr, 'YYYY-MM-DD').startOf('isoWeek');
  const days = Array.from({ length: 7 }, (_, i) =>
    weekStart.clone().add(i, 'day').format('YYYY-MM-DD')
  );
  const weekEnd = weekStart.clone().add(7, 'day'); // exclusive
  return {
    weekStart,
    weekEnd,
    weekKey: weekStart.format('YYYY-MM-DD'),
    days,
    isoWeek: weekStart.isoWeek(),
  };
};

// '8 – 14 Sep 2026' · '28 Sep – 4 Oct 2026' · '29 Dec 2025 – 4 Jan 2026'
export const formatWeekLabel = (weekStart) => {
  const start = moment.isMoment(weekStart)
    ? weekStart.clone()
    : moment(weekStart, 'YYYY-MM-DD');
  const end = start.clone().add(6, 'day');
  if (start.isSame(end, 'month')) return `${start.format('D')} – ${end.format('D MMM YYYY')}`;
  if (start.isSame(end, 'year')) return `${start.format('D MMM')} – ${end.format('D MMM YYYY')}`;
  return `${start.format('D MMM YYYY')} – ${end.format('D MMM YYYY')}`;
};

// Month grid containing dateStr: Monday of the ISO week holding the 1st through
// Sunday of the ISO week holding the last day (28, 35 or 42 days), as Mon–Sun rows.
// Calendar-day arithmetic only, like getWeek.
export const getMonthGrid = (dateStr) => {
  const monthStart = moment(dateStr, 'YYYY-MM-DD').startOf('month');
  const gridStart = monthStart.clone().startOf('isoWeek');
  const gridEnd = monthStart.clone().endOf('month').startOf('isoWeek').add(7, 'day'); // exclusive
  const days = [];
  const cursor = gridStart.clone();
  while (cursor.isBefore(gridEnd)) {
    days.push(cursor.format('YYYY-MM-DD'));
    cursor.add(1, 'day');
  }
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return {
    monthStart,
    monthKey: monthStart.format('YYYY-MM'),
    days,
    weeks,
  };
};

// Short time text for a chip whose range is already clipped to one day.
export const chipTimeLabel = (item) => {
  const { startMin, endMin } = item;
  if (startMin === 0 && endMin === 1440) return 'All day';
  if (startMin === 0) return `until ${formatTime(endMin)}`;
  if (endMin === 1440) return `from ${formatTime(startMin)}`;
  return `${formatTime(startMin)} – ${formatTime(endMin)}`;
};

// Wall-clock minutes since local midnight, like the axis and the now-line.
// Elapsed-minute differences would drift by an hour on 23/25-hour DST days.
const wallMinutes = (m) => m.hours() * 60 + m.minutes();

const dateLabelOf = (dateStr) => moment(dateStr, 'YYYY-MM-DD').format('ddd D MMM');

// Teachers attached to an event (event_codes.teacher_ids), resolved through the base
// teacher map. An id that no longer resolves (teacher removed) is skipped rather than
// shown as "Unknown": the event is still valid, it just has one leader fewer.
const eventTeachers = (base, ev) => {
  const teacherMap = base?.teacherMap || {};
  const infos = (Array.isArray(ev?.teacher_ids) ? ev.teacher_ids : [])
    .map(id => teacherMap[id])
    .filter(Boolean);
  return {
    teacherNames: infos.map(t => t.fullName),
    teacherShortNames: infos.map(t => t.shortName),
  };
};

// Events are absolute instants; clip one to a local calendar day.
// Returns null when the event has no dates or does not touch that day.
export const clipEventToDay = (ev, dateStr) => {
  if (!ev || !ev.starts_at || !ev.ends_at) return null;
  const dayStart = moment(dateStr, 'YYYY-MM-DD').startOf('day');
  const dayEnd = dayStart.clone().add(1, 'day');
  const rawStart = moment(ev.starts_at);
  const rawEnd = moment(ev.ends_at);
  if (!rawStart.isBefore(dayEnd) || !rawEnd.isAfter(dayStart)) return null; // outside this day
  const startsBeforeDay = rawStart.isBefore(dayStart);
  const endsAfterDay = rawEnd.isAfter(dayEnd);
  const startMin = startsBeforeDay ? 0 : wallMinutes(rawStart);
  const endMin = rawEnd.isSameOrAfter(dayEnd) ? 1440 : wallMinutes(rawEnd);
  if (endMin <= startMin) return null;
  return {
    startMin,
    endMin,
    spansBeyondDay: startsBeforeDay || endsAfterDay,
    startsBeforeDay,
    endsAfterDay,
  };
};

const emptyReservations = () => ({
  simReservations: [],
  roomReservations: [],
  scheduleIds: new Set(),
  eventIds: new Set(),
  unplacedEvents: [],
});

const byStartEndLabel = (a, b) =>
  a.startMin - b.startMin ||
  a.endMin - b.endMin ||
  String(a.label || '').localeCompare(String(b.label || ''));

// One entry per class and per event touching a single local day, in input order
// (schedules first, then events). Entry shape is shared by the month cells and, fanned
// out per resource, by the day view, the week grid and the tooltip:
// { id, kind, date, dateLabel, startMin, endMin, durationMin, timeLabel, label, placed,
//   simNumbers, simNames, roomNames,
//   class: scheduleId, teacher, teacherShort, gradient, note, course, groups, needsAssistance
//   event: eventId, raw, title, code, startsAt, endsAt, spansBeyondDay, teacherNames, teacherShortNames }
// Input order matters: assignLanes sorts stably, so two items with the same start and
// end keep their input order for lanes. buildDayReservations fans out in this order;
// buildDayEntries sorts a copy for display.
const collectDayEntries = ({ base, schedules = [], events = [], date }) => {
  const entries = [];
  const scheduleIds = new Set();
  const eventIds = new Set();
  if (!base || !date) return { entries, scheduleIds, eventIds };

  const simNameByNumber = Object.fromEntries(
    base.simulators.map(s => [String(s.number), s.name])
  );
  const dateLabel = dateLabelOf(date);

  schedules.forEach(s => {
    if (s.session_date !== date) return;
    const startMin = timeToMinutes(s.start_time);
    const endMin = timeToMinutes(s.end_time);
    if (startMin === null || endMin === null || endMin <= startMin) return;
    scheduleIds.add(s.id);

    const teacherInfo = base.teacherMap[s.teacher_id];
    const teacher = teacherInfo?.fullName || 'Unknown teacher';
    const teacherShort = teacherInfo?.shortName || teacher;
    const simNumbers = (s.simulators || []).map(n => String(n));
    const roomNames = Array.isArray(s.rooms) ? s.rooms.filter(Boolean) : [];
    entries.push({
      id: `${s.id}-${date}`,
      kind: 'class',
      date,
      dateLabel,
      startMin,
      endMin,
      durationMin: endMin - startMin,
      timeLabel: chipTimeLabel({ startMin, endMin }),
      label: teacherShort,
      placed: simNumbers.length > 0 || roomNames.length > 0,
      scheduleId: s.id,
      teacher,
      teacherShort,
      gradient: teacherInfo?.gradient || PILL_GRADIENTS[0],
      note: s.notes || '',
      course: s.course || '',
      groups: Array.isArray(s.groups) ? s.groups.filter(Boolean) : [],
      needsAssistance: s.needs_assistance === true,
      simNumbers,
      simNames: simNumbers.map(n => simNameByNumber[n] || `Simulator ${n}`),
      roomNames,
    });
  });

  events.forEach(ev => {
    const clip = clipEventToDay(ev, date);
    if (!clip) return;
    eventIds.add(ev.id); // counted whether or not it occupies a row

    const simNumbers = Array.isArray(ev.allowed_simulators)
      ? ev.allowed_simulators.map(n => String(n)).filter(Boolean)
      : [];
    const roomNames = Array.isArray(ev.rooms) ? ev.rooms.filter(Boolean) : [];
    const title = ev.event_name || ev.code;
    const { teacherNames, teacherShortNames } = eventTeachers(base, ev);
    entries.push({
      id: `${ev.id}-${date}`,
      kind: 'event',
      date,
      dateLabel,
      startMin: clip.startMin,
      endMin: clip.endMin,
      durationMin: clip.endMin - clip.startMin,
      timeLabel: chipTimeLabel(clip),
      label: title,
      placed: simNumbers.length > 0 || roomNames.length > 0, // false: no resource row, Events strip and month cell only
      simNumbers,
      simNames: simNumbers.map(n => simNameByNumber[n] || `Simulator ${n}`),
      roomNames,
      eventId: ev.id,
      raw: ev, // un-clipped row: the edit modal must prefill from real starts_at/ends_at
      title,
      code: ev.code,
      startsAt: ev.starts_at,
      endsAt: ev.ends_at,
      spansBeyondDay: clip.spansBeyondDay,
      teacherNames,
      teacherShortNames,
    });
  });

  return { entries, scheduleIds, eventIds };
};

// Public, display-ordered variant: one entry per class / event for `date`,
// sorted by start, end, label (the month cells list these directly).
export const buildDayEntries = (args) =>
  [...collectDayEntries(args).entries].sort(byStartEndLabel);

// One reservation item per (reservation, resource) for a single local day:
// every placed entry above, copied once per simulator and once per room with
// `id` re-keyed to the resource and `simNumber` | `room` added; lane is added by assignLanes.
export const buildDayReservations = ({ base, schedules = [], events = [], date }) => {
  const result = emptyReservations();
  if (!base || !date) return result;
  const { simReservations, roomReservations, unplacedEvents } = result;

  const { entries, scheduleIds, eventIds } = collectDayEntries({ base, schedules, events, date });
  result.scheduleIds = scheduleIds;
  result.eventIds = eventIds;

  entries.forEach(entry => {
    if (entry.kind === 'event' && !entry.placed) {
      unplacedEvents.push(entry.raw); // reachable from the Events strip only
      return;
    }
    const sourceId = entry.kind === 'class' ? entry.scheduleId : entry.eventId;
    entry.simNumbers.forEach(n => {
      simReservations.push({ ...entry, id: `${sourceId}-${date}-sim-${n}`, simNumber: n });
    });
    entry.roomNames.forEach(room => {
      roomReservations.push({ ...entry, id: `${sourceId}-${date}-room-${room}`, room });
    });
  });

  return result;
};

const countLabelFor = (scheduleCount, eventCount) => {
  const parts = [];
  if (scheduleCount > 0) {
    parts.push(`${scheduleCount} reservation${scheduleCount === 1 ? '' : 's'}`);
  }
  if (eventCount > 0) {
    parts.push(`${eventCount} event${eventCount === 1 ? '' : 's'}`);
  }
  return parts.join(' · ');
};

// Day view: rows with lanes/heights on an hour axis (8–20 by default, expanding to fit).
export const buildDayTimeline = ({ base, schedules = [], events = [], date, showEmptyRooms = false }) => {
  if (!base) return null;

  const { simReservations, roomReservations, scheduleIds, eventIds } = buildDayReservations({
    base,
    schedules,
    events,
    date,
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

  const allRoomRows = base.rooms.map(room => {
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
  // Simulators are never hidden; rooms with nothing booked are, unless asked for.
  const roomRows = showEmptyRooms ? allRoomRows : allRoomRows.filter(r => r.items.length > 0);

  const sections = [
    ...(simRows.length
      ? [{ key: 'simulators', label: 'Simulators', rows: simRows, hiddenCount: 0, totalCount: simRows.length }]
      : []),
    ...(allRoomRows.length
      ? [{
          key: 'rooms',
          label: 'Rooms',
          rows: roomRows,
          hiddenCount: allRoomRows.length - roomRows.length,
          totalCount: allRoomRows.length,
        }]
      : []),
  ];

  const now = moment();
  const isToday = date === now.format('YYYY-MM-DD');
  const nowMin = wallMinutes(now);
  const nowPercent =
    isToday && nowMin >= windowStart && nowMin <= windowStart + windowLength
      ? toPercent(nowMin)
      : null;

  const scheduleCount = scheduleIds.size;
  const eventCount = eventIds.size;

  return {
    sections,
    hours,
    toPercent,
    nowPercent,
    total: scheduleCount + eventCount,
    countLabel: countLabelFor(scheduleCount, eventCount),
  };
};

// Week view: resources as rows, Mon–Sun as columns, chips stacked per cell.
export const buildWeekGrid = ({
  base,
  schedules = [],
  events = [],
  days,
  selectedDate,
  showEmptyRooms = false,
}) => {
  if (!base) return null;
  const weekDays = Array.isArray(days) && days.length === 7 ? days : getWeek(selectedDate).days;

  const now = moment();
  const today = now.format('YYYY-MM-DD');
  const nowMin = wallMinutes(now);

  const allScheduleIds = new Set();
  const allEventIds = new Set();

  const perDay = weekDays.map(date => {
    const reservations = buildDayReservations({ base, schedules, events, date });
    reservations.scheduleIds.forEach(id => allScheduleIds.add(id));
    reservations.eventIds.forEach(id => allEventIds.add(id));
    return { date, ...reservations };
  });

  const dayHeaders = perDay.map(({ date, scheduleIds, eventIds }) => {
    const m = moment(date, 'YYYY-MM-DD');
    const classCount = scheduleIds.size;
    const eventCount = eventIds.size;
    const parts = [];
    if (classCount > 0) parts.push(`${classCount} class${classCount === 1 ? '' : 'es'}`);
    if (eventCount > 0) parts.push(`${eventCount} event${eventCount === 1 ? '' : 's'}`);
    return {
      date,
      weekday: m.format('ddd').toUpperCase(),
      dayNum: m.format('D'),
      isToday: date === today,
      isAnchor: date === selectedDate,
      isWeekend: m.isoWeekday() >= 6,
      classCount,
      eventCount,
      countLabel: parts.length ? parts.join(' · ') : 'Free',
    };
  });

  const buildCells = (pick) =>
    perDay.map(day => {
      const { items } = assignLanes(pick(day));
      items.sort(byStartEndLabel);
      return { date: day.date, items };
    });

  const makeRow = (key, title, subtitle, cells) => ({
    key,
    title,
    subtitle,
    cells,
    hasAny: cells.some(c => c.items.length > 0),
  });

  const simRows = base.simulators.map(sim =>
    makeRow(
      `sim-${sim.id}`,
      sim.name,
      `№ ${sim.number}`,
      buildCells(day => day.simReservations.filter(r => r.simNumber === String(sim.number)))
    )
  );

  const allRoomRows = base.rooms.map(room =>
    makeRow(
      `room-${room}`,
      room,
      '',
      buildCells(day => day.roomReservations.filter(r => r.room === room))
    )
  );
  const roomRows = showEmptyRooms ? allRoomRows : allRoomRows.filter(r => r.hasAny);

  const sections = [
    ...(simRows.length
      ? [{ key: 'simulators', label: 'Simulators', rows: simRows, hiddenCount: 0, totalCount: simRows.length }]
      : []),
    ...(allRoomRows.length
      ? [{
          key: 'rooms',
          label: 'Rooms',
          rows: roomRows,
          hiddenCount: allRoomRows.length - roomRows.length,
          totalCount: allRoomRows.length,
        }]
      : []),
  ];

  const scheduleCount = allScheduleIds.size;
  const eventCount = allEventIds.size;

  return {
    days: dayHeaders,
    sections,
    total: scheduleCount + eventCount,
    countLabel: countLabelFor(scheduleCount, eventCount),
    nowMin,
    todayIndex: weekDays.indexOf(today),
    anchorIndex: weekDays.indexOf(selectedDate),
  };
};

// Month view: Mon–Sun rows of day cells, each listing its own entries with a load
// figure, so a whole month's plan (and how busy the center is) reads at a glance.
// Counts, the busiest day and the bar scale come from the selected month's own days;
// the padding days of the neighbouring months are shown but not counted.
export const buildMonthGrid = ({ base, schedules = [], events = [], days, selectedDate }) => {
  if (!base) return null;
  const gridDays = Array.isArray(days) && days.length > 0 && days.length % 7 === 0
    ? days
    : getMonthGrid(selectedDate).days;
  const monthKey = moment(selectedDate, 'YYYY-MM-DD').format('YYYY-MM');
  const today = moment().format('YYYY-MM-DD');

  const allScheduleIds = new Set();
  const allEventIds = new Set();
  let busiestDate = null;
  let maxBookedMinutes = 0;

  const cells = gridDays.map(date => {
    const m = moment(date, 'YYYY-MM-DD');
    const inMonth = m.format('YYYY-MM') === monthKey;
    const { entries, scheduleIds, eventIds } = collectDayEntries({ base, schedules, events, date });
    entries.sort(byStartEndLabel);
    // Planned minutes that day, one share per class / event (an unplaced event still happens).
    const bookedMinutes = entries.reduce((sum, e) => sum + e.durationMin, 0);
    if (inMonth) {
      scheduleIds.forEach(id => allScheduleIds.add(id));
      eventIds.forEach(id => allEventIds.add(id));
      if (bookedMinutes > maxBookedMinutes) {
        maxBookedMinutes = bookedMinutes;
        busiestDate = date;
      }
    }
    return {
      date,
      dayNum: m.format('D'),
      inMonth,
      isToday: date === today,
      isAnchor: date === selectedDate,
      isWeekend: m.isoWeekday() >= 6,
      entries,
      classCount: scheduleIds.size,
      eventCount: eventIds.size,
      bookedMinutes,
    };
  });

  // An 8-hour day is a full bar; a busier month stretches the scale to its busiest day.
  const fullDay = Math.max(maxBookedMinutes, 480);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    const row = cells.slice(i, i + 7).map(cell => ({
      ...cell,
      loadPercent: Math.min(100, (cell.bookedMinutes / fullDay) * 100),
    }));
    weeks.push({ key: row[0].date, days: row });
  }

  const scheduleCount = allScheduleIds.size;
  const eventCount = allEventIds.size;

  return {
    weeks,
    total: scheduleCount + eventCount,
    countLabel: countLabelFor(scheduleCount, eventCount),
    busiestDate,
    maxBookedMinutes,
  };
};

// Flat, sorted list of the dated events in the visible period (for the Events strip).
// mode 'day': events touching `date`; mode 'week' | 'month': every fetched event of the
// period bounded by `days`.
// `base` is optional: without it teacher ids cannot be resolved, so the name lists stay empty.
export const buildPeriodEvents = ({ events = [], mode = 'day', date, days, base = null }) => {
  const bounded = (mode === 'week' || mode === 'month') && Array.isArray(days) && days.length > 0;
  const periodStart = bounded ? moment(days[0], 'YYYY-MM-DD').startOf('day') : null;
  const periodEnd = periodStart
    ? moment(days[days.length - 1], 'YYYY-MM-DD').startOf('day').add(1, 'day')
    : null;

  const list = [];
  events.forEach(ev => {
    if (!ev || !ev.starts_at || !ev.ends_at) return;
    const start = moment(ev.starts_at);
    const end = moment(ev.ends_at);

    if (mode === 'day') {
      if (!clipEventToDay(ev, date)) return;
    } else if (periodStart && (!start.isBefore(periodEnd) || !end.isAfter(periodStart))) {
      return; // outside the fetched period (defensive; the query already scopes it)
    }

    const sameDay = start.isSame(end, 'day');
    let timeLabel;
    if (mode === 'day') {
      timeLabel = sameDay
        ? `${start.format('HH:mm')} – ${end.format('HH:mm')}`
        : `${start.format('D MMM HH:mm')} – ${end.format('D MMM HH:mm')}`;
    } else if (mode === 'month') {
      timeLabel = sameDay
        ? `${start.format('D MMM')} · ${start.format('HH:mm')} – ${end.format('HH:mm')}`
        : `${start.format('D MMM HH:mm')} – ${end.format('D MMM HH:mm')}`;
    } else {
      timeLabel = sameDay
        ? `${start.format('ddd D')} · ${start.format('HH:mm')} – ${end.format('HH:mm')}`
        : `${start.format('ddd D HH:mm')} – ${end.format('ddd D HH:mm')}`;
    }

    const numbers = Array.isArray(ev.allowed_simulators)
      ? ev.allowed_simulators.map(n => String(n)).filter(Boolean)
      : [];
    const rooms = Array.isArray(ev.rooms) ? ev.rooms.filter(Boolean) : [];
    const { teacherNames, teacherShortNames } = eventTeachers(base, ev);

    list.push({
      id: ev.id,
      title: ev.event_name || ev.code,
      code: ev.code,
      startsAt: ev.starts_at,
      endsAt: ev.ends_at,
      timeLabel,
      placed: numbers.length > 0 || rooms.length > 0,
      teacherNames,
      teacherShortNames,
      raw: ev,
    });
  });

  list.sort((a, b) => moment(a.startsAt).valueOf() - moment(b.startsAt).valueOf());
  return list;
};
