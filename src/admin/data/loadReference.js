// Reference data of ONE university: who the people are, which clinics, simulators and rooms
// exist. RLS does not scope by university, so every query here filters on it, and every
// activity table is later scoped through these ids.
// Privacy: no student or guest names and no e-mails are ever selected.
import { supabase } from '../../lib/supabase';
import { buildReference } from './buildReference.js';
import { DataError } from './errors.js';
import { allOrNothing, fetchAllPages } from './query.js';

export async function loadReference(university, signal) {
  if (!university) throw new DataError('NO_UNIVERSITY');

  const page = (table, columns, scoped) => (linkedSignal) =>
    fetchAllPages(
      (selectOpts) => {
        const query = supabase.from(table).select(columns, selectOpts);
        return (scoped ? query.eq('university', university) : query).order('id');
      },
      { signal: linkedSignal, table }
    );

  const tasks = [
    page('students', 'id, course, group_name, faculty', true),
    page('teachers', 'id, name, surname, clinic_ids', true),
    page('residents', 'id, specialty', true),
    page('clinics', 'id, name, university', false),
    page('event_codes', 'id', true),
    page('guest_users', 'id, code_id', false),
    page('simulators', 'id, number, name, free_access', true),
    page('rooms', 'id, name', true),
  ];

  try {
    const [students, teachers, residents, clinics, eventCodes, guestUsers, simulators, rooms] =
      await allOrNothing(signal, (linkedSignal) => tasks.map((task) => task(linkedSignal)));
    return buildReference(
      university,
      { students, teachers, residents, clinics, eventCodes, guestUsers, simulators, rooms },
      Date.now()
    );
  } catch (err) {
    if (err?.code !== 'ABORTED') console.error(err);
    throw err;
  }
}
