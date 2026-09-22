// raw rows + Reference → the ONE cleaned dataset every metric reads. Rows dated before the
// counted window (STATS_START_DATE) are dropped first, so no metric has to know about it.
// Pure apart from the running dataset id (used by the hooks as a cache key).
import {
  SIM_FALLBACK_MEDIAN_MIN,
  SIM_MAX_MIN,
  SIM_MIN_MIN,
  VISIT_FALLBACK_MEDIAN_MIN,
  VISIT_MAX_MIN,
  VISIT_MIN_MIN,
} from './constants.js';
import { dateToMs, dayKeyOf, isCountedDay, statsStartOf, toMs } from './period.js';
import {
  affiliationKey,
  countryKey,
  normalizeAffiliation,
  normalizeCountry,
  spellingIndex,
} from './normalize.js';
import { cleanVisits, compareIds, computeBaseline } from './clean/visits.js';
import { cleanSimSessions } from './clean/simSessions.js';
import { buildBookingSegs, buildClasses, buildEvents } from './clean/bookings.js';
import { inferClassStatus, inferEventStatus } from './clean/classStatus.js';

let lastDatasetId = 0;

// The guest form is free text: country and institution are grouped by key and shown with
// the spelling most people used.
const buildGuestRegs = (rows) => {
  const list = rows || [];
  const countrySpellings = spellingIndex(list.map((row) => row?.country), countryKey);
  const affiliationSpellings = spellingIndex(list.map((row) => row?.affiliation), affiliationKey);
  const regs = [];
  list.forEach((row) => {
    if (!row) return;
    const ms = toMs(row.created_at);
    if (!Number.isFinite(ms)) return;
    const affiliation = normalizeAffiliation(row.affiliation, affiliationSpellings);
    regs.push({
      id: row.id,
      ms,
      dayKey: dayKeyOf(ms),
      country: normalizeCountry(row.country, countrySpellings),
      affiliationKey: affiliation.key,
      affiliation: affiliation.label,
    });
  });
  regs.sort((a, b) => a.ms - b.ms || compareIds(a.id, b.id));
  return regs;
};

// The day a raw row belongs to — a visit to its tap-in, a session to its start, a class to its
// date, an event to its start, a guest registration to its sign-in — the same days the metrics
// count them on. null = no usable date.
const dayOfInstant = (value) => {
  const ms = toMs(value);
  return Number.isFinite(ms) ? dayKeyOf(ms) : null;
};
const DAY_OF_ROW = {
  centerSessions: (row) => dayOfInstant(row.entry_time),
  simSessions: (row) => dayOfInstant(row.start_time),
  schedules: (row) => (row.session_date ? String(row.session_date).slice(0, 10) : null),
  events: (row) => dayOfInstant(row.starts_at),
  guests: (row) => dayOfInstant(row.created_at),
};

// Rows dated before the counted window (STATS_START_DATE, see period.js) are split off here,
// once, before any cleaning — so baselines, class evidence and every metric only ever see
// counted days. Rows without a usable date stay: the cleaning steps count and drop them.
const splitAtStart = (raw, statsStart) => {
  const counted = {};
  const before = {};
  Object.entries(DAY_OF_ROW).forEach(([table, dayOf]) => {
    counted[table] = [];
    before[table] = [];
    (raw?.[table] || []).forEach((row) => {
      const day = row ? dayOf(row) : null;
      if (day !== null && !isCountedDay(day, statsStart)) before[table].push(row);
      else counted[table].push(row);
    });
  });
  return { counted, before };
};

// options.statsStart: see period.js (undefined → STATS_START_DATE, null → every day counts).
export const buildDataset = (rawInput, ref, nowMs, options = {}) => {
  const statsStart = statsStartOf(options.statsStart);
  const { counted: raw, before } = splitAtStart(rawInput, statsStart); // `raw` = counted rows only
  const roleByUserId = ref?.roleByUserId || new Map();

  // center_sessions has no university column: a row counts when its user is in one of the
  // university's role tables. Everything else (deleted accounts) is kept apart and never
  // enters a total.
  const knownRows = [];
  const unknownRows = [];
  (raw.centerSessions || []).forEach((row) => {
    if (row && roleByUserId.has(row.user_id)) knownRows.push(row);
    else if (row) unknownRows.push(row);
  });

  const visitBaseline = computeBaseline(knownRows, {
    getStart: (row) => row.entry_time,
    getEnd: (row) => row.exit_time,
    minMin: VISIT_MIN_MIN,
    maxMin: VISIT_MAX_MIN,
    fallbackMin: VISIT_FALLBACK_MEDIAN_MIN,
  });
  const visitOptions = { nowMs, medianMin: visitBaseline.medianMin, roleByUserId };
  const { visits, stats: visitStats, shortTapMs } = cleanVisits(knownRows, visitOptions);
  const { visits: unattributedVisits } = cleanVisits(unknownRows, visitOptions);

  const simulatorById = ref?.simulatorById || new Map();
  const scopedSimRows = (raw.simSessions || []).filter((row) => row && simulatorById.has(row.simulator_id));
  const simBaseline = computeBaseline(scopedSimRows, {
    getStart: (row) => row.start_time,
    getEnd: (row) => row.end_time,
    minMin: SIM_MIN_MIN,
    maxMin: SIM_MAX_MIN,
    fallbackMin: SIM_FALLBACK_MEDIAN_MIN,
  });
  const { sessions: simSessions, stats: simStats } = cleanSimSessions(raw.simSessions || [], {
    nowMs,
    simulatorById,
    medianMin: simBaseline.medianMin,
    roleByUserId,
  });

  const evidence = { visits, simSessions, ref, nowMs };
  const classes = inferClassStatus(buildClasses(raw.schedules, ref), evidence);
  const events = inferEventStatus(buildEvents(raw.events, ref), evidence);
  const { bookingSegs, removedSimRefs, unlistedRoomRefs } = buildBookingSegs(classes, events, ref);

  // First / last recorded activity. Classes count once they have started — a class planned
  // for next month is not activity yet.
  let firstActivityMs = null;
  let lastActivityMs = null;
  const note = (ms) => {
    if (!Number.isFinite(ms)) return;
    if (firstActivityMs === null || ms < firstActivityMs) firstActivityMs = ms;
    if (lastActivityMs === null || ms > lastActivityMs) lastActivityMs = ms;
  };
  visits.forEach((visit) => note(visit.entryMs));
  simSessions.forEach((session) => note(session.startMs));
  classes.forEach((item) => {
    if (item.startMs <= nowMs) note(item.startMs);
  });
  // Rows before the counted window never count, but they show that SimuFlow was already
  // recording when it opened: then every denominator starts on its first day, even if nobody
  // tapped in on that day. (lastActivityMs stays the last COUNTED activity, null if none.)
  const recordedBefore =
    before.centerSessions.some((row) => roleByUserId.has(row.user_id)) ||
    before.simSessions.some((row) => simulatorById.has(row.simulator_id)) ||
    before.schedules.length > 0;
  if (statsStart && recordedBefore) {
    const startMs = dateToMs(statsStart);
    if (firstActivityMs === null || startMs < firstActivityMs) firstActivityMs = startMs;
  }

  lastDatasetId += 1;
  return {
    id: lastDatasetId,
    nowMs,
    visits,
    unattributed: {
      visits: unattributedVisits.length,
      people: new Set(unattributedVisits.map((visit) => visit.userId)).size,
      items: unattributedVisits, // cleaned like any visit, so metrics can count them per period
    },
    simSessions,
    classes,
    events,
    bookingSegs,
    guestRegs: buildGuestRegs(raw.guests),
    baselines: {
      visitMedianMin: visitBaseline.medianMin,
      visitSample: visitBaseline.sampleSize,
      simMedianMin: simBaseline.medianMin,
      simSample: simBaseline.sampleSize,
    },
    quality: {
      visits: visitStats,
      simSessions: simStats,
      removedSimRefs,
      unlistedRoomRefs,
      shortTapMs, // when the ignored accidental taps happened, so a period can count its own
      // Raw rows per table dated before the counted window: dropped, never cleaned or counted.
      beforeStart: Object.fromEntries(Object.entries(before).map(([table, rows]) => [table, rows.length])),
    },
    statsStart,
    firstActivityMs,
    lastActivityMs,
  };
};
