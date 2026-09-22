// Period presets, comparison windows, chart buckets and available hours.
// Pure: "now" is always passed in. Dates are local calendar days ('YYYY-MM-DD') and every
// step is calendar arithmetic — Vilnius DST days are 23/25 h long, so adding 86 400 000 ms
// would drift.
import moment from 'moment';
import { OPEN_HOUR, CLOSE_HOUR, WORKDAYS, STATS_START_DATE } from './constants.js';

export const PRESETS = [
  { id: 'thisMonth', label: 'This month' },
  { id: 'semester', label: 'Semester' },
  { id: 'academicYear', label: 'Academic year' },
  { id: 'thisYear', label: 'This year' },
  { id: 'allTime', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];
export const DEFAULT_PRESET = 'thisYear';

// Presets the ‹ › stepper can move.
export const SHIFTABLE_PRESETS = ['thisMonth', 'semester', 'academicYear', 'thisYear'];

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;

// ---------------------------------------------------------------------------
// Small date helpers
// ---------------------------------------------------------------------------

const pad2 = (n) => (n < 10 ? `0${n}` : String(n));
const toKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
// Local midnight always exists in Vilnius (DST switches at 03:00 / 04:00).
const parseKey = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));

const isValidDateKey = (key) => typeof key === 'string' && DATE_RE.test(key) && toKey(parseKey(key)) === key;

// Timestamp (ISO string from PostgREST, Date or epoch ms) → epoch ms; NaN when unusable.
// Not for date-only strings: those are local days, use dateToMs.
export const toMs = (value) => {
  if (value === null || value === undefined || value === '') return NaN;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? moment(value, moment.ISO_8601).valueOf() : parsed;
};

export const dayKeyOf = (ms) => toKey(new Date(ms));

export const monthKeyOf = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

export const isoWeekdayOf = (ms) => new Date(ms).getDay() || 7;

export const hourOf = (ms) => new Date(ms).getHours();

// Local midnight of a calendar day, in epoch ms.
export const dateToMs = (dateStr) => parseKey(dateStr).getTime();

export const isoWeekdayOfDate = (dateStr) => parseKey(dateStr).getDay() || 7;

export const addDays = (dateStr, n) => {
  const d = parseKey(dateStr);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

// Whole calendar days from a to b (b exclusive). Rounding absorbs the DST hour.
export const diffDays = (a, b) => Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / DAY_MS);

export const eachDay = (from, toExcl) => {
  const days = [];
  if (!isValidDateKey(from) || !isValidDateKey(toExcl)) return days;
  const cursor = parseKey(from);
  let key = from;
  while (key < toExcl) {
    days.push(key);
    cursor.setDate(cursor.getDate() + 1);
    key = toKey(cursor);
  }
  return days;
};

const firstOfMonth = (year, monthIndex) => toKey(new Date(year, monthIndex, 1));
const addMonthsToFirst = (dateStr, n) => {
  const d = parseKey(dateStr);
  return firstOfMonth(d.getFullYear(), d.getMonth() + n);
};
const monthsBetween = (a, b) => {
  const da = parseKey(a);
  const db = parseKey(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
};
const isFirstOfMonth = (dateStr) => dateStr.endsWith('-01');
const mondayOf = (dateStr) => addDays(dateStr, 1 - isoWeekdayOfDate(dateStr));

const dayMonth = (dateStr) => {
  const d = parseKey(dateStr);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};
const dayMonthYear = (dateStr) => `${dayMonth(dateStr)} ${dateStr.slice(0, 4)}`;

// '6 Jul 2026' · '6 Jul – 19 Aug 2026' · '29 Dec 2025 – 4 Jan 2026' (end shown inclusive)
const dayRangeLabel = (from, toExcl) => {
  const last = addDays(toExcl, -1);
  if (last <= from) return dayMonthYear(from);
  if (from.slice(0, 4) === last.slice(0, 4)) return `${dayMonth(from)} – ${dayMonthYear(last)}`;
  return `${dayMonthYear(from)} – ${dayMonthYear(last)}`;
};

// Whole months read as months: 'Aug 2026' · 'Feb – Jun 2026' · 'Sep 2025 – Jan 2026' · '2025'.
const rangeLabel = (from, toExcl) => {
  if (!isFirstOfMonth(from) || !isFirstOfMonth(toExcl)) return dayRangeLabel(from, toExcl);
  const months = monthsBetween(from, toExcl);
  if (months < 1) return dayRangeLabel(from, toExcl);
  const first = parseKey(from);
  const last = parseKey(addMonthsToFirst(toExcl, -1));
  const firstYear = first.getFullYear();
  const lastYear = last.getFullYear();
  if (first.getMonth() === 0 && months % 12 === 0) {
    return firstYear === lastYear ? String(firstYear) : `${firstYear} – ${lastYear}`;
  }
  if (months === 1) return `${MONTHS_SHORT[first.getMonth()]} ${firstYear}`;
  if (firstYear === lastYear) {
    return `${MONTHS_SHORT[first.getMonth()]} – ${MONTHS_SHORT[last.getMonth()]} ${lastYear}`;
  }
  return `${MONTHS_SHORT[first.getMonth()]} ${firstYear} – ${MONTHS_SHORT[last.getMonth()]} ${lastYear}`;
};

// ---------------------------------------------------------------------------
// The counted window — the ONE place that decides which days analytics count
// ---------------------------------------------------------------------------
// A local (Vilnius) calendar day counts when it is on or after STATS_START_DATE. Periods are
// clamped with countedFrom(), rows are kept with isCountedDay() / isCountedMs(), and every
// denominator starts at a clamped period start. A later rule that leaves out whole days
// (summer months, say) goes into isCountedDay() and must then also be applied where open days
// are enumerated (availability() and the rooms heatmap); countedFrom() only knows the start.
//
// Every `statsStart` option means: undefined → STATS_START_DATE, null → no floor (tests that pin
// other rules on older fixture dates), 'YYYY-MM-DD' → that day.

export const statsStartOf = (statsStart) => (statsStart === undefined ? STATS_START_DATE : statsStart || null);

export const isCountedDay = (dayKey, statsStart) => {
  const floor = statsStartOf(statsStart);
  return !floor || dayKey >= floor;
};

// An instant belongs to its local day, like every other rule in this file.
export const isCountedMs = (ms, statsStart) => Number.isFinite(ms) && isCountedDay(dayKeyOf(ms), statsStart);

// The first counted day of a range that starts on `dayKey`.
export const countedFrom = (dayKey, statsStart) => {
  const floor = statsStartOf(statsStart);
  return floor && dayKey < floor ? floor : dayKey;
};

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

export const pickGranularity = (days) => {
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
};

// `today` is kept on the period so buckets and the comparison window can be derived
// later without a clock. `statsStart` (already resolved: a day or null) clamps the start: a
// period that begins before the counted window begins where it opens, and one that lies
// wholly before it collapses to an empty range at its end. The period keeps the floor, so the
// comparison window and the stepper obey the same one.
const makePeriod = ({ preset, offset, label, from: presetFrom, to }, today, statsStart) => {
  const floor = statsStartOf(statsStart);
  const clamped = countedFrom(presetFrom, floor);
  const from = clamped < to ? clamped : to;
  const tomorrow = addDays(today, 1);
  let effTo = to < tomorrow ? to : tomorrow;
  if (effTo < from) effTo = from; // period entirely in the future: nothing has elapsed
  const days = diffDays(from, to);
  return {
    preset,
    offset,
    label,
    from,
    to,
    statsStart: floor,
    startClamped: from !== presetFrom, // the preset itself starts earlier (a year cut at 1 Sep)
    fromMs: dateToMs(from),
    toMs: dateToMs(to),
    effTo,
    effToMs: dateToMs(effTo),
    days,
    effDays: diffDays(from, effTo),
    isPartial: from <= today && today < to,
    isFuture: from > today,
    // Buckets span the nominal period [from, to), so its length picks their size (a year that
    // is 20 days old still shows 12 month slots, not 365 day slots).
    granularity: pickGranularity(days),
    key: `${from}..${to}`,
    today,
  };
};

// Hand-made periods may lack `today`. A running period ends its elapsed part tomorrow, so
// today is the day before; otherwise the period is treated as finished.
const todayOf = (period) =>
  period.today || (period.effTo < period.to ? addDays(period.effTo, -1) : period.effTo);

const semesterRange = (index) => {
  const year = Math.floor(index / 2);
  const autumn = index - year * 2 === 1;
  return autumn
    ? { year, autumn, from: firstOfMonth(year, 8), to: firstOfMonth(year + 1, 1) }
    : { year, autumn, from: firstOfMonth(year, 1), to: firstOfMonth(year, 6) };
};

// Semester that holds `today`; in July–August that is the Spring that has just ended.
const semesterIndexOf = (today) => {
  const d = parseKey(today);
  const year = d.getFullYear();
  const month = d.getMonth();
  if (month >= 8) return year * 2 + 1; // Sep–Dec: Autumn of this year
  if (month === 0) return (year - 1) * 2 + 1; // Jan: Autumn that started last year
  return year * 2; // Feb–Aug: Spring
};

// The calendar range a preset stands for, before the counted window is applied.
// null = the choice is unusable and the default preset is used instead.
const presetRange = (presetId, nowMs, { offset, custom, firstActivityMs, floor }) => {
  const today = dayKeyOf(nowMs);
  const now = parseKey(today);
  const year = now.getFullYear();

  switch (presetId) {
    case 'thisMonth': {
      const first = new Date(year, now.getMonth() + offset, 1);
      return {
        preset: 'thisMonth',
        offset,
        label: `${MONTHS_LONG[first.getMonth()]} ${first.getFullYear()}`,
        from: toKey(first),
        to: firstOfMonth(first.getFullYear(), first.getMonth() + 1),
      };
    }
    case 'semester': {
      const sem = semesterRange(semesterIndexOf(today) + offset);
      const justEnded = offset === 0 && today >= sem.to;
      return {
        preset: 'semester',
        offset,
        label: `${sem.autumn ? 'Autumn' : 'Spring'} ${sem.year}${justEnded ? ' (ended 30 Jun)' : ''}`,
        from: sem.from,
        to: sem.to,
      };
    }
    case 'academicYear': {
      const startYear = (now.getMonth() >= 8 ? year : year - 1) + offset;
      return {
        preset: 'academicYear',
        offset,
        label: `${startYear}/${pad2((startYear + 1) % 100)}`,
        from: firstOfMonth(startYear, 8),
        to: firstOfMonth(startYear + 1, 8),
      };
    }
    case 'allTime': {
      // From the first recorded activity, never before the counted window (makePeriod clamps).
      let firstDay = floor || firstOfMonth(year, 0);
      if (Number.isFinite(firstActivityMs) && firstActivityMs <= nowMs) firstDay = dayKeyOf(firstActivityMs);
      return { preset: 'allTime', offset: 0, label: 'All time', from: firstDay, to: addDays(today, 1) };
    }
    case 'custom': {
      const from = custom?.from;
      const to = custom?.to;
      if (!isValidDateKey(from) || !isValidDateKey(to) || from > to) return null;
      const toExcl = addDays(to, 1);
      if (floor && toExcl <= floor) return null; // nothing of it is counted
      return {
        preset: 'custom',
        offset: 0,
        label: dayRangeLabel(countedFrom(from, floor), toExcl),
        from,
        to: toExcl,
      };
    }
    case 'thisYear': {
      const y = year + offset;
      return {
        preset: 'thisYear',
        offset,
        label: String(y),
        from: firstOfMonth(y, 0),
        to: firstOfMonth(y + 1, 0),
      };
    }
    default:
      return null;
  }
};

// options: { offset, custom: { from, to } (inclusive days), firstActivityMs, statsStart }
export const resolvePeriod = (presetId, nowMs, options = {}) => {
  const { custom = null, firstActivityMs = null } = options;
  const offset = Number.isFinite(options.offset) ? Math.trunc(options.offset) : 0;
  const floor = statsStartOf(options.statsStart);

  const range = presetRange(presetId, nowMs, { offset, custom, firstActivityMs, floor });
  if (!range) return resolvePeriod(DEFAULT_PRESET, nowMs, { firstActivityMs, statsStart: floor });

  // An earlier step never lies wholly before the counted window (a stored offset can be older
  // than the rule): move forward to the first one that has counted days.
  if (floor && range.offset < 0 && range.to <= floor) {
    return resolvePeriod(presetId, nowMs, { ...options, offset: range.offset + 1 });
  }
  return makePeriod(range, dayKeyOf(nowMs), floor);
};

// Equal-length window immediately before the ELAPSED part of the period.
// Whole months compare with whole months; anything else with the same number of days.
// The counted window of the period applies here too: a window wholly before it gives null
// (shown like any missing comparison), one partly before it is cut and labelled by its dates.
export const previousPeriod = (period) => {
  if (!period || period.preset === 'allTime' || period.effDays <= 0) return null;
  const { from, effTo } = period;
  const floor = statsStartOf(period.statsStart);
  if (floor && from <= floor) return null;

  let prevFrom;
  let compareLabel;
  if (isFirstOfMonth(from) && isFirstOfMonth(effTo)) {
    prevFrom = addMonthsToFirst(from, -monthsBetween(from, effTo));
    compareLabel = `vs ${rangeLabel(prevFrom, from)}`;
  } else {
    prevFrom = addDays(from, -period.effDays);
    compareLabel = period.effDays === 1 ? 'vs previous day' : `vs previous ${period.effDays} days`;
  }
  if (floor && prevFrom < floor) {
    prevFrom = floor;
    compareLabel = `vs ${rangeLabel(prevFrom, from)}`;
  }

  return {
    ...makePeriod({
      preset: 'custom',
      offset: 0,
      label: rangeLabel(prevFrom, from),
      from: prevFrom,
      to: from,
    }, todayOf(period), floor),
    compareLabel,
  };
};

// Stepper rules: never forward past the current period, never back past the first activity,
// never back into a period that ends before the counted window opens.
export const canShiftPeriod = (period, nowMs, { firstActivityMs = null } = {}) => {
  if (!period || !SHIFTABLE_PRESETS.includes(period.preset)) return { prev: false, next: false };
  const next = period.offset < 0;
  if (!Number.isFinite(firstActivityMs)) return { prev: false, next };
  const target = period.offset - 1;
  const earlier = resolvePeriod(period.preset, nowMs, { offset: target, statsStart: period.statsStart });
  // resolvePeriod moves a step that would land wholly before the counted window forward again.
  return { prev: earlier.offset === target && earlier.toMs > firstActivityMs, next };
};

export const shiftPeriod = (period, direction, nowMs, { firstActivityMs = null } = {}) => {
  const allowed = canShiftPeriod(period, nowMs, { firstActivityMs });
  if ((direction < 0 && !allowed.prev) || (direction > 0 && !allowed.next) || !direction) return period;
  return resolvePeriod(period.preset, nowMs, {
    offset: period.offset + (direction < 0 ? -1 : 1),
    firstActivityMs,
    statsStart: period.statsStart,
  });
};

// ---------------------------------------------------------------------------
// Chart buckets
// ---------------------------------------------------------------------------

const makeBucket = (key, label, longLabel, from, to, today) => ({
  key,
  label,
  longLabel,
  from,
  to,
  fromMs: dateToMs(from),
  toMs: dateToMs(to),
  isFuture: from > today,
  isPartial: from <= today && today < to,
});

// Buckets tile the NOMINAL period exactly: the first and last one are cut at the period
// edges, so an indexed value is always inside the period.
export const buildBuckets = (period) => {
  if (!period || !(period.from < period.to)) return [];
  const { from, to, granularity } = period;
  const today = todayOf(period);
  const clipFrom = (d) => (d < from ? from : d);
  const clipTo = (d) => (d > to ? to : d);
  const buckets = [];

  if (granularity === 'day') {
    eachDay(from, to).forEach((day) => {
      const weekday = WEEKDAYS_SHORT[isoWeekdayOfDate(day) - 1];
      buckets.push(makeBucket(day, dayMonth(day), `${weekday} ${dayMonthYear(day)}`, day, addDays(day, 1), today));
    });
    return buckets;
  }

  if (granularity === 'week') {
    for (let monday = mondayOf(from); monday < to; monday = addDays(monday, 7)) {
      buckets.push(makeBucket(
        monday,
        dayMonth(monday),
        `Week of ${dayMonthYear(monday)}`,
        clipFrom(monday),
        clipTo(addDays(monday, 7)),
        today
      ));
    }
    return buckets;
  }

  let shownYear = null;
  for (let first = `${from.slice(0, 7)}-01`; first < to; first = addMonthsToFirst(first, 1)) {
    const d = parseKey(first);
    const year = d.getFullYear();
    const short = MONTHS_SHORT[d.getMonth()];
    // Year on the first tick and whenever it changes: "Jan ’27"
    const label = year === shownYear ? short : `${short} ’${pad2(year % 100)}`;
    shownYear = year;
    buckets.push(makeBucket(
      first.slice(0, 7),
      label,
      `${MONTHS_LONG[d.getMonth()]} ${year}`,
      clipFrom(first),
      clipTo(addMonthsToFirst(first, 1)),
      today
    ));
  }
  return buckets;
};

// (epoch ms | 'YYYY-MM-DD') → bucket index, or -1 when outside every bucket.
export const bucketIndexer = (buckets) => {
  const list = Array.isArray(buckets) ? buckets : [];
  const find = (value, startKey, endKey) => {
    let lo = 0;
    let hi = list.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (value < list[mid][startKey]) hi = mid - 1;
      else if (value >= list[mid][endKey]) lo = mid + 1;
      else return mid;
    }
    return -1;
  };
  return (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? find(value, 'fromMs', 'toMs') : -1;
    if (typeof value === 'string' && value.length >= 10) return find(value.slice(0, 10), 'from', 'to');
    return -1;
  };
};

// ---------------------------------------------------------------------------
// Available (open) minutes per resource
// ---------------------------------------------------------------------------

// 'elapsed': days after today give nothing and today counts up to the current wall-clock
// minute. 'full': every working day of the range counts whole (planned bookings).
// No public holidays. perDay lists only days that contribute minutes.
export const availability = (range, nowMs, options = {}) => {
  const {
    openHour = OPEN_HOUR,
    closeHour = CLOSE_HOUR,
    workdays = WORKDAYS,
    horizon = 'elapsed',
  } = options;
  const from = range?.from;
  const toExcl = range?.toExcl ?? range?.to;
  const openMin = openHour * 60;
  const closeMin = closeHour * 60;
  const perDay = new Map();
  let minutesPerResource = 0;

  const now = new Date(nowMs);
  const today = toKey(now);
  const nowWallMin = now.getHours() * 60 + now.getMinutes();
  const fullDay = Math.max(0, closeMin - openMin);

  eachDay(from, toExcl).forEach((day) => {
    if (!workdays.includes(isoWeekdayOfDate(day))) return;
    let minutes = fullDay;
    if (horizon === 'elapsed') {
      if (day > today) return;
      if (day === today) minutes = Math.max(0, Math.min(nowWallMin, closeMin) - openMin);
    }
    if (minutes <= 0) return;
    perDay.set(day, minutes);
    minutesPerResource += minutes;
  });

  return { minutesPerResource, workingDays: perDay.size, perDay, openMin, closeMin };
};
