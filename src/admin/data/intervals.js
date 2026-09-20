// Day-segment maths. Segment = { date: 'YYYY-MM-DD', startMin, endMin } in wall-clock minutes
// since local midnight — the same model the calendar draws. Open hours, merging and the
// heatmap all work on wall-clock minutes, so 23/25-hour DST days need no special care.
import { timeToMinutes, clipEventToDay } from '../../components/timeline/model.js';
import { OPEN_HOUR, CLOSE_HOUR, HEAT_SLOT_MIN } from './constants.js';
import { toMs, dayKeyOf, addDays, isoWeekdayOfDate } from './period.js';

const byDateThenStart = (a, b) =>
  (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || a.startMin - b.startMin || a.endMin - b.endMin;

// Absolute interval → one segment per local day it touches, clipped exactly like the
// calendar clips an event (clipEventToDay), so bookings and the calendar always agree.
export const msToSegments = (startMs, endMs) => {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];
  const span = { starts_at: startMs, ends_at: endMs };
  const lastDay = dayKeyOf(endMs);
  const segments = [];
  for (let day = dayKeyOf(startMs); day <= lastDay; day = addDays(day, 1)) {
    const clip = clipEventToDay(span, day);
    if (clip) segments.push({ date: day, startMin: clip.startMin, endMin: clip.endMin });
  }
  return segments;
};

// Accepts a raw event_codes row ({starts_at, ends_at}) or a cleaned item ({startMs, endMs}).
export const eventToSegments = (ev) => {
  if (!ev) return [];
  return msToSegments(toMs(ev.startMs ?? ev.starts_at), toMs(ev.endMs ?? ev.ends_at));
};

// A class is already wall-clock: teacher_schedules row → one segment, or null when the
// times are unusable (same rule as the calendar).
export const classToSegment = (row) => {
  if (!row || !row.session_date) return null;
  const startMin = timeToMinutes(row.start_time);
  const endMin = timeToMinutes(row.end_time);
  if (startMin === null || endMin === null || Number.isNaN(startMin) || Number.isNaN(endMin)) return null;
  if (endMin <= startMin) return null;
  return { date: String(row.session_date).slice(0, 10), startMin, endMin };
};

// Union per date; segments that overlap or touch become one. Extra fields are dropped.
export const mergeSegments = (segs) => {
  const sorted = (segs || []).filter((s) => s && s.endMin > s.startMin).sort(byDateThenStart);
  const merged = [];
  let current = null;
  sorted.forEach((seg) => {
    if (current && current.date === seg.date && seg.startMin <= current.endMin) {
      if (seg.endMin > current.endMin) current.endMin = seg.endMin;
      return;
    }
    current = { date: seg.date, startMin: seg.startMin, endMin: seg.endMin };
    merged.push(current);
  });
  return merged;
};

// Keep only the part inside the open window. `dayFilter(date)` drops whole days (weekends).
// `perDay` (Map date → open minutes, from availability()) drops days it does not list and
// shortens the window of a day that is still running. Extra fields of a segment survive.
export const clipSegments = (segs, options = {}) => {
  const {
    openMin = OPEN_HOUR * 60,
    closeMin = CLOSE_HOUR * 60,
    dayFilter = null,
    perDay = null,
  } = options;
  const clipped = [];
  (segs || []).forEach((seg) => {
    if (!seg) return;
    if (dayFilter && !dayFilter(seg.date)) return;
    let windowEnd = closeMin;
    if (perDay) {
      const minutes = perDay.get(seg.date);
      if (!minutes) return;
      windowEnd = Math.min(closeMin, openMin + minutes);
    }
    const startMin = Math.max(seg.startMin, openMin);
    const endMin = Math.min(seg.endMin, windowEnd);
    if (endMin > startMin) clipped.push({ ...seg, startMin, endMin });
  });
  return clipped;
};

// Time covered by BOTH lists (each list is merged first).
export const intersectSegments = (a, b) => {
  const left = mergeSegments(a);
  const right = mergeSegments(b);
  const result = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const l = left[i];
    const r = right[j];
    if (l.date !== r.date) {
      if (l.date < r.date) i += 1;
      else j += 1;
      continue;
    }
    const startMin = Math.max(l.startMin, r.startMin);
    const endMin = Math.min(l.endMin, r.endMin);
    if (endMin > startMin) result.push({ date: l.date, startMin, endMin });
    if (l.endMin < r.endMin) i += 1;
    else j += 1;
  }
  return result;
};

export const sumMinutes = (segs) =>
  (segs || []).reduce((total, seg) => total + Math.max(0, seg.endMin - seg.startMin), 0);

// ['08–10', '10–12', …] for the rooms heatmap.
export const slotLabels = (options = {}) => {
  const { slotMin = HEAT_SLOT_MIN, openMin = OPEN_HOUR * 60, closeMin = CLOSE_HOUR * 60 } = options;
  const clock = (min) => {
    const h = String(Math.floor(min / 60)).padStart(2, '0');
    return min % 60 === 0 ? h : `${h}:${String(min % 60).padStart(2, '0')}`;
  };
  const labels = [];
  for (let start = openMin; start < closeMin; start += slotMin) {
    labels.push(`${clock(start)}–${clock(Math.min(start + slotMin, closeMin))}`);
  }
  return labels;
};

// minutes[isoWeekday 1..7][slotIndex]; row 0 exists (all zeros) so the result is a plain
// rectangular array. Minutes outside the open window are ignored. Segments are summed as
// given: merge them first when overlaps must not count twice.
export const slotMatrix = (segs, options = {}) => {
  const { slotMin = HEAT_SLOT_MIN, openMin = OPEN_HOUR * 60, closeMin = CLOSE_HOUR * 60 } = options;
  const slotCount = Math.max(0, Math.ceil((closeMin - openMin) / slotMin));
  const minutes = Array.from({ length: 8 }, () => new Array(slotCount).fill(0));
  (segs || []).forEach((seg) => {
    if (!seg) return;
    const startMin = Math.max(seg.startMin, openMin);
    const endMin = Math.min(seg.endMin, closeMin);
    if (endMin <= startMin) return;
    const row = minutes[isoWeekdayOfDate(seg.date)];
    const firstSlot = Math.floor((startMin - openMin) / slotMin);
    const lastSlot = Math.min(slotCount - 1, Math.floor((endMin - 1 - openMin) / slotMin));
    for (let slot = firstSlot; slot <= lastSlot; slot += 1) {
      const slotStart = openMin + slot * slotMin;
      const slotEnd = Math.min(slotStart + slotMin, closeMin);
      row[slot] += Math.max(0, Math.min(endMin, slotEnd) - Math.max(startMin, slotStart));
    }
  });
  return minutes;
};
