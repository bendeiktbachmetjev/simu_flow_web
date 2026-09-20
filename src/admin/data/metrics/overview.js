// The Overview page in one object: the five headline KPIs (with change vs the previous
// window and a sparkline), the highlights, the breakdown blocks and the data notes.
// Visits, classes, sessions and bookings are never counted here: every number is read from
// the domain metrics, so the same figure is identical on every page.
import moment from 'moment';
import { addDays, isoWeekdayOfDate } from '../period.js';
import { COURSE_OTHER } from '../normalize.js';
import { fmt } from '../../format.js';
import { computeVisitors } from './visitors.js';
import { computeStudents } from './students.js';
import { computeClasses } from './classes.js';
import { computeSimulators } from './simulators.js';
import { computeRooms } from './rooms.js';
import { computeGuests } from './guests.js';
import { comparable, effectiveRange, inPeriod, makeDelta } from './shared.js';

const ROUTES = {
  students: '/admin/students',
  classes: '/admin/classes',
  simulators: '/admin/simulators',
  rooms: '/admin/rooms',
};

const SPARK_BUCKETS = 12;
const TOP_SIMULATORS = 5;

// Highlight thresholds (spec §5.1). Below them a sentence would describe noise.
const MIN_VISITS_FOR_SHARE = 20;
const MIN_PCT_DENOMINATOR = 20;
const TOP_YEAR_SHARE = 0.4;
const MIN_REGISTERED = 10;
const CONCENTRATION_MIN_DAYS = 56;
const CONCENTRATION_SHARE = 0.5;
const WEEKDAY_LEAD = 1.15;
const MIN_WEEKDAYS = 3;
const MIN_ACTIVE_DAYS = 5;
const MIN_VISITS_FOR_PEAK = 10;
const MIN_PAST_CLASSES = 3;
const MIN_PAST_CLASSES_FOR_LEADER = 5;
const MIN_BOOKED_HOURS = 4;
const MAX_USED_SHARE = 0.25;
const MIN_SESSIONS = 5;
const MIN_ROOM_BOOKINGS = 3;

const bold = (text) => ({ t: text, b: true });
const plain = (text) => ({ t: text });
const plural = (n, one, many) => `${fmt.int(n)} ${n === 1 ? one : many}`;
const wholePct = (n, d) => `${Math.round((n / d) * 100)}%`;

// Last ≤ 12 buckets that have begun — a sparkline of the recent trend, not a second chart.
const sparkOf = (series, field) =>
  series
    .filter((row) => !row.isFuture)
    .slice(-SPARK_BUCKETS)
    .map((row) => row[field] ?? 0);

const compute = (ds, ref, period) => ({
  visitors: computeVisitors(ds, ref, period),
  students: computeStudents(ds, ref, period),
  classes: computeClasses(ds, ref, period),
  simulators: computeSimulators(ds, ref, period),
  // Default horizon 'elapsed': highlights and KPIs never count future bookings.
  rooms: computeRooms(ds, ref, period),
  guests: computeGuests(ds, ref, period),
});

// ---------------------------------------------------------------------------
// KPI tiles
// ---------------------------------------------------------------------------

const registeredSub = (unique, registered, coveragePct) => {
  if (registered <= 0) return 'No students registered in SimuFlow yet';
  if (registered < MIN_PCT_DENOMINATOR) return `${fmt.int(unique)} of ${fmt.int(registered)} registered in SimuFlow`;
  return `${Math.round(coveragePct)}% of ${fmt.int(registered)} registered in SimuFlow`;
};

const classesSub = ({ past, noActivity, upcoming }) => {
  if (past > 0) {
    const base = `of ${fmt.int(past)} planned so far`;
    return noActivity > 0 ? `${base} · ${fmt.int(noActivity)} with no activity recorded` : base;
  }
  return upcoming > 0 ? `${fmt.int(upcoming)} upcoming` : 'No classes planned in this period';
};

const buildKpis = (cur, prev, compareLabel) => {
  const delta = (pick, kind) =>
    makeDelta(pick(cur), prev ? pick(prev) : null, { kind, comparable: Boolean(prev) });
  const students = cur.students.totals;
  const classes = cur.classes.totals;
  const simulators = cur.simulators.totals;
  const noStudentVisits = 'No student visits in this period';

  return [
    {
      id: 'studentVisits',
      label: 'Student visits',
      value: students.visits,
      format: 'int',
      sub: students.visitsPerStudent === null
        ? noStudentVisits
        : `${fmt.decimal(students.visitsPerStudent)} visits per student`,
      delta: delta((m) => m.students.totals.visits, 'pct'),
      spark: sparkOf(cur.students.series, 'visits'),
      hintKey: 'studentVisits',
      to: ROUTES.students,
    },
    {
      id: 'uniqueStudents',
      label: 'Unique students',
      value: students.uniqueStudents,
      format: 'int',
      sub: registeredSub(students.uniqueStudents, students.registered, students.coveragePct),
      delta: delta((m) => m.students.totals.uniqueStudents, 'pct'),
      spark: sparkOf(cur.students.series, 'unique'),
      hintKey: 'uniqueStudents',
      to: ROUTES.students,
    },
    {
      id: 'classesHeld',
      label: 'Classes held',
      value: classes.held,
      format: 'int',
      sub: classesSub(classes),
      delta: delta((m) => m.classes.totals.held, 'pct'),
      spark: sparkOf(cur.classes.series, 'held'),
      hintKey: 'classesHeld',
      to: ROUTES.classes,
    },
    {
      id: 'utilisation',
      label: 'Simulator use',
      value: simulators.utilisationPct,
      format: 'pct',
      sub: simulators.utilisationPct === null
        ? 'No open hours counted in this period'
        : `${fmt.hours(simulators.hoursInOpen)} in use · ${fmt.pct(simulators.bookedPct)} booked`,
      delta: delta((m) => m.simulators.totals.utilisationPct, 'pp'),
      spark: sparkOf(cur.simulators.series, 'utilisationPct'),
      hintKey: 'utilisation',
      to: ROUTES.simulators,
    },
    {
      id: 'trainingHours',
      label: 'Training hours',
      value: students.trainingHours,
      format: 'hours',
      sub: students.medianVisitMin === null
        ? noStudentVisits
        : `typical visit ${fmt.duration(students.medianVisitMin)}`,
      delta: delta((m) => m.students.totals.trainingHours, 'pct'),
      spark: sparkOf(cur.students.series, 'hours'),
      hintKey: 'trainingHours',
      to: ROUTES.students,
    },
  ].map((kpi) => ({ ...kpi, compareLabel }));
};

// ---------------------------------------------------------------------------
// Highlights — four slots, the first eligible candidate of a slot wins.
// A candidate returns null when its condition fails or its winner is a tie.
// Sentences state counts that are on the page; they never judge and never compare periods.
// ---------------------------------------------------------------------------

const insight = (id, slot, tone, parts, to) => ({ id, slot, tone, parts, to });

// The single largest item by `valueOf`, or null when the list is empty or the top is shared.
const strictLeader = (items, valueOf) => {
  let leader = null;
  let tied = false;
  items.forEach((item) => {
    const value = valueOf(item);
    if (leader === null || value > valueOf(leader)) {
      leader = item;
      tied = false;
    } else if (value === valueOf(leader)) {
      tied = true;
    }
  });
  return tied ? null : leader;
};

const peopleCandidates = ({ students }) => [
  () => {
    const total = students.totals.visits;
    if (total < MIN_VISITS_FOR_SHARE) return null;
    const top = strictLeader(students.byCourse, (row) => row.visits);
    if (!top || top.course === COURSE_OTHER || top.visits / total < TOP_YEAR_SHARE) return null;
    return insight('topYear', 'A', 'neutral', [
      bold(`${top.label} students`),
      plain(' make up '),
      bold(wholePct(top.visits, total)),
      plain(` of student visits (${fmt.int(top.visits)} of ${fmt.int(total)}).`),
    ], ROUTES.students);
  },
  () => {
    const { registered, uniqueStudents } = students.totals;
    if (registered < MIN_REGISTERED || uniqueStudents < 1) return null;
    const share = registered >= MIN_PCT_DENOMINATOR ? ` (${wholePct(uniqueStudents, registered)})` : '';
    return insight('reach', 'A', 'neutral', [
      bold(`${fmt.int(uniqueStudents)} of ${fmt.int(registered)}`),
      plain(` students registered in SimuFlow visited the center${share}.`),
    ], ROUTES.students);
  },
];

const rhythmCandidates = ({ visitors }, { period }) => {
  const total = visitors.totals.visits;
  // A date needs its year only when the counted days run over more than one year.
  const lastDay = period.effTo > period.from ? addDays(period.effTo, -1) : period.from;
  const withYear = period.from.slice(0, 4) !== lastDay.slice(0, 4);

  // ISO weeks, keyed by their Monday.
  const perWeek = new Map();
  visitors.byDay.forEach(({ date, visits }) => {
    const monday = addDays(date, 1 - isoWeekdayOfDate(date));
    perWeek.set(monday, (perWeek.get(monday) || 0) + visits);
  });

  return [
    () => {
      if (period.effDays < CONCENTRATION_MIN_DAYS || total < MIN_VISITS_FOR_SHARE) return null;
      const top = strictLeader([...perWeek.entries()], ([, count]) => count);
      if (!top || top[1] / total < CONCENTRATION_SHARE) return null;
      const week = moment(top[0], 'YYYY-MM-DD').format(withYear ? 'D MMM YYYY' : 'D MMM');
      return insight('concentrated', 'B', 'attention', [
        plain('Activity is concentrated: '),
        bold(`${fmt.int(top[1])} of ${fmt.int(total)} visits`),
        plain(` took place in the week of ${week}.`),
      ], ROUTES.students);
    },
    () => {
      if (total < MIN_VISITS_FOR_SHARE || visitors.totals.activeDays < MIN_ACTIVE_DAYS) return null;
      const ranked = visitors.byWeekday.filter((row) => row.visits > 0).sort((a, b) => b.visits - a.visits);
      if (ranked.length < MIN_WEEKDAYS || ranked[0].visits < WEEKDAY_LEAD * ranked[1].visits) return null;
      return insight('busiestWeekday', 'B', 'neutral', [
        plain('Busiest day of the week: '),
        bold(ranked[0].longLabel),
        plain(` (${fmt.int(ranked[0].visits)} of ${fmt.int(total)} visits).`),
      ], ROUTES.students);
    },
    () => {
      if (total < MIN_VISITS_FOR_PEAK) return null;
      const top = strictLeader(visitors.byDay, (day) => day.visits);
      if (!top) return null;
      return insight('busiestDay', 'B', 'neutral', [
        plain('Busiest day: '),
        bold(withYear ? fmt.dayLong(top.date) : fmt.dayShort(top.date)),
        plain(` with ${plural(top.visits, 'visit', 'visits')}.`),
      ], ROUTES.students);
    },
  ];
};

const teachingCandidates = ({ classes }, { pastEvents }) => [
  () => {
    const { past, held, noActivity, upcoming } = classes.totals;
    if (past < MIN_PAST_CLASSES) return null;
    const what = upcoming > 0 ? 'classes planned so far show' : 'planned classes show';
    const rest = noActivity === 0
      ? '.'
      : `; ${fmt.int(noActivity)} ${noActivity === 1 ? 'has' : 'have'} no activity recorded.`;
    return insight('classesHeld', 'C', noActivity > 0 ? 'attention' : 'neutral', [
      bold(`${fmt.int(held)} of ${fmt.int(past)}`),
      plain(` ${what} activity on site${rest}`),
    ], ROUTES.classes);
  },
  () => {
    if (classes.totals.past < MIN_PAST_CLASSES_FOR_LEADER) return null;
    const clinics = classes.byClinic.filter((row) => row.clinicId !== null);
    const top = clinics.length >= 2 ? strictLeader(clinics, (row) => row.held) : null;
    if (!top || top.held < 1) return null;
    return insight('topClinic', 'C', 'neutral', [
      bold(top.clinic),
      plain(` held the most classes: ${fmt.int(top.held)}.`),
    ], ROUTES.classes);
  },
  () => {
    if (pastEvents.length < 1) return null;
    const minutes = pastEvents.reduce((sum, event) => sum + event.durationMin, 0);
    return insight('guestEvents', 'C', 'neutral', [
      bold(plural(pastEvents.length, 'guest event', 'guest events')),
      plain(` took place, ${fmt.hours(minutes / 60)} in total.`),
    ], ROUTES.classes);
  },
];

const equipmentCandidates = ({ simulators, rooms }) => [
  () => {
    // Total NFC use of the period is compared, so "barely used" can never be an artefact of
    // use that happened outside the booked hours.
    const idle = simulators.perSimulator.filter(
      (row) => row.bookedHours >= MIN_BOOKED_HOURS && row.hours <= MAX_USED_SHARE * row.bookedHours
    );
    const top = strictLeader(idle, (row) => row.bookedHours - row.hours);
    if (!top) return null;
    const used = top.hours > 0 ? `NFC shows ${fmt.hours(top.hours)} of use.` : 'NFC shows no use.';
    return insight('bookedUnused', 'D', 'attention', [
      bold(`Simulator ${top.number}`),
      plain(` was booked for ${fmt.hours(top.bookedHours)}; ${used}`),
    ], ROUTES.simulators);
  },
  () => {
    if (simulators.totals.sessions < MIN_SESSIONS) return null;
    const top = strictLeader(simulators.perSimulator, (row) => row.hours);
    if (!top || top.sessions < 1) return null;
    return insight('topSimulator', 'D', 'neutral', [
      plain('Most used simulator: '),
      bold(top.label),
      plain(`, ${fmt.hours(top.hours)} over ${plural(top.sessions, 'session', 'sessions')}.`),
    ], ROUTES.simulators);
  },
  () => {
    const { bookings, rooms: total, roomsUsed } = rooms.totals;
    if (bookings < MIN_ROOM_BOOKINGS || total - roomsUsed < 1) return null;
    return insight('unusedRooms', 'D', 'neutral', [
      bold(`${fmt.int(total - roomsUsed)} of ${plural(total, 'room', 'rooms')}`),
      plain(' had no bookings in this period.'),
    ], ROUTES.rooms);
  },
];

const buildInsights = (cur, context) =>
  [
    peopleCandidates(cur),
    rhythmCandidates(cur, context),
    teachingCandidates(cur, context),
    equipmentCandidates(cur),
  ]
    .map((candidates) => {
      for (let i = 0; i < candidates.length; i += 1) {
        const found = candidates[i]();
        if (found) return found;
      }
      return null;
    })
    .filter(Boolean);

// ---------------------------------------------------------------------------
// CSV summary and the empty-state pointer
// ---------------------------------------------------------------------------

const SUMMARY_METRICS = [
  { metric: 'student_visits', unit: 'visits', kind: 'pct', pick: (m) => m.students.totals.visits },
  { metric: 'unique_students', unit: 'students', kind: 'pct', pick: (m) => m.students.totals.uniqueStudents },
  { metric: 'classes_held', unit: 'classes', kind: 'pct', pick: (m) => m.classes.totals.held },
  { metric: 'simulator_utilisation_pct', unit: '%', kind: 'pp', pick: (m) => m.simulators.totals.utilisationPct },
  { metric: 'training_hours', unit: 'hours', kind: 'pct', pick: (m) => m.students.totals.trainingHours },
  { metric: 'visits_all', unit: 'visits', kind: 'pct', pick: (m) => m.visitors.totals.visits },
  { metric: 'unique_visitors', unit: 'people', kind: 'pct', pick: (m) => m.visitors.totals.uniqueVisitors },
  { metric: 'room_occupancy_pct', unit: '%', kind: 'pp', pick: (m) => m.rooms.totals.occupancyPct },
  { metric: 'rooms_used', unit: 'rooms', kind: 'pct', pick: (m) => m.rooms.totals.roomsUsed },
  { metric: 'guest_registrations', unit: 'registrations', kind: 'pct', pick: (m) => m.guests.totals.registrations },
];

// Last day inside an exclusive end; never before the first day.
const lastDayOf = (from, toExcl) => (toExcl > from ? addDays(toExcl, -1) : from);

const buildSummary = (cur, prev, period, prevPeriod) =>
  SUMMARY_METRICS.map(({ metric, unit, kind, pick }) => {
    const previousValue = prev ? pick(prev) : null;
    const change = makeDelta(pick(cur), previousValue, { kind, comparable: Boolean(prev) });
    return {
      metric,
      value: pick(cur),
      unit,
      previousValue,
      change: change ? change.value : null,
      changeKind: change ? change.kind : null,
      periodFrom: period.from,
      periodTo: lastDayOf(period.from, period.effTo),
      previousFrom: prev ? prevPeriod.from : null,
      previousTo: prev ? lastDayOf(prevPeriod.from, prevPeriod.to) : null,
    };
  });

// Month with the most visits in the whole history (the earliest one wins a tie). An empty
// period points the reader to it: "Most activity so far was in June 2026."
const peakMonthOf = (ds) => {
  const perMonth = new Map();
  (ds?.visits || []).forEach((visit) => perMonth.set(visit.monthKey, (perMonth.get(visit.monthKey) || 0) + 1));
  let peak = null;
  [...perMonth.keys()].sort().forEach((key) => {
    const visits = perMonth.get(key);
    if (!peak || visits > peak.visits) peak = { key, label: fmt.month(key), visits };
  });
  return peak;
};

// ---------------------------------------------------------------------------

export const computeOverview = (ds, ref, period, prevPeriod = null) => {
  const cur = compute(ds, ref, period);
  const prev = prevPeriod && comparable(ds, prevPeriod) ? compute(ds, ref, prevPeriod) : null;
  const compareLabel = prev ? prevPeriod.compareLabel ?? null : null;

  const pastEvents = (ds?.events || []).filter(
    (event) => inPeriod(event.startMs, period) && event.endMs <= ds.nowMs
  );

  const range = effectiveRange(period, ds);
  const topRoom = cur.rooms.perRoom.find((room) => room.bookedHours > 0) || null;

  return {
    kpis: buildKpis(cur, prev, compareLabel),
    activity: cur.visitors.series,
    insights: buildInsights(cur, { period, pastEvents }),
    roles: cur.visitors.byRole,
    byCourse: cur.students.byCourse,
    byClinic: cur.classes.byClinic,
    simulatorsTop5: cur.simulators.perSimulator
      .filter((row) => row.hours > 0 || row.bookedHours > 0)
      .slice(0, TOP_SIMULATORS),
    roomsHeat: cur.rooms.heatmap,
    roomsLine: {
      occupancyPct: cur.rooms.totals.occupancyPct,
      roomsUsed: cur.rooms.totals.roomsUsed,
      rooms: cur.rooms.totals.rooms,
      bookings: cur.rooms.totals.bookings,
      topRoom: topRoom ? { name: topRoom.name, bookedHours: topRoom.bookedHours } : null,
    },
    dataNotes: cur.visitors.dataNotes,
    counted: { clipped: range.clipped, fromLabel: range.clipped ? fmt.date(range.from) : null },
    peakMonth: peakMonthOf(ds),
    // Extras for the page chrome: totals behind the block footers and the CSV "summary" table.
    visitorTotals: cur.visitors.totals,
    unattributed: cur.visitors.unattributed,
    classTotals: cur.classes.totals,
    simulatorTotals: cur.simulators.totals,
    summary: buildSummary(cur, prev, period, prevPeriod),
  };
};
