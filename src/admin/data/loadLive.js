// "Right now" rows: who tapped in today, which simulators have an open NFC session, and what
// the calendar reserves at this minute. Small queries, polled once a minute by useLive.
import moment from 'moment';
import { supabase } from '../../lib/supabase';
import { DataError, toDataError } from './errors.js';
import { allOrNothing, fetchAllPages } from './query.js';

const BOOKED_NOW_WINDOW_MS = 60000;

async function loadBookedNow(university, nowMs, signal) {
  const table = 'resource_availability';
  let response;
  try {
    let query = supabase.rpc('resource_availability', {
      p_university: university,
      p_from: new Date(nowMs).toISOString(),
      p_to: new Date(nowMs + BOOKED_NOW_WINDOW_MS).toISOString(),
    });
    if (signal) query = query.abortSignal(signal);
    response = await query;
  } catch (err) {
    throw toDataError(err, { table });
  }
  if (signal?.aborted) throw new DataError('ABORTED', null, { table });
  if (response.error) throw toDataError(response.error, { table, status: response.status });
  return Array.isArray(response.data) ? response.data : [];
}

/**
 * → rawLive = { nowMs, centerSessionsToday, openSimSessions, busyNow } (database column names)
 * centerSessionsToday: today's visits of people of this university, open and closed
 *   { id, user_id, entry_time, exit_time };
 * openSimSessions: sessions without an end, started today, on this university's simulators
 *   { id, simulator_id, user_id, start_time };
 * busyNow: resource_availability rows that overlap [now, now + 1 min)
 *   { resource_type: 'simulator'|'room', resource_key, busy_from, busy_until, source: 'class'|'event', source_id }.
 */
export async function loadLive(ref, nowMs, signal) {
  if (!ref?.university) throw new DataError('NO_UNIVERSITY');
  const startOfToday = moment(nowMs).startOf('day').toISOString();

  try {
    const [centerSessionsToday, openSimSessions, busyNow] = await allOrNothing(signal, (linkedSignal) => [
      fetchAllPages(
        (selectOpts) =>
          supabase
            .from('center_sessions')
            .select('id, user_id, entry_time, exit_time', selectOpts)
            .gte('entry_time', startOfToday)
            .order('entry_time')
            .order('id'),
        { signal: linkedSignal, table: 'center_sessions' }
      ),
      fetchAllPages(
        (selectOpts) =>
          supabase
            .from('simulator_sessions')
            .select('id, simulator_id, user_id, start_time', selectOpts)
            .is('end_time', null)
            .gte('start_time', startOfToday)
            .order('start_time')
            .order('id'),
        { signal: linkedSignal, table: 'simulator_sessions' }
      ),
      loadBookedNow(ref.university, nowMs, linkedSignal),
    ]);

    return scopeLive({ nowMs, centerSessionsToday, openSimSessions, busyNow }, ref);
  } catch (err) {
    if (err?.code !== 'ABORTED') console.error(err);
    throw err;
  }
}

// Neither session table has a university column: keep only this university's people and
// simulators. The RPC also returns a `label` (the teacher's name, or the access code of an
// unnamed event); it is dropped so neither can ever reach the screen — titles come from the
// dataset through source_id. Shared with the dev demo rows so both take the same path.
export function scopeLive(rawLive, ref) {
  return {
    nowMs: rawLive.nowMs,
    centerSessionsToday: (rawLive.centerSessionsToday || []).filter((row) => ref.roleByUserId.has(row.user_id)),
    openSimSessions: (rawLive.openSimSessions || []).filter((row) => ref.simulatorById.has(row.simulator_id)),
    busyNow: (rawLive.busyNow || []).map((row) => ({
      resource_type: row.resource_type,
      resource_key: row.resource_key,
      busy_from: row.busy_from,
      busy_until: row.busy_until,
      source: row.source,
      source_id: row.source_id,
    })),
  };
}
