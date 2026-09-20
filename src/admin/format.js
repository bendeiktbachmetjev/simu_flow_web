// Number, duration and date formatters for the admin analytics.
// Pure file: no React, no window, no Date.now() — Node runs it in the tests as well.
// Dates follow the browser's local zone, the same assumption the calendar makes.
import moment from 'moment';

const NBSP = '\u00A0';
const MINUS = '\u2212';
const EN_DASH = '\u2013';
const EMPTY = '\u2014';

const groupedFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const oneDecimalFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const round1 = (n) => Math.round(n * 10) / 10;
const signOf = (n) => (n < 0 ? MINUS : '');

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY = /^\d{4}-\d{2}$/;

// Strict parsing only: a free-form string would make moment fall back to `new Date()` and warn.
const toMoment = (v) => {
  if (v == null || v === '') return null;
  let m;
  if (typeof v === 'string') {
    if (DAY_KEY.test(v)) m = moment(v, 'YYYY-MM-DD', true);
    else if (MONTH_KEY.test(v)) m = moment(v, 'YYYY-MM', true);
    else m = moment(v, moment.ISO_8601, true);
  } else {
    m = moment(v);
  }
  return m.isValid() ? m : null;
};

// `ref` is the value that decides the notation. The count-up passes the final value, so the
// digits on the way up ("0.4K … 12.9K") keep one notation instead of switching half way.
const intText = (n, ref = n) => {
  const rounded = Math.round(n);
  if (rounded === 0) return '0';
  const format = Math.abs(Math.round(ref)) < 10000 ? groupedFormat : compactFormat;
  return `${signOf(rounded)}${format.format(Math.abs(rounded))}`;
};

const pctText = (p, ref = p) => {
  const abs = Math.abs(p);
  if (abs === 0) return '0';
  if (round1(Math.abs(ref)) >= 10) return `${signOf(p)}${groupedFormat.format(Math.round(abs))}`;
  if (abs < 0.1) return `${signOf(p)}<0.1`;
  return `${signOf(p)}${oneDecimalFormat.format(round1(abs))}`;
};

const hoursPart = (h, ref = h) => {
  const abs = Math.abs(h);
  const refAbs = Math.abs(ref);
  if (refAbs === 0) return { num: '0', unit: 'h' };
  if (round1(refAbs) >= 10) return { num: intText(h, ref), unit: 'h' };
  if (Math.round(refAbs * 60) >= 60) return { num: `${signOf(h)}${oneDecimalFormat.format(round1(abs))}`, unit: 'h' };
  const minutes = Math.round(abs * 60);
  if (minutes === 0 && abs > 0) return { num: '<1', unit: 'min' };
  return { num: `${signOf(h)}${minutes}`, unit: 'min' };
};

const durationParts = (min) => {
  const total = Math.round(Math.abs(min));
  if (total === 0) return [{ num: Math.abs(min) > 0 ? '<1' : '0', unit: 'min' }];
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const parts = [];
  if (hours > 0) parts.push({ num: `${signOf(min)}${groupedFormat.format(hours)}`, unit: 'h' });
  if (minutes > 0) parts.push({ num: hours > 0 ? String(minutes) : `${signOf(min)}${minutes}`, unit: 'min' });
  return parts;
};

const joinParts = (parts) =>
  parts
    .map(({ num, unit }) => {
      if (!unit) return num;
      return unit === '%' ? `${num}%` : `${num}${NBSP}${unit}`;
    })
    .join(' ');

// A value split into number and unit, so a stat tile can set the unit in a smaller size.
const parts = (v, format = 'int', ref = v) => {
  if (v == null || v === '') return [{ num: EMPTY, unit: '' }];
  if (typeof v === 'string') return [{ num: v, unit: '' }];
  if (!isNum(v)) return [{ num: EMPTY, unit: '' }];
  const anchor = isNum(ref) ? ref : v;
  switch (format) {
    case 'pct':
      return [{ num: pctText(v, anchor), unit: '%' }];
    case 'hours':
      return [hoursPart(v, anchor)];
    case 'duration':
      return durationParts(v);
    case 'compact':
      return [{ num: `${signOf(v)}${compactFormat.format(Math.abs(v))}`, unit: '' }];
    case 'decimal':
      return [{ num: `${signOf(v)}${oneDecimalFormat.format(round1(Math.abs(v)))}`, unit: '' }];
    default:
      return [{ num: intText(v, anchor), unit: '' }];
  }
};

const numeric = (format) => (n) => (isNum(n) ? joinParts(parts(n, format)) : EMPTY);

const int = numeric('int');
const pct = numeric('pct');
const hours = numeric('hours');
const duration = numeric('duration');
const decimal = numeric('decimal');
const compact = numeric('compact');

// d = result of makeDelta: { kind: 'pct' | 'pp' | 'abs', value, dir }
const delta = (d) => {
  if (!d || !isNum(d.value)) return EMPTY;
  const suffix = d.kind === 'pct' ? '%' : d.kind === 'pp' ? `${NBSP}pp` : '';
  const abs = Math.abs(d.value);
  const keepDecimal = d.kind === 'abs' && !Number.isInteger(d.value);
  const rounded = keepDecimal ? round1(abs) : Math.round(abs);
  if (d.dir === 'flat' || rounded === 0) return `0${suffix}`;
  const body = Number.isInteger(rounded) ? groupedFormat.format(rounded) : oneDecimalFormat.format(rounded);
  return `${d.value > 0 ? '+' : MINUS}${body}${suffix}`;
};

const dateWith = (pattern) => (v) => {
  const m = toMoment(v);
  return m ? m.format(pattern) : EMPTY;
};

const date = dateWith('D MMM YYYY');
const dayShort = dateWith('ddd D MMM');
const dayLong = dateWith('ddd D MMM YYYY');
const month = dateWith('MMMM YYYY');
const time = dateWith('HH:mm');
const dateTime = dateWith('D MMM YYYY, HH:mm');

// `toExcl` is exclusive, the way periods and buckets store their end: the label shows the last day inside.
const range = (from, toExcl) => {
  const start = toMoment(from);
  const end = toMoment(toExcl);
  if (!start || !end) return EMPTY;
  const last = end.clone().subtract(1, 'day');
  if (!last.isAfter(start, 'day')) return start.format('D MMM YYYY');
  const head = start.year() === last.year() ? start.format('D MMM') : start.format('D MMM YYYY');
  return `${head} ${EN_DASH} ${last.format('D MMM YYYY')}`;
};

// Wall-clock minutes since midnight → "10:00" (class and booking times)
const clock = (minutes) => {
  if (!isNum(minutes)) return EMPTY;
  const total = Math.max(0, Math.round(minutes));
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

const FORMATTERS = { int, pct, hours, duration, decimal, compact, date, time };

// Dispatcher for KpiTile, BarList, DataTable and the charts. `format` is a key of FORMATTERS,
// 'text', or a function. Strings pass through, so a cell can carry ready text such as "2 of 3".
const value = (v, format = 'int') => {
  if (v == null || v === '') return EMPTY;
  if (typeof format === 'function') return format(v);
  if (typeof v === 'string' && format !== 'date' && format !== 'time') return v;
  const formatter = FORMATTERS[format];
  return formatter ? formatter(v) : String(v);
};

export const fmt = {
  int,
  compact,
  pct,
  hours,
  duration,
  decimal,
  delta,
  date,
  range,
  time,
  dateTime,
  dayShort,
  dayLong,
  month,
  clock,
  value,
  parts,
  empty: EMPTY,
};

export default fmt;
