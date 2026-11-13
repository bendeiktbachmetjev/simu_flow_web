// simulator_sessions rows → cleaned sessions (device-occupied time, not person-hours).
// Same classification as visits (open / auto-closed / accidental tap). Several people can
// work on one simulator together (database migration 043), each with a row of their own:
// rows of one simulator that overlap in time are merged into ONE device session, from the
// first start to the last end, so a group counts once and its time is not lost.
// Rows that only touch (one ends the second the next starts) stay separate sessions.
import { SIM_FALLBACK_MEDIAN_MIN, SIM_MAX_MIN, SIM_MIN_MIN } from '../constants.js';
import { dayKeyOf } from '../period.js';
import { msToSegments } from '../intervals.js';
import { classifyInterval, compareIds, round1 } from './visits.js';

const MIN_MS = 60000;

// rows: [{ id, simulator_id, user_id, start_time, end_time }].
// Rows of simulators missing from `simulatorById` are outside the university → skipped.
export const cleanSimSessions = (rows, options = {}) => {
  const {
    nowMs,
    simulatorById,
    maxMin = SIM_MAX_MIN,
    minMin = SIM_MIN_MIN,
    roleByUserId = null,
  } = options;
  const medianMin = Number.isFinite(options.medianMin) ? options.medianMin : SIM_FALLBACK_MEDIAN_MIN;
  // merged = rows folded into another row's device session (people working together).
  const stats = { raw: 0, invalid: 0, outOfScope: 0, short: 0, merged: 0, imputed: 0, capped: 0, open: 0 };
  const bySimulator = new Map();

  (rows || []).forEach((row) => {
    stats.raw += 1;
    if (!row) {
      stats.invalid += 1;
      return;
    }
    const simulator = simulatorById?.get(row.simulator_id);
    if (!simulator) {
      stats.outOfScope += 1;
      return;
    }
    const interval = classifyInterval(row.start_time, row.end_time, { nowMs, medianMin, maxMin, minMin });
    if (interval.drop) {
      stats[interval.drop] += 1;
      return;
    }
    const item = {
      id: row.id,
      simulatorId: row.simulator_id,
      simNumber: String(simulator.number),
      userId: row.user_id ?? null,
      role: roleByUserId?.get(row.user_id) ?? null,
      startMs: interval.startMs,
      endMs: interval.endMs,
      open: interval.closeKind === 'open',
      imputed: interval.imputed,
      capped: interval.capped,
    };
    if (!bySimulator.has(item.simulatorId)) bySimulator.set(item.simulatorId, []);
    bySimulator.get(item.simulatorId).push(item);
  });

  const sessions = [];
  const keep = (item) => {
    const minutes = (item.endMs - item.startMs) / MIN_MS;
    if (minutes < minMin) {
      stats.short += 1;
      return;
    }
    if (item.imputed) stats.imputed += 1;
    if (item.capped) stats.capped += 1;
    if (item.open) stats.open += 1;
    sessions.push({
      id: item.id,
      simulatorId: item.simulatorId,
      simNumber: item.simNumber,
      userId: item.userId,
      role: item.role,
      people: item.users.size, // how many people shared this device session
      startMs: item.startMs,
      endMs: item.endMs,
      durationMin: round1(minutes),
      open: item.open,
      imputed: item.imputed,
      capped: item.capped,
      dayKey: dayKeyOf(item.startMs),
      segments: msToSegments(item.startMs, item.endMs),
    });
  };

  bySimulator.forEach((list) => {
    list.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || compareIds(a.id, b.id));
    let current = null;
    list.forEach((item) => {
      if (current && item.startMs < current.endMs) {
        // Overlaps the running device session: the same use of the simulator. The session
        // keeps the id, user and role of its first row and ends with whoever ends last;
        // how that end is known (open / guessed / capped) comes from that last row.
        stats.merged += 1;
        current.users.add(item.userId);
        if (item.endMs > current.endMs) {
          current.endMs = item.endMs;
          current.open = item.open;
          current.imputed = item.imputed;
          current.capped = item.capped;
        } else if (item.endMs === current.endMs) {
          current.open = current.open || item.open;
          current.imputed = current.imputed && item.imputed;
          current.capped = current.capped && item.capped;
        }
        return;
      }
      if (current) keep(current);
      current = { ...item, users: new Set([item.userId]) };
    });
    if (current) keep(current);
  });

  sessions.sort((a, b) => a.startMs - b.startMs || compareIds(a.id, b.id));
  return { sessions, stats };
};
