// Generated rows for the dev-only demo mode (see ./demo.js). Every use site loads this file
// with a dynamic import behind `import.meta.env.DEV`, so it never reaches a production bundle.
//
// The rows have exactly the column shapes of the Supabase queries (reference R1–R8, history
// H1–H5, live), so they run through the same buildReference → buildDataset → metrics pipeline
// as real data — including the real defects: visits closed by the 20:00 cron, double entrance
// taps, accidental taps, old classes that point at a removed simulator or an unlisted room.
//
// Pure and deterministic: seeded PRNG, `nowMs` is injected, no Math.random, no Date.now.
// Wall-clock maths is done in Vilnius time with its own EU daylight-saving rule, so the output
// does not depend on the time zone of the machine that runs it. Each day has its own seed, so
// a day's rows do not depend on the days generated before it, today's rows stay put while
// "now" moves through the day, and the live poll only has to generate today.

const SEED = 0x85a308d3;
const UNIVERSITY = 'Vilnius University';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const HISTORY_MONTHS = 16;
const UPCOMING_DAYS = 28;
const LEGACY_DAYS = 120; // old classes still name simulator "1" and rooms that no longer exist

// Id namespaces. The last uuid group is kind + day + index, which makes every id unique.
const KIND = {
  student: 1,
  teacher: 2,
  resident: 3,
  guestUser: 4,
  clinic: 5,
  simulator: 6,
  room: 7,
  event: 8,
  deletedUser: 9,
  visit: 10,
  session: 11,
  schedule: 12,
  guestReg: 13,
  foreign: 14,
};

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hash32 = (a, b = 0, c = 0) => {
  let h = (SEED ^ Math.imul(a + 0x9e3779b9, 0x85ebca6b)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35) ^ Math.imul(b + 0x165667b1, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 13), 0x9e3779b1) ^ Math.imul(c + 0x61c88647, 0x85ebca77);
  return (h ^ (h >>> 16)) >>> 0;
};

const makeRng = (seed) => {
  const next = mulberry32(seed);
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  const gaussian = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  return {
    next,
    int,
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],
    weighted: (weights) => {
      let roll = next() * weights.reduce((sum, w) => sum + w, 0);
      for (let i = 0; i < weights.length; i += 1) {
        roll -= weights[i];
        if (roll < 0) return i;
      }
      return weights.length - 1;
    },
    logNormal: (median, sigma) => median * Math.exp(sigma * gaussian()),
    poisson: (mean) => {
      if (mean <= 0) return 0;
      const limit = Math.exp(-mean);
      let count = 0;
      let product = next();
      while (product > limit) {
        count += 1;
        product *= next();
      }
      return count;
    },
    shuffled: (list) => {
      const copy = [...list];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = int(0, i);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
};

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

// ---------------------------------------------------------------------------
// Vilnius wall clock ↔ UTC, ids and timestamp strings
// ---------------------------------------------------------------------------

const dstBoundsByYear = new Map();

// 01:00 UTC on the last Sunday of a month: the moment the EU switches its clocks.
const lastSundayAt1Utc = (year, monthIndex) => {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  return Date.UTC(year, monthIndex, lastDay.getUTCDate() - lastDay.getUTCDay(), 1);
};

const vilniusOffsetMs = (utcMs) => {
  const year = new Date(utcMs).getUTCFullYear();
  let bounds = dstBoundsByYear.get(year);
  if (!bounds) {
    bounds = [lastSundayAt1Utc(year, 2), lastSundayAt1Utc(year, 9)];
    dstBoundsByYear.set(year, bounds);
  }
  return utcMs >= bounds[0] && utcMs < bounds[1] ? 3 * HOUR : 2 * HOUR;
};

// A "day number" is a Vilnius calendar date counted in days since 1970-01-01.
const wallToUtcMs = (dayNum, minuteOfDay) => {
  const wall = dayNum * DAY + minuteOfDay * MIN;
  const asWinter = wall - 2 * HOUR;
  return vilniusOffsetMs(asWinter) === 2 * HOUR ? asWinter : wall - 3 * HOUR;
};

const dayNumOf = (utcMs) => Math.floor((utcMs + vilniusOffsetMs(utcMs)) / DAY);
const minuteOfDayOf = (utcMs) => Math.floor(((utcMs + vilniusOffsetMs(utcMs)) % DAY) / MIN);

const calendarOf = (dayNum) => {
  const d = new Date(dayNum * DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), isoWeekday: d.getUTCDay() || 7 };
};

const pad = (n, width) => String(n).padStart(width, '0');
const dateStr = (dayNum) => new Date(dayNum * DAY).toISOString().slice(0, 10);
const timeStr = (minuteOfDay) => `${pad(Math.floor(minuteOfDay / 60), 2)}:${pad(minuteOfDay % 60, 2)}:00`;

// PostgREST prints timestamptz as '2026-06-16T07:03:21.482913+00:00' and drops a zero fraction.
const iso = (ms) => {
  const text = new Date(ms).toISOString();
  if (ms % 1000 === 0) return `${text.slice(0, 19)}+00:00`;
  return `${text.slice(0, 23)}${pad((ms * 7) % 1000, 3)}+00:00`;
};

const hex = (n, width) => n.toString(16).padStart(width, '0');

const uid = (kind, a, b) => {
  const h1 = hash32(kind, a, b);
  const h2 = hash32(h1, kind, 0x51);
  const variant = '89ab'[h1 & 3];
  const head = `${hex(h1, 8)}-${hex(h2 >>> 16, 4)}-4${hex(h2 & 0xfff, 3)}-${variant}${hex((h1 >>> 8) & 0xfff, 3)}`;
  return `${head}-${hex(kind, 2)}${hex(a, 5)}${hex(b, 5)}`;
};

// The database job runs at 17:00 and 18:00 UTC and closes open sessions only once it is
// 20:00 or later in Vilnius: 17:00Z in summer, 18:00Z in winter. An entry after that run
// stays open until the next one.
const nextCronCloseMs = (entryMs) => {
  const utcDayStart = Math.floor(entryMs / DAY) * DAY;
  for (let d = 0; d < 3; d += 1) {
    for (const hour of [17, 18]) {
      const run = utcDayStart + d * DAY + hour * HOUR;
      if (run > entryMs && minuteOfDayOf(run) >= 20 * 60) return run;
    }
  }
  return utcDayStart + DAY + 18 * HOUR;
};

// The cleaning step recognises a job-closed row by its time of day (17:00 or 18:00 UTC, to the
// minute). A real tap inside one of those two minutes would be read as "forgot to tap out",
// so generated taps stay clear of them and the demo counts stay exact.
const isJobMinute = (ms) => {
  const msOfDay = ms % DAY;
  return (msOfDay >= 17 * HOUR && msOfDay < 17 * HOUR + MIN) || (msOfDay >= 18 * HOUR && msOfDay < 18 * HOUR + MIN);
};

// ---------------------------------------------------------------------------
// The center: clinics, teachers, simulators, rooms, students
// ---------------------------------------------------------------------------

// One clinic has no university in the live data but is used by this university's teachers;
// the last one belongs to another university and must be filtered out by the Reference builder.
const CLINICS = [
  { name: 'Anesteziologijos ir reanimatologijos', university: UNIVERSITY },
  { name: 'Skubios medicinos', university: UNIVERSITY },
  { name: 'Pulmonologijos', university: UNIVERSITY },
  { name: 'Kraujagyslių chirurgijos', university: UNIVERSITY },
  { name: 'Akušerijos ir ginekologijos', university: UNIVERSITY },
  { name: 'Vaikų ligų', university: null },
  { name: 'Test clinic', university: 'Test University' },
];

const SIMULATORS = [
  { number: '2', name: 'Adult patient simulator', freeAccess: false, useWeight: 0.95 },
  { number: '3', name: 'ALS manikin', freeAccess: false, useWeight: 0.9 },
  { number: '4', name: 'Birthing simulator', freeAccess: false, useWeight: 0.65 },
  { number: '5', name: 'Pediatric simulator', freeAccess: false, useWeight: 0.6 },
  { number: '6', name: 'Newborn simulator', freeAccess: false, useWeight: 0.18 },
  { number: '8', name: 'Airway trainer', freeAccess: true, useWeight: 0.5 },
  { number: 'X1', name: 'Ultrasound simulator', freeAccess: false, useWeight: 0.55 },
  { number: 'X2', name: 'Laparoscopy trainer', freeAccess: true, useWeight: 0.35 },
  { number: 'X3', name: 'Endoscopy trainer', freeAccess: false, useWeight: 0.08 },
  { number: 'X4', name: 'IV access arm', freeAccess: true, useWeight: 0.25 },
];

const ROOMS = [
  'A2-01', 'A2-03', 'A2-06', 'A2-08', 'A2-11', 'A2-14', 'A2-17', 'A2-19',
  'B2-02', 'B2-04', 'B2-05', 'B2-09', 'B2-12', 'B2-16',
  'C2-01', 'C2-04', 'C2-07', 'C2-10', 'C2-13', 'C2-15', 'C2-18',
  'D2-02', 'D2-03', 'D2-08', 'D2-10', 'D2-12', 'D2-14', 'D2-16', 'D2-20', 'D2-21',
];

const REMOVED_SIMULATORS = ['1', '7'];
const UNLISTED_ROOMS = ['Debriefing', 'Simuliacinė 1', 'Simuliacinė 2'];

// clinics: indexes into CLINICS · courses: years the teacher plans classes for · sims: the
// teacher's allowed simulators (pre-ticked in the app) · rooms: favourites, most used first.
const TEACHERS = [
  { name: 'Rasa', surname: 'Kazlauskienė', clinics: [0], courses: ['3', '4', '5'], weight: 3,
    sims: ['2', '3', '8', 'X4'], rooms: ['A2-06', 'A2-08', 'A2-19', 'C2-04'] },
  { name: 'Tomas', surname: 'Petrauskas', clinics: [0, 1], courses: ['3', '5', '6'], weight: 2.4,
    sims: ['2', '3', '5', '8', 'X4'], rooms: ['A2-08', 'A2-19', 'B2-04'] },
  { name: 'Jonas', surname: 'Jankauskas', clinics: [1], courses: ['1', '2', '3'], weight: 2.2,
    sims: ['2', '3', '8'], rooms: ['A2-19', 'A2-06', 'B2-04', 'B2-05'] },
  { name: 'Eglė', surname: 'Stankevičienė', clinics: [1], courses: ['2', '3', '6'], weight: 1.8,
    sims: ['2', '3', '5', '8'], rooms: ['B2-04', 'A2-19', 'B2-05'] },
  { name: 'Mindaugas', surname: 'Butkus', clinics: [2], courses: ['3', '4'], weight: 1.5,
    sims: ['2', '8', 'X3'], rooms: ['C2-04', 'C2-07', 'B2-09'] },
  { name: 'Laura', surname: 'Žukauskaitė', clinics: [2], courses: ['3', '4'], weight: 0.9,
    sims: ['2', 'X3'], rooms: ['C2-07', 'C2-04'] },
  { name: 'Andrius', surname: 'Vasiliauskas', clinics: [3], courses: ['4', '5'], weight: 1.6,
    sims: ['X1', 'X2', 'X4'], rooms: ['D2-08', 'D2-10', 'C2-10'] },
  { name: 'Ieva', surname: 'Paulauskaitė', clinics: [3], courses: ['4', '5'], weight: 0.7,
    sims: ['X1', 'X2', 'X4'], rooms: ['D2-10', 'D2-08'] },
  { name: 'Darius', surname: 'Urbonas', clinics: [4], courses: ['4', '5'], weight: 1.7,
    sims: ['4', '6', 'X1'], rooms: ['B2-12', 'B2-16', 'D2-02'] },
  { name: 'Giedrė', surname: 'Navickienė', clinics: [4, 5], courses: ['5', '6'], weight: 1.1,
    sims: ['4', '5', '6'], rooms: ['B2-16', 'B2-12', 'C2-15'] },
  { name: 'Vytautas', surname: 'Ramanauskas', clinics: [5], courses: ['5', '6'], weight: 1.3,
    sims: ['5', '6', '8'], rooms: ['C2-13', 'C2-15', 'B2-12'] },
  { name: 'Agnė', surname: 'Kavaliauskaitė', clinics: [5], courses: ['3', '5'], weight: 0.6,
    sims: ['5', '6', '8'], rooms: ['C2-15', 'C2-13'] },
  { name: 'Paulius', surname: 'Savickas', clinics: [0], courses: ['1', '2'], weight: 1,
    sims: ['3', '8', 'X4'], rooms: ['A2-06', 'A2-01', 'A2-03'] },
  { name: 'Monika', surname: 'Balčiūnaitė', clinics: [], courses: ['1', '2'], weight: 0.35,
    sims: ['3', '8'], rooms: ['A2-01', 'A2-03'] },
];

// never = share of registered students who have not come yet (keeps "reach" below 100 %).
const COURSE_PLAN = [
  { course: '1', students: 30, groups: ['1', '2'], never: 0.45, classWeight: 0.05 },
  { course: '2', students: 38, groups: ['1', '2', '3'], never: 0.25, classWeight: 0.12 },
  { course: '3', students: 52, groups: ['5', '6', '7', '8'], never: 0.05, classWeight: 0.3 },
  { course: '4', students: 40, groups: ['MED-01', 'MED-02', 'MED-03'], never: 0.08, classWeight: 0.24 },
  { course: '5', students: 34, groups: ['1', '2', '3'], never: 0.12, classWeight: 0.19 },
  { course: '6', students: 22, groups: ['1', '2'], never: 0.3, classWeight: 0.1 },
];
const COURSE_WEIGHTS = COURSE_PLAN.map((plan) => plan.classWeight);

const OTHER_STUDENTS = [
  { course: '1 semestre masters', group: 'Molecular biology', faculty: 'Life Sciences Centre' },
  { course: 'Erasmus', group: 'ERASMUS', faculty: 'Medicine' },
  { course: 'Erasmus', group: 'ERASMUS', faculty: 'Medicine' },
  { course: 'PhD', group: 'Doktorantūra', faculty: 'Medicinos fakultetas' },
];

const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI' };
const COURSE_SPELLINGS = [(c) => `${c} kursas`, (c) => ROMAN[c], (c) => `${c} course`, (c) => `${c}.`];

// Free text typed at registration, with its real-life mess.
const FACULTIES = [
  ['Medicine', 150], ['medicine', 14], ['Medicina', 9], ['Medicinos', 5], ['Medicinos fakultetas', 4],
  ['Faculty of Medicine', 4], ['MF', 3], ['Nursing', 8], ['Dentistry', 7], ['Odontologija', 2],
  ['Life Sciences Centre', 6], ['Public Health', 2], [null, 4], ['', 1],
];
const FACULTY_WEIGHTS = FACULTIES.map(([, weight]) => weight);

const RELIABILITY = [0.97, 0.75, 0.3, 0.1, 0.03];
const RELIABILITY_WEIGHTS = [0.42, 0.22, 0.16, 0.12, 0.08];

const RESIDENT_SPECIALTIES = ['Anesteziologija reanimatologija', 'Skubioji medicina', 'Vaikų ligos'];

// guest_users.university is the guest's OWN institution, never the host university.
const GUEST_USERS = [
  { event: 20, university: 'Riga Stradiņš University' },
  { event: 20, university: 'University of Tartu' },
  { event: 19, university: 'Lithuanian University of Health Sciences' },
  { event: 19, university: 'Klaipėda University' },
  { event: 17, university: 'Medical University of Warsaw' },
  { event: 17, university: 'Riga Stradiņš University' },
  { event: 12, university: 'University of Helsinki' },
  { event: 6, university: 'Karolinska Institutet' },
];

// Guest events, oldest first. start/dur in wall-clock minutes; teachers = indexes into TEACHERS
// (event_codes.teacher_ids); staff = who taps in when no teacher is assigned; intl = share of
// registrations from abroad; regs = filled sign-in forms; quiet = no NFC activity at all.
const EVENT_PLAN = [
  { name: 'BLS instructor course', start: 540, dur: 420, teachers: [2], intl: 0, regs: 9,
    sims: ['3', '8'], rooms: ['A2-19', 'D2-12'] },
  { name: 'Open doors day', start: 600, dur: 360, teachers: [], staff: 12, intl: 0.05, regs: 24,
    sims: ['2', '3', 'X4'], rooms: ['A2-19', 'A2-14', 'C2-01'] },
  { name: 'Resident bootcamp: airway management', start: 510, dur: 480, teachers: [0], intl: 0, regs: 8,
    sims: ['2', '8'], rooms: ['C2-04', 'D2-12'] },
  { name: 'High school visit: future doctors', start: 600, dur: 240, teachers: [], intl: 0, regs: 16, quiet: true,
    sims: ['3', 'X4'], rooms: ['A2-14'] },
  { name: 'Pediatric emergencies workshop', start: 540, dur: 450, teachers: [10], intl: 0.2, regs: 12,
    sims: ['5', '6'], rooms: ['C2-13', 'D2-14'] },
  { name: 'Baltic simulation network meeting', start: 540, dur: 540, teachers: [1], intl: 0.75, regs: 19,
    sims: ['2', '5', 'X1'], rooms: ['D2-12', 'D2-14', 'C2-01'] },
  { name: 'Ultrasound-guided vascular access', start: 540, dur: 360, teachers: [6], intl: 0.15, regs: 10,
    sims: ['X1', 'X4'], rooms: ['D2-08', 'D2-12'] },
  { name: 'ALS provider course', start: 540, dur: 480, teachers: [0, 1], intl: 0, regs: 12, saturday: true,
    sims: ['2', '3'], rooms: ['A2-19', 'D2-12'] },
  { name: 'Obstetric emergencies course', start: 510, dur: 480, teachers: [8], intl: 0.1, regs: 11,
    sims: ['4', '6'], rooms: ['B2-12', 'D2-14'] },
  { name: null, start: 780, dur: 180, teachers: [], intl: 0, regs: 2, quiet: true,
    sims: ['8'], rooms: ['B2-02'] },
  { name: 'Nursing skills day', start: 540, dur: 360, teachers: [12], intl: 0, regs: 13,
    sims: ['3', '8', 'X4'], rooms: ['A2-14', 'C2-01'] },
  { name: 'Trauma team training', start: 720, dur: 480, teachers: [1, 3], intl: 0, regs: 9,
    sims: ['2', '3'], rooms: ['A2-19'] },
  { name: 'Erasmus+ simulation week', start: 540, dur: 480, teachers: [3], intl: 0.9, regs: 15,
    sims: ['2', '5', 'X1'], rooms: ['D2-12', 'D2-14'] },
  { name: 'Difficult airway workshop', start: 600, dur: 360, teachers: [4], intl: 0.1, regs: 9,
    sims: ['8', 'X3'], rooms: ['C2-04'] },
  { name: 'Simulation instructor evening seminar', start: 960, dur: 300, teachers: [0], intl: 0.1, regs: 10,
    sims: ['2'], rooms: ['D2-12', 'C2-01'] },
  { name: 'Neonatal resuscitation course', start: 540, dur: 420, teachers: [9], intl: 0.1, regs: 10, quiet: true,
    sims: ['6'], rooms: ['C2-15', 'D2-14'] },
  { name: 'Summer school: clinical skills', start: 540, dur: 480, teachers: [2], intl: 0.6, regs: 17,
    sims: ['3', '8', 'X2', 'X4'], rooms: ['A2-14', 'A2-19', 'C2-01'] },
  { name: 'Laparoscopy basics for residents', start: 540, dur: 420, teachers: [6], intl: 0.1, regs: 8,
    sims: ['X2'], rooms: ['D2-10', 'D2-12'] },
  { name: 'Emergency ultrasound weekend course', start: 600, dur: 420, teachers: [7], intl: 0.3, regs: 9,
    saturday: true, sims: ['X1'], rooms: ['D2-08'] },
  { name: 'Sepsis simulation for ICU nurses', start: 540, dur: 390, teachers: [0], intl: 0.2, regs: 12,
    sims: ['2', '3'], rooms: ['A2-19', 'D2-12'] },
  { name: 'Pediatric simulation instructor course', start: 540, dur: 480, teachers: [10], intl: 0.5, regs: 14,
    sims: ['5', '6'], rooms: ['D2-12', 'D2-14'] },
  { name: 'Student science fair: simulation demo', start: 600, dur: 300, teachers: [], intl: 0, regs: 0,
    sims: ['3', 'X4'], rooms: ['A2-14'] },
  { name: 'ALS provider course', start: 540, dur: 480, teachers: [0, 1], intl: 0, regs: 0,
    sims: ['2', '3'], rooms: ['A2-19', 'D2-12'] },
  { name: 'Obstetric emergencies course', start: 510, dur: 480, teachers: [8], intl: 0, regs: 0,
    sims: ['4', '6'], rooms: ['B2-12', 'D2-14'] },
  { name: 'Baltic simulation network meeting', start: 540, dur: 540, teachers: [1], intl: 0, regs: 0,
    sims: ['2', '5', 'X1'], rooms: ['D2-12', 'D2-14', 'C2-01'] },
];
// Days from today, same order as EVENT_PLAN: 20 past events, one today, four upcoming.
const EVENT_OFFSETS = [
  -468, -441, -419, -392, -371, -342, -318, -297, -266, -243, -220, -196, -171, -150, -122, -96, -68, -40, -12, -3,
  0, 4, 10, 17, 25,
];
const TODAY_EVENT_INDEX = 20;

// Today is always a full teaching day, even on a Sunday or in July, so that the "Right now"
// strip has something to show whenever the demo is opened. `used` simulators run one NFC
// session after another for the whole class.
const TODAY_PLAN = [
  { startMin: 510, endMin: 630, teacher: 2, course: '3', groups: ['5', '6'],
    sims: ['2', '3', '8'], used: ['2', '3'], rooms: ['A2-19'] },
  { startMin: 645, endMin: 765, teacher: 0, course: '4', groups: ['MED-01', 'MED-02'],
    sims: ['2', '3', '8'], used: ['2', '3'], rooms: ['A2-06'], needsAssistance: true },
  { startMin: 750, endMin: 840, teacher: 8, course: '5', groups: ['1'],
    sims: ['4', 'X1'], used: [], rooms: ['B2-12'] },
  { startMin: 795, endMin: 915, teacher: 1, course: '5', groups: ['2', '3'],
    sims: ['2', '3'], used: ['2', '3'], rooms: ['A2-08'] },
  { startMin: 930, endMin: 1050, teacher: 3, course: '3', groups: ['7', '8'],
    sims: ['2', '3', '8'], used: ['2', '3'], rooms: ['A2-19'] },
  { startMin: 1065, endMin: 1155, teacher: 12, course: '2', groups: ['1', '2'],
    sims: ['3', '8'], used: ['3', '8'], rooms: ['A2-06'] },
];
const TODAY_FIRST_START_MIN = TODAY_PLAN[0].startMin;
const TODAY_LAST_END_MIN = TODAY_PLAN[TODAY_PLAN.length - 1].endMin;
// Outside the timetable above, one extra class is placed on the block around "now". The evening
// blocks are cut at 20:00 and 21:00, when the database job closes every open visit.
const KEEP_ALIVE_CLASS = {
  teacher: 4, course: '4', groups: ['MED-03'], sims: ['4', 'X1'], used: ['4', 'X1'], rooms: ['C2-04'],
};
const KEEP_ALIVE_EDGES = [0, 120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200, 1260, 1380, 1440];
const TODAY_FREE_CHAIN_SIM = 'X4';

// Academic rhythm: busy Sep–Dec and Feb–Jun, exams in January and June, quiet July–August.
const MONTH_WEIGHT = [0.3, 0.85, 1, 0.95, 1, 0.5, 0.04, 0.06, 0.8, 1, 1, 0.65];
const WEEKDAY_WEIGHT = [0, 0.8, 1.1, 1.25, 1.1, 0.75, 0, 0]; // by ISO weekday
const HOLIDAYS = new Set([101, 216, 311, 501, 624, 706, 815, 1101, 1102, 1224, 1225, 1226]); // month*100 + day
const CLASSES_PER_DAY = 1.7;
const FREE_PRACTICE_PER_DAY = 13;
const ATTENDANCE = 0.96;

const SLOT_STARTS = [480, 510, 540, 600, 645, 720, 780, 795, 840, 900, 930, 960, 1020];
const SLOT_WEIGHTS = [1, 1.6, 1.2, 1.6, 1.4, 0.8, 1.3, 0.8, 1.5, 1, 0.8, 0.5, 0.12];
const DURATIONS = [60, 90, 120, 180];
const DURATION_WEIGHTS = [0.1, 0.3, 0.42, 0.18];
const LAST_CLASS_END_MIN = 19 * 60;
const ROOM_PICK_WEIGHTS = [5, 3, 2, 1];

const FOREIGN_COUNTRIES = ['Latvia', 'Estonia', 'Poland', 'Germany', 'Finland', 'Ukraine', 'Sweden'];
const FOREIGN_COUNTRY_WEIGHTS = [6, 4, 4, 2, 2, 2, 1];
const FOREIGN_AFFILIATIONS = {
  Latvia: ['Riga Stradiņš University', 'Riga Stradiņš University', 'RSU', 'University of Latvia'],
  Estonia: ['University of Tartu', 'University of Tartu', 'Tartu University Hospital'],
  Poland: ['Medical University of Warsaw', 'Medical University of Warsaw', 'Jagiellonian University'],
  Germany: ['Charité Berlin', 'LMU Munich'],
  Finland: ['University of Helsinki', 'Helsinki University Hospital'],
  Ukraine: ['Bogomolets National Medical University', 'Lviv National Medical University'],
  Sweden: ['Karolinska Institutet'],
};
const LOCAL_AFFILIATIONS = [
  ['Vilnius University', 20], ['VU', 6], ['VU MF', 5], ['Vilniaus universitetas', 4],
  ['Vilnius University Faculty of Medicine', 3], ['Santaros klinikos', 9], ['VUL Santaros klinikos', 5],
  ['santaros klinikos', 2], ['LSMU', 6], ['Lithuanian University of Health Sciences', 3],
  ['Kauno klinikos', 4], ['Respublikinė Vilniaus universitetinė ligoninė', 4], ['RVUL', 2],
  ['Klaipėdos universitetinė ligoninė', 2], ['Vilniaus kolegija', 5], ['Vilniaus greitosios pagalbos stotis', 4],
  ['Vilniaus miesto klinikinė ligoninė', 3], ['Vilniaus gimnazija', 3], ['Vaikų ligoninė', 2],
  ['Utenos ligoninė', 1], ['Private practice', 1], ['', 2],
];
const LOCAL_AFFILIATION_WEIGHTS = LOCAL_AFFILIATIONS.map(([, weight]) => weight);

let cachedWorld = null;

// Everything that does not depend on "now". Built once: it is a pure function of the seed.
const getWorld = () => {
  if (cachedWorld) return cachedWorld;
  const rng = makeRng(hash32(1));

  const clinics = CLINICS.map((clinic, i) => ({ ...clinic, id: uid(KIND.clinic, 0, i) }));
  const teachers = TEACHERS.map((teacher, i) => ({
    ...teacher,
    id: uid(KIND.teacher, 0, i),
    clinicIds: teacher.clinics.map((clinicIndex) => clinics[clinicIndex].id),
  }));
  const simulators = SIMULATORS.map((sim, i) => ({ ...sim, id: uid(KIND.simulator, 0, i) }));
  const rooms = ROOMS.map((name, i) => ({ id: uid(KIND.room, 0, i), name }));

  const students = [];
  const groupMembers = new Map();
  COURSE_PLAN.forEach((plan) => {
    plan.groups.forEach((group) => groupMembers.set(`${plan.course}|${group}`, []));
    for (let i = 0; i < plan.students; i += 1) {
      const group = plan.groups[i % plan.groups.length];
      let groupText = group;
      const mess = rng.next();
      if (mess < 0.03) {
        groupText = ` ${group} `;
      } else if (mess < 0.06 && group.startsWith('MED-')) {
        groupText = group.toLowerCase();
      } else if (mess < 0.09 && group.startsWith('MED-0')) {
        // "MED-1" is another group for the matcher: this student never counts as class evidence.
        groupText = group.replace('MED-0', 'MED-');
      }
      const student = {
        id: uid(KIND.student, 0, students.length),
        groupKey: `${plan.course}|${group}`,
        reliability: rng.chance(plan.never) ? 0 : RELIABILITY[rng.weighted(RELIABILITY_WEIGHTS)],
        row: {
          course: rng.chance(0.1) ? rng.pick(COURSE_SPELLINGS)(plan.course) : plan.course,
          group_name: groupText,
          faculty: FACULTIES[rng.weighted(FACULTY_WEIGHTS)][0],
        },
      };
      students.push(student);
      groupMembers.get(`${plan.course}|${group}`).push(student);
    }
  });
  OTHER_STUDENTS.forEach((other) => {
    students.push({
      id: uid(KIND.student, 0, students.length),
      groupKey: null,
      reliability: 0.45,
      row: { course: other.course, group_name: other.group, faculty: other.faculty },
    });
  });

  const teachersByCourse = new Map(
    COURSE_PLAN.map((plan) => [
      plan.course,
      teachers.map((teacher, i) => (teacher.courses.includes(plan.course) ? i : -1)).filter((i) => i >= 0),
    ])
  );

  cachedWorld = {
    clinics,
    teachers,
    teachersByCourse,
    simulators,
    simByNumber: new Map(simulators.map((sim) => [sim.number, sim])),
    freeAccessNumbers: simulators.filter((sim) => sim.freeAccess).map((sim) => sim.number),
    allSimNumbers: simulators.map((sim) => sim.number),
    rooms,
    students,
    groupMembers,
    regulars: students.filter((student) => student.reliability >= 0.3),
    residents: RESIDENT_SPECIALTIES.map((specialty, i) => ({ id: uid(KIND.resident, 0, i), specialty })),
    guestUsers: GUEST_USERS.map((guest, i) => ({ ...guest, id: uid(KIND.guestUser, 0, i) })),
    deletedUserIds: [0, 1, 2, 3].map((i) => uid(KIND.deletedUser, 0, i)),
    eventIds: EVENT_PLAN.map((_, i) => uid(KIND.event, 0, i)),
  };
  return cachedWorld;
};

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------

const isHoliday = (cal) => HOLIDAYS.has((cal.month + 1) * 100 + cal.day);

const dayWeight = (cal) => {
  if (isHoliday(cal)) return 0;
  let weight = MONTH_WEIGHT[cal.month] * WEEKDAY_WEIGHT[cal.isoWeekday];
  if (cal.month === 0 && cal.day <= 5) weight = 0; // winter break
  if (cal.month === 11 && cal.day >= 20) weight *= 0.15;
  if (cal.month === 8 && cal.day <= 5) weight *= 0.4; // the term starts slowly
  if (cal.month === 5 && cal.day >= 20) weight *= 0.3;
  return weight;
};

const historyStartDay = (todayNum) => {
  const cal = calendarOf(todayNum);
  return Math.floor(Date.UTC(cal.year, cal.month - HISTORY_MONTHS, 1) / DAY);
};

// Adoption grows over the history, so a period usually beats the one before it.
const growthOf = (dayNum, startDay, todayNum) =>
  0.62 + 0.38 * clamp((dayNum - startDay) / Math.max(1, todayNum - 60 - startDay), 0, 1);

const buildEvents = (world, todayNum) =>
  EVENT_PLAN.map((plan, index) => {
    let dayNum = todayNum + EVENT_OFFSETS[index];
    const weekday = calendarOf(dayNum).isoWeekday;
    if (index < TODAY_EVENT_INDEX) {
      // Past events move back to Friday (or to Saturday for weekend courses): never onto today.
      if (plan.saturday) dayNum -= (weekday + 1) % 7;
      else if (weekday > 5) dayNum -= weekday - 5;
    } else if (index > TODAY_EVENT_INDEX && weekday > 5) {
      dayNum += 8 - weekday;
    }
    const staffIndexes = plan.teachers.length ? plan.teachers : [plan.staff].filter((i) => i !== undefined);
    return {
      index,
      id: world.eventIds[index],
      name: plan.name,
      dayNum,
      startMin: plan.start,
      endMin: plan.start + plan.dur,
      startMs: wallToUtcMs(dayNum, plan.start),
      endMs: wallToUtcMs(dayNum, plan.start + plan.dur),
      sims: plan.sims,
      rooms: plan.rooms,
      teacherIndexes: plan.teachers,
      staffIndexes,
      guests: world.guestUsers.filter((guest) => guest.event === index),
      quiet: Boolean(plan.quiet),
      intl: plan.intl,
      regs: plan.regs,
    };
  });

const makeBusy = () => {
  const map = new Map();
  return {
    isFree: (key, from, to) => {
      const list = map.get(key);
      return !list || list.every(([a, b]) => from >= b || to <= a);
    },
    occupy: (key, from, to) => {
      const list = map.get(key);
      if (list) list.push([from, to]);
      else map.set(key, [[from, to]]);
    },
  };
};

// ---------------------------------------------------------------------------
// One day of the center
// ---------------------------------------------------------------------------

/**
 * mode 'past' | 'today' | 'future'. Returns DB-shaped rows of that day plus the class plans
 * (needed for the live "booked now" rows). The whole day is simulated first and then looked
 * at from `nowMs`: rows that have not started yet are left out, rows still running are open.
 */
function simulateDay(world, dayNum, { mode, nowMs, events, legacy, earlyDays, growth, ensureClass }) {
  const dayRng = makeRng(hash32(11, dayNum));
  let rng = dayRng;
  const cal = calendarOf(dayNum);
  const dayStartMs = wallToUtcMs(dayNum, 0);
  const at = (minuteOfDay) => wallToUtcMs(dayNum, minuteOfDay);
  const minuteAt = (ms) => (ms - dayStartMs) / MIN;
  const isToday = mode === 'today';
  const hasActivity = mode !== 'future';

  const busy = makeBusy(); // bookings in wall minutes (t:, g:, s:, r:) and NFC use in ms (u:, p:)
  const plans = [];
  const visits = [];
  const visitsByUser = new Map();
  const sessions = [];

  // ---- bookings -----------------------------------------------------------

  events.forEach((event) => {
    event.sims.forEach((number) => busy.occupy(`s:${number}`, event.startMin, event.endMin));
    event.rooms.forEach((name) => busy.occupy(`r:${name}`, event.startMin, event.endMin));
    event.staffIndexes.forEach((i) => busy.occupy(`t:${i}`, event.startMin - 30, event.endMin + 30));
  });

  const book = (plan) => {
    plan.id = uid(KIND.schedule, dayNum, plan.index);
    busy.occupy(`t:${plan.teacher}`, plan.startMin - 15, plan.endMin + 15);
    plan.groups.forEach((group) => busy.occupy(`g:${plan.course}|${group}`, plan.startMin - 15, plan.endMin + 15));
    plan.sims.forEach((number) => busy.occupy(`s:${number}`, plan.startMin, plan.endMin));
    plan.rooms.forEach((name) => busy.occupy(`r:${name}`, plan.startMin, plan.endMin));
    plans.push(plan);
  };

  const planRandomClass = (index) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const coursePlan = COURSE_PLAN[rng.weighted(COURSE_WEIGHTS)];
      const startMin = SLOT_STARTS[rng.weighted(SLOT_WEIGHTS)];
      let duration = DURATIONS[rng.weighted(DURATION_WEIGHTS)];
      while (startMin + duration > LAST_CLASS_END_MIN && duration > 60) duration -= 30;
      const endMin = startMin + duration;

      const freeTeachers = world.teachersByCourse
        .get(coursePlan.course)
        .filter((i) => busy.isFree(`t:${i}`, startMin, endMin));
      const freeGroups = rng
        .shuffled(coursePlan.groups)
        .filter((group) => busy.isFree(`g:${coursePlan.course}|${group}`, startMin, endMin));
      if (freeTeachers.length && freeGroups.length) {
        const teacherIndex = freeTeachers[rng.weighted(freeTeachers.map((i) => world.teachers[i].weight))];
        const teacher = world.teachers[teacherIndex];
        const groupCount = [1, 2, 3][rng.weighted([0.15, 0.5, 0.35])];

        // The app pre-ticks every simulator the teacher may use; some teachers untick a few.
        let sims = teacher.sims.filter((number) => busy.isFree(`s:${number}`, startMin, endMin));
        if (sims.length > 1 && rng.chance(0.25)) {
          const keep = new Set(rng.shuffled(sims).slice(0, rng.int(1, sims.length - 1)));
          sims = sims.filter((number) => keep.has(number));
        }
        const freeRooms = teacher.rooms.filter((name) => busy.isFree(`r:${name}`, startMin, endMin));
        const roomCount = Math.min(freeRooms.length, [0, 1, 2][rng.weighted([0.1, 0.72, 0.18])]);
        let rooms = [];
        for (let k = 0; k < roomCount; k += 1) {
          const left = freeRooms.filter((name) => !rooms.includes(name));
          rooms.push(left[rng.weighted(ROOM_PICK_WEIGHTS.slice(0, left.length))]);
        }
        if (legacy) {
          if (rng.chance(0.35)) sims = [REMOVED_SIMULATORS[0], ...sims];
          if (rng.chance(0.08)) sims = [...sims, REMOVED_SIMULATORS[1]];
          if (rng.chance(0.4)) rooms = [rng.pick(UNLISTED_ROOMS)];
        }
        return {
          index,
          teacher: teacherIndex,
          course: coursePlan.course,
          groups: freeGroups.slice(0, groupCount).sort(),
          startMin,
          endMin,
          sims,
          rooms,
          needsAssistance: rng.chance(0.12),
          noShow: mode === 'past' && rng.chance(0.08),
          used: null,
        };
      }
    }
    return null;
  };

  if (isToday) {
    TODAY_PLAN.forEach((plan, index) => {
      book({ ...plan, index, needsAssistance: Boolean(plan.needsAssistance), noShow: false });
    });
  } else {
    const weight = dayWeight(cal);
    let count = weight > 0 ? rng.poisson(CLASSES_PER_DAY * weight * growth) : 0;
    if (ensureClass) count = Math.max(count, 1);
    for (let i = 0; i < count; i += 1) {
      const plan = planRandomClass(i);
      if (plan) book(plan);
    }
  }

  // ---- NFC activity -------------------------------------------------------

  // A class nobody came to must stay without NFC evidence: neither its teacher nor a student
  // of its groups is inside during its time, or the status inference would call it held.
  const quietClasses = plans
    .filter((plan) => plan.noShow)
    .map((plan) => ({
      fromMs: at(plan.startMin),
      toMs: at(plan.endMin),
      teacherId: world.teachers[plan.teacher].id,
      groupKeys: new Set(plan.groups.map((group) => `${plan.course}|${group}`)),
    }));
  const concerns = (quiet, userId, groupKey) => quiet.teacherId === userId || quiet.groupKeys.has(groupKey);

  // Arrive after an earlier quiet class would have ended, leave before a later one would start.
  // `plain` = such a visit also gets no tap defects: a forgotten tap-out is counted with the
  // typical visit length, which could reach into the quiet class.
  const aroundQuietClasses = (userId, groupKey, entryMs, exitMs, classStartMs, classEndMs) => {
    let fromMs = entryMs;
    let toMs = exitMs;
    let plain = false;
    quietClasses.forEach((quiet) => {
      if (!concerns(quiet, userId, groupKey)) return;
      plain = true;
      if (quiet.toMs <= classStartMs) fromMs = Math.max(fromMs, quiet.toMs + 30000);
      else if (quiet.fromMs >= classEndMs) toMs = Math.min(toMs, quiet.fromMs - 30000);
    });
    return { fromMs, toMs, plain };
  };

  const resolve = (visit) => (visit.into ? resolve(visit.into) : visit);

  // Someone with two classes in a row stays inside: visits closer than 20 minutes are one visit.
  const touches = (a, b) => a.entryMs <= b.exitMs + 20 * MIN && a.exitMs >= b.entryMs - 20 * MIN;
  const addVisit = (userId, entryMs, exitMs) => {
    let list = visitsByUser.get(userId);
    if (!list) {
      list = [];
      visitsByUser.set(userId, list);
    }
    const entry = Math.max(entryMs, dayStartMs + 1000);
    const exit = Math.max(exitMs, entry + MIN);
    const fresh = { userId, entryMs: entry, exitMs: exit, forgot: false, plain: false, into: null };
    const open = list.filter((other) => !other.into && !other.forgot);
    const kept = open.find((other) => touches(fresh, other));
    if (!kept) {
      list.push(fresh);
      visits.push(fresh);
      return fresh;
    }
    kept.entryMs = Math.min(kept.entryMs, fresh.entryMs);
    kept.exitMs = Math.max(kept.exitMs, fresh.exitMs);
    // The longer visit may now reach another one of the same person: fold that in as well.
    let folded = true;
    while (folded) {
      folded = false;
      open.forEach((other) => {
        if (other === kept || other.into || !touches(kept, other)) return;
        kept.entryMs = Math.min(kept.entryMs, other.entryMs);
        kept.exitMs = Math.max(kept.exitMs, other.exitMs);
        kept.plain = kept.plain || other.plain;
        other.into = kept;
        folded = true;
      });
    }
    return kept;
  };

  const addClassVisit = (userId, groupKey, entryMs, exitMs, classStartMs, classEndMs) => {
    const { fromMs, toMs, plain } = aroundQuietClasses(userId, groupKey, entryMs, exitMs, classStartMs, classEndMs);
    const visit = addVisit(userId, fromMs, toMs);
    if (plain) visit.plain = true;
    return visit;
  };

  const hasVisitNear = (userId, fromMs, toMs) =>
    (visitsByUser.get(userId) || []).some((visit) => !visit.into && touches({ entryMs: fromMs, exitMs: toMs }, visit));

  const pickPresent = (people, fromMs, toMs) => {
    for (let attempt = 0; attempt < 6 && people.length; attempt += 1) {
      const person = rng.pick(people);
      const visit = resolve(person.visit);
      const inside = visit.entryMs <= fromMs && visit.exitMs >= toMs;
      if (inside && busy.isFree(`p:${person.userId}`, fromMs, toMs)) return person;
    }
    return null;
  };

  const addSession = (number, person, startMs, endMs) => {
    busy.occupy(`u:${number}`, startMs, endMs);
    busy.occupy(`p:${person.userId}`, startMs, endMs);
    sessions.push({ number, userId: person.userId, visit: person.visit, startMs, endMs });
  };

  // One simulator during a class: students take turns, one tap after another.
  const runChain = (number, people, fromMs, toMs, { gapless, medianMin, sigma, minMin, maxMin, pauseMs }) => {
    let t = fromMs;
    while (t < toMs - minMin * MIN) {
      if (!gapless && rng.chance(0.04)) {
        // Accidental tap: the next student taps a few seconds later and the app ends it.
        const slip = busy.isFree(`u:${number}`, t, t + MIN) ? pickPresent(people, t, t + MIN) : null;
        if (slip) {
          const slipEnd = t + rng.int(6000, 50000);
          addSession(number, slip, t, slipEnd);
          t = slipEnd;
        }
      }
      const endMs = Math.min(t + Math.round(clamp(rng.logNormal(medianMin, sigma), minMin, maxMin) * MIN), toMs);
      const person = busy.isFree(`u:${number}`, t, endMs) ? pickPresent(people, t, endMs) : null;
      if (!person) {
        t += 5 * MIN;
      } else {
        addSession(number, person, t, endMs);
        // A new tap ends the previous session at the same instant; otherwise "End session" comes first.
        t = gapless || rng.chance(0.45) ? endMs : endMs + rng.int(pauseMs[0], pauseMs[1]);
      }
    }
  };

  const runClass = (plan) => {
    const startMs = at(plan.startMin);
    const endMs = at(plan.endMin);
    const people = [];
    // A class that starts right after the evening job ran: a tap-in before the job would have
    // been closed by it, so everybody taps in after it.
    const jobMs = nextCronCloseMs(startMs - 15 * MIN);
    const arrival = (entryMs) => (jobMs <= startMs && entryMs <= jobMs ? jobMs + rng.int(20000, 4 * MIN) : entryMs);

    plan.groups.forEach((group) => {
      world.groupMembers.get(`${plan.course}|${group}`).forEach((student) => {
        if (!rng.chance(student.reliability * ATTENDANCE)) return;
        const late = rng.chance(0.1);
        const entryMs = late ? startMs + rng.int(MIN, 15 * MIN) : startMs - rng.int(MIN, 14 * MIN);
        const leftEarly = rng.chance(0.05);
        const exitMs = leftEarly
          ? startMs + Math.round((endMs - startMs) * (0.5 + rng.next() * 0.3))
          : endMs + rng.int(0, 20 * MIN);
        const visit = addClassVisit(student.id, student.groupKey, arrival(entryMs), exitMs, startMs, endMs);
        people.push({ userId: student.id, visit });
      });
    });

    if (isToday || rng.chance(0.85)) {
      let entryMs = startMs - rng.int(8 * MIN, 30 * MIN);
      let exitMs = endMs + rng.int(3 * MIN, 35 * MIN);
      if (!isToday && rng.chance(0.05)) {
        // A whole working day in the center: longer than the 8 h a visit may count for.
        entryMs = Math.min(entryMs, at(470) + rng.int(0, 25 * MIN));
        exitMs = Math.max(exitMs, at(1040) + rng.int(0, 80 * MIN));
      }
      const teacherId = world.teachers[plan.teacher].id;
      const visit = addClassVisit(teacherId, null, arrival(entryMs), exitMs, startMs, endMs);
      people.push({ userId: teacherId, visit, isTeacher: true });
    }

    const students = people.filter((person) => !person.isTeacher);
    // Booked is not used: every simulator has its own chance to see an NFC tap during a class.
    const used =
      plan.used ||
      plan.sims.filter((number) => {
        const sim = world.simByNumber.get(number);
        return sim && rng.chance(sim.useWeight);
      });
    used.forEach((number) => {
      const chainStart = startMs + rng.int(3 * MIN, isToday ? 6 * MIN : 12 * MIN);
      runChain(number, students, chainStart, endMs - 2 * MIN, {
        gapless: isToday,
        medianMin: 19,
        sigma: 0.33,
        minMin: 4,
        maxMin: 50,
        pauseMs: [20000, 3 * MIN],
      });
    });
  };

  const runEvent = (event) => {
    const people = [];
    event.staffIndexes.forEach((i) => {
      const teacherId = world.teachers[i].id;
      const entryMs = event.startMs - rng.int(10 * MIN, 30 * MIN);
      const exitMs = event.endMs + rng.int(5 * MIN, 25 * MIN);
      people.push({ userId: teacherId, visit: addVisit(teacherId, entryMs, exitMs) });
    });
    event.guests.forEach((guest) => {
      const entryMs = event.startMs - rng.int(5 * MIN, 20 * MIN);
      const exitMs = event.endMs - rng.int(0, 40 * MIN);
      people.push({ userId: guest.id, visit: addVisit(guest.id, entryMs, exitMs) });
    });
    // Today's event brings people in but leaves its simulators idle, so that "in use now"
    // stays at the two or three sessions a normal teaching hour has.
    if (isToday) return;
    const lastEndMs = Math.min(event.endMs - 30 * MIN, nextCronCloseMs(event.startMs) - 5 * MIN);
    event.sims.forEach((number) => {
      runChain(number, people, event.startMs + rng.int(20 * MIN, 50 * MIN), lastEndMs, {
        gapless: false,
        medianMin: 28,
        sigma: 0.4,
        minMin: 10,
        maxMin: 60,
        pauseMs: [5 * MIN, 30 * MIN],
      });
    });
  };

  // Self-study on free-access simulators, residents, and (early on) accounts deleted since.
  const runFreePractice = () => {
    const roll = rng.next();
    let userId;
    let groupKey = null;
    let candidates = world.freeAccessNumbers;
    let lengthMin = rng.int(35, 150);
    if (earlyDays && roll < 0.12) {
      userId = rng.pick(world.deletedUserIds);
    } else if (roll < 0.22) {
      userId = rng.pick(world.residents).id;
      candidates = world.allSimNumbers;
      lengthMin = rng.int(60, 200);
    } else {
      const student = rng.pick(world.regulars);
      userId = student.id;
      groupKey = student.groupKey;
    }
    const entryMs = at(rng.int(540, 990)) + rng.int(0, 59000);
    const exitMs = entryMs + lengthMin * MIN + rng.int(0, 59000);
    if (hasVisitNear(userId, entryMs, exitMs)) return;
    const duringQuietClass = quietClasses.some(
      (quiet) => concerns(quiet, userId, groupKey) && entryMs < quiet.toMs && exitMs > quiet.fromMs
    );
    if (duringQuietClass) return;
    const person = { userId, visit: addVisit(userId, entryMs, exitMs) };

    const wanted = isToday ? 0 : [0, 1, 2, 3][rng.weighted([0.4, 0.35, 0.18, 0.07])];
    let t = entryMs + rng.int(3 * MIN, 10 * MIN);
    for (let k = 0; k < wanted; k += 1) {
      const endMs = t + Math.round(clamp(rng.logNormal(24, 0.5), 5, 90) * MIN);
      if (endMs > exitMs - 2 * MIN) break;
      const fromMin = minuteAt(t) - 5;
      const toMin = minuteAt(endMs) + 5;
      const number = rng
        .shuffled(candidates)
        .find((n) => busy.isFree(`s:${n}`, fromMin, toMin) && busy.isFree(`u:${n}`, t - MIN, endMs + MIN));
      if (number) addSession(number, person, t, endMs);
      t = endMs + rng.int(MIN, 6 * MIN);
    }
  };

  // A student who sits in one of today's classes is not also queueing at the IV arm.
  const hasClassAround = (student, fromMs, toMs) =>
    plans.some(
      (plan) =>
        at(plan.startMin) - 20 * MIN < toMs &&
        at(plan.endMin) + 25 * MIN > fromMs &&
        plan.groups.some((group) => world.groupMembers.get(`${plan.course}|${group}`).includes(student))
    );

  // Today only: a steady queue at the IV arm and a resident in for the day, so that the
  // live numbers never drop to zero between classes.
  const runTodayExtras = () => {
    let t = at(545) + rng.int(0, 5 * MIN);
    const lastStart = at(TODAY_LAST_END_MIN - 30);
    while (t < lastStart) {
      const endMs = t + rng.int(14 * MIN, 28 * MIN);
      const entryMs = t - rng.int(3 * MIN, 9 * MIN);
      const exitMs = endMs + rng.int(2 * MIN, 12 * MIN);
      const student = rng
        .shuffled(world.regulars)
        .find((one) => !hasVisitNear(one.id, entryMs, exitMs) && !hasClassAround(one, entryMs, exitMs));
      if (student) {
        const person = { userId: student.id, visit: addVisit(student.id, entryMs, exitMs) };
        addSession(TODAY_FREE_CHAIN_SIM, person, t, endMs);
      }
      t = endMs + rng.int(MIN, 4 * MIN);
    }
    addVisit(world.residents[0].id, at(550) + rng.int(0, 9 * MIN), at(1000) + rng.int(0, 20 * MIN));
  };

  // Outside today's timetable one more class sits on the block around "now". It is added
  // last and draws from its own seed, so the rest of the day does not reshuffle when the
  // block moves on.
  const runKeepAliveClass = () => {
    const nowMin = minuteOfDayOf(nowMs);
    if (nowMin >= TODAY_FIRST_START_MIN && nowMin < TODAY_LAST_END_MIN) return;
    const block = KEEP_ALIVE_EDGES.findIndex((edge, i) => nowMin >= edge && nowMin < KEEP_ALIVE_EDGES[i + 1]);
    if (block < 0) return;
    const plan = {
      ...KEEP_ALIVE_CLASS,
      index: 90 + block,
      startMin: KEEP_ALIVE_EDGES[block],
      endMin: Math.min(KEEP_ALIVE_EDGES[block + 1], 23 * 60 + 59),
      needsAssistance: false,
      noShow: false,
    };
    book(plan);
    rng = makeRng(hash32(12, dayNum, block));
    runClass(plan);
    rng = dayRng;
  };

  if (hasActivity) {
    plans.sort((a, b) => a.startMin - b.startMin || a.index - b.index);
    plans.forEach((plan) => {
      if (!plan.noShow) runClass(plan);
    });
    events.forEach((event) => {
      if (!event.quiet) runEvent(event);
    });
    if (isToday) runTodayExtras();

    const weight = dayWeight(cal);
    const quietDayMean = cal.isoWeekday <= 5 && !isHoliday(cal) ? 0.3 : 0;
    const freeCount = rng.poisson(isToday ? 3 : FREE_PRACTICE_PER_DAY * weight * growth + quietDayMean);
    for (let i = 0; i < freeCount; i += 1) runFreePractice();

    if (mode === 'past' && weight > 0 && rng.chance(0.015)) {
      // Tapped in after the evening job: the visit stays open until the job runs again.
      const entryMs = at(rng.int(1205, 1250)) + rng.int(0, 59000);
      addVisit(rng.pick(world.regulars).id, entryMs, entryMs + 30 * MIN).forgot = true;
    }
    if (isToday) runKeepAliveClass();
  }
  plans.sort((a, b) => a.startMin - b.startMin || a.index - b.index);

  // ---- rows, with the defects of real tap data ----------------------------

  const visitRows = [];
  let visitSeq = 0;
  const pushVisitRow = (userId, entryMs, exitMs) => {
    const id = uid(KIND.visit, dayNum, visitSeq);
    visitSeq += 1;
    if (entryMs > nowMs) return;
    const exitTime = exitMs > nowMs ? null : iso(exitMs);
    visitRows.push({ ms: entryMs, row: { id, user_id: userId, entry_time: iso(entryMs), exit_time: exitTime } });
  };

  visits.forEach((visit) => {
    if (visit.into) return;
    const roll = visit.plain ? 1 : rng.next();
    const jobMs = nextCronCloseMs(visit.entryMs);
    if (visit.forgot || roll < 0.07 || visit.exitMs > jobMs) {
      // Forgot to tap out, or still inside in the evening: the 20:00 job closes the visit.
      visit.forgot = true;
      visit.exitMs = jobMs;
    } else if (roll < 0.083) {
      // Double tap at the entrance: the exit tap closes only the newer row, the job closes the other.
      const firstTapMs = Math.max(visit.entryMs - rng.int(15000, 70000), dayStartMs);
      pushVisitRow(visit.userId, firstTapMs, nextCronCloseMs(firstTapMs));
    } else if (roll < 0.098) {
      // Accidental tap a few minutes earlier, closed within a minute.
      const tapMs = Math.max(visit.entryMs - rng.int(2 * MIN, 6 * MIN), dayStartMs);
      const tapEndMs = tapMs + rng.int(8000, 50000);
      if (!isJobMinute(tapEndMs)) pushVisitRow(visit.userId, tapMs, tapEndMs);
    }
    if (!visit.forgot && isJobMinute(visit.exitMs)) visit.exitMs += MIN;
    pushVisitRow(visit.userId, visit.entryMs, visit.exitMs);
  });

  // The last session of the day on a simulator has nobody to end it: it runs until the
  // person's exit tap (database trigger) or, without one, until the evening job. Not today:
  // "in use now" should show the running classes, not a forgotten session from the morning.
  const tailRng = makeRng(hash32(15, dayNum));
  const lastBySim = new Map();
  sessions.forEach((session) => {
    const last = lastBySim.get(session.number);
    if (!last || session.startMs > last.startMs) lastBySim.set(session.number, session);
  });
  lastBySim.forEach((session) => {
    const visit = resolve(session.visit);
    const roll = tailRng.next();
    const usesAnotherLater = sessions.some(
      (other) => other.userId === session.userId && other.startMs >= session.endMs
    );
    if (isToday || usesAnotherLater) return;
    if (visit.forgot ? roll < 0.6 : roll < 0.2 && visit.exitMs - session.startMs < 100 * MIN) {
      session.endMs = Math.max(session.endMs, visit.exitMs);
      session.closedWithVisit = true;
    }
  });

  const sessionRows = [];
  sessions.forEach((session, i) => {
    if (session.startMs > nowMs) return;
    const longEnough = session.endMs - session.startMs > 2 * MIN;
    if (!session.closedWithVisit && longEnough && isJobMinute(session.endMs)) session.endMs -= MIN;
    sessionRows.push({
      ms: session.startMs,
      row: {
        id: uid(KIND.session, dayNum, i),
        simulator_id: world.simByNumber.get(session.number).id,
        user_id: session.userId,
        start_time: iso(session.startMs),
        end_time: session.endMs > nowMs ? null : iso(session.endMs),
      },
    });
  });

  const byTimeThenId = (a, b) => a.ms - b.ms || (a.row.id < b.row.id ? -1 : 1);
  const date = dateStr(dayNum);
  return {
    plans,
    classRows: plans.map((plan) => ({
      id: plan.id,
      teacher_id: world.teachers[plan.teacher].id,
      session_date: date,
      start_time: timeStr(plan.startMin),
      end_time: timeStr(plan.endMin),
      course: plan.course,
      groups: [...plan.groups],
      simulators: [...plan.sims],
      rooms: [...plan.rooms],
      needs_assistance: plan.needsAssistance,
    })),
    visitRows: visitRows.sort(byTimeThenId).map((entry) => entry.row),
    sessionRows: sessionRows.sort(byTimeThenId).map((entry) => entry.row),
  };
}

const TODAY_OPTIONS = { mode: 'today', legacy: false, earlyDays: false, growth: 1, ensureClass: false };

const simulateToday = (world, nowMs) => {
  const todayNum = dayNumOf(nowMs);
  const events = buildEvents(world, todayNum).filter((event) => event.dayNum === todayNum);
  return { ...simulateDay(world, todayNum, { ...TODAY_OPTIONS, nowMs, events }), todayNum, events };
};

// ---------------------------------------------------------------------------
// Anonymous guest registrations (public sign-in form)
// ---------------------------------------------------------------------------

const makeGuestRegistration = (rng, dayNum, seq, createdMs, intl) => {
  const abroad = rng.chance(intl);
  const country = abroad ? FOREIGN_COUNTRIES[rng.weighted(FOREIGN_COUNTRY_WEIGHTS)] : 'Lithuania';
  return {
    ms: createdMs,
    row: {
      id: uid(KIND.guestReg, dayNum, seq),
      // Rows from before the form had a fixed country list.
      country: !abroad && rng.chance(0.04) ? 'lithuania' : country,
      affiliation: abroad
        ? rng.pick(FOREIGN_AFFILIATIONS[country])
        : LOCAL_AFFILIATIONS[rng.weighted(LOCAL_AFFILIATION_WEIGHTS)][0],
      created_at: iso(createdMs),
    },
  };
};

const makeGuestRows = (events, startDay, todayNum, nowMs) => {
  const entries = [];
  events.forEach((event) => {
    if (event.dayNum > todayNum) return;
    const rng = makeRng(hash32(13, event.index));
    for (let i = 0; i < event.regs; i += 1) {
      // Most people fill the form at the door; some the evening before.
      const createdMs = rng.chance(0.2)
        ? wallToUtcMs(event.dayNum - 1, rng.int(1020, 1320)) + rng.int(0, 59999)
        : wallToUtcMs(event.dayNum, event.startMin + rng.int(-50, 40)) + rng.int(0, 59999);
      entries.push(makeGuestRegistration(rng, event.dayNum, i, createdMs, event.intl));
    }
  });
  for (let dayNum = startDay; dayNum <= todayNum; dayNum += 1) {
    if (calendarOf(dayNum).isoWeekday <= 5) {
      const rng = makeRng(hash32(14, dayNum));
      const count = rng.chance(0.13) ? rng.int(1, 2) : 0;
      for (let i = 0; i < count; i += 1) {
        const createdMs = wallToUtcMs(dayNum, rng.int(540, 960)) + rng.int(0, 59999);
        entries.push(makeGuestRegistration(rng, dayNum, 500 + i, createdMs, 0.12));
      }
    }
  }
  return entries
    .filter((entry) => entry.ms <= nowMs)
    .sort((a, b) => a.ms - b.ms || (a.row.id < b.row.id ? -1 : 1))
    .map((entry) => entry.row);
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const assertNow = (nowMs) => {
  if (!Number.isFinite(nowMs)) throw new TypeError('demoData: nowMs must be a finite epoch-millisecond number');
};

/**
 * Raw rows of the reference queries R1–R8 (plus `university` where the table has that column).
 * Clinics and guest users include one row each that does not belong to the university, so the
 * Reference builder's scoping is exercised too.
 */
export function makeDemoReferenceRows() {
  const world = getWorld();
  return {
    students: world.students.map((student) => ({ id: student.id, ...student.row, university: UNIVERSITY })),
    teachers: world.teachers.map((teacher) => ({
      id: teacher.id,
      name: teacher.name,
      surname: teacher.surname,
      clinic_ids: [...teacher.clinicIds],
      university: UNIVERSITY,
    })),
    residents: world.residents.map((resident) => ({
      id: resident.id,
      specialty: resident.specialty,
      university: UNIVERSITY,
    })),
    clinics: world.clinics.map((clinic) => ({ id: clinic.id, name: clinic.name, university: clinic.university })),
    eventCodes: world.eventIds.map((id) => ({ id, university: UNIVERSITY })),
    guestUsers: [
      ...world.guestUsers.map((guest) => ({
        id: guest.id,
        code_id: world.eventIds[guest.event],
        university: guest.university,
      })),
      { id: uid(KIND.foreign, 0, 1), code_id: uid(KIND.foreign, 0, 2), university: 'Test University' },
    ],
    simulators: world.simulators.map((sim) => ({
      id: sim.id,
      number: sim.number,
      name: sim.name,
      free_access: sim.freeAccess,
      university: UNIVERSITY,
    })),
    rooms: world.rooms.map((room) => ({ id: room.id, name: room.name, university: UNIVERSITY })),
  };
}

/** Full history (queries H1–H5): about 16 months up to `nowMs`, plus classes and events of the next 4 weeks. */
export function makeDemoRaw(nowMs) {
  assertNow(nowMs);
  const world = getWorld();
  const todayNum = dayNumOf(nowMs);
  const startDay = historyStartDay(todayNum);
  const events = buildEvents(world, todayNum);
  const eventsByDay = new Map();
  events.forEach((event) => eventsByDay.set(event.dayNum, [...(eventsByDay.get(event.dayNum) || []), event]));

  const centerSessions = [];
  const simSessions = [];
  const schedules = [];
  let ensuredUpcoming = 0;

  for (let dayNum = startDay; dayNum <= todayNum + UPCOMING_DAYS; dayNum += 1) {
    const dayEvents = eventsByDay.get(dayNum) || [];
    let day;
    if (dayNum === todayNum) {
      day = simulateDay(world, dayNum, { ...TODAY_OPTIONS, nowMs, events: dayEvents });
    } else {
      const future = dayNum > todayNum;
      const cal = calendarOf(dayNum);
      // The coming weeks always hold a few classes, whatever the season.
      const ensureClass = future && ensuredUpcoming < 6 && cal.isoWeekday <= 5 && !isHoliday(cal);
      if (ensureClass) ensuredUpcoming += 1;
      day = simulateDay(world, dayNum, {
        mode: future ? 'future' : 'past',
        nowMs,
        events: dayEvents,
        legacy: dayNum < startDay + LEGACY_DAYS,
        earlyDays: dayNum < startDay + 150,
        growth: future ? 1 : growthOf(dayNum, startDay, todayNum),
        ensureClass,
      });
    }
    centerSessions.push(...day.visitRows);
    simSessions.push(...day.sessionRows);
    schedules.push(...day.classRows);
  }

  return {
    centerSessions,
    simSessions,
    schedules,
    events: [...events]
      .sort((a, b) => a.startMs - b.startMs || (a.id < b.id ? -1 : 1))
      .map((event) => ({
        id: event.id,
        event_name: event.name,
        allowed_simulators: [...event.sims],
        rooms: [...event.rooms],
        teacher_ids: event.teacherIndexes.map((i) => world.teachers[i].id),
        starts_at: iso(event.startMs),
        ends_at: iso(event.endMs),
      })),
    guests: makeGuestRows(events, startDay, todayNum, nowMs),
  };
}

/**
 * Live rows at `nowMs`: today's visits, open simulator sessions, and what the RPC
 * resource_availability(now, now + 1 min) would return (one row per busy simulator or room).
 */
export function makeDemoLive(nowMs) {
  assertNow(nowMs);
  const world = getWorld();
  const today = simulateToday(world, nowMs);
  const untilMs = nowMs + MIN;

  const busyNow = [];
  const addBusy = (source, sourceId, label, startMs, endMs, sims, rooms) => {
    if (startMs >= untilMs || endMs <= nowMs) return;
    const base = { busy_from: iso(startMs), busy_until: iso(endMs), source, source_id: sourceId, label };
    sims.forEach((number) => busyNow.push({ resource_type: 'simulator', resource_key: number, ...base }));
    rooms.forEach((name) => busyNow.push({ resource_type: 'room', resource_key: name, ...base }));
  };
  today.plans.forEach((plan) => {
    const teacher = world.teachers[plan.teacher];
    addBusy(
      'class',
      plan.id,
      `${teacher.surname} ${teacher.name}`,
      wallToUtcMs(today.todayNum, plan.startMin),
      wallToUtcMs(today.todayNum, plan.endMin),
      plan.sims,
      plan.rooms
    );
  });
  today.events.forEach((event) => {
    addBusy('event', event.id, event.name, event.startMs, event.endMs, event.sims, event.rooms);
  });
  busyNow.sort(
    (a, b) =>
      a.resource_type.localeCompare(b.resource_type) ||
      a.resource_key.localeCompare(b.resource_key) ||
      (a.busy_from < b.busy_from ? -1 : a.busy_from > b.busy_from ? 1 : 0)
  );

  return {
    centerSessionsToday: today.visitRows,
    openSimSessions: today.sessionRows
      .filter((row) => row.end_time === null)
      .map((row) => ({ id: row.id, simulator_id: row.simulator_id, user_id: row.user_id, start_time: row.start_time })),
    busyNow,
  };
}
