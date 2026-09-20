// raw rows + Reference → the ONE cleaned dataset every metric reads.
// Pure apart from the running dataset id (used by the hooks as a cache key).
import {
  SIM_FALLBACK_MEDIAN_MIN,
  SIM_MAX_MIN,
  SIM_MIN_MIN,
  VISIT_FALLBACK_MEDIAN_MIN,
  VISIT_MAX_MIN,
  VISIT_MIN_MIN,
} from './constants.js';
import { toMs, dayKeyOf } from './period.js';
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

export const buildDataset = (raw, ref, nowMs) => {
  const roleByUserId = ref?.roleByUserId || new Map();

  // center_sessions has no university column: a row counts when its user is in one of the
  // university's role tables. Everything else (deleted accounts) is kept apart and never
  // enters a total.
  const knownRows = [];
  const unknownRows = [];
  (raw?.centerSessions || []).forEach((row) => {
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
  const scopedSimRows = (raw?.simSessions || []).filter((row) => row && simulatorById.has(row.simulator_id));
  const simBaseline = computeBaseline(scopedSimRows, {
    getStart: (row) => row.start_time,
    getEnd: (row) => row.end_time,
    minMin: SIM_MIN_MIN,
    maxMin: SIM_MAX_MIN,
    fallbackMin: SIM_FALLBACK_MEDIAN_MIN,
  });
  const { sessions: simSessions, stats: simStats } = cleanSimSessions(raw?.simSessions || [], {
    nowMs,
    simulatorById,
    medianMin: simBaseline.medianMin,
    roleByUserId,
  });

  const evidence = { visits, simSessions, ref, nowMs };
  const classes = inferClassStatus(buildClasses(raw?.schedules, ref), evidence);
  const events = inferEventStatus(buildEvents(raw?.events, ref), evidence);
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
    guestRegs: buildGuestRegs(raw?.guests),
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
    },
    firstActivityMs,
    lastActivityMs,
  };
};
