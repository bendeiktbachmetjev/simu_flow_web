import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classToSegment, clipSegments, eventToSegments, intersectSegments, mergeSegments, msToSegments,
  slotLabels, slotMatrix, sumMinutes,
} from '../intervals.js';
import { availability, isoWeekdayOfDate } from '../period.js';
import { buildBookingSegs, buildClasses, buildEvents, roomKey, simKey } from '../clean/bookings.js';
import { makeRef, schedule, eventCode, localMs } from './fixtures.mjs';

const ref = makeRef();
const OPEN = { openMin: 8 * 60, closeMin: 20 * 60, dayFilter: (date) => isoWeekdayOfDate(date) <= 5 };

const segsOf = (segs, key) => segs.filter((s) => s.resourceKey === key);
const bookingsOf = (segs) => new Set(segs.map((s) => `${s.kind}:${s.sourceId}`)).size;
const insideOutside = (segs) => {
  const merged = mergeSegments(segs);
  const inside = sumMinutes(clipSegments(merged, OPEN));
  return { inside, outside: sumMinutes(merged) - inside };
};
const roomSegs = ({ schedules = [], events = [] }) => {
  const { bookingSegs } = buildBookingSegs(buildClasses(schedules, ref), buildEvents(events, ref), ref);
  return segsOf(bookingSegs, roomKey('A2-06'));
};

test('one room, Tuesday: class 10–12 + event 11–14 ⇒ 240 merged minutes, 2 bookings', () => {
  const segs = roomSegs({
    schedules: [schedule({ session_date: '2026-09-15', rooms: ['A2-06'] })],
    events: [eventCode({ starts: '2026-09-15 11:00', ends: '2026-09-15 14:00', rooms: ['A2-06'] })],
  });
  assert.equal(isoWeekdayOfDate('2026-09-15'), 2);
  assert.equal(bookingsOf(segs), 2);
  assert.equal(sumMinutes(segs), 300, 'raw segments overlap for an hour');
  assert.deepEqual(mergeSegments(segs), [{ date: '2026-09-15', startMin: 600, endMin: 840 }]);
  assert.deepEqual(insideOutside(segs), { inside: 240, outside: 0 });
});

test('event 18–22 ⇒ 120 minutes inside open hours, 2 h outside', () => {
  const segs = roomSegs({
    events: [eventCode({ starts: '2026-09-15 18:00', ends: '2026-09-15 22:00', rooms: ['A2-06'] })],
  });
  assert.deepEqual(insideOutside(segs), { inside: 120, outside: 120 });
});

test('Saturday event ⇒ nothing inside, 4 h outside', () => {
  const segs = roomSegs({
    events: [eventCode({ starts: '2026-09-19 10:00', ends: '2026-09-19 14:00', rooms: ['A2-06'] })],
  });
  assert.equal(isoWeekdayOfDate('2026-09-19'), 6);
  assert.deepEqual(insideOutside(segs), { inside: 0, outside: 240 });
});

test('event across the 25-hour day (Sat 24 Oct 18:00 → Sun 25 Oct 12:00) ⇒ 1080 wall minutes', () => {
  const ev = eventCode({ starts: '2026-10-24 18:00', ends: '2026-10-25 12:00' });
  const segments = eventToSegments(ev);
  assert.deepEqual(segments, [
    { date: '2026-10-24', startMin: 1080, endMin: 1440 },
    { date: '2026-10-25', startMin: 0, endMin: 720 },
  ]);
  assert.equal(sumMinutes(segments), 1080);
  // 19 hours really pass; the wall clock only shows 18
  assert.equal((Date.parse(ev.ends_at) - Date.parse(ev.starts_at)) / 60000, 1140);
  assert.deepEqual(msToSegments(localMs('2026-10-24 18:00'), localMs('2026-10-25 12:00')), segments);
});

test('the 23-hour day (29 Mar 2026) keeps wall-clock minutes too', () => {
  const segments = msToSegments(localMs('2026-03-28 22:00'), localMs('2026-03-29 08:00'));
  assert.deepEqual(segments, [
    { date: '2026-03-28', startMin: 1320, endMin: 1440 },
    { date: '2026-03-29', startMin: 0, endMin: 480 },
  ]);
});

test('msToSegments: edges', () => {
  assert.deepEqual(msToSegments(localMs('2026-06-15 10:00'), localMs('2026-06-15 10:20')), [
    { date: '2026-06-15', startMin: 600, endMin: 620 },
  ]);
  // ending exactly at midnight does not leak into the next day
  assert.deepEqual(msToSegments(localMs('2026-06-15 22:00'), localMs('2026-06-16 00:00')), [
    { date: '2026-06-15', startMin: 1320, endMin: 1440 },
  ]);
  // three days
  assert.equal(msToSegments(localMs('2026-06-15 22:00'), localMs('2026-06-17 01:00')).length, 3);
  assert.deepEqual(msToSegments(localMs('2026-06-15 10:00'), localMs('2026-06-15 10:00')), []);
  assert.deepEqual(msToSegments(NaN, 5), []);
});

test('classToSegment: wall-clock row, unusable times give null', () => {
  assert.deepEqual(
    classToSegment({ session_date: '2026-06-15', start_time: '10:00:00', end_time: '12:30:00' }),
    { date: '2026-06-15', startMin: 600, endMin: 750 }
  );
  assert.equal(classToSegment({ session_date: '2026-06-15', start_time: '12:00', end_time: '10:00' }), null);
  assert.equal(classToSegment({ session_date: '2026-06-15', start_time: null, end_time: '10:00' }), null);
  assert.equal(classToSegment(null), null);
});

test('mergeSegments: per date, touching segments join, input untouched', () => {
  const input = [
    { date: '2026-06-16', startMin: 600, endMin: 660 },
    { date: '2026-06-15', startMin: 660, endMin: 720 },
    { date: '2026-06-15', startMin: 600, endMin: 660 }, // touches the one above
    { date: '2026-06-15', startMin: 900, endMin: 960 },
    { date: '2026-06-15', startMin: 910, endMin: 920 }, // inside the one above
  ];
  const copy = JSON.parse(JSON.stringify(input));
  assert.deepEqual(mergeSegments(input), [
    { date: '2026-06-15', startMin: 600, endMin: 720 },
    { date: '2026-06-15', startMin: 900, endMin: 960 },
    { date: '2026-06-16', startMin: 600, endMin: 660 },
  ]);
  assert.deepEqual(input, copy);
  assert.deepEqual(mergeSegments([]), []);
});

test('clipSegments: perDay from availability() stops today at the current minute', () => {
  const nowMs = localMs('2026-09-16 10:30'); // Wednesday
  const { perDay, openMin, closeMin } = availability({ from: '2026-09-14', toExcl: '2026-09-21' }, nowMs);
  const segs = [
    { date: '2026-09-15', startMin: 420, endMin: 600, tag: 'tue' }, // 07:00–10:00 → 08:00–10:00
    { date: '2026-09-16', startMin: 540, endMin: 720, tag: 'today' }, // 09:00–12:00 → 09:00–10:30
    { date: '2026-09-17', startMin: 540, endMin: 720, tag: 'tomorrow' }, // not elapsed yet
  ];
  assert.deepEqual(clipSegments(segs, { openMin, closeMin, perDay }), [
    { date: '2026-09-15', startMin: 480, endMin: 600, tag: 'tue' },
    { date: '2026-09-16', startMin: 540, endMin: 630, tag: 'today' },
  ]);
});

test('intersectSegments: booked ∩ used', () => {
  const booked = [
    { date: '2026-06-15', startMin: 600, endMin: 720 },
    { date: '2026-06-16', startMin: 600, endMin: 720 },
  ];
  const used = [
    { date: '2026-06-15', startMin: 570, endMin: 630 },
    { date: '2026-06-15', startMin: 620, endMin: 640 }, // overlaps the previous one
    { date: '2026-06-15', startMin: 700, endMin: 760 },
    { date: '2026-06-17', startMin: 600, endMin: 720 },
  ];
  const both = intersectSegments(booked, used);
  assert.deepEqual(both, [
    { date: '2026-06-15', startMin: 600, endMin: 640 },
    { date: '2026-06-15', startMin: 700, endMin: 720 },
  ]);
  assert.equal(sumMinutes(both), 60);
  assert.deepEqual(intersectSegments(booked, []), []);
});

test('slotMatrix: a Tuesday 10–12 booking lands wholly in slot "10–12"', () => {
  const labels = slotLabels();
  assert.deepEqual(labels, ['08–10', '10–12', '12–14', '14–16', '16–18', '18–20']);

  const matrix = slotMatrix([{ date: '2026-09-15', startMin: 600, endMin: 720 }]);
  assert.equal(matrix.length, 8);
  assert.equal(matrix[2][labels.indexOf('10–12')], 120);
  assert.equal(matrix.flat().reduce((a, b) => a + b, 0), 120);

  // 09:00–13:30 on a Friday spreads over three slots; 07:00–08:00 and 20:00–21:00 are ignored
  const spread = slotMatrix([
    { date: '2026-09-18', startMin: 540, endMin: 810 },
    { date: '2026-09-18', startMin: 420, endMin: 480 },
    { date: '2026-09-18', startMin: 1200, endMin: 1260 },
  ]);
  assert.deepEqual(spread[5], [60, 120, 90, 0, 0, 0]);
  // Sunday is row 7
  assert.equal(slotMatrix([{ date: '2026-09-20', startMin: 480, endMin: 540 }])[7][0], 60);
});

test('buildBookingSegs: removed simulators and unlisted rooms are flagged, one seg per resource and day', () => {
  const classes = buildClasses(
    [schedule({ id: 'c1', session_date: '2026-09-15', simulators: ['2', '1', '2'], rooms: ['Debriefing', 'A2-06'] })],
    ref
  );
  const events = buildEvents(
    [eventCode({ id: 'e1', starts: '2026-10-24 18:00', ends: '2026-10-25 12:00', allowed_simulators: ['X1'], rooms: ['C2-04'] })],
    ref
  );
  const { bookingSegs, removedSimRefs, unlistedRoomRefs } = buildBookingSegs(classes, events, ref);

  assert.equal(removedSimRefs, 1);
  assert.equal(unlistedRoomRefs, 1);
  assert.equal(bookingSegs.length, 4 + 4, 'class: 2 sims + 2 rooms · event: (1 sim + 1 room) × 2 days');

  const [known] = segsOf(bookingSegs, simKey('2'));
  assert.deepEqual(known, {
    date: '2026-09-15', startMin: 600, endMin: 720, kind: 'class', sourceId: 'c1', resourceType: 'simulator',
    resourceKey: 'sim:2', resourceId: 'sim-2', label: 'No. 2 · SimMan 3G', removed: false,
  });
  const [removed] = segsOf(bookingSegs, simKey('1'));
  assert.deepEqual([removed.removed, removed.label, removed.resourceId], [true, 'Simulator 1 (removed)', null]);

  const [unlisted] = segsOf(bookingSegs, roomKey('Debriefing'));
  assert.deepEqual([unlisted.listed, unlisted.resourceType, unlisted.resourceId], [false, 'room', null]);
  const [listed] = segsOf(bookingSegs, roomKey('A2-06'));
  assert.deepEqual([listed.listed, listed.resourceId], [true, 'room-a206']);

  assert.deepEqual(
    segsOf(bookingSegs, roomKey('C2-04')).map((s) => [s.date, s.startMin, s.endMin, s.kind, s.sourceId]),
    [['2026-10-24', 1080, 1440, 'event', 'e1'], ['2026-10-25', 0, 720, 'event', 'e1']]
  );
});
