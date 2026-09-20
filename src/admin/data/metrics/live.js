// "Right now": who is inside, which simulators run an NFC session, what the calendar
// reserves at this minute and what is planned for today. Independent of the period.
//   rawLive = { nowMs, centerSessionsToday, openSimSessions, busyNow } — see loadLive.js
//   ds      = the cleaned dataset (today's classes and events come from it); may be null
// Labels never carry a teacher's name: a class reads "Year 3 class", an event its title.
import { SIM_MAX_MIN, VISIT_MAX_MIN, ROLE_ORDER } from '../constants.js';
import { dayKeyOf, toMs } from '../period.js';
import { COURSE_ORDER } from '../normalize.js';
import { wallMinuteOf } from './shared.js';

const MIN_MS = 60000;

// A row nobody closed counts as running only while that is plausible — the same limits the
// history uses before it treats a session as "forgot to tap out".
const stillOpen = (startMs, nowMs, maxMin) =>
  Number.isFinite(startMs) && startMs <= nowMs + MIN_MS && nowMs - startMs <= maxMin * MIN_MS;

// Reservations that cover this minute, per resource key: the latest end and its kind.
const busyByKey = (rows, resourceType, nowMs) => {
  const busy = new Map();
  (rows || []).forEach((row) => {
    if (!row || row.resource_type !== resourceType) return;
    const fromMs = toMs(row.busy_from);
    const untilMs = toMs(row.busy_until);
    if (!Number.isFinite(fromMs) || !Number.isFinite(untilMs)) return;
    if (fromMs >= nowMs + MIN_MS || untilMs <= nowMs) return;
    const key = String(row.resource_key);
    const known = busy.get(key);
    if (!known || untilMs > known.untilMs) {
      busy.set(key, { untilMs, kind: row.source === 'event' ? 'event' : 'class' });
    }
  });
  return busy;
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// One booking reads by its own label; several at once read as a count ("2 classes and 1 event").
const labelOf = (items) => {
  if (items.length === 1) return items[0].label;
  const classes = items.filter((item) => item.kind === 'class').length;
  const events = items.length - classes;
  return [
    classes > 0 ? plural(classes, 'class', 'classes') : null,
    events > 0 ? plural(events, 'event', 'events') : null,
  ]
    .filter(Boolean)
    .join(' and ');
};

const todayPlan = (ds, nowMs) => {
  const today = dayKeyOf(nowMs);
  const nowMin = wallMinuteOf(nowMs);
  const items = [];
  (ds?.classes || []).forEach((item) => {
    if (item.date !== today) return;
    items.push({
      kind: 'class',
      label: COURSE_ORDER.includes(item.course) ? `Year ${item.course} class` : 'Class',
      startMin: item.startMin,
      endMin: item.endMin,
    });
  });
  (ds?.events || []).forEach((event) => {
    const seg = (event.segments || []).find((part) => part.date === today);
    if (seg) items.push({ kind: 'event', label: event.title, startMin: seg.startMin, endMin: seg.endMin });
  });

  const running = items.filter((item) => item.startMin <= nowMin && item.endMin > nowMin);
  const later = items.filter((item) => item.startMin > nowMin);
  const nextStart = later.reduce((earliest, item) => Math.min(earliest, item.startMin), Infinity);
  const upNext = later.filter((item) => item.startMin === nextStart);

  return {
    classes: items.filter((item) => item.kind === 'class').length,
    events: items.filter((item) => item.kind === 'event').length,
    // Several bookings at once: "until" is when the last of them ends.
    now: running.length > 0
      ? { label: labelOf(running), untilMin: Math.max(...running.map((item) => item.endMin)) }
      : null,
    next: upNext.length > 0 ? { label: labelOf(upNext), startMin: nextStart } : null,
  };
};

export const computeLive = (rawLive, ref, nowMs, ds) => {
  // --- people inside: tapped in today, no tap-out yet ------------------------------------------
  const byRole = Object.fromEntries(ROLE_ORDER.map((role) => [role, 0]));
  const inside = new Set();
  (rawLive?.centerSessionsToday || []).forEach((row) => {
    if (!row || (row.exit_time !== null && row.exit_time !== undefined)) return;
    const role = ref?.roleByUserId?.get(row.user_id);
    if (!role || inside.has(row.user_id)) return;
    if (!stillOpen(toMs(row.entry_time), nowMs, VISIT_MAX_MIN)) return;
    inside.add(row.user_id);
    byRole[role] += 1;
  });

  // --- simulators: in use (NFC) and booked (calendar) are two different facts ------------------
  const sinceBySimulator = new Map();
  (rawLive?.openSimSessions || []).forEach((row) => {
    if (!row || !ref?.simulatorById?.has(row.simulator_id)) return;
    const startMs = toMs(row.start_time);
    if (!stillOpen(startMs, nowMs, SIM_MAX_MIN)) return;
    const known = sinceBySimulator.get(row.simulator_id);
    if (known === undefined || startMs > known) sinceBySimulator.set(row.simulator_id, startMs);
  });
  const bookedSimulators = busyByKey(rawLive?.busyNow, 'simulator', nowMs);

  let inUse = 0;
  let bookedNow = 0;
  const items = (ref?.simulators || []).map((simulator) => {
    const sinceMs = sinceBySimulator.get(simulator.id) ?? null;
    const booking = bookedSimulators.get(simulator.number) || null;
    if (sinceMs !== null) inUse += 1;
    if (booking) bookedNow += 1;
    let state = 'free';
    if (sinceMs !== null) state = booking ? 'in_use_booked' : 'in_use';
    else if (booking) state = 'booked';
    return {
      id: simulator.id,
      number: simulator.number,
      label: simulator.label,
      state,
      sinceMs,
      bookedUntilMs: booking ? booking.untilMs : null,
    };
  });

  // --- rooms: bookings only (rooms have no NFC tags) -------------------------------------------
  const bookedRooms = busyByKey(rawLive?.busyNow, 'room', nowMs);
  const busy = (ref?.rooms || [])
    .filter((room) => bookedRooms.has(room.name))
    .map((room) => ({ name: room.name, ...bookedRooms.get(room.name) }));
  const totalRooms = (ref?.rooms || []).length;

  return {
    updatedAt: nowMs,
    inCenter: { total: inside.size, byRole },
    simulators: { total: items.length, inUse, bookedNow, items },
    rooms: { total: totalRooms, bookedNow: busy.length, freeNow: totalRooms - busy.length, busy },
    today: todayPlan(ds, nowMs),
  };
};
