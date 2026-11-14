import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanVisits, computeBaseline, isCronClose } from '../clean/visits.js';
import { cleanSimSessions } from '../clean/simSessions.js';
import { makeRef, centerSession, simSession, utcMs } from './fixtures.mjs';

const NOW = utcMs('2026-06-16T09:00:00Z'); // 12:00 in Vilnius

const PINNED_ROWS = [
  // u1: forgot to tap out (cron) + a second entrance tap a minute later that was closed normally
  { id: 'a1', user_id: 'u1', entry_time: '2026-06-15T07:00:00Z', exit_time: '2026-06-15T17:00:00.041Z' },
  { id: 'a2', user_id: 'u1', entry_time: '2026-06-15T07:01:00Z', exit_time: '2026-06-15T09:30:00Z' },
  { id: 'b1', user_id: 'u2', entry_time: '2026-06-15T06:00:00Z', exit_time: '2026-06-15T17:00:00Z' },
  { id: 'c1', user_id: 'u3', entry_time: '2026-06-15T16:30:00Z', exit_time: '2026-06-15T17:00:00Z' },
  { id: 'd1', user_id: 'u4', entry_time: '2026-06-15T07:00:00Z', exit_time: '2026-06-15T07:00:40Z' },
  { id: 'e1', user_id: 'u5', entry_time: '2026-06-15T05:00:00Z', exit_time: '2026-06-15T14:30:00Z' },
  { id: 'f1', user_id: 'u6', entry_time: '2026-06-15T07:00:00Z', exit_time: '2026-06-15T17:00:00Z' },
  { id: 'f2', user_id: 'u6', entry_time: '2026-06-15T11:00:00Z', exit_time: '2026-06-15T13:00:00Z' },
  { id: 'g1', user_id: 'u7', entry_time: '2026-06-16T08:15:00Z', exit_time: null },
  { id: 'h1', user_id: 'u8', entry_time: '2026-06-15T13:00:00Z', exit_time: null },
];

const visitsOf = (visits, userId) => visits.filter((v) => v.userId === userId);

test('TZ is Europe/Vilnius (the suite depends on it)', () => {
  assert.equal(new Date('2026-06-15T12:00:00Z').getHours(), 15);
  assert.equal(new Date('2026-01-15T12:00:00Z').getHours(), 14);
});

test('cleanVisits: pinned scenarios (median 120)', () => {
  const { visits, stats, shortTapMs } = cleanVisits(PINNED_ROWS, { nowMs: NOW, medianMin: 120 });

  assert.equal(visits.length, 8);
  assert.deepEqual(stats, { raw: 10, invalid: 0, short: 1, merged: 1, imputed: 4, capped: 1, open: 1 });
  assert.deepEqual(shortTapMs, [utcMs('2026-06-15T07:00:00Z')], 'when the ignored tap happened');

  const [u1] = visitsOf(visits, 'u1');
  assert.equal(visitsOf(visits, 'u1').length, 1, 'double tap becomes ONE visit');
  assert.equal(u1.durationMin, 150);
  assert.equal(u1.closeKind, 'tap');
  assert.equal(u1.rawCount, 2);
  assert.equal(u1.imputed, false);
  assert.equal(u1.id, 'a1');
  assert.equal(u1.endMs, utcMs('2026-06-15T09:30:00Z'));

  const [u2] = visitsOf(visits, 'u2');
  assert.deepEqual([u2.durationMin, u2.closeKind, u2.imputed], [120, 'auto', true]);

  const [u3] = visitsOf(visits, 'u3');
  assert.deepEqual([u3.durationMin, u3.closeKind, u3.imputed], [30, 'auto', true], 'never longer than the raw row');

  assert.equal(visitsOf(visits, 'u4').length, 0, '40 s tap is dropped');

  const [u5] = visitsOf(visits, 'u5');
  assert.deepEqual([u5.durationMin, u5.closeKind, u5.capped, u5.imputed], [480, 'tap', true, false]);

  const u6 = visitsOf(visits, 'u6');
  assert.equal(u6.length, 2, 'impute first, merge second: the cron row must not swallow the later visit');
  assert.deepEqual(u6.map((v) => [v.durationMin, v.imputed, v.closeKind]), [[120, true, 'auto'], [120, false, 'tap']]);

  const [u7] = visitsOf(visits, 'u7');
  assert.deepEqual([u7.durationMin, u7.closeKind, u7.imputed], [45, 'open', false]);
  assert.equal(u7.endMs, NOW);

  const [u8] = visitsOf(visits, 'u8');
  assert.deepEqual([u8.durationMin, u8.closeKind, u8.imputed], [120, 'auto', true], 'open for 20 h = forgotten');
});

test('cleanVisits: shape, order, day and month keys, roles', () => {
  const roleByUserId = new Map([['u2', 'student'], ['u5', 'teacher']]);
  const { visits } = cleanVisits(PINNED_ROWS, { nowMs: NOW, medianMin: 120, roleByUserId });

  assert.deepEqual(Object.keys(visits[0]).sort(), [
    'capped', 'closeKind', 'dayKey', 'durationMin', 'endMs', 'entryMs', 'id', 'imputed', 'monthKey', 'rawCount',
    'role', 'userId',
  ]);
  const order = visits.map((v) => v.entryMs);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'sorted by entry');
  assert.equal(visitsOf(visits, 'u2')[0].role, 'student');
  assert.equal(visitsOf(visits, 'u5')[0].role, 'teacher');
  assert.equal(visitsOf(visits, 'u1')[0].role, null);

  // 2026-06-15T21:30Z is already 16 June in Vilnius
  const late = cleanVisits(
    [{ id: 'x', user_id: 'u', entry_time: '2026-06-15T21:30:00Z', exit_time: '2026-06-15T22:30:00Z' }],
    { nowMs: NOW, medianMin: 120 }
  ).visits[0];
  assert.equal(late.dayKey, '2026-06-16');
  assert.equal(late.monthKey, '2026-06');
});

test('cleanVisits: invalid rows are counted, not thrown', () => {
  const rows = [
    { id: '1', user_id: 'u1', entry_time: 'not a date', exit_time: null },
    { id: '2', user_id: 'u1', entry_time: '2026-06-15T09:00:00Z', exit_time: '2026-06-15T08:00:00Z' },
    { id: '3', user_id: null, entry_time: '2026-06-15T09:00:00Z', exit_time: '2026-06-15T10:00:00Z' },
    { id: '4', user_id: 'u1', entry_time: '2026-06-15T09:00:00Z', exit_time: '2026-06-15T10:00:00Z' },
  ];
  const { visits, stats } = cleanVisits(rows, { nowMs: NOW, medianMin: 120 });
  assert.equal(visits.length, 1);
  assert.equal(stats.raw, 4);
  assert.equal(stats.invalid, 3);
});

test('cleanVisits: a chain of double taps is one visit and never longer than 8 h', () => {
  const rows = [
    centerSession('u1', '2026-06-15 08:00', '2026-06-15 13:00'),
    centerSession('u1', '2026-06-15 12:59', '2026-06-15 17:30'),
    centerSession('u1', '2026-06-15 17:30', '2026-06-15 18:45'),
  ];
  const { visits, stats } = cleanVisits(rows, { nowMs: NOW, medianMin: 120 });
  assert.equal(visits.length, 1);
  assert.equal(visits[0].rawCount, 3);
  assert.equal(visits[0].durationMin, 480);
  assert.equal(visits[0].capped, true);
  assert.equal(stats.merged, 2);
});

test('isCronClose: the minute after 17:00 and 18:00 UTC', () => {
  assert.equal(isCronClose(Date.parse('2026-06-15T17:00:00.123456+00:00')), true);
  assert.equal(isCronClose(Date.parse('2026-06-15T18:00:00Z')), true);
  assert.equal(isCronClose(Date.parse('2026-06-15T17:01:00Z')), false);
  assert.equal(isCronClose(Date.parse('2026-06-15T16:59:59Z')), false);
  assert.equal(isCronClose(Date.parse('2026-06-15T20:00:00+03:00')), true, '20:00 Vilnius in summer');
  assert.equal(isCronClose('2026-01-15T18:00:30+00:00'), true, 'ISO strings are accepted too');
  assert.equal(isCronClose(NaN), false);
});

test('computeBaseline: median of normally closed rows, fallback below the sample size', () => {
  const day = (n) => String(n).padStart(2, '0');
  const rows = [];
  for (let i = 1; i <= 21; i += 1) {
    // 100, 102, … 140 minutes → median 120
    const minutes = 98 + i * 2;
    const entry = Date.parse(`2026-05-${day(i)}T07:00:00Z`);
    rows.push({ entry_time: new Date(entry).toISOString(), exit_time: new Date(entry + minutes * 60000).toISOString() });
  }
  // ignored: cron-closed, under a minute, over 8 h, still open
  rows.push({ entry_time: '2026-05-01T07:00:00Z', exit_time: '2026-05-01T17:00:00Z' });
  rows.push({ entry_time: '2026-05-01T07:00:00Z', exit_time: '2026-05-01T07:00:20Z' });
  rows.push({ entry_time: '2026-05-01T05:00:00Z', exit_time: '2026-05-01T14:30:00Z' });
  rows.push({ entry_time: '2026-05-01T07:00:00Z', exit_time: null });

  const options = { getStart: (r) => r.entry_time, getEnd: (r) => r.exit_time, minMin: 1, maxMin: 480, fallbackMin: 120 };
  assert.deepEqual(computeBaseline(rows, options), { medianMin: 120, sampleSize: 21, source: 'sample' });
  assert.deepEqual(
    computeBaseline(rows.slice(0, 5), { ...options, fallbackMin: 99 }),
    { medianMin: 99, sampleSize: 5, source: 'fallback' }
  );
  assert.deepEqual(
    computeBaseline(rows.slice(0, 5), { ...options, minSample: 5 }),
    { medianMin: 104, sampleSize: 5, source: 'sample' }
  );
});

test('cleanSimSessions: same rules, no user merge, overlap is cut at the next start', () => {
  const ref = makeRef();
  const now = utcMs('2026-06-16T09:00:00Z');
  const rows = [
    simSession('sim-2', 's1', '2026-06-15 10:00', '2026-06-15 10:20', 'a'),
    // overlaps the next session on the same simulator → cut at 10:40
    simSession('sim-2', 's2', '2026-06-15 10:30', '2026-06-15 11:00', 'b'),
    simSession('sim-2', 's1', '2026-06-15 10:40', '2026-06-15 11:10', 'c'),
    // closed by the 20:00 job → typical length
    simSession('sim-3', 's3', '2026-06-15 16:00', '2026-06-15T17:00:00Z', 'd'),
    // never ended, a day old → forgotten, typical length
    simSession('sim-3', 's3', '2026-06-15 12:00', null, 'e'),
    // accidental tap
    simSession('sim-4', 's1', '2026-06-15 09:00', '2026-06-15 09:00', 'f'),
    // another university's simulator
    simSession('sim-elsewhere', 's1', '2026-06-15 09:00', '2026-06-15 09:30', 'g'),
    // running right now (started 25 min before "now")
    simSession('sim-4', 's4', '2026-06-16 11:35', null, 'h'),
  ];
  const { sessions, stats } = cleanSimSessions(rows, {
    nowMs: now,
    simulatorById: ref.simulatorById,
    medianMin: 20,
    roleByUserId: ref.roleByUserId,
  });
  const byId = Object.fromEntries(sessions.map((s) => [s.id, s]));

  assert.deepEqual(Object.keys(byId).sort(), ['a', 'b', 'c', 'd', 'e', 'h']);
  assert.equal(byId.a.durationMin, 20);
  assert.equal(byId.b.durationMin, 10, 'cut where the next session starts');
  assert.equal(byId.c.durationMin, 30);
  assert.deepEqual([byId.d.durationMin, byId.d.imputed], [20, true]);
  assert.deepEqual([byId.e.durationMin, byId.e.imputed, byId.e.open], [20, true, false], 'open for a day = forgotten');
  assert.deepEqual([byId.h.durationMin, byId.h.open], [25, true]);
  assert.deepEqual([byId.a.simNumber, byId.a.simulatorId, byId.a.role, byId.a.dayKey], ['2', 'sim-2', 'student', '2026-06-15']);
  assert.deepEqual(byId.a.segments, [{ date: '2026-06-15', startMin: 600, endMin: 620 }]);
  assert.deepEqual(stats, { raw: 8, invalid: 0, outOfScope: 1, short: 1, cut: 1, imputed: 2, capped: 0, open: 1 });
});
