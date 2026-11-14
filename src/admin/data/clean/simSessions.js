// simulator_sessions rows → cleaned sessions (device-occupied time, not person-hours).
// Same classification as visits (open / auto-closed / accidental tap), but nothing is merged
// per user: a simulator carries one session at a time, so a session that still overlaps
// the next one on the same simulator is cut where the next one starts.
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
  const stats = { raw: 0, invalid: 0, outOfScope: 0, short: 0, cut: 0, imputed: 0, capped: 0, open: 0 };
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
  bySimulator.forEach((list) => {
    list.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || compareIds(a.id, b.id));
    list.forEach((item, index) => {
      const next = list[index + 1];
      let { endMs, open, imputed, capped } = item;
      if (next && endMs > next.startMs) {
        // The next start is a known end, so nothing about this session is guessed any more.
        endMs = next.startMs;
        open = false;
        imputed = false;
        capped = false;
        stats.cut += 1;
      }
      const minutes = (endMs - item.startMs) / MIN_MS;
      if (minutes < minMin) {
        stats.short += 1;
        return;
      }
      if (imputed) stats.imputed += 1;
      if (capped) stats.capped += 1;
      if (open) stats.open += 1;
      sessions.push({
        id: item.id,
        simulatorId: item.simulatorId,
        simNumber: item.simNumber,
        userId: item.userId,
        role: item.role,
        startMs: item.startMs,
        endMs,
        durationMin: round1(minutes),
        open,
        imputed,
        capped,
        dayKey: dayKeyOf(item.startMs),
        segments: msToSegments(item.startMs, endMs),
      });
    });
  });

  sessions.sort((a, b) => a.startMs - b.startMs || compareIds(a.id, b.id));
  return { sessions, stats };
};
