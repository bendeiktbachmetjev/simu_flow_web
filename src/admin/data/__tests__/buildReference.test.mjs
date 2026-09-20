import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReference } from '../buildReference.js';

const U = 'Vilnius University';

const rows = () => ({
  students: [
    { id: 's1', course: '3', group_name: ' 5 ', faculty: 'Medicine' },
    { id: 's2', course: '3 kursas', group_name: 'MED-08', faculty: 'Medicinos' },
    { id: 's3', course: '1 semestre masters', group_name: null, faculty: 'medicine' },
    { id: 'both', course: '6', group_name: '1', faculty: '' },
  ],
  teachers: [
    { id: 't1', name: ' Jonas ', surname: 'Jonaitis', clinic_ids: ['c1', 'c-shared'] },
    { id: 'both', name: 'Ona', surname: 'Onaitė', clinic_ids: null },
  ],
  residents: [{ id: 'r1', specialty: ' Anesthesiology ' }, { id: 'r2', specialty: '' }],
  clinics: [
    { id: 'c1', name: 'Skubios medicinos', university: U },
    { id: 'c-shared', name: 'Anesteziologijos', university: null },
    { id: 'c-foreign', name: 'Foreign clinic', university: 'Test University' },
  ],
  eventCodes: [{ id: 'e1' }],
  guestUsers: [
    { id: 'g1', code_id: 'e1' },
    { id: 'g-foreign', code_id: 'e-other' },
    { id: 'g-none', code_id: null },
  ],
  simulators: [
    { id: 'simX1', number: 'X1', name: 'Ultrasound', free_access: true },
    { id: 'sim10', number: '10', name: 'ALS manikin', free_access: false },
    { id: 'sim2', number: '2', name: '', free_access: false },
  ],
  rooms: [{ id: 'room2', name: 'B1-02' }, { id: 'room1', name: 'A2-19' }, { id: 'room0', name: '' }],
});

test('buildReference: shape, scoping and lookups', () => {
  const ref = buildReference(U, rows(), 1234);

  assert.equal(ref.university, U);
  assert.equal(ref.loadedAt, 1234);

  assert.deepEqual(ref.students[0], { id: 's1', course: '3', faculty: 'Medicine', groupKey: '5' });
  assert.deepEqual(ref.students.map((s) => s.course), ['3', '3', 'Other', '6']);
  assert.deepEqual(ref.students.map((s) => s.faculty), ['Medicine', 'Medicine', 'Medicine', 'Not specified']);
  assert.deepEqual(ref.registered, {
    total: 4,
    byCourse: { 1: 0, 2: 0, 3: 2, 4: 0, 5: 0, 6: 1, Other: 1 },
    byFaculty: { Medicine: 3, 'Not specified': 1 },
  });

  const teacher = ref.teacherById.get('t1');
  assert.equal(teacher.fullName, 'Jonas Jonaitis');
  assert.ok(teacher.shortName && !teacher.shortName.includes('undefined'));
  assert.deepEqual(teacher.clinicIds, ['c1', 'c-shared']);
  assert.deepEqual(ref.teacherById.get('both').clinicIds, []);

  // A clinic counts when it belongs to the university or one of its teachers uses it.
  assert.deepEqual(ref.clinics.map((c) => c.id).sort(), ['c-shared', 'c1']);
  assert.equal(ref.clinicById.has('c-foreign'), false);

  // App guests are scoped through the event code, never through guest_users.university.
  assert.deepEqual(ref.guestUsers, [{ id: 'g1', codeId: 'e1' }]);

  assert.deepEqual(ref.residents, [{ id: 'r1', specialty: 'Anesthesiology' }, { id: 'r2', specialty: null }]);
});

test('buildReference: role precedence teacher > resident > student > guest', () => {
  const input = rows();
  input.residents.push({ id: 's1', specialty: 'x' });
  input.guestUsers.push({ id: 's2', code_id: 'e1' });
  const ref = buildReference(U, input, 0);
  assert.equal(ref.roleByUserId.get('both'), 'teacher');
  assert.equal(ref.roleByUserId.get('s1'), 'resident');
  assert.equal(ref.roleByUserId.get('s2'), 'student');
  assert.equal(ref.roleByUserId.get('g1'), 'guest');
  assert.equal(ref.roleByUserId.has('g-foreign'), false);
});

test('buildReference: simulators in calendar order, rooms by name, string keys kept', () => {
  const ref = buildReference(U, rows(), 0);
  assert.deepEqual(ref.simulators.map((s) => s.number), ['X1', '2', '10']);
  assert.equal(ref.simulatorByNumber.get('2').label, 'No. 2');
  assert.equal(ref.simulatorByNumber.get('10').label, 'No. 10 · ALS manikin');
  assert.equal(ref.simulatorById.get('simX1').freeAccess, true);
  assert.deepEqual(ref.rooms.map((r) => r.name), ['A2-19', 'B1-02']);
  assert.equal(ref.roomByName.get('A2-19').id, 'room1');
});

test('buildReference: missing or snake_case row groups do not throw', () => {
  const empty = buildReference(U, {}, 0);
  assert.equal(empty.students.length, 0);
  assert.equal(empty.registered.total, 0);
  assert.equal(empty.roleByUserId.size, 0);

  const snake = buildReference(U, { event_codes: [{ id: 'e1' }], guest_users: [{ id: 'g1', code_id: 'e1' }] }, 0);
  assert.deepEqual(snake.guestUsers, [{ id: 'g1', codeId: 'e1' }]);
});
