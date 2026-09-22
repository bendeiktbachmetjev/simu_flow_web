// The counted window: analytics count only Vilnius days on or after STATS_START_DATE.
// Periods are clamped to it, rows before it are dropped once in buildDataset, and every
// denominator (open hours, working days, heatmap capacity) starts on its first day.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATS_START_DATE } from '../constants.js';
import {
  SHIFTABLE_PRESETS, availability, buildBuckets, canShiftPeriod, countedFrom, isCountedDay, isCountedMs,
  previousPeriod, resolvePeriod, shiftPeriod,
} from '../period.js';
import { buildDataset } from '../buildDataset.js';
import { effectiveRange } from '../metrics/shared.js';
import { computeVisitors } from '../metrics/visitors.js';
import { computeClasses } from '../metrics/classes.js';
import { computeGuests } from '../metrics/guests.js';
import { computeSimulators } from '../metrics/simulators.js';
import { computeRooms } from '../metrics/rooms.js';
import { computeOverview } from '../metrics/overview.js';
import {
  ALL_DAYS, makeRef, makeRaw, centerSession, simSession, schedule, eventCode, guestReg, localMs,
} from './fixtures.mjs';

const NOW = localMs('2026-09-22 11:00'); // Tuesday
const LATER = localMs('2027-03-15 11:00'); // Monday
const PILOT_MS = localMs('2026-06-15 09:00'); // a first activity from the pilot months
const range = (p) => [p.from, p.to];

// ---------------------------------------------------------------------------
// The rule
// ---------------------------------------------------------------------------

test('STATS_START_DATE is 1 Sep 2026; an instant counts by its Vilnius day', () => {
  assert.equal(STATS_START_DATE, '2026-09-01');

  assert.equal(isCountedMs(localMs('2026-08-31 23:30')), false);
  assert.equal(isCountedMs(localMs('2026-09-01 00:10')), true);
  // The same instants as PostgREST sends them: still 31 Aug in UTC, but 1 Sep in Vilnius.
  assert.equal(isCountedMs(Date.parse('2026-08-31T20:30:00Z')), false);
  assert.equal(isCountedMs(Date.parse('2026-08-31T21:10:00Z')), true);
  assert.equal(isCountedMs(NaN), false);

  assert.equal(isCountedDay('2026-08-31'), false);
  assert.equal(isCountedDay('2026-09-01'), true);
  assert.equal(isCountedDay('2026-08-31', null), true, 'null switches the floor off');
  assert.equal(isCountedDay('2026-09-10', '2026-09-15'), false, 'another floor can be passed');

  assert.equal(countedFrom('2026-01-01'), '2026-09-01');
  assert.equal(countedFrom('2026-10-05'), '2026-10-05');
  assert.equal(countedFrom('2026-01-01', null), '2026-01-01');
});

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

test('every preset starts on or after 1 Sep 2026', () => {
  const year = resolvePeriod('thisYear', NOW);
  assert.deepEqual(
    [year.label, ...range(year), year.effTo, year.days, year.effDays, year.granularity, year.startClamped, year.statsStart],
    ['2026', '2026-09-01', '2027-01-01', '2026-09-23', 122, 22, 'month', true, '2026-09-01']
  );
  assert.deepEqual(buildBuckets(year).map((b) => b.key), ['2026-09', '2026-10', '2026-11', '2026-12']);

  const month = resolvePeriod('thisMonth', NOW);
  assert.deepEqual([month.label, ...range(month), month.startClamped], ['September 2026', '2026-09-01', '2026-10-01', false]);
  const semester = resolvePeriod('semester', NOW);
  assert.deepEqual([semester.label, ...range(semester), semester.startClamped], ['Autumn 2026', '2026-09-01', '2027-02-01', false]);
  const academic = resolvePeriod('academicYear', NOW);
  assert.deepEqual([academic.label, ...range(academic)], ['2026/27', '2026-09-01', '2027-09-01']);

  // All time starts at the counted window, whatever the pilot months recorded.
  assert.deepEqual(range(resolvePeriod('allTime', NOW)), ['2026-09-01', '2026-09-23']);
  assert.deepEqual(range(resolvePeriod('allTime', NOW, { firstActivityMs: PILOT_MS })), ['2026-09-01', '2026-09-23']);
  // A university whose first activity is later keeps its own start.
  assert.deepEqual(
    range(resolvePeriod('allTime', NOW, { firstActivityMs: localMs('2026-09-10 09:00') })),
    ['2026-09-10', '2026-09-23']
  );

  // Custom: cut at the start, labelled by what is counted; wholly before it → the default preset.
  const cut = resolvePeriod('custom', NOW, { custom: { from: '2026-08-15', to: '2026-09-10' } });
  assert.deepEqual([cut.label, ...range(cut), cut.days, cut.startClamped], ['1 Sep – 10 Sep 2026', '2026-09-01', '2026-09-11', 10, true]);
  const before = resolvePeriod('custom', NOW, { custom: { from: '2026-07-06', to: '2026-08-31' } });
  assert.deepEqual([before.preset, ...range(before)], ['thisYear', '2026-09-01', '2027-01-01']);

  ['thisMonth', 'semester', 'academicYear', 'thisYear', 'allTime', 'custom'].forEach((preset) => {
    const p = resolvePeriod(preset, NOW, { firstActivityMs: PILOT_MS, custom: { from: '2025-01-01', to: '2026-09-20' } });
    assert.ok(p.from >= STATS_START_DATE, `${preset} starts ${p.from}`);
  });

  // Later on, periods that begin after the start are left alone.
  const year2027 = resolvePeriod('thisYear', LATER);
  assert.deepEqual([...range(year2027), year2027.startClamped], ['2027-01-01', '2028-01-01', false]);
});

test('stepper: never back into a period that ends before 1 Sep 2026', () => {
  // Even when the dataset's first activity is from the pilot months.
  SHIFTABLE_PRESETS.forEach((preset) => {
    const current = resolvePeriod(preset, NOW);
    assert.deepEqual(canShiftPeriod(current, NOW, { firstActivityMs: PILOT_MS }), { prev: false, next: false }, preset);
    assert.equal(shiftPeriod(current, -1, NOW, { firstActivityMs: PILOT_MS }), current, preset);
  });

  // March 2027 → back to September 2026, and no further.
  let month = resolvePeriod('thisMonth', LATER);
  for (let i = 0; i < 6; i += 1) month = shiftPeriod(month, -1, LATER, { firstActivityMs: PILOT_MS });
  assert.deepEqual([month.label, month.offset], ['September 2026', -6]);
  assert.deepEqual(canShiftPeriod(month, LATER, { firstActivityMs: PILOT_MS }), { prev: false, next: true });

  const year = shiftPeriod(resolvePeriod('thisYear', LATER), -1, LATER, { firstActivityMs: PILOT_MS });
  assert.deepEqual([year.label, ...range(year), year.startClamped], ['2026', '2026-09-01', '2027-01-01', true]);
  assert.equal(canShiftPeriod(year, LATER, { firstActivityMs: PILOT_MS }).prev, false);

  const semester = shiftPeriod(resolvePeriod('semester', LATER), -1, LATER, { firstActivityMs: PILOT_MS });
  assert.equal(semester.label, 'Autumn 2026');
  assert.equal(canShiftPeriod(semester, LATER, { firstActivityMs: PILOT_MS }).prev, false);
  assert.equal(canShiftPeriod(resolvePeriod('academicYear', LATER), LATER, { firstActivityMs: PILOT_MS }).prev, false);

  // A stored offset from before the rule lands on the first counted period.
  const stale = resolvePeriod('thisMonth', NOW, { offset: -1 }); // was August 2026
  assert.deepEqual([stale.label, stale.offset], ['September 2026', 0]);
  const staleLater = resolvePeriod('thisMonth', LATER, { offset: -9 }); // was June 2026
  assert.deepEqual([staleLater.label, staleLater.offset], ['September 2026', -6]);
});

test('comparison windows: none before 1 Sep 2026, cut when they start earlier', () => {
  ['thisMonth', 'semester', 'academicYear', 'thisYear'].forEach((preset) => {
    assert.equal(previousPeriod(resolvePeriod(preset, NOW)), null, preset);
  });
  // 2026 seen from 2027 starts on 1 Sep: nothing counted before it.
  assert.equal(previousPeriod(resolvePeriod('thisYear', LATER, { offset: -1 })), null);

  const october = localMs('2026-10-15 12:00');
  const running = previousPeriod(resolvePeriod('thisMonth', october));
  assert.deepEqual([...range(running), running.compareLabel], ['2026-09-16', '2026-10-01', 'vs previous 15 days']);

  // 10 Sep – 10 Oct would compare with 31 days from 10 Aug: cut at 1 Sep, and says so.
  const cut = previousPeriod(resolvePeriod('custom', october, { custom: { from: '2026-09-10', to: '2026-10-10' } }));
  assert.deepEqual(
    [...range(cut), cut.days, cut.compareLabel, cut.statsStart],
    ['2026-09-01', '2026-09-10', 9, 'vs 1 Sep – 9 Sep 2026', '2026-09-01']
  );

  const november = resolvePeriod('thisMonth', localMs('2026-12-10 12:00'), { offset: -1 });
  assert.equal(previousPeriod(november).compareLabel, 'vs Oct 2026');
});

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const ref = makeRef();

// Every table has a row just before (31 Aug 23:30) and just after (1 Sep 00:10) midnight, plus
// June pilot rows. "Now" is Tue 22 Sep 2026 11:00.
const boundaryRaw = () =>
  makeRaw({
    centerSessions: [
      centerSession('s1', '2026-08-31 23:30', '2026-09-01 01:00', 'cs-aug'),
      centerSession('s2', '2026-09-01 00:10', '2026-09-01 01:00', 'cs-sep'),
      centerSession('s3', '2026-06-15 09:00', '2026-06-15 11:00', 'cs-pilot'),
      centerSession('s4', '2026-08-20 09:00', '2026-08-20 09:00', 'cs-pilot-tap'), // accidental tap
      centerSession('ghost', '2026-08-31 23:30', '2026-09-01 00:30', 'cs-ghost'), // deleted account
    ],
    simSessions: [
      simSession('sim-2', 's1', '2026-08-31 23:30', '2026-08-31 23:50', 'ss-aug'),
      simSession('sim-2', 's2', '2026-09-01 00:10', '2026-09-01 00:40', 'ss-sep'),
    ],
    schedules: [
      schedule({ id: 'class-aug', session_date: '2026-08-31', simulators: ['2'], rooms: ['A2-06'] }),
      schedule({ id: 'class-sep', session_date: '2026-09-01', simulators: ['2'], rooms: ['A2-06'] }), // Tue 10–12
    ],
    events: [
      // Belongs to the day it starts, so it is left out as a whole.
      eventCode({ id: 'ev-aug', starts: '2026-08-31 23:30', ends: '2026-09-01 00:30', allowed_simulators: ['3'] }),
      eventCode({ id: 'ev-sep', starts: '2026-09-01 00:10', ends: '2026-09-01 01:00', allowed_simulators: ['3'] }),
    ],
    guests: [
      guestReg('Lithuania', 'Vilnius University', '2026-08-31 23:30', 'gr-aug'),
      guestReg('Poland', 'Jagiellonian University', '2026-09-01 00:10', 'gr-sep'),
    ],
  });

test('rows dated before 1 Sep 2026 are dropped once, in buildDataset', () => {
  const ds = buildDataset(boundaryRaw(), ref, NOW);

  assert.equal(ds.statsStart, '2026-09-01');
  assert.deepEqual(ds.quality.beforeStart, { centerSessions: 4, simSessions: 1, schedules: 1, events: 1, guests: 1 });
  assert.deepEqual(ds.visits.map((v) => v.id), ['cs-sep']);
  assert.deepEqual(ds.unattributed, { visits: 0, people: 0, items: [] });
  assert.deepEqual(ds.quality.shortTapMs, [], 'a pilot accidental tap is not even a data note');
  assert.equal(ds.quality.visits.raw, 1);
  assert.equal(ds.baselines.visitSample, 1, 'typical lengths come from counted rows only');
  assert.deepEqual(ds.simSessions.map((s) => s.id), ['ss-sep']);
  assert.deepEqual(ds.classes.map((c) => c.id), ['class-sep']);
  assert.deepEqual(ds.events.map((e) => e.id), ['ev-sep']);
  assert.deepEqual(ds.guestRegs.map((g) => g.id), ['gr-sep']);
  assert.ok(ds.bookingSegs.length > 0 && ds.bookingSegs.every((seg) => seg.date >= '2026-09-01'));

  // SimuFlow was recording before the window, so "recording began" is the window's first day
  // (00:00), not the first counted tap (00:10) and not a pilot date.
  assert.equal(ds.firstActivityMs, localMs('2026-09-01 00:00'));
  assert.equal(ds.lastActivityMs, localMs('2026-09-01 10:00'), 'the class of 1 Sep has started');

  // The floor switched off keeps everything (what the older fixtures rely on).
  const all = buildDataset(boundaryRaw(), ref, NOW, ALL_DAYS);
  assert.equal(all.visits.length, 3);
  assert.equal(all.firstActivityMs, localMs('2026-06-15 09:00'));
});

test('rows before 1 Sep 2026 count nowhere, even in a period that reaches back', () => {
  const ds = buildDataset(boundaryRaw(), ref, NOW);
  const thisYear = resolvePeriod('thisYear', NOW, { firstActivityMs: ds.firstActivityMs });
  // A period built without the floor still cannot see dropped rows.
  const wide = resolvePeriod('custom', NOW, { ...ALL_DAYS, custom: { from: '2026-06-01', to: '2026-09-21' } });

  [thisYear, wide].forEach((period) => {
    const visitors = computeVisitors(ds, ref, period);
    assert.equal(visitors.totals.visits, 1, period.key);
    assert.deepEqual(visitors.unattributed, { visits: 0, people: 0 }, period.key);
    assert.deepEqual(visitors.dataNotes, [], period.key);
    assert.equal(computeSimulators(ds, ref, period).totals.sessions, 1, period.key);
    const classes = computeClasses(ds, ref, period);
    assert.deepEqual([classes.totals.planned, classes.totals.guestEvents], [1, 1], period.key);
    const guests = computeGuests(ds, ref, period);
    assert.deepEqual([guests.totals.registrations, guests.totals.guestEvents], [1, 1], period.key);
    assert.equal(computeRooms(ds, ref, period).totals.bookings, 1, period.key);
  });
});

test('This year: occupancy denominators start on 1 Sep 2026', () => {
  const ds = buildDataset(boundaryRaw(), ref, NOW);
  const thisYear = resolvePeriod('thisYear', NOW, { firstActivityMs: ds.firstActivityMs });
  assert.deepEqual(effectiveRange(thisYear, ds), { from: '2026-09-01', toExcl: '2026-09-23', clipped: false });

  // Mon–Fri from Tue 1 Sep: 15 full days + today 08:00–11:00.
  const open = availability({ from: '2026-09-01', toExcl: '2026-09-23' }, NOW);
  assert.deepEqual([open.workingDays, open.minutesPerResource], [16, 15 * 720 + 180]);

  const rooms = computeRooms(ds, ref, thisYear);
  assert.deepEqual(
    [rooms.availability.countedFrom, rooms.availability.clipped, rooms.availability.workingDays, rooms.availability.minutesPerRoom],
    ['2026-09-01', false, 16, 10980]
  );
  assert.equal(rooms.totals.availableHours, 549); // 3 rooms × 183 h
  assert.equal(rooms.totals.occupancyPct, 0.4); // the 2 h class of 1 Sep ÷ 549 h
  // Heatmap capacity too: Tuesdays 1, 8, 15 Sep (120 min) + today 10–11 (60 min), × 3 rooms.
  const { heatmap } = rooms;
  const tueSlot = heatmap.cells[heatmap.slots.indexOf('10–12')][heatmap.weekdays.indexOf(2)];
  assert.equal(tueSlot, 9.5); // 120 of 1260 room-minutes

  const simulators = computeSimulators(ds, ref, thisYear);
  assert.deepEqual(
    [simulators.availability.countedFrom, simulators.availability.clipped, simulators.availability.minutesPerSimulator],
    ['2026-09-01', false, 10980]
  );
  assert.equal(simulators.totals.availableHours, 732); // 4 simulators × 183 h
  assert.equal(simulators.totals.bookedHours, 2);

  // The floor holds for the denominators even for a period that was built without it.
  const unclamped = resolvePeriod('thisYear', NOW, { ...ALL_DAYS });
  assert.deepEqual(effectiveRange(unclamped, ds), { from: '2026-09-01', toExcl: '2026-09-23', clipped: false });
  assert.equal(computeRooms(ds, ref, unclamped).totals.availableHours, 549);

  // A university with no rows before the window is counted from its first activity, as before.
  const fresh = buildDataset(
    makeRaw({ centerSessions: [centerSession('s1', '2026-09-03 09:00', '2026-09-03 10:00', 'cs-fresh')] }),
    ref,
    NOW
  );
  assert.deepEqual(effectiveRange(resolvePeriod('thisYear', NOW), fresh), { from: '2026-09-03', toExcl: '2026-09-23', clipped: true });
});

test('Overview: no comparison with the months before 1 Sep 2026', () => {
  const ds = buildDataset(boundaryRaw(), ref, NOW);
  const thisYear = resolvePeriod('thisYear', NOW, { firstActivityMs: ds.firstActivityMs });
  const overview = computeOverview(ds, ref, thisYear, previousPeriod(thisYear));
  overview.kpis.forEach((kpi) => {
    assert.equal(kpi.delta, null, kpi.id);
    assert.equal(kpi.compareLabel, null, kpi.id);
  });
  assert.deepEqual(overview.counted, { clipped: false, fromLabel: null });
  assert.equal(overview.summary[0].periodFrom, '2026-09-01');
  assert.deepEqual(overview.peakMonth, { key: '2026-09', label: 'September 2026', visits: 1 });
});
