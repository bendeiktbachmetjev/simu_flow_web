// center_sessions rows → cleaned visits.
// Known defects of the raw data: a cron job closes every open session at 20:00 Vilnius
// (exit lands on 17:00 or 18:00 UTC), double entrance taps create overlapping rows, and
// accidental taps last a few seconds. Rule order matters: impute first, merge second —
// otherwise a forgotten tap-out would swallow a real visit later the same day.
import {
  BASELINE_MIN_SAMPLE,
  VISIT_FALLBACK_MEDIAN_MIN,
  VISIT_MAX_MIN,
  VISIT_MIN_MIN,
} from '../constants.js';
import { toMs, dayKeyOf, monthKeyOf } from '../period.js';

const MIN_MS = 60000;
const DAY_S = 86400;

export const round1 = (x) => Math.round(x * 10) / 10;
export const compareIds = (a, b) => {
  const x = String(a);
  const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
};

// True when the instant lies in the minute after 17:00 or 18:00 UTC — the two runs of the
// closing job (pg_cron fires within that minute; a real tap-out at that exact minute is
// rare enough to accept).
export const isCronClose = (ms) => {
  const value = typeof ms === 'number' ? ms : toMs(ms);
  if (!Number.isFinite(value)) return false;
  const secondOfDay = ((Math.floor(value / 1000) % DAY_S) + DAY_S) % DAY_S;
  return (secondOfDay >= 61200 && secondOfDay < 61260) || (secondOfDay >= 64800 && secondOfDay < 64860);
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Typical length of a normally closed row: median of rows that were NOT closed by the cron
// job and last between minMin and maxMin. Too few such rows → the fixed fallback.
export const computeBaseline = (rows, options = {}) => {
  const {
    getStart = (row) => row.entry_time,
    getEnd = (row) => row.exit_time,
    minMin = VISIT_MIN_MIN,
    maxMin = VISIT_MAX_MIN,
    minSample = BASELINE_MIN_SAMPLE,
    fallbackMin,
  } = options;
  const durations = [];
  (rows || []).forEach((row) => {
    const startMs = toMs(getStart(row));
    const endMs = toMs(getEnd(row));
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || isCronClose(endMs)) return;
    const minutes = (endMs - startMs) / MIN_MS;
    if (minutes >= minMin && minutes <= maxMin) durations.push(minutes);
  });
  if (durations.length === 0 || durations.length < minSample) {
    return { medianMin: fallbackMin, sampleSize: durations.length, source: 'fallback' };
  }
  return { medianMin: round1(median(durations)), sampleSize: durations.length, source: 'sample' };
};

// Shared by visits and simulator sessions: classify one raw interval and give it its
// effective end. A row to drop comes back as { drop: 'invalid' | 'short' }.
//   open — no end yet and still plausible (≤ maxMin): runs until now
//   auto — closed by the cron job, or left open for longer than maxMin: the real end is
//          unknown, so the typical length is used (never more than the raw length or maxMin)
//   tap  — closed by a person; under minMin it is an accidental tap
export const classifyInterval = (startRaw, endRaw, { nowMs, medianMin, maxMin, minMin }) => {
  const startMs = toMs(startRaw);
  const hasEnd = endRaw !== null && endRaw !== undefined && endRaw !== '';
  const rawEndMs = hasEnd ? toMs(endRaw) : Math.max(nowMs, startMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(rawEndMs) || rawEndMs < startMs) {
    return { drop: 'invalid' };
  }
  const rawMin = (rawEndMs - startMs) / MIN_MS;
  let closeKind = 'tap';
  if (!hasEnd) closeKind = rawMin <= maxMin ? 'open' : 'auto';
  else if (isCronClose(rawEndMs)) closeKind = 'auto';
  if (closeKind === 'tap' && rawMin < minMin) return { drop: 'short', startMs };

  const imputed = closeKind === 'auto';
  const effMin = imputed ? Math.min(rawMin, medianMin, maxMin) : Math.min(rawMin, maxMin);
  return {
    startMs,
    endMs: startMs + effMin * MIN_MS,
    closeKind,
    imputed,
    capped: !imputed && rawMin > maxMin,
  };
};

// rows: [{ id, user_id, entry_time, exit_time }]. `roleByUserId` (optional Map) fills
// Visit.role; a row may also carry its own `role`.
// A visit belongs to the day / month / period that contains its entry.
export const cleanVisits = (rows, options = {}) => {
  const { nowMs, maxMin = VISIT_MAX_MIN, minMin = VISIT_MIN_MIN, roleByUserId = null } = options;
  const medianMin = Number.isFinite(options.medianMin) ? options.medianMin : VISIT_FALLBACK_MEDIAN_MIN;
  const stats = { raw: 0, invalid: 0, short: 0, merged: 0, imputed: 0, capped: 0, open: 0 };
  const shortTapMs = []; // entry times of the dropped accidental taps, for per-period data notes
  const byUser = new Map();

  (rows || []).forEach((row) => {
    stats.raw += 1;
    if (!row || row.user_id === null || row.user_id === undefined) {
      stats.invalid += 1;
      return;
    }
    const interval = classifyInterval(row.entry_time, row.exit_time, { nowMs, medianMin, maxMin, minMin });
    if (interval.drop) {
      stats[interval.drop] += 1;
      if (interval.drop === 'short') shortTapMs.push(interval.startMs);
      return;
    }
    const item = {
      id: row.id,
      userId: row.user_id,
      role: row.role ?? roleByUserId?.get(row.user_id) ?? null,
      entryMs: interval.startMs,
      endMs: interval.endMs,
      closeKind: interval.closeKind,
      imputed: interval.imputed,
      capped: interval.capped,
      rawCount: 1,
    };
    if (!byUser.has(item.userId)) byUser.set(item.userId, []);
    byUser.get(item.userId).push(item);
  });

  const visits = [];
  byUser.forEach((list) => {
    list.sort((a, b) => a.entryMs - b.entryMs || a.endMs - b.endMs || compareIds(a.id, b.id));
    const mergedList = [];
    let current = null;
    list.forEach((item) => {
      if (current && item.entryMs <= current.endMs) {
        // Double tap: one visit; the later end decides how the visit was closed.
        current.rawCount += 1;
        stats.merged += 1;
        if (item.endMs > current.endMs) {
          current.endMs = item.endMs;
          current.closeKind = item.closeKind;
          current.imputed = item.imputed;
          current.capped = item.capped;
        }
        return;
      }
      current = item;
      mergedList.push(item);
    });

    mergedList.forEach((visit) => {
      let minutes = (visit.endMs - visit.entryMs) / MIN_MS;
      if (minutes > maxMin) {
        minutes = maxMin;
        visit.endMs = visit.entryMs + maxMin * MIN_MS;
        visit.capped = true;
      }
      if (minutes < minMin) {
        stats.short += 1;
        shortTapMs.push(visit.entryMs);
        return;
      }
      if (visit.imputed) stats.imputed += 1;
      if (visit.capped) stats.capped += 1;
      if (visit.closeKind === 'open') stats.open += 1;
      visits.push({
        id: visit.id,
        userId: visit.userId,
        role: visit.role,
        entryMs: visit.entryMs,
        endMs: visit.endMs,
        durationMin: round1(minutes),
        closeKind: visit.closeKind,
        imputed: visit.imputed,
        capped: visit.capped,
        rawCount: visit.rawCount,
        dayKey: dayKeyOf(visit.entryMs),
        monthKey: monthKeyOf(visit.entryMs),
      });
    });
  });

  visits.sort((a, b) => a.entryMs - b.entryMs || compareIds(a.id, b.id));
  shortTapMs.sort((a, b) => a - b);
  return { visits, stats, shortTapMs };
};
