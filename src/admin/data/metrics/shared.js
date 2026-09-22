// Helpers every metric shares: period membership, the counted range, comparison deltas,
// rounding, privacy folding and the frame of a chart series.
// Pure: "now" always comes from the dataset (ds.nowMs), never from a clock.
import { PRIVACY_MIN_PEOPLE } from '../constants.js';
import { buildBuckets, bucketIndexer, countedFrom, dayKeyOf } from '../period.js';
import { round1 } from '../clean/visits.js';

export { round1 };

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const OTHER_LABEL = 'Other';
export const NO_CLINIC_LABEL = 'No clinic';
export const GUEST_EVENTS_LABEL = 'Guest events';

// ---------------------------------------------------------------------------
// Period membership and the counted range
// ---------------------------------------------------------------------------

// Epoch ms or a local 'YYYY-MM-DD' day against the NOMINAL period [from, to).
export const inPeriod = (value, period) => {
  if (!period) return false;
  if (typeof value === 'number') return value >= period.fromMs && value < period.toMs;
  if (typeof value === 'string' && value.length >= 10) {
    const day = value.slice(0, 10);
    return day >= period.from && day < period.to;
  }
  return false;
};

// Days that can carry a denominator (available hours). Nothing was recorded before the
// first activity, so counting those days as "open but unused" would understate every %.
// Nor does any day before the counted window (STATS_START_DATE) count, whatever period is
// passed in — resolved periods already start there.
// horizon 'elapsed' stops at today (period.effTo), 'full' runs to the end of the period.
// A period that lies wholly before the first activity gives an empty range (from ≥ toExcl).
export const effectiveRange = (period, ds, { horizon = 'elapsed' } = {}) => {
  const toExcl = horizon === 'full' ? period.to : period.effTo;
  const start = countedFrom(period.from, ds?.statsStart);
  const firstDay = Number.isFinite(ds?.firstActivityMs) ? dayKeyOf(ds.firstActivityMs) : null;
  const clipped = firstDay !== null && firstDay > start;
  return { from: clipped ? firstDay : start, toExcl, clipped };
};

// A comparison is shown only when the earlier window holds recorded activity.
export const comparable = (ds, prevPeriod) => {
  if (!ds || !prevPeriod || !Number.isFinite(ds.firstActivityMs)) return false;
  if (!(prevPeriod.toMs > ds.firstActivityMs)) return false;
  return (
    (ds.visits || []).some((visit) => inPeriod(visit.entryMs, prevPeriod)) ||
    (ds.simSessions || []).some((session) => inPeriod(session.startMs, prevPeriod)) ||
    (ds.classes || []).some((item) => inPeriod(item.date, prevPeriod))
  );
};

// Wall-clock minute of the day at an instant (the unit of every booking segment).
export const wallMinuteOf = (ms) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};

// Booking segments that have already happened: later days are dropped, today is cut at the
// current minute.
export const elapsedSegments = (segs, nowMs) => {
  const today = dayKeyOf(nowMs);
  const nowMin = wallMinuteOf(nowMs);
  const result = [];
  (segs || []).forEach((seg) => {
    if (seg.date < today) result.push(seg);
    else if (seg.date === today && seg.startMin < nowMin) {
      result.push(seg.endMin > nowMin ? { ...seg, endMin: nowMin } : seg);
    }
  });
  return result;
};

// The opposite: what is still ahead, today from the current minute on.
export const remainingSegments = (segs, nowMs) => {
  const today = dayKeyOf(nowMs);
  const nowMin = wallMinuteOf(nowMs);
  const result = [];
  (segs || []).forEach((seg) => {
    if (seg.date > today) result.push(seg);
    else if (seg.date === today && seg.endMin > nowMin) {
      result.push(seg.startMin < nowMin ? { ...seg, startMin: nowMin } : seg);
    }
  });
  return result;
};

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

// Hours are always rounded once, from unrounded minutes.
export const hoursOf = (minutes) => round1(minutes / 60);

// Share in % with one decimal; null when there is nothing to divide by.
export const pct = (n, d) => (Number.isFinite(n) && Number.isFinite(d) && d > 0 ? round1((n / d) * 100) : null);

export const median = (values) => {
  const sorted = (values || []).filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Small groups read as counts, large ones as a share: '2 of 3' · '72% (13 of 18)' · '72%'.
export const shareText = (n, N) => {
  if (!Number.isFinite(n) || !Number.isFinite(N) || N <= 0) return '—';
  if (N < 5) return `${n} of ${N}`;
  const share = `${Math.round((n / N) * 100)}%`;
  return N < 20 ? `${share} (${n} of ${N})` : share;
};

// Change against the comparison window.
//   null      — nothing to compare with, or a % of zero
//   kind abs  — a % of a number under 10 exaggerates ("+200%" for 1 → 3), so the plain
//               difference is given instead
//   kind pp   — difference of two percentages, in percentage points
// |value| under 0.5 reads as "no change".
export const makeDelta = (cur, prev, { kind = 'pct', comparable: canCompare = true } = {}) => {
  if (!canCompare || !Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  let outKind = kind === 'pp' ? 'pp' : 'pct';
  let value;
  if (outKind === 'pp') {
    value = cur - prev;
  } else if (prev === 0) {
    return null;
  } else if (prev < 10) {
    outKind = 'abs';
    value = cur - prev;
  } else {
    value = ((cur - prev) / prev) * 100;
  }
  value = round1(value);
  let dir = 'flat';
  if (Math.abs(value) >= 0.5) dir = value > 0 ? 'up' : 'down';
  return { kind: outKind, value, dir, prev };
};

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

// Rows that cover fewer than `min` people are merged into one "Other" row, so a rare
// faculty can never point at one or two students. Every numeric field is summed; an
// existing "Other" row absorbs the rest. `labelKey` defaults to the first text field.
// Row order is kept, the "Other" row comes last.
export const foldSmall = (rows, options = {}) => {
  const { peopleKey, min = PRIVACY_MIN_PEOPLE, otherLabel = OTHER_LABEL } = options;
  const list = rows || [];
  if (list.length === 0) return [];
  const labelKey = options.labelKey || Object.keys(list[0]).find((key) => typeof list[0][key] === 'string');

  const kept = [];
  let other = null;
  const absorb = (row) => {
    if (!other) {
      other = { ...row, [labelKey]: otherLabel };
      return;
    }
    Object.keys(row).forEach((key) => {
      if (typeof row[key] === 'number') other[key] = (other[key] || 0) + row[key];
    });
  };
  list.forEach((row) => {
    const people = Number(row[peopleKey]) || 0;
    if (row[labelKey] === otherLabel || people < min) absorb(row);
    else kept.push(row);
  });
  return other ? [...kept, other] : kept;
};

// ---------------------------------------------------------------------------
// Chart series
// ---------------------------------------------------------------------------

// One row per bucket of the NOMINAL period. `fields` start at 0; in buckets that have not
// begun they are null (an empty slot on the chart, not a zero) — except `keepFuture`
// fields, which describe plans (upcoming classes) and stay numeric.
// Rows also carry longLabel (tooltip title) and the bucket's from / to days (CSV bucket_start).
export const makeSeries = (period, fields, { keepFuture = [] } = {}) => {
  const buckets = buildBuckets(period);
  const rows = buckets.map((bucket) => {
    const row = {
      key: bucket.key,
      label: bucket.label,
      longLabel: bucket.longLabel,
      from: bucket.from,
      to: bucket.to,
      isFuture: bucket.isFuture,
      isPartial: bucket.isPartial,
    };
    fields.forEach((field) => {
      row[field] = bucket.isFuture && !keepFuture.includes(field) ? null : 0;
    });
    return row;
  });
  return { rows, indexOf: bucketIndexer(buckets) };
};

// Adds to a series cell unless the cell is a future (null) slot.
export const addTo = (row, field, amount) => {
  if (row && row[field] !== null) row[field] += amount;
};

// ---------------------------------------------------------------------------
// Guest events (the same numbers on the Classes and the Guests page)
// ---------------------------------------------------------------------------

// An event belongs to the period that contains its start.
export const eventsInPeriod = (ds, period) => (ds?.events || []).filter((event) => inPeriod(event.startMs, period));

export const eventTotals = (events) => {
  let minutes = 0;
  let held = 0;
  let past = 0;
  events.forEach((event) => {
    minutes += event.durationMin;
    if (event.status === 'held') held += 1;
    if (event.status !== 'upcoming') past += 1;
  });
  // guestEventsPast = started and no longer upcoming (comparable with an earlier window);
  // guestEventsHeld = the subset with NFC evidence.
  return {
    guestEvents: events.length,
    guestEventsPast: past,
    guestEventsHeld: held,
    guestEventHours: hoursOf(minutes),
  };
};
