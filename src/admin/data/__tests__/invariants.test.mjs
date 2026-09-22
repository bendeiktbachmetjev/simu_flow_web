import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDataset } from '../buildDataset.js';
import { previousPeriod, resolvePeriod } from '../period.js';
import { DEFINITIONS, fillHint } from '../definitions.js';
import {
  comparable, effectiveRange, foldSmall, inPeriod, makeDelta, pct, shareText,
} from '../metrics/shared.js';
import { computeVisitors } from '../metrics/visitors.js';
import { computeStudents } from '../metrics/students.js';
import { computeClasses } from '../metrics/classes.js';
import { computeSimulators } from '../metrics/simulators.js';
import { computeRooms } from '../metrics/rooms.js';
import { computeGuests } from '../metrics/guests.js';
import { computeOverview } from '../metrics/overview.js';
import { computeLive } from '../metrics/live.js';
import {
  SCENARIO_NOW, makeScenarioRaw, makeRef, makeRaw, centerSession, simSession, schedule, eventCode,
  localMs, localIso, ALL_DAYS,
} from './fixtures.mjs';

// The scenario's busy week is in June 2026, before STATS_START_DATE: these tests pin the metric
// rules with the counted-window floor off (statsStart.test.mjs tests the floor).
const NOW = localMs(SCENARIO_NOW);
const ref = makeRef();
const ds = buildDataset(makeScenarioRaw(), ref, NOW, ALL_DAYS);

const thisYear = resolvePeriod('thisYear', NOW, { ...ALL_DAYS, firstActivityMs: ds.firstActivityMs });
const june = resolvePeriod('custom', NOW, { ...ALL_DAYS, custom: { from: '2026-06-01', to: '2026-06-30' } });
const twoDays = resolvePeriod('custom', NOW, { ...ALL_DAYS, custom: { from: '2026-06-16', to: '2026-06-17' } });

const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] ?? 0), 0);
const kpi = (overview, id) => overview.kpis.find((item) => item.id === id);
// Formatters put a no-break space before units; tests read plain spaces.
const plainText = (value) => value.replace(/\u00A0/g, ' ');
const sentence = (item) => plainText(item.parts.map((part) => part.t).join(''));
const boldText = (item) => item.parts.filter((part) => part.b).map((part) => plainText(part.t));

// ---------------------------------------------------------------------------
// shared.js
// ---------------------------------------------------------------------------

test('makeDelta: null without a comparison, abs under 10, pct, pp, flat', () => {
  assert.equal(makeDelta(5, 3, { kind: 'pct', comparable: false }), null);
  assert.equal(makeDelta(5, null, { kind: 'pct', comparable: true }), null);
  assert.equal(makeDelta(null, 5, { kind: 'pct', comparable: true }), null);
  assert.equal(makeDelta(5, 0, { kind: 'pct', comparable: true }), null, 'a % of zero is not shown');

  assert.deepEqual(makeDelta(12, 8, { kind: 'pct', comparable: true }), { kind: 'abs', value: 4, dir: 'up', prev: 8 });
  assert.deepEqual(makeDelta(2.5, 4, { kind: 'pct', comparable: true }), { kind: 'abs', value: -1.5, dir: 'down', prev: 4 });
  assert.deepEqual(makeDelta(30, 20, { kind: 'pct', comparable: true }), { kind: 'pct', value: 50, dir: 'up', prev: 20 });
  assert.deepEqual(makeDelta(19, 20, { kind: 'pct', comparable: true }), { kind: 'pct', value: -5, dir: 'down', prev: 20 });
  assert.deepEqual(makeDelta(200.5, 200, { kind: 'pct', comparable: true }), { kind: 'pct', value: 0.3, dir: 'flat', prev: 200 });

  assert.deepEqual(makeDelta(12.5, 4.5, { kind: 'pp', comparable: true }), { kind: 'pp', value: 8, dir: 'up', prev: 4.5 });
  assert.deepEqual(makeDelta(3, 0, { kind: 'pp', comparable: true }), { kind: 'pp', value: 3, dir: 'up', prev: 0 });
  assert.equal(makeDelta(4.2, 4, { kind: 'pp', comparable: true }).dir, 'flat');
});

test('pct and shareText', () => {
  assert.equal(pct(46, 64), 71.9);
  assert.equal(pct(1, 0), null);
  assert.equal(shareText(2, 3), '2 of 3');
  assert.equal(shareText(13, 18), '72% (13 of 18)');
  assert.equal(shareText(46, 64), '72%');
  assert.equal(shareText(0, 0), '—');
});

test('foldSmall merges a 2-person faculty into Other and keeps sums', () => {
  const rows = [
    { faculty: 'Medicine', registered: 54, unique: 40, visits: 200, minutes: 24000 },
    { faculty: 'Nursing', registered: 2, unique: 2, visits: 5, minutes: 300 },
    { faculty: 'Life Sciences Centre', registered: 1, unique: 1, visits: 3, minutes: 100 },
    { faculty: 'Dentistry', registered: 3, unique: 1, visits: 1, minutes: 60 },
  ];
  const folded = foldSmall(rows, { peopleKey: 'registered', labelKey: 'faculty' });
  assert.deepEqual(folded, [
    { faculty: 'Medicine', registered: 54, unique: 40, visits: 200, minutes: 24000 },
    { faculty: 'Dentistry', registered: 3, unique: 1, visits: 1, minutes: 60 },
    { faculty: 'Other', registered: 3, unique: 3, visits: 8, minutes: 400 },
  ]);
  ['registered', 'unique', 'visits', 'minutes'].forEach((key) => assert.equal(sum(folded, key), sum(rows, key)));
  assert.equal(rows[1].faculty, 'Nursing', 'input rows are not changed');

  // Nothing small → untouched; an existing "Other" row absorbs the rest.
  assert.deepEqual(foldSmall(rows.slice(0, 1), { peopleKey: 'registered' }), rows.slice(0, 1));
  const withOther = foldSmall(
    [{ faculty: 'Other', registered: 5, visits: 5 }, { faculty: 'Nursing', registered: 2, visits: 1 }],
    { peopleKey: 'registered' }
  );
  assert.deepEqual(withOther, [{ faculty: 'Other', registered: 7, visits: 6 }]);
});

test('inPeriod, effectiveRange and comparable', () => {
  assert.equal(inPeriod(localMs('2026-06-30 23:59'), june), true);
  assert.equal(inPeriod(localMs('2026-07-01 00:00'), june), false);
  assert.equal(inPeriod('2026-06-01', june), true);
  assert.equal(inPeriod('2026-05-31', june), false);

  // First recorded activity is the 08:00 visit on 15 Jun.
  assert.deepEqual(effectiveRange(thisYear, ds), { from: '2026-06-15', toExcl: '2026-09-17', clipped: true });
  assert.deepEqual(effectiveRange(twoDays, ds), { from: '2026-06-16', toExcl: '2026-06-18', clipped: false });
  assert.deepEqual(effectiveRange(thisYear, ds, { horizon: 'full' }).toExcl, '2027-01-01');

  assert.equal(comparable(ds, previousPeriod(thisYear)), false, 'nothing was recorded in 2025');
  assert.equal(comparable(ds, previousPeriod(twoDays)), true);
  assert.equal(comparable(ds, null), false);
});

// ---------------------------------------------------------------------------
// Same number everywhere
// ---------------------------------------------------------------------------

test('student visits: Students totals = Visitors student row = Overview KPI', () => {
  [thisYear, june, twoDays].forEach((period) => {
    const students = computeStudents(ds, ref, period);
    const visitors = computeVisitors(ds, ref, period);
    const overview = computeOverview(ds, ref, period, previousPeriod(period));

    assert.equal(visitors.byRole[0].role, 'student');
    assert.equal(students.totals.visits, visitors.byRole[0].visits);
    assert.equal(students.totals.visits, kpi(overview, 'studentVisits').value);
    assert.equal(students.totals.uniqueStudents, visitors.byRole[0].unique);
    assert.equal(students.totals.uniqueStudents, kpi(overview, 'uniqueStudents').value);
    assert.equal(students.totals.trainingHours, visitors.byRole[0].hours);
    assert.equal(students.totals.trainingHours, kpi(overview, 'trainingHours').value);
    assert.equal(computeClasses(ds, ref, period).totals.held, kpi(overview, 'classesHeld').value);
    assert.equal(computeSimulators(ds, ref, period).totals.utilisationPct, kpi(overview, 'utilisation').value);

    assert.deepEqual(overview.roles, visitors.byRole);
    assert.deepEqual(overview.activity, visitors.series);
    assert.deepEqual(overview.byCourse, students.byCourse);
    assert.deepEqual(overview.roomsHeat, computeRooms(ds, ref, period).heatmap);
  });
});

test('scenario numbers, this year', () => {
  const visitors = computeVisitors(ds, ref, thisYear);
  assert.deepEqual(visitors.totals, {
    visits: 11,
    uniqueVisitors: 9,
    personHours: 17.8,
    medianVisitMin: 90,
    activeDays: 4,
    peakDay: { date: '2026-06-15', visits: 4 },
  });
  assert.deepEqual(visitors.byRole, [
    { role: 'student', label: 'Students', visits: 8, unique: 6, hours: 11.5 },
    { role: 'teacher', label: 'Teachers', visits: 1, unique: 1, hours: 2.4 },
    { role: 'resident', label: 'Residents', visits: 1, unique: 1, hours: 1 },
    { role: 'guest', label: 'Guests (app)', visits: 1, unique: 1, hours: 2.8 },
  ]);
  assert.deepEqual(visitors.quality, {
    imputedVisits: 1,
    imputedPct: 9.1,
    cappedVisits: 0,
    mergedRows: 1,
    droppedShort: 1,
    unattributedVisits: 1,
  });
  // Mon 15 Jun: 4 · Tue 16 Jun + Tue 15 Sep: 4 · Wed 17 Jun: 3
  assert.deepEqual(visitors.byWeekday.map((row) => row.visits), [4, 4, 3, 0, 0, 0, 0]);

  const students = computeStudents(ds, ref, thisYear);
  assert.deepEqual(students.totals, {
    visits: 8,
    uniqueStudents: 6,
    trainingHours: 11.5,
    medianVisitMin: 75,
    visitsPerStudent: 1.3,
    registered: 6,
    coveragePct: 100,
    coverageText: '100% (6 of 6)',
  });
  assert.deepEqual(students.frequency.map((row) => [row.bucket, row.students]), [['1', 5], ['2-3', 1], ['4-9', 0], ['10+', 0]]);
});

test('sums agree: roles, buckets, years, frequency', () => {
  [thisYear, june].forEach((period) => {
    const visitors = computeVisitors(ds, ref, period);
    assert.equal(sum(visitors.byRole, 'visits'), visitors.totals.visits);
    assert.equal(sum(visitors.byRole, 'unique'), visitors.totals.uniqueVisitors);
    assert.equal(sum(visitors.series, 'visits'), visitors.totals.visits);
    assert.equal(sum(visitors.byWeekday, 'visits'), visitors.totals.visits);

    const students = computeStudents(ds, ref, period);
    assert.equal(sum(students.byCourse, 'visits'), students.totals.visits);
    assert.equal(sum(students.byCourse, 'unique'), students.totals.uniqueStudents);
    assert.equal(sum(students.byFaculty, 'visits'), students.totals.visits);
    assert.equal(sum(students.series, 'visits'), students.totals.visits);
    assert.equal(sum(students.frequency, 'students'), students.totals.uniqueStudents);
    // The Overview chart's "Training hours" is student time, bucket by bucket.
    assert.deepEqual(
      visitors.series.map((row) => [row.studentVisits, row.hours]),
      students.series.map((row) => [row.visits, row.hours])
    );

    const classes = computeClasses(ds, ref, period);
    const { planned, held, noActivity, upcoming, past } = classes.totals;
    assert.equal(held + noActivity + upcoming, planned);
    assert.equal(held + noActivity, past);
    assert.equal(sum(classes.series, 'held') + sum(classes.series, 'noActivity') + sum(classes.series, 'upcoming'), planned);
    assert.equal(classes.list.filter((row) => !row.isEvent).length, planned);

    const simulators = computeSimulators(ds, ref, period);
    assert.equal(sum(simulators.perSimulator, 'sessions'), simulators.totals.sessions);
    assert.ok(simulators.totals.hoursInOpen <= simulators.totals.hours);

    const rooms = computeRooms(ds, ref, period);
    assert.equal(sum(rooms.perRoom, 'bookings'), rooms.totals.bookings);
    assert.equal(sum(rooms.byKind, 'bookings'), rooms.totals.bookings);

    const guests = computeGuests(ds, ref, period);
    assert.equal(sum(guests.byCountry, 'registrations'), guests.totals.registrations);
    assert.equal(
      sum(guests.byAffiliation, 'registrations') + guests.otherAffiliations.registrations,
      guests.totals.registrations
    );
    assert.equal(guests.totals.guestEvents, classes.totals.guestEvents);
    assert.equal(guests.totals.guestEventHours, classes.totals.guestEventHours);
  });
});

test('visits by deleted accounts never enter a total', () => {
  const visitors = computeVisitors(ds, ref, thisYear);
  assert.deepEqual(visitors.unattributed, { visits: 1, people: 1 });
  assert.equal(visitors.totals.visits, 11);
  assert.equal(visitors.totals.uniqueVisitors, 9);
  assert.equal(computeVisitors(ds, ref, twoDays).unattributed.visits, 0, 'counted per period');
});

test('the same visit has the same length under two periods', () => {
  // The cron-closed visit of 15 Jun counts with the typical 120 min whatever the period.
  const yearFive = (period) => computeStudents(ds, ref, period).byCourse.find((row) => row.course === '5');
  assert.deepEqual([yearFive(thisYear).visits, yearFive(thisYear).hours], [1, 2]);
  assert.deepEqual([yearFive(june).visits, yearFive(june).hours], [1, 2]);
  assert.equal(
    computeVisitors(ds, ref, thisYear).series.find((row) => row.key === '2026-06').personHours,
    computeVisitors(ds, ref, june).totals.personHours
  );
});

test('zero rows are kept: simulators, rooms, years of study', () => {
  const quiet = resolvePeriod('custom', NOW, { ...ALL_DAYS, custom: { from: '2026-07-06', to: '2026-07-12' } });
  const simulators = computeSimulators(ds, ref, quiet);
  assert.equal(simulators.perSimulator.length, 4);
  assert.ok(simulators.perSimulator.every((row) => row.sessions === 0 && row.hours === 0 && row.utilisationPct === 0));

  const rooms = computeRooms(ds, ref, quiet);
  assert.equal(rooms.perRoom.length, 3);
  assert.ok(rooms.perRoom.every((row) => row.bookedHours === 0 && row.bookings === 0 && row.occupancyPct === 0));
  assert.equal(rooms.byKind.length, 2);

  const students = computeStudents(ds, ref, quiet);
  assert.deepEqual(students.byCourse.map((row) => row.course), ['1', '2', '3', '4', '5', '6', 'Other']);
  assert.deepEqual(students.byCourse.find((row) => row.course === '2'), {
    course: '2',
    label: 'Year 2',
    registered: 0,
    unique: 0,
    visits: 0,
    hours: 0,
    coveragePct: null,
    coverageText: '—',
    visitsPerStudent: null,
  });
  assert.equal(students.totals.medianVisitMin, null);
  assert.deepEqual(computeClasses(ds, ref, quiet).byCourse.map((row) => row.course), ['1', '2', '3', '4', '5', '6']);
  assert.equal(computeVisitors(ds, ref, quiet).byRole.length, 4);
  assert.equal(computeVisitors(ds, ref, quiet).totals.peakDay, null);
});

test('a faculty with fewer than 3 registered students is reported as Other', () => {
  const { byFaculty } = computeStudents(ds, ref, thisYear);
  assert.deepEqual(byFaculty, [
    { faculty: 'Medicine', registered: 5, unique: 5, visits: 7, hours: 10.5 },
    { faculty: 'Other', registered: 1, unique: 1, visits: 1, hours: 1 },
  ]);
});

// ---------------------------------------------------------------------------
// Classes and guests
// ---------------------------------------------------------------------------

test('classes: status counts, clinics (once per clinic of the teacher), kinds, list', () => {
  const classes = computeClasses(ds, ref, thisYear);
  assert.deepEqual(classes.totals, {
    planned: 3,
    held: 1,
    noActivity: 1,
    upcoming: 1,
    past: 2,
    heldPct: 50,
    heldText: '1 of 2',
    plannedHours: 6,
    heldHours: 2,
    avgDurationMin: 120,
    specialistNeeded: 1,
    guestEvents: 1,
    guestEventHours: 6,
    guestEventsHeld: 1,
    guestEventsPast: 1,
    avgStudentsOnSite: 2,
  });
  assert.deepEqual(classes.byClinic, [
    { clinicId: 'c-pulmo', clinic: 'Pulmonologijos klinika', planned: 3, held: 1, hours: 6, heldHours: 2, teachers: 2 },
    {
      clinicId: 'c-surgery',
      clinic: 'Abdominalinės chirurgijos klinika',
      planned: 1,
      held: 0,
      hours: 2,
      heldHours: 0,
      teachers: 1,
    },
  ]);
  assert.deepEqual(
    classes.byKind.map((row) => [row.kind, row.count, row.hours, row.avgDurationMin]),
    [['teacher', 3, 6, 120], ['specialist', 1, 2, 120], ['event', 1, 6, 360]]
  );
  assert.deepEqual(
    classes.byCourse.filter((row) => row.classes > 0).map((row) => [row.course, row.classes, row.held, row.hours]),
    [['3', 2, 1, 4], ['5', 1, 0, 2]]
  );

  assert.deepEqual(classes.list.map((row) => row.id), ['class-upcoming', 'e1', 'class-quiet', 'class-held']);
  const held = classes.list[3];
  assert.deepEqual(
    [held.date, held.start, held.end, held.durationMin, held.status, held.simulatorsBooked, held.simulatorsUsed, held.rooms],
    ['2026-06-15', '10:00', '12:00', 120, 'held', 2, 1, ['A2-06']]
  );
  assert.deepEqual(held.evidence, { simulator: true, teacher: true, students: true, studentsOnSite: 2 });
  const event = classes.list[1];
  assert.deepEqual([event.isEvent, event.title, event.teacherShort, event.status], [true, 'Airway workshop', null, 'held']);

  // Upcoming classes stay visible in buckets that have not begun.
  const september = classes.series.find((row) => row.key === '2026-09');
  assert.deepEqual([september.upcoming, september.events, september.held], [1, 1, 0]);
  const october = classes.series.find((row) => row.key === '2026-10');
  assert.deepEqual(
    [october.isFuture, october.held, october.noActivity, october.upcoming, october.events],
    [true, null, null, 0, 0]
  );
});

test('guests: registrations by country and institution; small institutions are not named', () => {
  const guests = computeGuests(ds, ref, thisYear);
  assert.deepEqual(guests.totals, {
    registrations: 4,
    countries: 2,
    abroad: 1,
    abroadPct: 25,
    abroadText: '1 of 4',
    guestEvents: 1,
    guestEventsHeld: 1,
    guestEventsPast: 1,
    guestEventHours: 6,
    appGuestAccounts: 1,
    appGuestVisits: 1,
  });
  assert.deepEqual(guests.byCountry, [
    { country: 'Lithuania', registrations: 3, pct: 75 },
    { country: 'Poland', registrations: 1, pct: 25 },
  ]);
  assert.deepEqual(guests.byAffiliation, [{ affiliation: 'Vilnius University', registrations: 3 }]);
  assert.deepEqual(guests.otherAffiliations, { count: 1, registrations: 1 });
  assert.deepEqual(
    guests.events.map((row) => [row.id, row.title, row.hours, row.simulatorsBooked, row.roomsBooked, row.appGuests, row.status]),
    [['e1', 'Airway workshop', 6, 1, 1, 1, 'held']]
  );
});

// ---------------------------------------------------------------------------
// Overview: deltas, highlights, notes
// ---------------------------------------------------------------------------

test('deltas: null when the previous window is empty, abs when the previous value is under 10', () => {
  const empty = computeOverview(ds, ref, thisYear, previousPeriod(thisYear));
  empty.kpis.forEach((item) => {
    assert.equal(item.delta, null, item.id);
    assert.equal(item.compareLabel, null, item.id);
  });
  assert.ok(empty.summary.every((row) => row.previousValue === null && row.change === null && row.previousFrom === null));

  const compared = computeOverview(ds, ref, twoDays, previousPeriod(twoDays));
  assert.deepEqual(kpi(compared, 'studentVisits').delta, { kind: 'abs', value: 1, dir: 'up', prev: 3 });
  assert.deepEqual(kpi(compared, 'classesHeld').delta, { kind: 'abs', value: -1, dir: 'down', prev: 1 });
  assert.deepEqual(kpi(compared, 'utilisation').delta, { kind: 'pp', value: -1, dir: 'down', prev: 1 });
  assert.equal(kpi(compared, 'studentVisits').compareLabel, 'vs previous 2 days');

  const row = compared.summary.find((item) => item.metric === 'student_visits');
  assert.deepEqual(row, {
    metric: 'student_visits',
    value: 4,
    unit: 'visits',
    previousValue: 3,
    change: 1,
    changeKind: 'abs',
    periodFrom: '2026-06-16',
    periodTo: '2026-06-17',
    previousFrom: '2026-06-14',
    previousTo: '2026-06-15',
  });
  assert.deepEqual(compared.summary.map((item) => item.metric), [
    'student_visits', 'unique_students', 'classes_held', 'simulator_utilisation_pct', 'training_hours',
    'visits_all', 'unique_visitors', 'room_occupancy_pct', 'rooms_used', 'guest_registrations',
  ]);
});

test('KPI tiles: ids, formats, routes, hints, sub-lines, sparklines', () => {
  const overview = computeOverview(ds, ref, thisYear, null);
  assert.deepEqual(
    overview.kpis.map((item) => [item.id, item.label, item.format, item.to]),
    [
      ['studentVisits', 'Student visits', 'int', '/admin/students'],
      ['uniqueStudents', 'Unique students', 'int', '/admin/students'],
      ['classesHeld', 'Classes held', 'int', '/admin/classes'],
      ['utilisation', 'Simulator use', 'pct', '/admin/simulators'],
      ['trainingHours', 'Training hours', 'hours', '/admin/students'],
    ]
  );
  overview.kpis.forEach((item) => {
    assert.equal(item.hintKey, item.id);
    assert.ok(DEFINITIONS[item.hintKey].short, `definition for ${item.hintKey}`);
    assert.ok(item.spark.length <= 12 && item.spark.every(Number.isFinite), `spark of ${item.id}`);
  });
  assert.deepEqual(overview.kpis.map((item) => plainText(item.sub)), [
    '1.3 visits per student',
    '6 of 6 registered in SimuFlow',
    'of 2 planned so far · 1 with no activity recorded',
    '1.0 h in use · 0.4% booked',
    'typical visit 1 h 15 min',
  ]);
  // Jan–Sep 2026 have begun; the June bucket holds the week of 15 Jun.
  assert.deepEqual(kpi(overview, 'studentVisits').spark, [0, 0, 0, 0, 0, 7, 0, 0, 1]);
  assert.deepEqual(overview.counted, { clipped: true, fromLabel: '15 Jun 2026' });

  const quiet = resolvePeriod('custom', NOW, { ...ALL_DAYS, custom: { from: '2026-07-06', to: '2026-07-12' } });
  assert.deepEqual(computeOverview(ds, ref, quiet, null).kpis.map((item) => plainText(item.sub)), [
    'No student visits in this period',
    '0 of 6 registered in SimuFlow',
    'No classes planned in this period',
    '0 h in use · 0% booked',
    'No student visits in this period',
  ]);
});

test('data notes: only what happened in the period, singular and plural', () => {
  const overview = computeOverview(ds, ref, thisYear, null);
  assert.deepEqual(overview.dataNotes.map(plainText), [
    '1 visit had no tap-out; it is counted with the typical visit length of 2 h.',
    '1 visit by deleted accounts is not included.',
    '1 accidental tap under 1 minute was ignored; 1 double tap was merged.',
  ]);
  assert.deepEqual(overview.dataNotes, computeVisitors(ds, ref, thisYear).dataNotes, 'Students page reads the same notes');
  assert.deepEqual(computeVisitors(ds, ref, twoDays).dataNotes.map(plainText), [
    '1 accidental tap under 1 minute was ignored.',
  ]);

  // Plural forms, and visits longer than 8 h.
  const busy = buildDataset(
    makeRaw({
      centerSessions: [
        centerSession('s1', '2026-06-15 08:00', '2026-06-15T17:00:00.041Z', 'n1'),
        centerSession('s2', '2026-06-15 08:30', '2026-06-15T17:00:00.041Z', 'n2'),
        centerSession('s3', '2026-06-15 08:00', '2026-06-15 17:30', 'n3'), // tapped out after 9.5 h
        centerSession('ghost-1', '2026-06-15 09:00', '2026-06-15 10:00', 'n4'),
        centerSession('ghost-2', '2026-06-15 09:00', '2026-06-15 10:00', 'n5'),
      ],
    }),
    ref,
    NOW,
    ALL_DAYS
  );
  assert.deepEqual(computeVisitors(busy, ref, june).dataNotes.map(plainText), [
    '2 visits had no tap-out; they are counted with the typical visit length of 2 h.',
    '1 visit lasted longer than 8 h; it is counted as 8 h.',
    '2 visits by deleted accounts are not included.',
  ]);
});

test('an empty period can point to the busiest month of the whole history', () => {
  const quiet = resolvePeriod('custom', NOW, { ...ALL_DAYS, custom: { from: '2026-07-06', to: '2026-07-12' } });
  assert.deepEqual(computeOverview(ds, ref, quiet, null).peakMonth, { key: '2026-06', label: 'June 2026', visits: 9 });
  const nothing = buildDataset(makeRaw(), ref, NOW, ALL_DAYS);
  assert.equal(computeOverview(nothing, ref, thisYear, null).peakMonth, null);
});

test('highlights of the small scenario: slots without an eligible candidate are dropped', () => {
  const { insights } = computeOverview(ds, ref, thisYear, null);
  assert.deepEqual(insights.map((item) => [item.id, item.slot, item.tone, item.to]), [
    ['busiestDay', 'B', 'neutral', '/admin/students'],
    ['guestEvents', 'C', 'neutral', '/admin/classes'],
    ['bookedUnused', 'D', 'attention', '/admin/simulators'],
  ]);
  assert.deepEqual(insights.map(sentence), [
    'Busiest day: Mon 15 Jun with 4 visits.',
    '1 guest event took place, 6.0 h in total.',
    'Simulator 3 was booked for 8.0 h; NFC shows 30 min of use.',
  ]);
  assert.deepEqual(insights.map(boldText), [['Mon 15 Jun'], ['1 guest event'], ['Simulator 3']]);

  const quiet = resolvePeriod('custom', NOW, { ...ALL_DAYS, custom: { from: '2026-07-06', to: '2026-07-12' } });
  assert.deepEqual(computeOverview(ds, ref, quiet, null).insights, []);
});

// A busier fortnight (Mon 1 – Fri 12 Jun 2026) for the highlight rules.
const bigRef = makeRef({
  students: [
    ...['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id: `y3-${id}`, course: '3', faculty: 'Medicine', groupKey: '5' })),
    ...['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id: `y1-${id}`, course: '1', faculty: 'Medicine', groupKey: '1' })),
  ],
});
const WEEKDAYS_1 = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'];
const WEEKDAYS_2 = ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12'];
const visitsOn = (date, userIds) =>
  userIds.map((userId) => centerSession(userId, `${date} 09:00`, `${date} 11:00`, `cs-${date}-${userId}`));
const overviewOf = (raw, period = 'thisYear') => {
  const dataset = buildDataset(makeRaw(raw), bigRef, NOW, ALL_DAYS);
  const resolved = typeof period === 'string'
    ? resolvePeriod(period, NOW, { ...ALL_DAYS, firstActivityMs: dataset.firstActivityMs })
    : period;
  return computeOverview(dataset, bigRef, resolved, null);
};
const find = (overview, slot) => overview.insights.find((item) => item.slot === slot) || null;

test('highlights A (people): top year, then reach; a tie skips the candidate', () => {
  // 30 visits by year 3, 10 by year 1.
  const lopsided = overviewOf({
    centerSessions: [...WEEKDAYS_1, ...WEEKDAYS_2].flatMap((date) => visitsOn(date, ['y3-a', 'y3-b', 'y3-c', 'y1-a'])),
  });
  assert.equal(sentence(find(lopsided, 'A')), 'Year 3 students make up 75% of student visits (30 of 40).');
  assert.deepEqual(boldText(find(lopsided, 'A')), ['Year 3 students', '75%']);

  // 20 : 20 → no single top year → reach (12 registered: counts, no %).
  const tied = overviewOf({
    centerSessions: [...WEEKDAYS_1, ...WEEKDAYS_2].flatMap((date) => visitsOn(date, ['y3-a', 'y3-b', 'y1-a', 'y1-b'])),
  });
  assert.equal(find(tied, 'A').id, 'reach');
  assert.equal(sentence(find(tied, 'A')), '4 of 12 students registered in SimuFlow visited the center.');
});

test('highlights B (rhythm): concentration, busiest weekday, busiest day', () => {
  // Week of 1 Jun: 30 visits; week of 8 Jun: 10 → 75 % in one week of a long period.
  const concentrated = overviewOf({
    centerSessions: [
      ...WEEKDAYS_1.flatMap((date) => visitsOn(date, ['y3-a', 'y3-b', 'y3-c', 'y3-d', 'y1-a', 'y1-b'])),
      ...WEEKDAYS_2.flatMap((date) => visitsOn(date, ['y3-a', 'y1-a'])),
    ],
  });
  const b1 = find(concentrated, 'B');
  assert.deepEqual([b1.id, b1.tone], ['concentrated', 'attention']);
  assert.equal(sentence(b1), 'Activity is concentrated: 30 of 40 visits took place in the week of 1 Jun.');

  // Even weeks, but Wednesdays are busier: 6 + 6 of 28 visits (others 4 per day).
  const everyone = ['y3-a', 'y3-b', 'y3-c', 'y1-a', 'y1-b', 'y1-c'];
  const wednesdays = overviewOf({
    centerSessions: [...WEEKDAYS_1, ...WEEKDAYS_2].flatMap((date) =>
      visitsOn(date, ['2026-06-03', '2026-06-10'].includes(date) ? everyone : ['y3-a', 'y1-a'])
    ),
  });
  const b2 = find(wednesdays, 'B');
  assert.equal(b2.id, 'busiestWeekday');
  assert.equal(sentence(b2), 'Busiest day of the week: Wednesday (12 of 28 visits).');

  // A 30-day period (too short for "concentrated"), flat weekdays, one single busiest day.
  const peak = overviewOf(
    {
      centerSessions: [
        ...[...WEEKDAYS_1, ...WEEKDAYS_2].flatMap((date) => visitsOn(date, ['y3-a', 'y3-b', 'y1-a', 'y1-b'])),
        ...visitsOn('2026-06-02', ['y3-c']),
      ],
    },
    june
  );
  const b3 = find(peak, 'B');
  assert.equal(b3.id, 'busiestDay');
  assert.equal(sentence(b3), 'Busiest day: Tue 2 Jun with 5 visits.');

  // Everything even → nothing to say in this slot.
  const flat = overviewOf({
    centerSessions: [...WEEKDAYS_1, ...WEEKDAYS_2].flatMap((date) => visitsOn(date, ['y3-a', 'y1-a'])),
  });
  assert.equal(find(flat, 'B'), null);
});

test('highlights C (teaching) and D (equipment, rooms)', () => {
  const teacherVisits = ['2026-06-01', '2026-06-02', '2026-06-03'].map((date) =>
    centerSession('t1', `${date} 09:50`, `${date} 12:05`, `cs-t1-${date}`)
  );
  const fourClasses = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04'].map((date) =>
    schedule({ id: `cl-${date}`, session_date: date, simulators: [], rooms: ['A2-06'] })
  );
  const teaching = overviewOf({ centerSessions: teacherVisits, schedules: fourClasses });
  const c1 = find(teaching, 'C');
  assert.deepEqual([c1.id, c1.tone, c1.to], ['classesHeld', 'attention', '/admin/classes']);
  assert.equal(sentence(c1), '3 of 4 planned classes show activity on site; 1 has no activity recorded.');
  assert.deepEqual(boldText(c1), ['3 of 4']);
  // No simulator data at all, 4 room bookings in one of three rooms.
  const d3 = find(teaching, 'D');
  assert.deepEqual([d3.id, d3.to], ['unusedRooms', '/admin/rooms']);
  assert.equal(sentence(d3), '2 of 3 rooms had no bookings in this period.');

  const allHeld = overviewOf({
    centerSessions: teacherVisits,
    schedules: [...fourClasses.slice(0, 3), schedule({ id: 'cl-next', session_date: '2026-09-22', simulators: [] })],
  });
  assert.equal(find(allHeld, 'C').tone, 'neutral');
  assert.equal(sentence(find(allHeld, 'C')), '3 of 3 classes planned so far show activity on site.');

  const sessions = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00'].map((time, index) =>
    simSession('sim-2', 'y3-a', `2026-06-02 ${time}`, `2026-06-02 ${time.slice(0, 2)}:30`, `ss-${index}`)
  );
  const used = overviewOf({ simSessions: sessions });
  const d2 = find(used, 'D');
  assert.equal(d2.id, 'topSimulator');
  assert.equal(sentence(d2), 'Most used simulator: No. 2 · SimMan 3G, 3.0 h over 6 sessions.');
  assert.deepEqual(boldText(d2), ['No. 2 · SimMan 3G']);

  // Simulator 4: booked 6 h, never used → the booked-but-idle sentence wins over "most used".
  const idle = overviewOf({
    simSessions: sessions,
    events: [eventCode({ id: 'ev-idle', starts: '2026-06-03 09:00', ends: '2026-06-03 15:00', allowed_simulators: ['4'] })],
  });
  assert.deepEqual([find(idle, 'D').id, find(idle, 'D').tone], ['bookedUnused', 'attention']);
  assert.equal(sentence(find(idle, 'D')), 'Simulator 4 was booked for 6.0 h; NFC shows no use.');
  assert.equal(sentence(find(idle, 'C')), '1 guest event took place, 6.0 h in total.');
});

test('highlights never count future bookings', () => {
  const planned = overviewOf({
    schedules: ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'].map((date) =>
      schedule({ id: `cl-${date}`, session_date: date, simulators: ['4'], rooms: ['A2-06'] })
    ),
    events: [eventCode({ id: 'ev-next', starts: '2026-09-25 09:00', ends: '2026-09-25 15:00', allowed_simulators: ['4'] })],
  });
  assert.deepEqual(planned.insights, []);
  assert.equal(planned.roomsLine.bookings, 0);
});

// ---------------------------------------------------------------------------
// Right now
// ---------------------------------------------------------------------------

// One resource_availability row of today (16 Sep 2026), times on the Vilnius wall clock.
const busyRow = (type, key, from, until, source, sourceId) => ({
  resource_type: type,
  resource_key: key,
  busy_from: localIso(`2026-09-16 ${from}`),
  busy_until: localIso(`2026-09-16 ${until}`),
  source,
  source_id: sourceId,
});

test('computeLive: inside now, in use vs booked, free rooms, today', () => {
  const liveDs = buildDataset(
    makeRaw({
      schedules: [
        schedule({ id: 'today-a', session_date: '2026-09-16' }), // 10:00–12:00, year 3
        schedule({ id: 'today-b', session_date: '2026-09-16', start_time: '13:00:00', end_time: '14:00:00', course: '5' }),
      ],
      events: [eventCode({ id: 'today-ev', starts: '2026-09-16 09:00', ends: '2026-09-16 15:00' })],
    }),
    ref,
    NOW
  );
  const rawLive = {
    nowMs: NOW,
    centerSessionsToday: [
      centerSession('s1', '2026-09-16 09:00', null, 'l1'),
      centerSession('s1', '2026-09-16 09:01', null, 'l1-double'),
      centerSession('s2', '2026-09-16 08:30', '2026-09-16 09:30', 'l2'), // left already
      centerSession('s3', '2026-09-16 01:00', null, 'l3'), // open for 9.5 h → a forgotten tap-out
      centerSession('t1', '2026-09-16 09:45', null, 'l4'),
      centerSession('ghost', '2026-09-16 10:00', null, 'l5'), // not one of this university's people
    ],
    openSimSessions: [
      { id: 'o1', simulator_id: 'sim-2', user_id: 's1', start_time: localIso('2026-09-16 10:05') },
      { id: 'o2', simulator_id: 'sim-3', user_id: 's2', start_time: localIso('2026-09-16 05:00') }, // 5.5 h → stale
      { id: 'o3', simulator_id: 'sim-other', user_id: 's2', start_time: localIso('2026-09-16 10:00') },
    ],
    busyNow: [
      busyRow('simulator', '2', '10:00', '12:00', 'class', 'today-a'),
      busyRow('simulator', '4', '09:00', '15:00', 'event', 'today-ev'),
      busyRow('simulator', '9', '09:00', '15:00', 'event', 'today-ev'), // no such simulator
      busyRow('room', 'A2-06', '10:00', '12:00', 'class', 'today-a'),
      busyRow('room', 'A2-06', '09:00', '15:00', 'event', 'today-ev'),
      busyRow('room', 'Debriefing', '10:00', '12:00', 'class', 'today-a'), // unlisted room
    ],
  };

  const live = computeLive(rawLive, ref, NOW, liveDs);
  assert.equal(live.updatedAt, NOW);
  assert.deepEqual(live.inCenter, { total: 2, byRole: { student: 1, teacher: 1, resident: 0, guest: 0 } });

  assert.deepEqual([live.simulators.total, live.simulators.inUse, live.simulators.bookedNow], [4, 1, 2]);
  assert.deepEqual(
    live.simulators.items.map((item) => [item.number, item.state, item.sinceMs, item.bookedUntilMs]),
    [
      ['X1', 'free', null, null],
      ['2', 'in_use_booked', localMs('2026-09-16 10:05'), localMs('2026-09-16 12:00')],
      ['3', 'free', null, null],
      ['4', 'booked', null, localMs('2026-09-16 15:00')],
    ]
  );
  assert.deepEqual(live.rooms, {
    total: 3,
    bookedNow: 1,
    freeNow: 2,
    busy: [{ name: 'A2-06', untilMs: localMs('2026-09-16 15:00'), kind: 'event' }],
  });
  assert.deepEqual(live.today, {
    classes: 2,
    events: 1,
    now: { label: '1 class and 1 event', untilMin: 900 },
    next: { label: 'Year 5 class', startMin: 780 },
  });

  const later = localMs('2026-09-16 12:30');
  assert.deepEqual(computeLive({ ...rawLive, nowMs: later }, ref, later, liveDs).today.now, {
    label: 'Airway workshop',
    untilMin: 900,
  });
  const evening = localMs('2026-09-16 18:00');
  const closed = computeLive({ nowMs: evening, centerSessionsToday: [], openSimSessions: [], busyNow: [] }, ref, evening, null);
  assert.deepEqual(closed.today, { classes: 0, events: 0, now: null, next: null });
  assert.deepEqual([closed.inCenter.total, closed.simulators.inUse, closed.rooms.freeNow], [0, 0, 3]);
});

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

test('definitions: every hint has a short text; templates fill or fall back', () => {
  ['studentVisits', 'uniqueStudents', 'classesHeld', 'utilisation', 'trainingHours', 'liveNow'].forEach((key) => {
    assert.ok(DEFINITIONS[key], key);
  });
  Object.entries(DEFINITIONS).forEach(([key, definition]) => {
    assert.ok(typeof definition.short === 'string' && definition.short.length > 0, key);
    if (definition.long !== undefined) assert.ok(typeof definition.long === 'string' && definition.long.length > 0, key);
  });
  assert.equal(
    fillHint('roomOccupancy', { outsideHours: '6 h' }),
    'Overlapping bookings of one room are merged; hours outside Mon–Fri 08–20 are not counted (6 h in this period).'
  );
  assert.equal(fillHint('roomOccupancy'), DEFINITIONS.roomOccupancy.short);
  assert.equal(fillHint('reach'), DEFINITIONS.reach.short);
  assert.equal(fillHint('missing'), '');
});
