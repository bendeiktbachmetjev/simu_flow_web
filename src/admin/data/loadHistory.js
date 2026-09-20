// The five activity tables, full history, loaded once per session (all-or-nothing).
// None of them is scoped by RLS and three have no university column, so each one is scoped
// through the Reference: people by id, simulator sessions by simulator, classes by teacher.
// Privacy: no names, no e-mails, no class notes and never the event access code.
import { supabase } from '../../lib/supabase';
import { DataError } from './errors.js';
import { allOrNothing, fetchAllPages, fetchInChunks } from './query.js';

/**
 * → raw = { centerSessions, simSessions, schedules, events, guests }
 * Rows keep the exact database column names; buildDataset does all cleaning.
 */
export async function loadHistory(ref, signal) {
  if (!ref?.university) throw new DataError('NO_UNIVERSITY');
  const university = ref.university;
  const simulatorIds = ref.simulators.map((simulator) => simulator.id);
  const teacherIds = ref.teachers.map((teacher) => teacher.id);

  try {
    const [centerSessions, simSessions, schedules, events, guests] = await allOrNothing(signal, (linkedSignal) => [
      // H1 — no university column and no usable server-side filter: read all rows; buildDataset
      // keeps those whose user belongs to this university and counts the rest as unattributed.
      fetchAllPages(
        (selectOpts) =>
          supabase
            .from('center_sessions')
            .select('id, user_id, entry_time, exit_time', selectOpts)
            .order('entry_time')
            .order('id'),
        { signal: linkedSignal, table: 'center_sessions' }
      ),
      // H2
      fetchInChunks(
        simulatorIds,
        (chunk, selectOpts) =>
          supabase
            .from('simulator_sessions')
            .select('id, simulator_id, user_id, start_time, end_time', selectOpts)
            .in('simulator_id', chunk)
            .order('start_time')
            .order('id'),
        { signal: linkedSignal, table: 'simulator_sessions' }
      ),
      // H3
      fetchInChunks(
        teacherIds,
        (chunk, selectOpts) =>
          supabase
            .from('teacher_schedules')
            .select(
              'id, teacher_id, session_date, start_time, end_time, course, groups, simulators, rooms, needs_assistance',
              selectOpts
            )
            .in('teacher_id', chunk)
            .order('session_date')
            .order('id'),
        { signal: linkedSignal, table: 'teacher_schedules' }
      ),
      // H4 — events without dates are drafts and cannot be counted.
      fetchAllPages(
        (selectOpts) =>
          supabase
            .from('event_codes')
            .select('id, event_name, allowed_simulators, rooms, teacher_ids, starts_at, ends_at', selectOpts)
            .eq('university', university)
            .not('starts_at', 'is', null)
            .order('starts_at')
            .order('id'),
        { signal: linkedSignal, table: 'event_codes' }
      ),
      // H5 — the public sign-in form: one global table, shared by every university.
      fetchAllPages(
        (selectOpts) =>
          supabase
            .from('guests')
            .select('id, country, affiliation, created_at', selectOpts)
            .order('created_at')
            .order('id'),
        { signal: linkedSignal, table: 'guests' }
      ),
    ]);

    return { centerSessions, simSessions, schedules, events, guests };
  } catch (err) {
    if (err?.code !== 'ABORTED') console.error(err);
    throw err;
  }
}
