// Teaching: planned classes, which of them show NFC activity ("held"), who brings them
// (clinic, year of study, teacher vs center) and the class list.
// A class belongs to the period that contains its date; a guest event to the period that
// contains its start. Hours are CLASS hours — the planned length, not measured time.
// "No activity recorded" is never called cancelled: cancelled classes are deleted.
import { dayKeyOf } from '../period.js';
import { COURSE_ORDER, courseLabel } from '../normalize.js';
import { compareIds } from '../clean/visits.js';
import {
  NO_CLINIC_LABEL,
  addTo,
  eventTotals,
  eventsInPeriod,
  hoursOf,
  inPeriod,
  makeSeries,
  pct,
  round1,
  shareText,
  wallMinuteOf,
} from './shared.js';

const KIND_LABELS = {
  teacher: 'Teacher classes',
  specialist: '— of which simulation specialist requested',
  event: 'Guest events (organised by the center)',
};

const STATUS_FIELD = { held: 'held', no_activity: 'noActivity', upcoming: 'upcoming' };

const clock = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const average = (minutes, count) => (count > 0 ? Math.round(minutes / count) : null);

export const computeClasses = (ds, ref, period) => {
  const classes = (ds?.classes || []).filter((item) => inPeriod(item.date, period));
  const events = eventsInPeriod(ds, period);

  const counts = { held: 0, noActivity: 0, upcoming: 0 };
  let plannedMin = 0;
  let heldMin = 0;
  let specialistCount = 0;
  let specialistMin = 0;
  let onSiteClasses = 0;
  let onSiteStudents = 0;

  const group = () => ({ planned: 0, held: 0, minutes: 0, heldMinutes: 0, teachers: new Set() });
  const byClinicStats = new Map();
  const byCourseStats = new Map(COURSE_ORDER.map((course) => [course, group()]));

  // Upcoming classes and planned events are facts, so they stay visible in future buckets.
  const { rows: series, indexOf } = makeSeries(period, ['held', 'noActivity', 'upcoming', 'events'], {
    keepFuture: ['upcoming', 'events'],
  });

  classes.forEach((item) => {
    const held = item.status === 'held';
    counts[STATUS_FIELD[item.status]] += 1;
    plannedMin += item.durationMin;
    if (held) heldMin += item.durationMin;
    if (item.needsAssistance) {
      specialistCount += 1;
      specialistMin += item.durationMin;
    }
    if (held && item.evidence?.studentsOnSite > 0) {
      onSiteClasses += 1;
      onSiteStudents += item.evidence.studentsOnSite;
    }

    // A teacher can belong to several clinics: the class counts once for each of them.
    const clinicKeys = item.clinicIds.length > 0 ? [...new Set(item.clinicIds)] : [null];
    const targets = clinicKeys.map((clinicId) => {
      if (!byClinicStats.has(clinicId)) byClinicStats.set(clinicId, group());
      return byClinicStats.get(clinicId);
    });
    if (byCourseStats.has(item.course)) targets.push(byCourseStats.get(item.course));
    targets.forEach((stats) => {
      stats.planned += 1;
      stats.minutes += item.durationMin;
      if (held) {
        stats.held += 1;
        stats.heldMinutes += item.durationMin;
      }
      if (item.teacherId !== null) stats.teachers.add(item.teacherId);
    });

    const index = indexOf(item.date);
    if (index >= 0) addTo(series[index], STATUS_FIELD[item.status], 1);
  });

  events.forEach((event) => {
    const index = indexOf(event.startMs);
    if (index >= 0) addTo(series[index], 'events', 1);
  });

  // `hours` goes with `planned` (all classes of the row); heldHours with `held`.
  const byClinic = [...byClinicStats.entries()]
    .map(([clinicId, stats]) => ({
      clinicId,
      clinic: clinicId === null ? NO_CLINIC_LABEL : ref?.clinicById?.get(clinicId)?.name || NO_CLINIC_LABEL,
      planned: stats.planned,
      held: stats.held,
      hours: hoursOf(stats.minutes),
      heldHours: hoursOf(stats.heldMinutes),
      teachers: stats.teachers.size,
    }))
    .sort(
      (a, b) =>
        (a.clinicId === null) - (b.clinicId === null) ||
        b.planned - a.planned ||
        a.clinic.localeCompare(b.clinic)
    );

  const byCourse = COURSE_ORDER.map((course) => {
    const stats = byCourseStats.get(course);
    return {
      course,
      label: courseLabel(course),
      classes: stats.planned,
      held: stats.held,
      hours: hoursOf(stats.minutes),
      heldHours: hoursOf(stats.heldMinutes),
    };
  });

  const guest = eventTotals(events);
  const eventMin = events.reduce((total, event) => total + event.durationMin, 0);
  const byKind = [
    { kind: 'teacher', count: classes.length, minutes: plannedMin },
    { kind: 'specialist', count: specialistCount, minutes: specialistMin },
    { kind: 'event', count: events.length, minutes: eventMin },
  ].map(({ kind, count, minutes }) => ({
    kind,
    label: KIND_LABELS[kind],
    count,
    hours: hoursOf(minutes),
    avgDurationMin: average(minutes, count),
  }));

  // Newest first. Teacher short names are for the on-screen list only (never exported).
  const list = [
    ...classes.map((item) => ({
      id: item.id,
      kind: 'class',
      isEvent: false,
      title: null,
      date: item.date,
      endDate: item.date,
      start: clock(item.startMin),
      end: clock(item.endMin),
      startMs: item.startMs,
      endMs: item.endMs,
      durationMin: item.durationMin,
      teacherShort: item.teacherShort,
      clinics: item.clinics,
      course: item.course,
      courseLabel: courseLabel(item.course),
      groups: item.groups,
      simulatorsBooked: item.simNumbers.length,
      simulatorsUsed: item.usedSimNumbers.length,
      rooms: item.roomNames,
      status: item.status,
      needsAssistance: item.needsAssistance,
      evidence: item.evidence,
    })),
    ...events.map((event) => ({
      id: event.id,
      kind: 'event',
      isEvent: true,
      title: event.title,
      date: dayKeyOf(event.startMs),
      endDate: dayKeyOf(event.endMs),
      start: clock(wallMinuteOf(event.startMs)),
      end: clock(wallMinuteOf(event.endMs)),
      startMs: event.startMs,
      endMs: event.endMs,
      durationMin: event.durationMin,
      teacherShort: null,
      clinics: [],
      course: null,
      courseLabel: null,
      groups: [],
      simulatorsBooked: event.simNumbers.length,
      simulatorsUsed: event.usedSimNumbers.length,
      rooms: event.roomNames,
      status: event.status,
      needsAssistance: false,
      evidence: event.evidence,
    })),
  ].sort((a, b) => b.startMs - a.startMs || compareIds(a.id, b.id));

  const past = counts.held + counts.noActivity;
  return {
    totals: {
      planned: classes.length,
      held: counts.held,
      noActivity: counts.noActivity,
      upcoming: counts.upcoming,
      past,
      heldPct: pct(counts.held, past),
      heldText: shareText(counts.held, past),
      plannedHours: hoursOf(plannedMin),
      heldHours: hoursOf(heldMin),
      avgDurationMin: average(plannedMin, classes.length),
      specialistNeeded: specialistCount,
      guestEvents: guest.guestEvents,
      guestEventHours: guest.guestEventHours,
      guestEventsPast: guest.guestEventsPast,
      guestEventsHeld: guest.guestEventsHeld,
      // Only classes where students of the class's year and group were matched on site.
      avgStudentsOnSite: onSiteClasses > 0 ? round1(onSiteStudents / onSiteClasses) : null,
    },
    series,
    byClinic,
    byCourse,
    byKind,
    list,
  };
};
