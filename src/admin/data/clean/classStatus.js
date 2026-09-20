// Did a planned class (or guest event) take place? There is no attendance list, so the
// answer is inferred from NFC activity inside the booked time window:
//   held        — a simulator session on a booked simulator, the teacher on site, or a
//                 student of the class's year + group on site
//   upcoming    — not started yet, or still running with nothing recorded so far
//   no_activity — over, and nothing was recorded (NOT "cancelled": cancelled classes are
//                 deleted and never reach us)
// Evidence uses the EFFECTIVE (cleaned) intervals, so a forgotten tap-out that the cron job
// closed at 20:00 does not make every afternoon class look held.
import { COURSE_OTHER } from '../normalize.js';

const MIN_OVERLAP_MS = 60000;

// Items sorted by start + the longest span → everything overlapping a window is found
// with one binary search and a short scan.
const buildTimeIndex = (items, getStart, getEnd) => {
  const sorted = [...(items || [])].sort((a, b) => getStart(a) - getStart(b));
  let maxSpan = 0;
  sorted.forEach((item) => {
    maxSpan = Math.max(maxSpan, getEnd(item) - getStart(item));
  });
  return { sorted, maxSpan, getStart, getEnd };
};

const overlapping = (index, startMs, endMs) => {
  const { sorted, maxSpan, getStart, getEnd } = index;
  const earliest = startMs - maxSpan;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (getStart(sorted[mid]) < earliest) lo = mid + 1;
    else hi = mid;
  }
  const found = [];
  for (let i = lo; i < sorted.length && getStart(sorted[i]) < endMs; i += 1) {
    const item = sorted[i];
    const shared = Math.min(getEnd(item), endMs) - Math.max(getStart(item), startMs);
    if (shared >= MIN_OVERLAP_MS) found.push(item);
  }
  return found;
};

const visitStart = (visit) => visit.entryMs;
const visitEnd = (visit) => visit.endMs;
const sessionStart = (session) => session.startMs;
const sessionEnd = (session) => session.endMs;

const indexSessionsByNumber = (simSessions) => {
  const lists = new Map();
  (simSessions || []).forEach((session) => {
    if (!lists.has(session.simNumber)) lists.set(session.simNumber, []);
    lists.get(session.simNumber).push(session);
  });
  const indexes = new Map();
  lists.forEach((list, number) => indexes.set(number, buildTimeIndex(list, sessionStart, sessionEnd)));
  return indexes;
};

const usedNumbers = (simNumbers, sessionsByNumber, startMs, endMs) =>
  simNumbers.filter((number) => {
    const index = sessionsByNumber.get(number);
    return Boolean(index) && overlapping(index, startMs, endMs).length > 0;
  });

const statusOf = (item, hasEvidence, nowMs) => {
  if (item.startMs > nowMs) return 'upcoming';
  if (hasEvidence) return 'held';
  return item.endMs > nowMs ? 'upcoming' : 'no_activity';
};

export const inferClassStatus = (classes, { visits, simSessions, ref, nowMs }) => {
  const sessionsByNumber = indexSessionsByNumber(simSessions);
  const visitIndex = buildTimeIndex(visits, visitStart, visitEnd);

  return (classes || []).map((item) => {
    if (item.startMs > nowMs) {
      return {
        ...item,
        status: 'upcoming',
        evidence: { simulator: false, teacher: false, students: false, studentsOnSite: 0 },
        usedSimNumbers: [],
      };
    }

    const usedSimNumbers = usedNumbers(item.simNumbers, sessionsByNumber, item.startMs, item.endMs);
    const onSite = overlapping(visitIndex, item.startMs, item.endMs);
    const teacherOnSite = item.teacherId !== null && onSite.some((visit) => visit.userId === item.teacherId);

    // "Other" lumps unrelated free-text years together, so it never counts as a match.
    const students = new Set();
    if (item.course !== COURSE_OTHER && item.groupKeys.length > 0) {
      onSite.forEach((visit) => {
        const student = ref?.studentById?.get(visit.userId);
        if (student && student.course === item.course && item.groupKeys.includes(student.groupKey)) {
          students.add(visit.userId);
        }
      });
    }

    const evidence = {
      simulator: usedSimNumbers.length > 0,
      teacher: teacherOnSite,
      students: students.size > 0,
      studentsOnSite: students.size,
    };
    const hasEvidence = evidence.simulator || evidence.teacher || evidence.students;
    return { ...item, status: statusOf(item, hasEvidence, nowMs), evidence, usedSimNumbers };
  });
};

// Guest events: a session on one of the event's simulators, or a visit by an app guest who
// registered with this event's code.
export const inferEventStatus = (events, { visits, simSessions, ref, nowMs }) => {
  const sessionsByNumber = indexSessionsByNumber(simSessions);
  const visitIndex = buildTimeIndex(visits, visitStart, visitEnd);
  const eventByGuest = new Map();
  (ref?.guestUsers || []).forEach((guest) => eventByGuest.set(guest.id, guest.codeId));

  return (events || []).map((item) => {
    const blank = { simulator: false, teacher: false, students: false, studentsOnSite: 0, guests: false };
    if (item.startMs > nowMs) {
      return { ...item, status: 'upcoming', evidence: blank, usedSimNumbers: [] };
    }
    const usedSimNumbers = usedNumbers(item.simNumbers, sessionsByNumber, item.startMs, item.endMs);
    const guestsOnSite = overlapping(visitIndex, item.startMs, item.endMs)
      .some((visit) => eventByGuest.get(visit.userId) === item.id);
    const evidence = { ...blank, simulator: usedSimNumbers.length > 0, guests: guestsOnSite };
    const hasEvidence = evidence.simulator || evidence.guests;
    // Most guests sign in on the public web form and never tap NFC, so a finished event with
    // nothing recorded is simply 'past' — "no activity recorded" would read as "did not happen".
    const status = statusOf(item, hasEvidence, nowMs);
    return { ...item, status: status === 'no_activity' ? 'past' : status, evidence, usedSimNumbers };
  });
};
