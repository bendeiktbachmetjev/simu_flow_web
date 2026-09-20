// Equipment: NFC sessions (device-occupied time, not person-hours) against open hours and
// against what the calendar booked.
//   utilisation % = session time inside Mon–Fri open hours ÷ open hours up to now
//   booked %      = class + event reservations (merged per simulator, open hours, up to now)
//                   ÷ the same open hours
// A session belongs to the period / bucket that contains its start. Simulator numbers that
// match no current simulator ("removed") are listed apart and never enter a total.
import { CLOSE_HOUR, OPEN_HOUR } from '../constants.js';
import { availability, dayKeyOf } from '../period.js';
import { clipSegments, intersectSegments, mergeSegments, sumMinutes } from '../intervals.js';
import { removedSimulatorLabel, simKey } from '../clean/bookings.js';
import {
  GUEST_EVENTS_LABEL,
  NO_CLINIC_LABEL,
  addTo,
  effectiveRange,
  hoursOf,
  inPeriod,
  makeSeries,
  median,
  pct,
  wallMinuteOf,
} from './shared.js';

const MIN_MS = 60000;

const bookingId = (seg) => `${seg.kind}:${seg.sourceId}`;

// Session segments sit on the calendar's whole-minute grid. The seconds of the real start
// and end are put back, so time inside open hours can never exceed the session's length.
const secondsPart = (ms) => {
  const d = new Date(ms);
  return (d.getSeconds() * 1000 + d.getMilliseconds()) / MIN_MS;
};
const exactSegments = (session) => {
  const segs = (session.segments || []).map((seg) => ({ ...seg }));
  if (segs.length === 0) return segs;
  const first = segs[0];
  const last = segs[segs.length - 1];
  if (first.date === dayKeyOf(session.startMs) && first.startMin === wallMinuteOf(session.startMs)) {
    first.startMin += secondsPart(session.startMs);
  }
  if (last.date === dayKeyOf(session.endMs) && last.endMin === wallMinuteOf(session.endMs)) {
    last.endMin += secondsPart(session.endMs);
  }
  return segs;
};

export const computeSimulators = (ds, ref, period) => {
  const simulators = ref?.simulators || [];
  const range = effectiveRange(period, ds);
  const open = availability({ from: range.from, toExcl: range.toExcl }, ds.nowMs, {
    openHour: OPEN_HOUR,
    closeHour: CLOSE_HOUR,
    horizon: 'elapsed',
  });
  // Inside Mon–Fri open hours of the counted days; today only up to the current minute.
  const insideOpenHours = (segs) =>
    clipSegments(segs, { openMin: open.openMin, closeMin: open.closeMin, perDay: open.perDay });
  const availableMin = open.minutesPerResource;

  const { rows: series, indexOf } = makeSeries(period, ['sessions']);
  const bucketMinutes = series.map(() => 0);
  const bucketOpenMinutes = series.map(() => 0);
  const bucketBookedMinutes = series.map(() => 0);
  const bucketAvailableMinutes = series.map(() => 0);
  open.perDay.forEach((minutes, date) => {
    const index = indexOf(date);
    if (index >= 0) bucketAvailableMinutes[index] += minutes * simulators.length;
  });

  // --- use (NFC) ---------------------------------------------------------------------------
  const stats = new Map(
    simulators.map((simulator) => [
      simulator.id,
      { sessions: 0, minutes: 0, openSegs: [], lastUsedMs: null, bookedSegs: [] },
    ])
  );
  const durations = [];
  let sessionCount = 0;
  let totalMin = 0;

  (ds?.simSessions || []).forEach((session) => {
    const entry = stats.get(session.simulatorId);
    if (!entry) return;
    // "Last used" looks back beyond the period, so an idle simulator still shows a date.
    if (session.startMs < period.toMs && (entry.lastUsedMs === null || session.startMs > entry.lastUsedMs)) {
      entry.lastUsedMs = session.startMs;
    }
    if (!inPeriod(session.startMs, period)) return;

    const minutes = (session.endMs - session.startMs) / MIN_MS;
    const openSegs = insideOpenHours(exactSegments(session));
    entry.sessions += 1;
    entry.minutes += minutes;
    entry.openSegs.push(...openSegs);
    durations.push(session.durationMin);
    sessionCount += 1;
    totalMin += minutes;

    const index = indexOf(session.startMs);
    if (index < 0) return;
    addTo(series[index], 'sessions', 1);
    bucketMinutes[index] += minutes;
    bucketOpenMinutes[index] += sumMinutes(openSegs);
  });

  // --- bookings ----------------------------------------------------------------------------
  const classById = new Map((ds?.classes || []).map((item) => [item.id, item]));
  const statsByKey = new Map(simulators.map((simulator) => [simKey(simulator.number), stats.get(simulator.id)]));
  const removedStats = new Map();
  const clinicStats = new Map();
  const eventStats = { minutes: 0, sources: new Set() };

  (ds?.bookingSegs || []).forEach((seg) => {
    if (seg.resourceType !== 'simulator' || seg.date < range.from || seg.date >= range.toExcl) return;
    if (seg.removed) {
      if (!removedStats.has(seg.resourceKey)) {
        removedStats.set(seg.resourceKey, { segs: [], sources: new Set() });
      }
      const removed = removedStats.get(seg.resourceKey);
      removed.segs.push(seg);
      removed.sources.add(bookingId(seg));
      return;
    }
    const entry = statsByKey.get(seg.resourceKey);
    if (!entry) return;
    entry.bookedSegs.push(seg);

    // Who booked it: simulator-hours of a class go to every clinic of its teacher.
    const minutes = sumMinutes(insideOpenHours([seg]));
    if (minutes <= 0) return;
    if (seg.kind === 'event') {
      eventStats.minutes += minutes;
      eventStats.sources.add(seg.sourceId);
      return;
    }
    const clinicIds = classById.get(seg.sourceId)?.clinicIds || [];
    (clinicIds.length > 0 ? [...new Set(clinicIds)] : [null]).forEach((clinicId) => {
      if (!clinicStats.has(clinicId)) clinicStats.set(clinicId, { minutes: 0, sources: new Set() });
      const clinic = clinicStats.get(clinicId);
      clinic.minutes += minutes;
      clinic.sources.add(seg.sourceId);
    });
  });

  // --- per simulator -----------------------------------------------------------------------
  let openMinTotal = 0;
  let bookedMinTotal = 0;
  let usedBookedMinTotal = 0;
  let activeSimulators = 0;

  const perSimulator = simulators
    .map((simulator, order) => {
      const entry = stats.get(simulator.id);
      const usedSegs = mergeSegments(entry.openSegs);
      const bookedSegs = mergeSegments(insideOpenHours(entry.bookedSegs));
      const openMinutes = sumMinutes(usedSegs);
      const bookedMinutes = sumMinutes(bookedSegs);
      const usedBookedMinutes = sumMinutes(intersectSegments(usedSegs, bookedSegs));

      openMinTotal += openMinutes;
      bookedMinTotal += bookedMinutes;
      usedBookedMinTotal += usedBookedMinutes;
      if (entry.sessions > 0) activeSimulators += 1;
      bookedSegs.forEach((seg) => {
        const index = indexOf(seg.date);
        if (index >= 0) bucketBookedMinutes[index] += seg.endMin - seg.startMin;
      });

      return {
        order,
        minutes: entry.minutes,
        row: {
          id: simulator.id,
          number: simulator.number,
          name: simulator.name,
          label: simulator.label,
          sessions: entry.sessions,
          hours: hoursOf(entry.minutes),
          hoursInOpen: hoursOf(openMinutes),
          availableHours: hoursOf(availableMin),
          utilisationPct: pct(openMinutes, availableMin),
          idleHours: hoursOf(Math.max(0, availableMin - openMinutes)),
          lastUsedMs: entry.lastUsedMs,
          bookedHours: hoursOf(bookedMinutes),
          bookedPct: pct(bookedMinutes, availableMin),
          usedDuringBookedHours: hoursOf(usedBookedMinutes),
        },
      };
    })
    // Most used first; ties keep the calendar's simulator order.
    .sort((a, b) => b.minutes - a.minutes || a.order - b.order)
    .map((item) => item.row);

  series.forEach((row, index) => {
    const future = row.isFuture;
    row.hours = future ? null : hoursOf(bucketMinutes[index]);
    row.bookedHours = future ? null : hoursOf(bucketBookedMinutes[index]);
    row.hoursInOpen = future ? null : hoursOf(bucketOpenMinutes[index]);
    row.utilisationPct = future ? null : pct(bucketOpenMinutes[index], bucketAvailableMinutes[index]);
  });

  let removedBookedMin = 0;
  const removed = [...removedStats.entries()]
    .map(([resourceKey, item]) => {
      const minutes = sumMinutes(mergeSegments(insideOpenHours(item.segs)));
      const number = resourceKey.slice(simKey('').length);
      removedBookedMin += minutes;
      return {
        number,
        label: removedSimulatorLabel(number),
        bookedHours: hoursOf(minutes),
        bookings: item.sources.size,
      };
    })
    .sort((a, b) => a.number.localeCompare(b.number, 'en', { numeric: true }));

  const bookedByClinic = [...clinicStats.entries()]
    .map(([clinicId, clinic]) => ({
      clinicId,
      clinic: clinicId === null ? NO_CLINIC_LABEL : ref?.clinicById?.get(clinicId)?.name || NO_CLINIC_LABEL,
      simulatorHours: hoursOf(clinic.minutes),
      classes: clinic.sources.size,
      minutes: clinic.minutes,
    }))
    .sort(
      (a, b) =>
        (a.clinicId === null) - (b.clinicId === null) ||
        b.minutes - a.minutes ||
        a.clinic.localeCompare(b.clinic)
    )
    .map(({ minutes, ...row }) => row);
  if (eventStats.sources.size > 0) {
    bookedByClinic.push({
      clinicId: null,
      clinic: GUEST_EVENTS_LABEL,
      simulatorHours: hoursOf(eventStats.minutes),
      classes: eventStats.sources.size,
      isGuestEvents: true,
    });
  }

  const availableTotalMin = availableMin * simulators.length;
  const medianMin = median(durations);

  return {
    totals: {
      simulators: simulators.length,
      activeSimulators,
      sessions: sessionCount,
      hours: hoursOf(totalMin),
      hoursInOpen: hoursOf(openMinTotal),
      availableHours: hoursOf(availableTotalMin),
      utilisationPct: pct(openMinTotal, availableTotalMin),
      idleHours: hoursOf(Math.max(0, availableTotalMin - openMinTotal)),
      medianSessionMin: medianMin === null ? null : Math.round(medianMin),
      bookedHours: hoursOf(bookedMinTotal),
      bookedPct: pct(bookedMinTotal, availableTotalMin),
      usedDuringBookedHours: hoursOf(usedBookedMinTotal),
      removedBookedHours: hoursOf(removedBookedMin),
    },
    perSimulator,
    removed,
    series,
    bookedByClinic,
    availability: {
      workingDays: open.workingDays,
      openHour: OPEN_HOUR,
      closeHour: CLOSE_HOUR,
      minutesPerSimulator: availableMin,
      clipped: range.clipped,
      countedFrom: range.from,
    },
  };
};
