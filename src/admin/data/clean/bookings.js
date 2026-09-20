// Planned use: teacher_schedules rows → ClassItem, event_codes rows → EventItem, and both
// fanned out into BookingSeg — one wall-clock day segment per (booking, resource).
// Status and evidence are filled in later by classStatus.js.
import moment from 'moment';
import { toMs } from '../period.js';
import { classToSegment, msToSegments } from '../intervals.js';
import { normalizeCourse, normalizeGroup } from '../normalize.js';
import { compareIds } from './visits.js';

const MIN_MS = 60000;

export const UNKNOWN_TEACHER = 'Unknown teacher';
export const UNTITLED_EVENT = 'Untitled event';
export const UNLISTED_ROOMS_LABEL = 'Unlisted rooms';

// Resource keys keep simulator numbers and room names apart ("2" can be both).
export const simKey = (number) => `sim:${number}`;
export const roomKey = (name) => `room:${name}`;
export const removedSimulatorLabel = (number) => `Simulator ${number} (removed)`;

const emptyEvidence = () => ({ simulator: false, teacher: false, students: false, studentsOnSite: 0 });

// Simulator numbers / room names as the calendar reads them: text, blanks dropped, no repeats.
const textList = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  value.forEach((entry) => {
    if (entry === null || entry === undefined) return;
    const text = String(entry);
    if (text) seen.add(text);
  });
  return [...seen];
};

// Class instants are Vilnius wall-clock; the browser is assumed to run on Vilnius time,
// exactly like the calendar.
const wallClockMs = (date, time) => moment(`${date} ${time}`, 'YYYY-MM-DD HH:mm:ss').valueOf();

// Rows with unusable times are skipped, as the calendar skips them.
export const buildClasses = (schedules, ref) => {
  const classes = [];
  (schedules || []).forEach((row) => {
    const seg = classToSegment(row);
    if (!seg) return;
    const startMs = wallClockMs(seg.date, row.start_time);
    const endMs = wallClockMs(seg.date, row.end_time);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return;

    const teacher = ref?.teacherById?.get(row.teacher_id) || null;
    const knownClinics = (teacher?.clinicIds || [])
      .map((id) => ref?.clinicById?.get(id))
      .filter(Boolean);
    const groups = textList(row.groups);

    classes.push({
      id: row.id,
      teacherId: row.teacher_id ?? null,
      teacherShort: teacher?.shortName || UNKNOWN_TEACHER,
      clinicIds: knownClinics.map((clinic) => clinic.id),
      clinics: knownClinics.map((clinic) => clinic.name),
      date: seg.date,
      startMin: seg.startMin,
      endMin: seg.endMin,
      startMs,
      endMs,
      durationMin: seg.endMin - seg.startMin,
      course: normalizeCourse(row.course),
      groups,
      groupKeys: [...new Set(groups.map(normalizeGroup).filter(Boolean))],
      simNumbers: textList(row.simulators),
      roomNames: textList(row.rooms),
      needsAssistance: row.needs_assistance === true,
      status: null,
      evidence: emptyEvidence(),
      usedSimNumbers: [],
    });
  });
  classes.sort((a, b) => a.startMs - b.startMs || compareIds(a.id, b.id));
  return classes;
};

// Undated or reversed events are skipped. durationMin is real elapsed time; `segments`
// carry the wall-clock view used for room and simulator booking maths.
export const buildEvents = (events, ref) => {
  const guestsByCode = new Map();
  (ref?.guestUsers || []).forEach((guest) => {
    if (guest.codeId === null || guest.codeId === undefined) return;
    guestsByCode.set(guest.codeId, (guestsByCode.get(guest.codeId) || 0) + 1);
  });

  const items = [];
  (events || []).forEach((row) => {
    if (!row) return;
    const startMs = toMs(row.starts_at);
    const endMs = toMs(row.ends_at);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return;
    items.push({
      id: row.id,
      title: (typeof row.event_name === 'string' && row.event_name.trim()) || UNTITLED_EVENT,
      startMs,
      endMs,
      durationMin: Math.round((endMs - startMs) / MIN_MS),
      segments: msToSegments(startMs, endMs),
      simNumbers: textList(row.allowed_simulators),
      roomNames: textList(row.rooms),
      status: null,
      appGuests: guestsByCode.get(row.id) || 0,
      evidence: { ...emptyEvidence(), guests: false },
      usedSimNumbers: [],
    });
  });
  items.sort((a, b) => a.startMs - b.startMs || compareIds(a.id, b.id));
  return items;
};

// One BookingSeg per (booking, resource, local day).
// Simulator segs carry `removed` (the number matches no current simulator → listed in booked
// tables only, never in utilisation). Room segs carry `listed` (false → "Unlisted rooms",
// outside occupancy % and the heatmap). `resourceId` / `label` save consumers a lookup.
export const buildBookingSegs = (classes, events, ref) => {
  const bookingSegs = [];
  let removedSimRefs = 0;
  let unlistedRoomRefs = 0;

  const fanOut = (kind, sourceId, segments, simNumbers, roomNames) => {
    simNumbers.forEach((number) => {
      const simulator = ref?.simulatorByNumber?.get(number) || null;
      if (!simulator) removedSimRefs += 1;
      segments.forEach((seg) => {
        bookingSegs.push({
          date: seg.date,
          startMin: seg.startMin,
          endMin: seg.endMin,
          kind,
          sourceId,
          resourceType: 'simulator',
          resourceKey: simKey(number),
          resourceId: simulator?.id ?? null,
          label: simulator ? simulator.label : removedSimulatorLabel(number),
          removed: !simulator,
        });
      });
    });
    roomNames.forEach((name) => {
      const room = ref?.roomByName?.get(name) || null;
      if (!room) unlistedRoomRefs += 1;
      segments.forEach((seg) => {
        bookingSegs.push({
          date: seg.date,
          startMin: seg.startMin,
          endMin: seg.endMin,
          kind,
          sourceId,
          resourceType: 'room',
          resourceKey: roomKey(name),
          resourceId: room?.id ?? null,
          label: name,
          listed: Boolean(room),
        });
      });
    });
  };

  (classes || []).forEach((item) => {
    fanOut(
      'class',
      item.id,
      [{ date: item.date, startMin: item.startMin, endMin: item.endMin }],
      item.simNumbers,
      item.roomNames
    );
  });
  (events || []).forEach((item) => {
    fanOut('event', item.id, item.segments, item.simNumbers, item.roomNames);
  });

  return { bookingSegs, removedSimRefs, unlistedRoomRefs };
};
