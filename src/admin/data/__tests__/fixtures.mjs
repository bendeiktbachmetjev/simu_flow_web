// Shared test fixtures for the pure data zone. Run with TZ=Europe/Vilnius.
// makeRef() builds a Reference by hand in exactly the shape loadReference produces
// (spec §4b); makeRaw() builds the raw table bundle buildDataset() takes.
import moment from 'moment';
import { shortName } from '../../../components/timeline/model.js';

export const UNIVERSITY = 'Vilnius University';

// --- time helpers -----------------------------------------------------------------------
// 'YYYY-MM-DD HH:mm' on the Vilnius wall clock → epoch ms / ISO string (UTC, like PostgREST).
export const localMs = (wallClock) => moment(wallClock, 'YYYY-MM-DD HH:mm').valueOf();
export const localIso = (wallClock) => new Date(localMs(wallClock)).toISOString();
// ISO string with an explicit zone → epoch ms.
export const utcMs = (iso) => Date.parse(iso);

// --- reference --------------------------------------------------------------------------
const DEFAULT_CLINICS = [
  { id: 'c-pulmo', name: 'Pulmonologijos klinika' },
  { id: 'c-surgery', name: 'Abdominalinės chirurgijos klinika' },
];

const DEFAULT_TEACHERS = [
  { id: 't1', name: 'Vaida', surname: 'Petrauskienė', clinicIds: ['c-pulmo'] },
  { id: 't2', name: 'Jonas', surname: 'Kazlauskas', clinicIds: ['c-pulmo', 'c-surgery'] },
];

const DEFAULT_STUDENTS = [
  { id: 's1', course: '3', faculty: 'Medicine', groupKey: '5' },
  { id: 's2', course: '3', faculty: 'Medicine', groupKey: '5' },
  { id: 's3', course: '3', faculty: 'Medicine', groupKey: '6' },
  { id: 's4', course: '1', faculty: 'Medicine', groupKey: '1' },
  { id: 's5', course: '5', faculty: 'Medicine', groupKey: 'med-08' },
  { id: 's6', course: 'Other', faculty: 'Life Sciences Centre', groupKey: 'molecular biology' },
];

const DEFAULT_RESIDENTS = [{ id: 'r1' }];
const DEFAULT_GUEST_USERS = [{ id: 'g1', codeId: 'e1' }];

const DEFAULT_SIMULATORS = [
  { id: 'sim-2', number: '2', name: 'SimMan 3G' },
  { id: 'sim-3', number: '3', name: 'Resusci Anne' },
  { id: 'sim-4', number: '4', name: 'SimBaby' },
  { id: 'sim-x1', number: 'X1', name: 'Ultrasound trainer' },
];

const DEFAULT_ROOMS = [
  { id: 'room-a206', name: 'A2-06' },
  { id: 'room-a219', name: 'A2-19' },
  { id: 'room-c204', name: 'C2-04' },
];

const indexBy = (list, keyOf) => new Map(list.map((item) => [keyOf(item), item]));

// Every list can be replaced: makeRef({ simulators: [...], students: [...] }).
export const makeRef = (overrides = {}) => {
  const clinics = (overrides.clinics || DEFAULT_CLINICS).map((c) => ({ id: c.id, name: c.name }));
  const teachers = (overrides.teachers || DEFAULT_TEACHERS).map((t) => ({
    id: t.id,
    name: t.name,
    surname: t.surname,
    fullName: `${t.name} ${t.surname}`.trim(),
    shortName: shortName(t.name, t.surname),
    clinicIds: t.clinicIds || [],
  }));
  const students = (overrides.students || DEFAULT_STUDENTS).map((s) => ({
    id: s.id,
    course: s.course,
    faculty: s.faculty,
    groupKey: s.groupKey,
  }));
  const residents = (overrides.residents || DEFAULT_RESIDENTS).map((r) => ({ id: r.id }));
  const guestUsers = (overrides.guestUsers || DEFAULT_GUEST_USERS).map((g) => ({ id: g.id, codeId: g.codeId }));
  const simulators = (overrides.simulators || DEFAULT_SIMULATORS)
    .map((s) => ({ id: s.id, number: String(s.number), name: s.name, label: `No. ${s.number} · ${s.name}` }))
    .sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
  const rooms = (overrides.rooms || DEFAULT_ROOMS)
    .map((r) => ({ id: r.id, name: r.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Precedence teacher > resident > student > guest: the strongest role is written last.
  const roleByUserId = new Map();
  guestUsers.forEach((g) => roleByUserId.set(g.id, 'guest'));
  students.forEach((s) => roleByUserId.set(s.id, 'student'));
  residents.forEach((r) => roleByUserId.set(r.id, 'resident'));
  teachers.forEach((t) => roleByUserId.set(t.id, 'teacher'));

  const byCourse = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, Other: 0 };
  const byFaculty = {};
  students.forEach((s) => {
    byCourse[s.course] = (byCourse[s.course] || 0) + 1;
    byFaculty[s.faculty] = (byFaculty[s.faculty] || 0) + 1;
  });

  return {
    university: overrides.university || UNIVERSITY,
    loadedAt: overrides.loadedAt ?? 0,
    students,
    teachers,
    residents,
    guestUsers,
    clinics,
    simulators,
    rooms,
    roleByUserId,
    studentById: indexBy(students, (s) => s.id),
    teacherById: indexBy(teachers, (t) => t.id),
    clinicById: indexBy(clinics, (c) => c.id),
    simulatorById: indexBy(simulators, (s) => s.id),
    simulatorByNumber: indexBy(simulators, (s) => s.number),
    roomByName: indexBy(rooms, (r) => r.name),
    registered: { total: students.length, byCourse, byFaculty },
  };
};

// --- raw rows (DB column shapes of spec §4b) -----------------------------------------------
let rowCounter = 0;
const nextId = (prefix) => {
  rowCounter += 1;
  return `${prefix}-${String(rowCounter).padStart(4, '0')}`;
};

// Times are Vilnius wall clock ('YYYY-MM-DD HH:mm') unless an ISO string with a zone is given.
const stamp = (value) => {
  if (value === null || value === undefined) return null;
  return /T.*(Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : localIso(value);
};

export const centerSession = (userId, entry, exit = null, id = nextId('cs')) => ({
  id,
  user_id: userId,
  entry_time: stamp(entry),
  exit_time: stamp(exit),
});

export const simSession = (simulatorId, userId, start, end = null, id = nextId('ss')) => ({
  id,
  simulator_id: simulatorId,
  user_id: userId,
  start_time: stamp(start),
  end_time: stamp(end),
});

export const schedule = (fields = {}) => ({
  id: fields.id || nextId('cl'),
  teacher_id: 't1',
  session_date: '2026-06-15',
  start_time: '10:00:00',
  end_time: '12:00:00',
  course: '3',
  groups: ['5'],
  simulators: ['2', '3'],
  rooms: [],
  needs_assistance: false,
  ...fields,
});

export const eventCode = (fields = {}) => {
  const { starts, ends, ...rest } = fields;
  return {
    id: rest.id || nextId('ev'),
    event_name: 'Airway workshop',
    allowed_simulators: [],
    rooms: [],
    teacher_ids: [],
    starts_at: stamp(starts ?? '2026-09-15 09:00'),
    ends_at: stamp(ends ?? '2026-09-15 15:00'),
    ...rest,
  };
};

export const guestReg = (country, affiliation, createdAt, id = nextId('gr')) => ({
  id,
  country,
  affiliation,
  created_at: stamp(createdAt),
});

export const makeRaw = (overrides = {}) => ({
  centerSessions: [],
  simSessions: [],
  schedules: [],
  events: [],
  guests: [],
  ...overrides,
});

// --- metric scenario (A2b) ----------------------------------------------------------------
// One small, complete history for the metric tests. "Now" is Wed 16 Sep 2026 10:30.
// June: a busy week (15–18 Jun) with every data defect once; September: a guest event
// yesterday and an upcoming class next week.
export const SCENARIO_NOW = '2026-09-16 10:30';

export const makeScenarioRaw = () =>
  makeRaw({
    centerSessions: [
      centerSession('s1', '2026-06-15 09:00', '2026-06-15 11:00', 'cs-s1-a'),
      centerSession('s1', '2026-06-16 09:00', '2026-06-16 10:00', 'cs-s1-b'),
      centerSession('s1', '2026-09-15 09:00', '2026-09-15 10:30', 'cs-s1-c'),
      centerSession('s2', '2026-06-15 09:30', '2026-06-15 11:30', 'cs-s2-a'),
      centerSession('s2', '2026-06-15 09:31', '2026-06-15 09:40', 'cs-s2-double'), // double tap → merged
      centerSession('s3', '2026-06-17 10:00', '2026-06-17 11:00', 'cs-s3-a'),
      centerSession('s4', '2026-06-17 12:00', '2026-06-17 13:00', 'cs-s4-a'),
      centerSession('s4', '2026-06-17T05:00:00Z', '2026-06-17T05:00:30Z', 'cs-s4-short'), // 30 s → ignored
      centerSession('s5', '2026-06-15 08:00', '2026-06-15T17:00:00.041Z', 'cs-s5-cron'), // cron close → 120 min
      centerSession('s6', '2026-06-17 09:00', '2026-06-17 10:00', 'cs-s6-a'),
      centerSession('t1', '2026-06-15 09:45', '2026-06-15 12:10', 'cs-t1-a'),
      centerSession('r1', '2026-06-16 14:00', '2026-06-16 15:00', 'cs-r1-a'),
      centerSession('g1', '2026-09-15 09:10', '2026-09-15 12:00', 'cs-g1-a'),
      centerSession('ghost', '2026-06-15 10:00', '2026-06-15 11:00', 'cs-ghost'), // deleted account
    ],
    simSessions: [
      simSession('sim-2', 's1', '2026-06-15 10:10', '2026-06-15 10:40', 'ss-a'),
      simSession('sim-3', 'g1', '2026-09-15 09:20', '2026-09-15 09:50', 'ss-b'),
    ],
    schedules: [
      schedule({ id: 'class-held', rooms: ['A2-06'] }),
      schedule({
        id: 'class-quiet',
        teacher_id: 't2',
        session_date: '2026-06-18',
        course: '5',
        groups: ['med-08'],
        simulators: ['4', '7'], // "7" no longer exists
        rooms: ['Debriefing'], // unlisted room
        needs_assistance: true,
      }),
      schedule({ id: 'class-upcoming', session_date: '2026-09-22', simulators: ['2'], rooms: ['A2-19'] }),
    ],
    events: [
      eventCode({ id: 'e1', allowed_simulators: ['3'], rooms: ['C2-04'] }), // 15 Sep 09:00–15:00
    ],
    guests: [
      guestReg('Lithuania', 'VU', '2026-06-15 09:00', 'gr-1'),
      guestReg('Lithuania', 'Vilnius University', '2026-06-15 09:05', 'gr-2'),
      guestReg('lithuania', 'Vilniaus universitetas', '2026-06-15 09:10', 'gr-3'),
      guestReg('Poland', 'Jagiellonian University', '2026-09-15 08:50', 'gr-4'),
    ],
  });
