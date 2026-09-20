// Raw reference rows → Reference. Pure file (no Supabase, no React, no window): the Supabase
// loader, the dev demo data and the Node smoke script all build the Reference through here.
import { shortName } from '../../components/timeline/model.js';
import {
  COURSE_ORDER,
  COURSE_OTHER,
  facultyKey,
  normalizeCourse,
  normalizeFaculty,
  normalizeGroup,
  spellingIndex,
} from './normalize.js';

const asArray = (value) => (Array.isArray(value) ? value : []);
const asText = (value) => (value === null || value === undefined ? '' : String(value).trim());

// Same order as the calendar: by the numeric part of the number ("X1" counts as 0),
// then by the number text so the result does not depend on the order rows arrive in.
const bySimulatorNumber = (a, b) =>
  (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0) ||
  a.number.localeCompare(b.number, 'en', { numeric: true });

/**
 * Raw rows (exactly the columns selected in loadReference.js, R1–R8) → Reference.
 * Shared by the Supabase loader and the dev demo data, so both take the same path.
 * rows = { students, teachers, residents, clinics, eventCodes, guestUsers, simulators, rooms }
 */
export function buildReference(university, rows, loadedAt) {
  const studentRows = asArray(rows?.students);
  const facultySpellings = spellingIndex(studentRows.map((row) => row.faculty), facultyKey);

  const students = studentRows.map((row) => ({
    id: row.id,
    course: normalizeCourse(row.course),
    faculty: normalizeFaculty(row.faculty, facultySpellings),
    groupKey: normalizeGroup(row.group_name),
  }));

  const teachers = asArray(rows?.teachers).map((row) => {
    const name = asText(row.name);
    const surname = asText(row.surname);
    return {
      id: row.id,
      name,
      surname,
      fullName: [name, surname].filter(Boolean).join(' '),
      shortName: shortName(name, surname),
      clinicIds: asArray(row.clinic_ids),
    };
  });

  const residents = asArray(rows?.residents).map((row) => ({ id: row.id, specialty: asText(row.specialty) || null }));

  // guest_users.university is the guest's OWN institution (free text), so app guests are
  // scoped through the event code they joined with, never through that column.
  const eventCodeIds = new Set(asArray(rows?.eventCodes ?? rows?.event_codes).map((row) => row.id));
  const guestUsers = asArray(rows?.guestUsers ?? rows?.guest_users)
    .filter((row) => row.code_id != null && eventCodeIds.has(row.code_id))
    .map((row) => ({ id: row.id, codeId: row.code_id }));

  // One clinic has no university in the live data but is used by this university's teachers.
  const referencedClinicIds = new Set(teachers.flatMap((teacher) => teacher.clinicIds));
  const clinics = asArray(rows?.clinics)
    .filter((row) => row.university === university || referencedClinicIds.has(row.id))
    .map((row) => ({ id: row.id, name: asText(row.name) || 'Unnamed clinic' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const simulators = asArray(rows?.simulators)
    .map((row) => {
      // Kept exactly as stored: bookings reference the number by string equality, like the calendar.
      const number = String(row.number ?? '');
      const name = asText(row.name);
      return {
        id: row.id,
        number,
        name,
        label: name ? `No. ${number} · ${name}` : `No. ${number}`,
        freeAccess: Boolean(row.free_access),
      };
    })
    .sort(bySimulatorNumber);

  // Room names are matched by string equality too, so they are not trimmed either.
  const roomList = asArray(rows?.rooms)
    .map((row) => ({ id: row.id, name: String(row.name ?? '') }))
    .filter((room) => room.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Precedence teacher > resident > student > guest: written lowest first, so a higher role
  // overwrites a lower one when the same account exists in two tables.
  const roleByUserId = new Map();
  guestUsers.forEach((row) => roleByUserId.set(row.id, 'guest'));
  students.forEach((row) => roleByUserId.set(row.id, 'student'));
  residents.forEach((row) => roleByUserId.set(row.id, 'resident'));
  teachers.forEach((row) => roleByUserId.set(row.id, 'teacher'));

  const byCourse = Object.fromEntries([...COURSE_ORDER, COURSE_OTHER].map((course) => [course, 0]));
  const byFaculty = {};
  students.forEach((student) => {
    byCourse[student.course] = (byCourse[student.course] || 0) + 1;
    byFaculty[student.faculty] = (byFaculty[student.faculty] || 0) + 1;
  });

  return {
    university,
    loadedAt,
    students,
    teachers,
    residents,
    guestUsers,
    clinics,
    simulators,
    rooms: roomList,
    roleByUserId,
    studentById: new Map(students.map((row) => [row.id, row])),
    teacherById: new Map(teachers.map((row) => [row.id, row])),
    clinicById: new Map(clinics.map((row) => [row.id, row])),
    simulatorById: new Map(simulators.map((row) => [row.id, row])),
    simulatorByNumber: new Map(simulators.map((row) => [row.number, row])),
    roomByName: new Map(roomList.map((row) => [row.name, row])),
    registered: { total: students.length, byCourse, byFaculty },
  };
}
