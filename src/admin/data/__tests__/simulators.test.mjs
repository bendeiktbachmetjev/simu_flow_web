import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDataset } from '../buildDataset.js';
import { resolvePeriod } from '../period.js';
import { computeSimulators } from '../metrics/simulators.js';
import { computeRooms } from '../metrics/rooms.js';
import {
  makeRef, makeRaw, centerSession, simSession, schedule, eventCode, localMs,
} from './fixtures.mjs';

const NOW = localMs('2026-09-16 10:30'); // Wednesday
const september = resolvePeriod('thisMonth', NOW);

const twoSimulators = makeRef({
  simulators: [
    { id: 'sim-2', number: '2', name: 'SimMan 3G' },
    { id: 'sim-3', number: '3', name: 'Resusci Anne' },
  ],
});

// Tue 15 Sep 09–11 (inside open hours) and Sat 12 Sep 10–11 (weekend).
const pinnedSessions = () => [
  simSession('sim-2', 's1', '2026-09-15 09:00', '2026-09-15 11:00', 'ss-tue'),
  simSession('sim-2', 's1', '2026-09-12 10:00', '2026-09-12 11:00', 'ss-sat'),
];
const augustVisit = () => centerSession('s1', '2026-08-03 09:00', '2026-08-03 10:00', 'cs-aug');

// ---------------------------------------------------------------------------
// Simulators
// ---------------------------------------------------------------------------

test('pinned: hours 3.0, in open hours 2.0, 269.0 h available, utilisation 0.7 %', () => {
  const raw = makeRaw({ centerSessions: [augustVisit()], simSessions: pinnedSessions() });
  const out = computeSimulators(buildDataset(raw, twoSimulators, NOW), twoSimulators, september);

  assert.equal(out.totals.simulators, 2);
  assert.equal(out.totals.activeSimulators, 1);
  assert.equal(out.totals.sessions, 2);
  assert.equal(out.totals.hours, 3);
  assert.equal(out.totals.hoursInOpen, 2);
  assert.equal(out.totals.availableHours, 269);
  assert.equal(out.totals.utilisationPct, 0.7);
  assert.equal(out.totals.idleHours, 267);
  assert.equal(out.totals.medianSessionMin, 90);
  assert.deepEqual(out.availability, {
    workingDays: 12,
    openHour: 8,
    closeHour: 20,
    minutesPerSimulator: 8070,
    clipped: false,
    countedFrom: '2026-09-01',
  });
});

test('pinned: without earlier activity the range is counted from the first session (12 Sep)', () => {
  const raw = makeRaw({ simSessions: pinnedSessions() });
  const out = computeSimulators(buildDataset(raw, twoSimulators, NOW), twoSimulators, september);

  assert.equal(out.availability.clipped, true);
  assert.equal(out.availability.countedFrom, '2026-09-12');
  assert.equal(out.availability.workingDays, 3); // Mon 14, Tue 15 and the running Wed 16
  assert.equal(out.availability.minutesPerSimulator, 720 + 720 + 150);
  assert.equal(out.totals.availableHours, 53);
  assert.equal(out.totals.hoursInOpen, 2);
  assert.equal(out.totals.utilisationPct, 3.8);
});

test('every current simulator keeps a row; most used first, then calendar order', () => {
  const ref = makeRef();
  const raw = makeRaw({ centerSessions: [augustVisit()], simSessions: pinnedSessions() });
  const out = computeSimulators(buildDataset(raw, ref, NOW), ref, september);

  assert.deepEqual(out.perSimulator.map((row) => row.number), ['2', 'X1', '3', '4']);
  const [used, ...idle] = out.perSimulator;
  assert.deepEqual(
    [used.sessions, used.hours, used.hoursInOpen, used.availableHours, used.utilisationPct, used.idleHours],
    [2, 3, 2, 134.5, 1.5, 132.5]
  );
  assert.equal(used.lastUsedMs, localMs('2026-09-15 09:00'));
  idle.forEach((row) => {
    assert.deepEqual(
      [row.sessions, row.hours, row.hoursInOpen, row.utilisationPct, row.bookedHours, row.lastUsedMs],
      [0, 0, 0, 0, 0, null]
    );
  });
});

test('"last used" looks back before the period; the session itself stays outside it', () => {
  const ref = makeRef();
  const raw = makeRaw({ simSessions: [simSession('sim-4', 's1', '2026-06-15 10:00', '2026-06-15 10:30', 'ss-june')] });
  const out = computeSimulators(buildDataset(raw, ref, NOW), ref, september);
  const row = out.perSimulator.find((item) => item.number === '4');
  assert.equal(row.sessions, 0);
  assert.equal(row.lastUsedMs, localMs('2026-06-15 10:00'));
  assert.equal(out.totals.sessions, 0);
});

test('seconds are kept: time in open hours never exceeds the session length', () => {
  const raw = makeRaw({
    centerSessions: [augustVisit()],
    simSessions: [
      simSession('sim-2', 's1', '2026-09-15T06:00:50+00:00', '2026-09-15T06:20:10+00:00', 'ss-1'), // 19 min 20 s
      simSession('sim-2', 's1', '2026-09-15T07:00:59+00:00', '2026-09-15T07:30:01+00:00', 'ss-2'), // 29 min 2 s
    ],
  });
  const out = computeSimulators(buildDataset(raw, twoSimulators, NOW), twoSimulators, september);
  assert.equal(out.totals.hours, 0.8); // 48 min 22 s
  assert.equal(out.totals.hoursInOpen, 0.8);
  assert.ok(out.totals.hoursInOpen <= out.totals.hours);
});

test('booked vs used: merged per simulator, open hours only, up to now; removed numbers apart', () => {
  const ref = makeRef();
  const raw = makeRaw({
    centerSessions: [augustVisit()],
    simSessions: [simSession('sim-2', 's1', '2026-09-15 09:00', '2026-09-15 11:00', 'ss-tue')],
    schedules: [
      // Tue 10–12 on simulators 2, 3 and the removed "7"; teacher t2 belongs to two clinics.
      schedule({ id: 'c-tue', teacher_id: 't2', session_date: '2026-09-15', simulators: ['2', '3', '7'] }),
      // Running right now (10:00–12:00, now 10:30): only the first half hour has happened.
      schedule({ id: 'c-now', session_date: '2026-09-16', simulators: ['3'] }),
      // Next week: not counted at all.
      schedule({ id: 'c-next', session_date: '2026-09-22', simulators: ['2'] }),
    ],
    events: [
      // Tue 11:00–13:00 on simulator 2 overlaps the class by one hour → merged 10–13.
      eventCode({ id: 'ev-tue', starts: '2026-09-15 11:00', ends: '2026-09-15 13:00', allowed_simulators: ['2'] }),
      // Saturday: outside open hours.
      eventCode({ id: 'ev-sat', starts: '2026-09-12 10:00', ends: '2026-09-12 14:00', allowed_simulators: ['4'] }),
    ],
  });
  const out = computeSimulators(buildDataset(raw, ref, NOW), ref, september);
  const byNumber = Object.fromEntries(out.perSimulator.map((row) => [row.number, row]));

  assert.equal(byNumber['2'].bookedHours, 3);
  assert.equal(byNumber['2'].usedDuringBookedHours, 1); // session 09–11 ∩ booked 10–13
  assert.equal(byNumber['2'].bookedPct, 2.2); // 180 of 8070 min
  assert.equal(byNumber['3'].bookedHours, 2.5);
  assert.equal(byNumber['4'].bookedHours, 0);

  assert.equal(out.totals.bookedHours, 5.5);
  assert.equal(out.totals.usedDuringBookedHours, 1);
  assert.equal(out.totals.removedBookedHours, 2);
  assert.deepEqual(out.removed, [
    { number: '7', label: 'Simulator 7 (removed)', bookedHours: 2, bookings: 1 },
  ]);

  // The Tuesday class (2 current simulators × 2 h) is credited to both clinics of its teacher.
  assert.deepEqual(out.bookedByClinic, [
    { clinicId: 'c-pulmo', clinic: 'Pulmonologijos klinika', simulatorHours: 4.5, classes: 2 },
    { clinicId: 'c-surgery', clinic: 'Abdominalinės chirurgijos klinika', simulatorHours: 4, classes: 1 },
    { clinicId: null, clinic: 'Guest events', simulatorHours: 2, classes: 1, isGuestEvents: true },
  ]);
});

test('series: sessions and hours by start bucket, nulls in future buckets', () => {
  const raw = makeRaw({ centerSessions: [augustVisit()], simSessions: pinnedSessions() });
  const out = computeSimulators(buildDataset(raw, twoSimulators, NOW), twoSimulators, september);
  assert.equal(out.series.length, 30);

  const tuesday = out.series.find((row) => row.key === '2026-09-15');
  assert.deepEqual(
    [tuesday.sessions, tuesday.hours, tuesday.hoursInOpen, tuesday.bookedHours, tuesday.utilisationPct],
    [1, 2, 2, 0, 8.3] // 120 of 2 × 720 min
  );
  const saturday = out.series.find((row) => row.key === '2026-09-12');
  assert.deepEqual([saturday.sessions, saturday.hours, saturday.utilisationPct], [1, 1, null]);
  const today = out.series.find((row) => row.key === '2026-09-16');
  assert.deepEqual([today.isPartial, today.isFuture, today.sessions], [true, false, 0]);
  const tomorrow = out.series.find((row) => row.key === '2026-09-17');
  assert.deepEqual(
    [tomorrow.isFuture, tomorrow.sessions, tomorrow.hours, tomorrow.bookedHours, tomorrow.utilisationPct],
    [true, null, null, null, null]
  );
});

// ---------------------------------------------------------------------------
// Rooms (bookings only)
// ---------------------------------------------------------------------------

const juneWeek = resolvePeriod('custom', NOW, { custom: { from: '2026-06-15', to: '2026-06-21' } });

const roomsRaw = () =>
  makeRaw({
    centerSessions: [centerSession('s1', '2026-06-01 09:00', '2026-06-01 10:00', 'cs-june')],
    schedules: [
      schedule({ id: 'r-class-a', session_date: '2026-06-16', simulators: [], rooms: ['A2-06'] }), // Tue 10–12
      schedule({
        id: 'r-class-b', session_date: '2026-06-16', start_time: '11:00:00', simulators: [], rooms: ['A2-19'],
      }), // Tue 11–12
      schedule({ id: 'r-class-old', session_date: '2026-06-17', simulators: [], rooms: ['Debriefing'] }),
      schedule({ id: 'r-class-now', session_date: '2026-09-16', simulators: [], rooms: ['A2-06'] }), // today 10–12
      schedule({ id: 'r-class-next', session_date: '2026-09-22', simulators: [], rooms: ['A2-19'] }),
    ],
    events: [
      eventCode({ id: 'r-ev-tue', starts: '2026-06-16 11:00', ends: '2026-06-16 14:00', rooms: ['A2-06'] }),
      eventCode({ id: 'r-ev-late', starts: '2026-06-18 18:00', ends: '2026-06-18 22:00', rooms: ['A2-19'] }),
      eventCode({ id: 'r-ev-sat', starts: '2026-06-20 10:00', ends: '2026-06-20 14:00', rooms: ['C2-04'] }),
    ],
  });

test('rooms: merged per room, open hours only, unlisted rooms outside every %', () => {
  const ref = makeRef();
  const out = computeRooms(buildDataset(roomsRaw(), ref, NOW), ref, juneWeek);

  assert.deepEqual(
    {
      rooms: out.totals.rooms,
      roomsUsed: out.totals.roomsUsed,
      bookings: out.totals.bookings,
      bookedHours: out.totals.bookedHours,
      availableHours: out.totals.availableHours,
      occupancyPct: out.totals.occupancyPct,
      outsideHours: out.totals.outsideHours,
      unlistedBookedHours: out.totals.unlistedBookedHours,
    },
    {
      rooms: 3,
      roomsUsed: 3,
      bookings: 5,
      bookedHours: 7, // A2-06 10–14 merged (4 h) + A2-19 1 h + 2 h before closing
      availableHours: 180, // 3 rooms × 5 working days × 12 h
      occupancyPct: 3.9,
      outsideHours: 6, // Thu 20–22 and the whole Saturday event
      unlistedBookedHours: 2,
    }
  );
  assert.deepEqual(out.totals.peak, { rooms: 2, date: '2026-06-16', startMin: 660 });
  assert.deepEqual(out.unlisted, { names: ['Debriefing'], bookedHours: 2, bookings: 1 });

  assert.deepEqual(out.perRoom.map((row) => row.name), ['A2-06', 'A2-19', 'C2-04']);
  const [a206, a219, c204] = out.perRoom;
  assert.deepEqual(
    [a206.bookedHours, a206.occupancyPct, a206.bookings, a206.daysUsed, a206.classHours, a206.eventHours],
    [4, 6.7, 2, 1, 2, 3]
  );
  assert.deepEqual([a219.bookedHours, a219.bookings, a219.daysUsed], [3, 2, 2]);
  assert.deepEqual([c204.bookedHours, c204.occupancyPct, c204.bookings, c204.daysUsed], [0, 0, 1, 1]);

  assert.deepEqual(out.byKind, [
    { kind: 'class', label: 'Teacher classes', hours: 3, bookings: 2 },
    { kind: 'event', label: 'Guest events', hours: 5, bookings: 3 },
  ]);
});

test('rooms heatmap: true share of room-hours per weekday × two-hour slot; weekend only if booked', () => {
  const ref = makeRef();
  const { heatmap } = computeRooms(buildDataset(roomsRaw(), ref, NOW), ref, juneWeek);

  assert.deepEqual(heatmap.weekdays, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(heatmap.weekdayLabels, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  assert.deepEqual(heatmap.slots, ['08–10', '10–12', '12–14', '14–16', '16–18', '18–20']);

  const cell = (slot, weekday) => heatmap.cells[heatmap.slots.indexOf(slot)][heatmap.weekdays.indexOf(weekday)];
  assert.equal(cell('10–12', 2), 50); // A2-06 120 min + A2-19 60 min of 3 rooms × 120 min
  assert.equal(cell('12–14', 2), 33.3);
  assert.equal(cell('18–20', 4), 33.3);
  assert.equal(cell('10–12', 6), 33.3);
  assert.equal(cell('08–10', 1), 0);
  assert.equal(heatmap.bookedHours[1][1], 3);
  assert.equal(heatmap.maxPct, 50);
  assert.deepEqual(heatmap.topSlot, { weekdayLabel: 'Tue', slot: '10–12', pct: 50 });

  const quietWeek = resolvePeriod('custom', NOW, { custom: { from: '2026-06-22', to: '2026-06-28' } });
  const quiet = computeRooms(buildDataset(roomsRaw(), ref, NOW), ref, quietWeek);
  assert.deepEqual(quiet.heatmap.weekdays, [1, 2, 3, 4, 5]);
  assert.equal(quiet.heatmap.topSlot, null);
  assert.equal(quiet.totals.peak, null);
  assert.equal(quiet.perRoom.length, 3);
});

test('rooms horizon: "elapsed" stops at this minute, "full" includes planned bookings', () => {
  const ref = makeRef();
  const ds = buildDataset(roomsRaw(), ref, NOW);

  const elapsed = computeRooms(ds, ref, september);
  assert.equal(elapsed.totals.bookings, 1);
  assert.equal(elapsed.totals.bookedHours, 0.5); // today's class 10:00–10:30 so far
  assert.equal(elapsed.totals.availableHours, 403.5); // 3 rooms × 8070 min
  const slot = elapsed.heatmap.slots.indexOf('10–12');
  // Wednesdays 2, 9 and the running 16 Sep: (120 + 120 + 30) min × 3 rooms.
  assert.equal(elapsed.heatmap.cells[slot][2], 3.7);

  const full = computeRooms(ds, ref, september, { horizon: 'full' });
  assert.equal(full.totals.bookings, 2);
  assert.equal(full.totals.bookedHours, 4);
  assert.equal(full.totals.availableHours, 792); // 22 working days × 12 h × 3 rooms
  assert.equal(full.availability.horizon, 'full');

  // Whatever the period: what is still ahead in the next 30 days, from this minute on.
  assert.deepEqual(elapsed.next30, { bookings: 2, hours: 3.5 });
  assert.deepEqual(computeRooms(ds, ref, juneWeek).next30, { bookings: 2, hours: 3.5 });
});
