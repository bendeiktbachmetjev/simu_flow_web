// Students only: visits, unique students, training hours (their time in the center), reach
// by year of study and by faculty, and how often they come.
// "Registered" is the number of student accounts in SimuFlow today — real year-group sizes
// are not in the system, so reach is always "of registered students".
import { COURSE_ORDER, COURSE_OTHER, NOT_SPECIFIED, courseLabel } from '../normalize.js';
import {
  OTHER_LABEL,
  foldSmall,
  hoursOf,
  inPeriod,
  makeSeries,
  median,
  pct,
  round1,
  shareText,
} from './shared.js';

const FREQUENCY_BUCKETS = [
  { bucket: '1', label: '1 visit', min: 1, max: 1 },
  { bucket: '2-3', label: '2–3 visits', min: 2, max: 3 },
  { bucket: '4-9', label: '4–9 visits', min: 4, max: 9 },
  { bucket: '10+', label: '10+ visits', min: 10, max: Infinity },
];

const perStudent = (visits, unique) => (unique > 0 ? round1(visits / unique) : null);

export const computeStudents = (ds, ref, period) => {
  const visits = (ds?.visits || []).filter(
    (visit) => visit.role === 'student' && inPeriod(visit.entryMs, period)
  );
  const registered = ref?.registered || { total: 0, byCourse: {}, byFaculty: {} };

  const group = () => ({ visits: 0, minutes: 0, people: new Set() });
  const byCourseStats = new Map([...COURSE_ORDER, COURSE_OTHER].map((course) => [course, group()]));
  const byFacultyStats = new Map();
  const visitsPerUser = new Map();
  let minutes = 0;

  const { rows: series, indexOf } = makeSeries(period, ['visits']);
  const bucketPeople = series.map(() => new Set());
  const bucketMinutes = series.map(() => 0);

  visits.forEach((visit) => {
    minutes += visit.durationMin;
    visitsPerUser.set(visit.userId, (visitsPerUser.get(visit.userId) || 0) + 1);

    // Year and faculty as written in the profile today (there is no history of them).
    const student = ref?.studentById?.get(visit.userId);
    const course = byCourseStats.has(student?.course) ? student.course : COURSE_OTHER;
    const faculty = student?.faculty || NOT_SPECIFIED;
    if (!byFacultyStats.has(faculty)) byFacultyStats.set(faculty, group());
    [byCourseStats.get(course), byFacultyStats.get(faculty)].forEach((stats) => {
      stats.visits += 1;
      stats.minutes += visit.durationMin;
      stats.people.add(visit.userId);
    });

    const index = indexOf(visit.entryMs);
    if (index < 0) return;
    series[index].visits += 1;
    bucketPeople[index].add(visit.userId);
    bucketMinutes[index] += visit.durationMin;
  });

  series.forEach((row, index) => {
    row.unique = row.isFuture ? null : bucketPeople[index].size;
    row.hours = row.isFuture ? null : hoursOf(bucketMinutes[index]);
  });

  // Years 1–6 always (zeros are information); "Other" only when somebody is in it.
  const byCourse = [];
  byCourseStats.forEach((stats, course) => {
    const registeredHere = registered.byCourse?.[course] || 0;
    if (course === COURSE_OTHER && registeredHere === 0 && stats.visits === 0) return;
    byCourse.push({
      course,
      label: courseLabel(course),
      registered: registeredHere,
      unique: stats.people.size,
      visits: stats.visits,
      hours: hoursOf(stats.minutes),
      coveragePct: pct(stats.people.size, registeredHere),
      coverageText: shareText(stats.people.size, registeredHere),
      visitsPerStudent: perStudent(stats.visits, stats.people.size),
    });
  });

  // Faculties that visited in this period. A faculty with fewer than 3 registered students
  // is merged into "Other" (the group size, not the number of visitors, is what could point
  // at a person), so the fold does not change from period to period. Most visits first,
  // "Other" last.
  const facultyRows = [...byFacultyStats.entries()].map(([faculty, stats]) => ({
    faculty,
    registered: registered.byFaculty?.[faculty] || 0,
    unique: stats.people.size,
    visits: stats.visits,
    minutes: stats.minutes,
  }));
  const byFaculty = foldSmall(facultyRows, { peopleKey: 'registered', labelKey: 'faculty' })
    .map(({ minutes: facultyMinutes, ...row }) => ({ ...row, hours: hoursOf(facultyMinutes) }))
    .sort(
      (a, b) =>
        (a.faculty === OTHER_LABEL) - (b.faculty === OTHER_LABEL) ||
        b.visits - a.visits ||
        a.faculty.localeCompare(b.faculty)
    );

  const frequency = FREQUENCY_BUCKETS.map(({ bucket, label }) => ({ bucket, label, students: 0 }));
  visitsPerUser.forEach((count) => {
    const index = FREQUENCY_BUCKETS.findIndex((range) => count >= range.min && count <= range.max);
    if (index >= 0) frequency[index].students += 1;
  });

  const uniqueStudents = visitsPerUser.size;
  const medianMin = median(visits.map((visit) => visit.durationMin));

  return {
    totals: {
      visits: visits.length,
      uniqueStudents,
      trainingHours: hoursOf(minutes),
      medianVisitMin: medianMin === null ? null : Math.round(medianMin),
      visitsPerStudent: perStudent(visits.length, uniqueStudents),
      registered: registered.total || 0,
      coveragePct: pct(uniqueStudents, registered.total || 0),
      coverageText: shareText(uniqueStudents, registered.total || 0),
    },
    byCourse,
    byFaculty,
    series,
    frequency,
  };
};
