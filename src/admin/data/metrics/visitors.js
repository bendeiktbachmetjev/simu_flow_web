// Everyone who taps in: visits, unique people and time in the center, by role and over time.
// A visit belongs to the period / bucket that contains its tap-in, and its whole length is
// credited there. Visits by deleted accounts ("unattributed") never enter a total.
import { ROLE_LABELS, ROLE_ORDER, VISIT_MAX_MIN } from '../constants.js';
import { isoWeekdayOf } from '../period.js';
import { fmt } from '../../format.js';
import { WEEKDAY_LONG, WEEKDAY_SHORT, hoursOf, inPeriod, makeSeries, median, pct } from './shared.js';

const plural = (n, one, many) => `${fmt.int(n)} ${n === 1 ? one : many}`;

// Why totals differ from raw tap counts — one sentence per cleaning rule that applied in
// this period, and nothing when it did not. Shown as "Data notes" on Overview and Students.
const buildDataNotes = (quality, typicalVisitMin) => {
  const { imputedVisits, cappedVisits, unattributedVisits, droppedShort, mergedRows } = quality;
  const visits = (n) => plural(n, 'visit', 'visits');
  const notes = [];
  if (imputedVisits > 0) {
    const typical = fmt.duration(typicalVisitMin);
    const counted = imputedVisits === 1 ? 'it is counted' : 'they are counted';
    notes.push(`${visits(imputedVisits)} had no tap-out; ${counted} with the typical visit length of ${typical}.`);
  }
  if (cappedVisits > 0) {
    const limit = fmt.duration(VISIT_MAX_MIN);
    const counted = cappedVisits === 1 ? 'it is counted' : 'they are counted';
    notes.push(`${visits(cappedVisits)} lasted longer than ${limit}; ${counted} as ${limit}.`);
  }
  if (unattributedVisits > 0) {
    const verb = unattributedVisits === 1 ? 'is' : 'are';
    notes.push(`${visits(unattributedVisits)} by deleted accounts ${verb} not included.`);
  }
  const taps = [];
  if (droppedShort > 0) {
    const what = plural(droppedShort, 'accidental tap', 'accidental taps');
    taps.push(`${what} under 1 minute ${droppedShort === 1 ? 'was' : 'were'} ignored`);
  }
  if (mergedRows > 0) {
    taps.push(`${plural(mergedRows, 'double tap', 'double taps')} ${mergedRows === 1 ? 'was' : 'were'} merged`);
  }
  if (taps.length > 0) notes.push(`${taps.join('; ')}.`);
  return notes;
};

export const computeVisitors = (ds, ref, period) => {
  const visits = (ds?.visits || []).filter((visit) => inPeriod(visit.entryMs, period));

  const roleStats = new Map(ROLE_ORDER.map((role) => [role, { visits: 0, minutes: 0, people: new Set() }]));
  const people = new Set();
  const perDay = new Map();
  const perWeekday = new Array(8).fill(0);
  let minutes = 0;
  let imputedVisits = 0;
  let cappedVisits = 0;
  let mergedRows = 0;

  // series.hours is STUDENT time — the "Training hours" of every page — so the chart adds
  // up to the Training hours tile. series.personHours is the time of all roles.
  const { rows: series, indexOf } = makeSeries(period, ['visits', 'studentVisits']);
  const bucketPeople = series.map(() => new Set());
  const bucketMinutes = series.map(() => 0);
  const bucketStudentMinutes = series.map(() => 0);

  visits.forEach((visit) => {
    minutes += visit.durationMin;
    people.add(visit.userId);
    perDay.set(visit.dayKey, (perDay.get(visit.dayKey) || 0) + 1);
    perWeekday[isoWeekdayOf(visit.entryMs)] += 1;
    if (visit.imputed) imputedVisits += 1;
    if (visit.capped) cappedVisits += 1;
    mergedRows += visit.rawCount - 1;

    const role = roleStats.get(visit.role);
    if (role) {
      role.visits += 1;
      role.minutes += visit.durationMin;
      role.people.add(visit.userId);
    }

    const index = indexOf(visit.entryMs);
    if (index < 0) return;
    series[index].visits += 1;
    bucketPeople[index].add(visit.userId);
    bucketMinutes[index] += visit.durationMin;
    if (visit.role === 'student') {
      series[index].studentVisits += 1;
      bucketStudentMinutes[index] += visit.durationMin;
    }
  });

  series.forEach((row, index) => {
    row.unique = row.isFuture ? null : bucketPeople[index].size;
    row.hours = row.isFuture ? null : hoursOf(bucketStudentMinutes[index]);
    row.personHours = row.isFuture ? null : hoursOf(bucketMinutes[index]);
  });

  // Active days in date order. Busiest day: the earliest one wins a tie.
  const byDay = [...perDay.keys()].sort().map((date) => ({ date, visits: perDay.get(date) }));
  let peakDay = null;
  byDay.forEach((day) => {
    if (!peakDay || day.visits > peakDay.visits) peakDay = { date: day.date, visits: day.visits };
  });

  const medianMin = median(visits.map((visit) => visit.durationMin));
  const unattributedItems = (ds?.unattributed?.items || []).filter((visit) => inPeriod(visit.entryMs, period));
  const droppedShort = (ds?.quality?.shortTapMs || []).filter((ms) => inPeriod(ms, period)).length;

  const quality = {
    imputedVisits,
    imputedPct: pct(imputedVisits, visits.length),
    cappedVisits,
    mergedRows,
    droppedShort,
    unattributedVisits: unattributedItems.length,
  };

  return {
    totals: {
      visits: visits.length,
      uniqueVisitors: people.size,
      personHours: hoursOf(minutes),
      medianVisitMin: medianMin === null ? null : Math.round(medianMin),
      activeDays: perDay.size,
      peakDay,
    },
    byRole: ROLE_ORDER.map((role) => {
      const stats = roleStats.get(role);
      return {
        role,
        label: ROLE_LABELS[role],
        visits: stats.visits,
        unique: stats.people.size,
        hours: hoursOf(stats.minutes),
      };
    }),
    unattributed: {
      visits: unattributedItems.length,
      people: new Set(unattributedItems.map((visit) => visit.userId)).size,
    },
    series,
    byDay,
    byWeekday: WEEKDAY_SHORT.map((label, index) => ({
      isoWeekday: index + 1,
      label,
      longLabel: WEEKDAY_LONG[index],
      visits: perWeekday[index + 1],
    })),
    quality,
    dataNotes: buildDataNotes(quality, ds?.baselines?.visitMedianMin),
  };
};
