import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRESET, PRESETS, addDays, availability, bucketIndexer, buildBuckets, canShiftPeriod, dateToMs,
  dayKeyOf, diffDays, eachDay, hourOf, isoWeekdayOf, monthKeyOf, pickGranularity, previousPeriod, resolvePeriod,
  shiftPeriod, toMs,
} from '../period.js';
import { ALL_DAYS, localMs } from './fixtures.mjs';

// These tests pin the calendar arithmetic, mostly on dates before STATS_START_DATE, so the
// counted-window floor is off; statsStart.test.mjs covers the floor.
const resolve = (preset, nowMs, options = {}) => resolvePeriod(preset, nowMs, { ...ALL_DAYS, ...options });
const NOW = localMs('2026-09-20 13:30'); // Sunday
const custom = (from, to, nowMs = NOW) => resolve('custom', nowMs, { custom: { from, to } });
const range = (p) => [p.from, p.to];

test('presets', () => {
  assert.deepEqual(PRESETS.map((p) => p.id), ['thisMonth', 'semester', 'academicYear', 'thisYear', 'allTime', 'custom']);
  assert.deepEqual(PRESETS.map((p) => p.label), ['This month', 'Semester', 'Academic year', 'This year', 'All time', 'Custom']);
  assert.equal(DEFAULT_PRESET, 'thisYear');
});

test('resolvePeriod: this year on 20 Sep 2026', () => {
  const p = resolve('thisYear', NOW);
  assert.deepEqual(
    { ...p },
    {
      preset: 'thisYear', offset: 0, label: '2026', from: '2026-01-01', to: '2027-01-01',
      statsStart: null, startClamped: false, fromMs: localMs('2026-01-01 00:00'), toMs: localMs('2027-01-01 00:00'),
      effTo: '2026-09-21', effToMs: localMs('2026-09-21 00:00'),
      days: 365, effDays: 263, isPartial: true, isFuture: false, granularity: 'month',
      key: '2026-01-01..2027-01-01', today: '2026-09-20',
    }
  );
});

test('resolvePeriod: labels and ranges of every preset', () => {
  const month = resolve('thisMonth', NOW);
  assert.deepEqual([month.label, ...range(month), month.effTo, month.granularity], ['September 2026', '2026-09-01', '2026-10-01', '2026-09-21', 'day']);

  const year = resolve('academicYear', NOW);
  assert.deepEqual([year.label, ...range(year)], ['2026/27', '2026-09-01', '2027-09-01']);
  const yearInSpring = resolve('academicYear', localMs('2026-05-10 09:00'));
  assert.deepEqual([yearInSpring.label, ...range(yearInSpring)], ['2025/26', '2025-09-01', '2026-09-01']);

  const all = resolve('allTime', NOW, { firstActivityMs: localMs('2026-03-01 09:12'), offset: -3 });
  assert.deepEqual([all.label, ...range(all), all.offset, all.effTo], ['All time', '2026-03-01', '2026-09-21', 0, '2026-09-21']);
  assert.deepEqual(range(resolve('allTime', NOW)), ['2026-01-01', '2026-09-21'], 'no activity yet → from 1 Jan');

  const c = custom('2026-07-06', '2026-08-19');
  assert.deepEqual([c.label, ...range(c), c.days, c.isPartial, c.granularity], ['6 Jul – 19 Aug 2026', '2026-07-06', '2026-08-20', 45, false, 'week']);
  assert.equal(custom('2025-12-29', '2026-01-04').label, '29 Dec 2025 – 4 Jan 2026');
  assert.equal(custom('2026-07-06', '2026-07-06').label, '6 Jul 2026');

  const past = resolve('thisYear', NOW, { offset: -1 });
  assert.deepEqual([past.label, past.effTo, past.effDays, past.isPartial], ['2025', '2026-01-01', 365, false]);

  const future = resolve('thisMonth', NOW, { offset: 2 });
  assert.deepEqual([future.label, future.isFuture, future.effDays, future.effTo], ['November 2026', true, 0, '2026-11-01']);
});

test('resolvePeriod: bad input falls back to the default preset', () => {
  assert.equal(resolve('nonsense', NOW).preset, 'thisYear');
  assert.equal(custom('2026-08-19', '2026-07-06').preset, 'thisYear', 'start after end');
  assert.equal(custom('2026-02-30', '2026-03-05').preset, 'thisYear', 'not a real date');
  assert.equal(resolve('custom', NOW).preset, 'thisYear');
});

test('semester: Spring 2026 in July (just ended), Autumn 2026 in September', () => {
  const july = resolve('semester', localMs('2026-07-15 10:00'));
  assert.deepEqual([...range(july), july.label], ['2026-02-01', '2026-07-01', 'Spring 2026 (ended 30 Jun)']);
  assert.equal(july.isPartial, false);

  const september = resolve('semester', NOW);
  assert.deepEqual([...range(september), september.label], ['2026-09-01', '2027-02-01', 'Autumn 2026']);

  const january = resolve('semester', localMs('2027-01-20 10:00'));
  assert.deepEqual([...range(january), january.label], ['2026-09-01', '2027-02-01', 'Autumn 2026']);

  const april = resolve('semester', localMs('2026-04-02 10:00'));
  assert.deepEqual([...range(april), april.label], ['2026-02-01', '2026-07-01', 'Spring 2026']);

  const before = resolve('semester', NOW, { offset: -1 });
  assert.deepEqual([...range(before), before.label], ['2026-02-01', '2026-07-01', 'Spring 2026']);
  const twoBack = resolve('semester', NOW, { offset: -2 });
  assert.deepEqual([...range(twoBack), twoBack.label], ['2025-09-01', '2026-02-01', 'Autumn 2025']);
});

test('previousPeriod: DST week', () => {
  const prev = previousPeriod(custom('2026-03-30', '2026-04-05'));
  assert.deepEqual(range(prev), ['2026-03-23', '2026-03-30']);
  assert.equal(prev.days, 7);
  assert.equal(prev.compareLabel, 'vs previous 7 days');
  assert.equal(prev.toMs - prev.fromMs, 7 * 86400000 - 3600000, 'the week of 29 March is 167 hours long');
});

test('previousPeriod: whole months compare with whole months', () => {
  const march = resolve('thisMonth', NOW, { offset: -6 });
  assert.deepEqual(range(march), ['2026-03-01', '2026-04-01']);
  const prev = previousPeriod(march);
  assert.deepEqual(range(prev), ['2026-02-01', '2026-03-01']);
  assert.equal(prev.compareLabel, 'vs Feb 2026');
  assert.equal(prev.label, 'Feb 2026');
  assert.deepEqual([prev.effTo, prev.isPartial, prev.isFuture, prev.key], ['2026-03-01', false, false, '2026-02-01..2026-03-01']);

  const julToNov = custom('2026-07-01', '2026-11-30', localMs('2027-03-01 09:00'));
  assert.equal(previousPeriod(julToNov).compareLabel, 'vs Feb – Jun 2026');

  const spring = resolve('semester', NOW, { offset: -1 });
  const beforeSpring = previousPeriod(spring);
  assert.deepEqual(range(beforeSpring), ['2025-09-01', '2026-02-01']);
  assert.equal(beforeSpring.compareLabel, 'vs Sep 2025 – Jan 2026');

  assert.equal(previousPeriod(resolve('thisYear', NOW, { offset: -1 })).compareLabel, 'vs 2024');
});

test('previousPeriod: a running period compares its elapsed days', () => {
  const year = previousPeriod(resolve('thisYear', NOW)); // 2026-01-01..2026-09-21 elapsed
  assert.deepEqual(range(year), ['2025-04-13', '2026-01-01']);
  assert.equal(year.days, 263);
  assert.equal(year.compareLabel, 'vs previous 263 days');

  const month = previousPeriod(resolve('thisMonth', NOW)); // 2026-09-01..09-21 elapsed
  assert.deepEqual(range(month), ['2026-08-12', '2026-09-01']);
  assert.equal(month.compareLabel, 'vs previous 20 days');

  // on 31 Aug the elapsed part of the year is exactly Jan–Aug → whole months again
  const endOfAugust = previousPeriod(resolve('thisYear', localMs('2026-08-31 18:00')));
  assert.deepEqual(range(endOfAugust), ['2025-05-01', '2026-01-01']);
  assert.equal(endOfAugust.compareLabel, 'vs May – Dec 2025');
});

test('previousPeriod: none for All time or for a period that has not started', () => {
  assert.equal(previousPeriod(resolve('allTime', NOW, { firstActivityMs: localMs('2026-03-01 09:00') })), null);
  assert.equal(previousPeriod(resolve('thisMonth', NOW, { offset: 1 })), null);
  assert.equal(previousPeriod(null), null);
});

test('shift: Sep 2026 → Aug 2026; never past today or before the first activity', () => {
  const first = localMs('2026-03-01 09:12');
  const september = resolve('thisMonth', NOW);
  assert.deepEqual(canShiftPeriod(september, NOW, { firstActivityMs: first }), { prev: true, next: false });

  const august = shiftPeriod(september, -1, NOW, { firstActivityMs: first });
  assert.deepEqual([august.label, ...range(august), august.offset], ['August 2026', '2026-08-01', '2026-09-01', -1]);
  assert.equal(shiftPeriod(august, 1, NOW, { firstActivityMs: first }).label, 'September 2026');
  assert.equal(shiftPeriod(september, 1, NOW, { firstActivityMs: first }), september, 'cannot step into the future');

  const march = resolve('thisMonth', NOW, { offset: -6 });
  assert.deepEqual(canShiftPeriod(march, NOW, { firstActivityMs: first }), { prev: false, next: true });
  assert.equal(shiftPeriod(march, -1, NOW, { firstActivityMs: first }), march);

  assert.deepEqual(canShiftPeriod(resolve('allTime', NOW), NOW, { firstActivityMs: first }), { prev: false, next: false });
  assert.deepEqual(canShiftPeriod(custom('2026-07-06', '2026-08-19'), NOW, { firstActivityMs: first }), { prev: false, next: false });
  assert.deepEqual(canShiftPeriod(september, NOW, {}), { prev: false, next: false }, 'no data → nowhere to go');
});

test('pickGranularity: 31 → day, 32 → week, 120 → week, 121 → month', () => {
  assert.equal(pickGranularity(1), 'day');
  assert.equal(pickGranularity(31), 'day');
  assert.equal(pickGranularity(32), 'week');
  assert.equal(pickGranularity(120), 'week');
  assert.equal(pickGranularity(121), 'month');
});

test('buildBuckets: months over the nominal year, future slots flagged', () => {
  const buckets = buildBuckets(resolve('thisYear', NOW));
  assert.equal(buckets.length, 12);
  assert.deepEqual(buckets.map((b) => b.label), ['Jan ’26', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
  assert.deepEqual(buckets[8], {
    key: '2026-09', label: 'Sep', longLabel: 'September 2026', from: '2026-09-01', to: '2026-10-01',
    fromMs: localMs('2026-09-01 00:00'), toMs: localMs('2026-10-01 00:00'), isFuture: false, isPartial: true,
  });
  assert.deepEqual(buckets.map((b) => b.isFuture), [...Array(9).fill(false), true, true, true]);
  assert.equal(buckets.filter((b) => b.isPartial).length, 1);

  const academic = buildBuckets(resolve('academicYear', NOW, { offset: -1 }));
  assert.deepEqual(academic.map((b) => b.label), ['Sep ’25', 'Oct', 'Nov', 'Dec', 'Jan ’26', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']);
});

test('buildBuckets: ISO weeks labelled by their Monday and cut at the period edges', () => {
  const period = custom('2026-07-08', '2026-08-19'); // Wed … Wed, 43 days
  const buckets = buildBuckets(period);
  assert.equal(period.granularity, 'week');
  assert.deepEqual(buckets.map((b) => b.label), ['6 Jul', '13 Jul', '20 Jul', '27 Jul', '3 Aug', '10 Aug', '17 Aug']);
  assert.deepEqual([buckets[0].key, buckets[0].from, buckets[0].to], ['2026-07-06', '2026-07-08', '2026-07-13']);
  assert.deepEqual([buckets[6].from, buckets[6].to], ['2026-08-17', '2026-08-20']);
  assert.equal(buckets[0].longLabel, 'Week of 6 Jul 2026');
  assert.equal(buckets[0].from, period.from);
  assert.equal(buckets[buckets.length - 1].to, period.to);
  buckets.slice(1).forEach((b, i) => assert.equal(b.from, buckets[i].to, 'no gaps, no overlaps'));
});

test('buildBuckets: days; today is "in progress"; All time ends in a running month', () => {
  const september = buildBuckets(resolve('thisMonth', NOW));
  assert.equal(september.length, 30);
  assert.deepEqual([september[19].key, september[19].label, september[19].longLabel], ['2026-09-20', '20 Sep', 'Sun 20 Sep 2026']);
  assert.deepEqual([september[18].isPartial, september[19].isPartial, september[20].isFuture], [false, true, true]);

  // the DST month still has one bucket per calendar day
  assert.equal(buildBuckets(resolve('thisMonth', NOW, { offset: 1 })).length, 31);

  const all = buildBuckets(resolve('allTime', NOW, { firstActivityMs: localMs('2026-03-16 10:00') }));
  assert.deepEqual(all.map((b) => b.key), ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  assert.deepEqual([all[0].from, all[6].to, all[6].isPartial], ['2026-03-16', '2026-09-21', true]);
});

test('a hand-made period without `today` still works', () => {
  const finished = { preset: 'custom', from: '2026-06-01', to: '2026-07-01', effTo: '2026-07-01', effDays: 30, granularity: 'week', statsStart: null };
  const buckets = buildBuckets(finished);
  assert.equal(buckets.length, 5);
  assert.equal(buckets.some((b) => b.isPartial || b.isFuture), false);
  assert.deepEqual(range(previousPeriod(finished)), ['2026-05-01', '2026-06-01']);

  const running = { preset: 'custom', from: '2026-09-01', to: '2026-10-01', effTo: '2026-09-21', effDays: 20, granularity: 'day' };
  const days = buildBuckets(running);
  assert.deepEqual([days[19].isPartial, days[20].isFuture], [true, true]);
  assert.equal(buildBuckets(null).length, 0);
});

test('bucketIndexer: ms and date strings, -1 outside', () => {
  const indexOf = bucketIndexer(buildBuckets(resolve('thisYear', NOW)));
  assert.equal(indexOf(localMs('2026-06-15 10:00')), 5);
  assert.equal(indexOf('2026-06-15'), 5);
  assert.equal(indexOf(localMs('2026-01-01 00:00')), 0);
  assert.equal(indexOf(localMs('2026-12-31 23:59')), 11);
  assert.equal(indexOf(localMs('2027-01-01 00:00')), -1);
  assert.equal(indexOf('2025-12-31'), -1);
  assert.equal(indexOf(NaN), -1);
  assert.equal(indexOf(null), -1);
  // the hour that happens twice on 25 Oct still belongs to October
  assert.equal(indexOf(Date.parse('2026-10-25T00:30:00Z')), 9);
  assert.equal(bucketIndexer([])(5), -1);
});

test('day helpers are calendar-based and DST-safe', () => {
  assert.equal(eachDay('2026-10-19', '2026-11-02').length, 14);
  assert.equal(eachDay('2026-03-23', '2026-04-06').length, 14);
  assert.deepEqual(eachDay('2026-02-27', '2026-03-02'), ['2026-02-27', '2026-02-28', '2026-03-01']);
  assert.deepEqual(eachDay('2026-03-02', '2026-03-02'), []);
  assert.equal(addDays('2026-10-25', 1), '2026-10-26');
  assert.equal(addDays('2026-03-29', 1), '2026-03-30');
  assert.equal(addDays('2026-01-01', -263), '2025-04-13');
  assert.equal(diffDays('2026-01-01', '2026-09-21'), 263);
  assert.equal(diffDays('2026-10-19', '2026-11-02'), 14);
  assert.equal(dateToMs('2026-10-26') - dateToMs('2026-10-25'), 25 * 3600000);

  const lateEvening = Date.parse('2026-06-15T21:30:00Z'); // 00:30 on 16 June in Vilnius
  assert.equal(dayKeyOf(lateEvening), '2026-06-16');
  assert.equal(monthKeyOf(Date.parse('2026-06-30T21:30:00Z')), '2026-07');
  assert.equal(hourOf(lateEvening), 0);
  assert.equal(isoWeekdayOf(lateEvening), 2);
  assert.equal(isoWeekdayOf(localMs('2026-09-20 12:00')), 7);

  assert.equal(toMs('2026-06-15T17:00:00.123456+00:00'), Date.parse('2026-06-15T17:00:00.123Z'));
  assert.equal(toMs(1234), 1234);
  assert.ok(Number.isNaN(toMs(null)));
  assert.ok(Number.isNaN(toMs('not a date')));
});

test('availability: Mon–Fri 08–20, elapsed part only', () => {
  const september = { from: '2026-09-01', toExcl: '2026-10-01' };

  const wednesday = availability(september, localMs('2026-09-16 10:30'));
  assert.equal(wednesday.minutesPerResource, 8070); // 11 full days + 150 min of today
  assert.equal(wednesday.workingDays, 12);
  assert.equal(wednesday.perDay.get('2026-09-16'), 150);
  assert.equal(wednesday.perDay.get('2026-09-15'), 720);
  assert.equal(wednesday.perDay.has('2026-09-17'), false);
  assert.deepEqual([wednesday.openMin, wednesday.closeMin], [480, 1200]);

  assert.equal(availability(september, localMs('2026-09-20 13:30')).minutesPerResource, 10080); // Sunday: 14 days
  assert.equal(availability({ from: '2026-03-23', toExcl: '2026-04-06' }, NOW).minutesPerResource, 7200);
  assert.equal(availability({ from: '2026-06-01', toExcl: '2026-07-01' }, NOW).minutesPerResource, 15840);
});

test('availability: before opening, after closing, full horizon, a Period as range', () => {
  const day = { from: '2026-09-16', toExcl: '2026-09-17' };
  assert.equal(availability(day, localMs('2026-09-16 07:15')).minutesPerResource, 0);
  assert.equal(availability(day, localMs('2026-09-16 07:15')).workingDays, 0);
  assert.equal(availability(day, localMs('2026-09-16 22:40')).minutesPerResource, 720);

  const september = { from: '2026-09-01', toExcl: '2026-10-01' };
  const full = availability(september, localMs('2026-09-16 10:30'), { horizon: 'full' });
  assert.equal(full.minutesPerResource, 22 * 720);
  assert.equal(full.workingDays, 22);

  const custom6 = availability(september, NOW, { openHour: 9, closeHour: 17, workdays: [1, 2, 3, 4, 5, 6], horizon: 'full' });
  assert.equal(custom6.minutesPerResource, 26 * 480);

  const period = resolve('thisMonth', NOW);
  assert.equal(availability(period, NOW).minutesPerResource, 10080, '`to` works like `toExcl`');
});
