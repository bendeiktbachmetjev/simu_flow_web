import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClasses, buildEvents } from '../clean/bookings.js';
import { inferClassStatus, inferEventStatus } from '../clean/classStatus.js';
import { cleanVisits } from '../clean/visits.js';
import { cleanSimSessions } from '../clean/simSessions.js';
import { buildDataset } from '../buildDataset.js';
import {
  makeRef, makeRaw, centerSession, simSession, schedule, eventCode, guestReg, localMs, ALL_DAYS,
} from './fixtures.mjs';

const ref = makeRef();
const NOW = localMs('2026-06-20 12:00');

// Pinned class: 2026-06-15 10:00–12:00, year 3, group 5, simulators 2 and 3, teacher t1.
const pinnedClass = (fields = {}) => schedule({ id: 'class-1', ...fields });

const infer = ({ schedules = [pinnedClass()], centerSessions = [], simSessions = [], nowMs = NOW }) => {
  const { visits } = cleanVisits(centerSessions, { nowMs, medianMin: 120, roleByUserId: ref.roleByUserId });
  const { sessions } = cleanSimSessions(simSessions, { nowMs, simulatorById: ref.simulatorById, medianMin: 20 });
  return inferClassStatus(buildClasses(schedules, ref), { visits, simSessions: sessions, ref, nowMs });
};

test('buildClasses: wall-clock class → ClassItem', () => {
  const [item] = buildClasses([pinnedClass({ teacher_id: 't2', rooms: ['A2-06'], needs_assistance: true })], ref);
  assert.equal(item.id, 'class-1');
  assert.equal(item.teacherShort, 'J. Kazlauskas');
  assert.deepEqual(item.clinicIds, ['c-pulmo', 'c-surgery']);
  assert.deepEqual(item.clinics, ['Pulmonologijos klinika', 'Abdominalinės chirurgijos klinika']);
  assert.deepEqual([item.date, item.startMin, item.endMin, item.durationMin], ['2026-06-15', 600, 720, 120]);
  assert.equal(item.startMs, localMs('2026-06-15 10:00'));
  assert.equal(item.endMs, localMs('2026-06-15 12:00'));
  assert.deepEqual([item.course, item.groups, item.groupKeys], ['3', ['5'], ['5']]);
  assert.deepEqual([item.simNumbers, item.roomNames, item.needsAssistance], [['2', '3'], ['A2-06'], true]);

  const [orphan] = buildClasses([pinnedClass({ teacher_id: 'gone' })], ref);
  assert.equal(orphan.teacherShort, 'Unknown teacher');
  assert.deepEqual(orphan.clinics, []);

  assert.equal(buildClasses([pinnedClass({ end_time: '09:00:00' })], ref).length, 0, 'reversed times are skipped');
});

test('session on a booked simulator ⇒ held, usedSimNumbers lists it', () => {
  const [item] = infer({ simSessions: [simSession('sim-2', 's4', '2026-06-15 10:30', '2026-06-15 10:50')] });
  assert.equal(item.status, 'held');
  assert.deepEqual(item.usedSimNumbers, ['2']);
  assert.deepEqual(item.evidence, { simulator: true, teacher: false, students: false, studentsOnSite: 0 });
});

test('teacher visit only ⇒ held', () => {
  const [item] = infer({ centerSessions: [centerSession('t1', '2026-06-15 09:45', '2026-06-15 12:10')] });
  assert.equal(item.status, 'held');
  assert.deepEqual(item.evidence, { simulator: false, teacher: true, students: false, studentsOnSite: 0 });
  assert.deepEqual(item.usedSimNumbers, []);
});

test('year-3 / group-5 student on site ⇒ held; group 6 is not evidence', () => {
  const [held] = infer({
    centerSessions: [
      centerSession('s1', '2026-06-15 10:05', '2026-06-15 11:55'),
      centerSession('s2', '2026-06-15 10:10', '2026-06-15 11:00'),
      centerSession('s3', '2026-06-15 10:00', '2026-06-15 12:00'), // group 6
    ],
  });
  assert.equal(held.status, 'held');
  assert.deepEqual(held.evidence, { simulator: false, teacher: false, students: true, studentsOnSite: 2 });

  const [other] = infer({
    centerSessions: [
      centerSession('s3', '2026-06-15 10:00', '2026-06-15 12:00'), // year 3, group 6
      centerSession('s4', '2026-06-15 10:00', '2026-06-15 12:00'), // year 1
      centerSession('t2', '2026-06-15 10:00', '2026-06-15 12:00'), // another teacher
    ],
  });
  assert.equal(other.status, 'no_activity');
  assert.equal(other.evidence.studentsOnSite, 0);
});

test('session only on simulator 4 (not booked) ⇒ no_activity', () => {
  const [item] = infer({ simSessions: [simSession('sim-4', 's1', '2026-06-15 10:30', '2026-06-15 10:50')] });
  assert.equal(item.status, 'no_activity');
  assert.deepEqual(item.usedSimNumbers, []);
});

test('evidence needs at least one shared minute inside the class window', () => {
  const outside = [
    simSession('sim-2', 's1', '2026-06-15 09:00', '2026-06-15 09:40'), // before the class
    centerSession('t1', '2026-06-15 12:00', '2026-06-15 13:00'), // arrives as it ends
  ];
  const [none] = infer({ simSessions: [outside[0]], centerSessions: [outside[1]] });
  assert.equal(none.status, 'no_activity');

  // 11:59:30–12:30 shares 30 seconds with the class → still nothing
  const [halfMinute] = infer({
    simSessions: [simSession('sim-3', 's1', '2026-06-15T11:59:30+03:00', '2026-06-15T12:30:00+03:00')],
  });
  assert.equal(halfMinute.status, 'no_activity');

  // 11:59–12:30 shares exactly one minute → evidence
  const [oneMinute] = infer({
    simSessions: [simSession('sim-3', 's1', '2026-06-15 11:59', '2026-06-15 12:30')],
  });
  assert.equal(oneMinute.status, 'held');
  assert.deepEqual(oneMinute.usedSimNumbers, ['3']);
});

test('class tomorrow ⇒ upcoming', () => {
  const [item] = infer({ schedules: [pinnedClass({ session_date: '2026-06-21' })] });
  assert.equal(item.status, 'upcoming');
});

test('class started 30 minutes ago, nothing recorded yet ⇒ upcoming; with evidence ⇒ held', () => {
  const nowMs = localMs('2026-06-15 10:30');
  const [waiting] = infer({ nowMs });
  assert.equal(waiting.status, 'upcoming');

  const [running] = infer({ nowMs, centerSessions: [centerSession('t1', '2026-06-15 09:50', null)] });
  assert.equal(running.status, 'held');
});

test('08:00 visit closed by the cron job is imputed to 10:00, so a 15:00–17:00 class ⇒ no_activity', () => {
  const [item] = infer({
    schedules: [pinnedClass({ start_time: '15:00:00', end_time: '17:00:00' })],
    // raw row spans 08:00–20:00 and would overlap the class; the effective visit does not
    centerSessions: [
      centerSession('s1', '2026-06-15 08:00', '2026-06-15T17:00:00.250Z'),
      centerSession('t1', '2026-06-15 08:00', '2026-06-15T17:00:00.250Z'),
    ],
  });
  assert.equal(item.status, 'no_activity');
  assert.deepEqual(item.evidence, { simulator: false, teacher: false, students: false, studentsOnSite: 0 });
});

test('guest events: simulator session or an app guest of THIS event ⇒ held', () => {
  const events = [
    eventCode({ id: 'e1', starts: '2026-06-16 09:00', ends: '2026-06-16 15:00', allowed_simulators: ['X1'], rooms: ['A2-06'] }),
    eventCode({ id: 'e2', starts: '2026-06-17 09:00', ends: '2026-06-17 15:00', allowed_simulators: ['X1'] }),
    eventCode({ id: 'e3', starts: '2026-06-18 09:00', ends: '2026-06-18 15:00', allowed_simulators: ['X1'] }),
    eventCode({ id: 'e4', starts: '2026-06-25 09:00', ends: '2026-06-25 15:00', event_name: '  ' }),
  ];
  const { visits } = cleanVisits(
    [
      centerSession('g1', '2026-06-16 09:30', '2026-06-16 11:00'), // g1 registered with e1's code
      centerSession('g1', '2026-06-18 09:30', '2026-06-18 11:00'), // …so this is no evidence for e3
    ],
    { nowMs: NOW, medianMin: 120, roleByUserId: ref.roleByUserId }
  );
  const { sessions } = cleanSimSessions(
    [simSession('sim-x1', 's1', '2026-06-17 10:00', '2026-06-17 10:30')],
    { nowMs: NOW, simulatorById: ref.simulatorById, medianMin: 20 }
  );
  const items = inferEventStatus(buildEvents(events, ref), { visits, simSessions: sessions, ref, nowMs: NOW });
  const byId = Object.fromEntries(items.map((e) => [e.id, e]));

  assert.deepEqual(items.map((e) => e.status), ['held', 'held', 'past', 'upcoming']);
  assert.equal(byId.e1.evidence.guests, true);
  assert.equal(byId.e1.appGuests, 1);
  assert.deepEqual(byId.e2.usedSimNumbers, ['X1']);
  assert.equal(byId.e2.appGuests, 0);
  assert.equal(byId.e4.title, 'Untitled event');
  assert.equal(byId.e1.title, 'Airway workshop');
  assert.equal(byId.e1.durationMin, 360);
  assert.deepEqual(byId.e1.segments, [{ date: '2026-06-16', startMin: 540, endMin: 900 }]);
});

test('buildDataset: exact Dataset shape, scoping and baselines', () => {
  const raw = makeRaw({
    centerSessions: [
      centerSession('s1', '2026-06-15 10:05', '2026-06-15 11:55'),
      centerSession('t1', '2026-06-15 09:45', '2026-06-15 12:10'),
      centerSession('deleted-user', '2026-06-15 10:00', '2026-06-15 11:00'),
      centerSession('deleted-user', '2026-06-15 10:01', '2026-06-15 11:30'), // double tap → 1 visit
      centerSession('deleted-user-2', '2026-03-02 10:00', '2026-03-02 10:00'), // accidental tap
      centerSession('s2', '2026-06-14 09:00', '2026-06-14 09:00'), // accidental tap of a known student
    ],
    simSessions: [
      simSession('sim-2', 's1', '2026-06-15 10:30', '2026-06-15 10:50'),
      simSession('sim-elsewhere', 's1', '2026-06-15 10:30', '2026-06-15 10:50'),
    ],
    schedules: [
      pinnedClass({ simulators: ['2', '1'], rooms: ['Debriefing', 'A2-06'] }),
      schedule({ id: 'class-2', session_date: '2026-07-01' }),
    ],
    events: [
      eventCode({ id: 'e1', starts: '2026-09-15 09:00', ends: '2026-09-15 15:00', allowed_simulators: ['X1', '7'], rooms: ['C2-04'] }),
    ],
    guests: [
      guestReg('Lithuania', 'Vilnius University', '2026-06-15 09:00'),
      guestReg('lithuania', 'VU', '2026-06-15 09:05'),
      guestReg('Lithuania', 'Kauno klinikos', '2026-06-16 09:00'),
      guestReg('Poland', 'kauno klinikos', '2026-06-16 09:30'),
      guestReg('Poland', 'Kauno klinikos', '2026-06-16 09:40'),
      guestReg('', null, '2026-06-17 09:00'),
    ],
  });
  const ds = buildDataset(raw, ref, NOW, ALL_DAYS); // June rows: the counted-window floor is off

  assert.deepEqual(Object.keys(ds).sort(), [
    'baselines', 'bookingSegs', 'classes', 'events', 'firstActivityMs', 'guestRegs', 'id', 'lastActivityMs',
    'nowMs', 'quality', 'simSessions', 'statsStart', 'unattributed', 'visits',
  ]);
  assert.equal(ds.nowMs, NOW);
  assert.equal(ds.statsStart, null);
  assert.equal(buildDataset(raw, ref, NOW, ALL_DAYS).id, ds.id + 1, 'ids increase');

  assert.deepEqual(ds.visits.map((v) => [v.userId, v.role]), [['t1', 'teacher'], ['s1', 'student']]);
  assert.equal(ds.unattributed.visits, 1);
  assert.equal(ds.unattributed.people, 1);
  assert.equal(ds.unattributed.items[0].rawCount, 2);
  assert.equal(ds.simSessions.length, 1, 'sessions of foreign simulators are out of scope');

  assert.deepEqual(ds.baselines, { visitMedianMin: 120, visitSample: 2, simMedianMin: 20, simSample: 1 });
  assert.deepEqual(Object.keys(ds.quality).sort(), [
    'beforeStart', 'removedSimRefs', 'shortTapMs', 'simSessions', 'unlistedRoomRefs', 'visits',
  ]);
  assert.deepEqual(ds.quality.beforeStart, { centerSessions: 0, simSessions: 0, schedules: 0, events: 0, guests: 0 });
  assert.deepEqual(ds.quality.visits, { raw: 3, invalid: 0, short: 1, merged: 0, imputed: 0, capped: 0, open: 0 });
  assert.deepEqual(ds.quality.shortTapMs, [localMs('2026-06-14 09:00')], 'only taps of known users');
  assert.equal(ds.quality.simSessions.outOfScope, 1);
  assert.equal(ds.quality.removedSimRefs, 2, 'simulator "1" in the class and "7" in the event');
  assert.equal(ds.quality.unlistedRoomRefs, 1, 'room "Debriefing"');

  assert.deepEqual(ds.classes.map((c) => [c.id, c.status]), [['class-1', 'held'], ['class-2', 'upcoming']]);
  assert.deepEqual(ds.classes[0].evidence, { simulator: true, teacher: true, students: true, studentsOnSite: 1 });
  assert.deepEqual(ds.events.map((e) => [e.id, e.status]), [['e1', 'upcoming']]);

  assert.equal(ds.firstActivityMs, localMs('2026-06-15 09:45'));
  assert.equal(ds.lastActivityMs, localMs('2026-06-15 10:30'), 'a class that has not started is not activity yet');

  assert.deepEqual(
    ds.guestRegs.map((g) => [g.dayKey, g.country, g.affiliation]),
    [
      ['2026-06-15', 'Lithuania', 'Vilnius University'],
      ['2026-06-15', 'Lithuania', 'Vilnius University'],
      ['2026-06-16', 'Lithuania', 'Kauno klinikos'],
      ['2026-06-16', 'Poland', 'Kauno klinikos'],
      ['2026-06-16', 'Poland', 'Kauno klinikos'],
      ['2026-06-17', 'Not specified', 'Not specified'],
    ]
  );
  assert.equal(new Set(ds.guestRegs.slice(2, 5).map((g) => g.affiliationKey)).size, 1);
  assert.deepEqual(Object.keys(ds.guestRegs[0]).sort(), ['affiliation', 'affiliationKey', 'country', 'dayKey', 'id', 'ms']);
});

test('buildDataset: empty input gives an empty, well-formed dataset', () => {
  const ds = buildDataset(makeRaw(), ref, NOW);
  assert.deepEqual(
    [ds.visits, ds.simSessions, ds.classes, ds.events, ds.bookingSegs, ds.guestRegs],
    [[], [], [], [], [], []]
  );
  assert.deepEqual(ds.unattributed, { visits: 0, people: 0, items: [] });
  assert.deepEqual(ds.baselines, { visitMedianMin: 120, visitSample: 0, simMedianMin: 20, simSample: 0 });
  assert.equal(ds.firstActivityMs, null);
  assert.equal(ds.lastActivityMs, null);
  assert.equal(ds.statsStart, '2026-09-01', 'the counted window is on by default');
});
