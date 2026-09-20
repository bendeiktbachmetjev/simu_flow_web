// Every "how we count" text of the admin analytics, in one place.
//   short — the one-line hint under a card title (exact wording of the page specs)
//   long  — optional second paragraph for the (i) popover and the print appendix
//   template — a `short` with {placeholders}; fill it with fillHint()
// Plain language on purpose: the readers are the center's administrator and the dean.

const BOOKED_VS_USED =
  'Booked = calendar reservations up to today. Used = NFC sessions. Classes pre-select every simulator the teacher may use, so bookings run high.';
const CLASSES_BY_CLINIC =
  'A class counts once for each clinic of its teacher, so rows can add up to more than the total.';
const ROOMS_HEAT =
  'From bookings, not live use. Colour is relative to the busiest slot; the number is the true share of room-hours booked.';
const OVER_TIME =
  'Visits by day, week or month of the tap-in. A person active in two buckets is counted once in each.';
const LIVE_NOW =
  'In use = an NFC session is running on the simulator. Booked = a class or event reserves it at this minute. Rooms come from bookings, not live use. People who tapped in today and have not tapped out are counted as inside.';

export const DEFINITIONS = {
  // --- Right now (Overview strip, Simulators live card) --------------------------------------
  liveNow: {
    short: LIVE_NOW,
    long: 'A tap-in older than 8 hours, or a simulator session older than 4 hours, is treated as a forgotten tap-out and not shown as running.',
  },

  // --- Overview: headline numbers ------------------------------------------------------------
  studentVisits: {
    short: 'Each tap-in counts once. Double taps are merged; taps under 1 minute are ignored.',
    long: 'A visit belongs to the day of its tap-in. Visits by accounts that were deleted since are left out of every total.',
  },
  uniqueStudents: {
    short:
      'Different students who came at least once. The share is of students registered in the app, not of the whole faculty.',
    long: 'A student who came ten times counts once. Registered = student accounts of this university in SimuFlow today.',
  },
  classesHeld: {
    short:
      "Held = NFC activity during the class: simulator use, the teacher on site, or the class's students on site. Not an attendance list.",
    long: "A class with none of these is shown as 'no activity recorded'. That is not the same as cancelled: cancelled classes are deleted and cannot be counted. Classes that have not started yet are 'upcoming'.",
  },
  utilisation: {
    short:
      'Hours with a running NFC session ÷ open hours (Mon–Fri 08–20, up to today). Public holidays are not excluded.',
    long: 'Every simulator is assumed available on every working day since recording began. A group working on one simulator counts once: this is device time, not person-hours.',
  },
  trainingHours: {
    short:
      'Time students spent inside the center. If a student forgot to tap out, a typical visit length is used (never more than 8 h).',
    long: 'The whole visit is credited to the day of the tap-in. Simulator hours are a different measure (device time) and are never added to training hours.',
  },

  // --- Overview: blocks ---------------------------------------------------------------------------
  activityOverTime: { short: OVER_TIME },
  highlights: { short: 'Computed from the numbers on this page.' },
  whoVisits: {
    short: 'All roles that tap in are counted. Guests (app) = accounts created with an event code.',
  },
  studentsByYear: { short: "Year as written in the student's profile today." },
  classesByClinic: { short: CLASSES_BY_CLINIC },
  bookedVsUsed: { short: BOOKED_VS_USED },
  roomsHeat: { short: ROOMS_HEAT },
  comingLater: {
    short:
      'Coming later: training quality (feedback) and cost per student. SimuFlow does not collect this data yet.',
  },

  // --- Students -------------------------------------------------------------------------------------
  reach: {
    short: 'Of students registered in SimuFlow today. Real year-group sizes are not in the system.',
  },
  studentVisitsOverTime: { short: OVER_TIME },
  byYearOfStudy: {
    short:
      "Year as written in the student's profile today. Reach = visited ÷ registered in the app for that year.",
  },
  byFaculty: {
    short:
      "Faculty as typed at registration, cleaned up ('Medicina' → 'Medicine'). SimuFlow has no study-programme field yet. Faculties with fewer than 3 students are merged into Other.",
  },
  visitFrequency: { short: 'Number of visits per student in this period.' },
  dataNotes: { short: 'Why totals may differ from raw tap counts.' },

  // --- Classes --------------------------------------------------------------------------------------
  heldInferred: {
    short: 'Held = inferred from NFC activity, not from an attendance list.',
    long: "Evidence is a simulator session on a booked simulator, a visit of the teacher, or a visit of a student of the class's year and group — each inside the planned time.",
  },
  classesOverTime: {
    short:
      "'No activity recorded' is not the same as cancelled: cancelled classes are deleted and cannot be counted.",
  },
  whoOrganises: {
    short: 'Guest events are created by center staff; classes by teachers in the app.',
  },
  classesByYear: { short: 'Year chosen by the teacher when planning.' },
  classList: { short: 'Evidence comes from NFC taps inside the class time.' },
  classesNotRecorded: {
    short: 'Class type (BLS, ALS, OSCE…) and cancellations are not recorded in SimuFlow yet.',
  },

  // --- Simulators -----------------------------------------------------------------------------------
  realUse: {
    short:
      'Real use lies between the two: NFC misses use nobody tapped in; bookings overstate need. A group on one simulator counts once.',
  },
  simulatorHoursOverTime: { short: 'Device-occupied hours, not person-hours.' },
  bookedByClinic: {
    short: 'Booked simulator-hours of a class are credited to every clinic of its teacher.',
  },
  simulatorsNotRecorded: {
    short:
      'Downtime and maintenance are not recorded yet; every simulator is assumed available every weekday 08–20.',
  },

  // --- Rooms ----------------------------------------------------------------------------------------
  roomsSource: {
    short:
      'Rooms have no NFC tags: everything here comes from calendar bookings (classes + guest events), not from live use.',
  },
  roomsFreeNow: { short: 'From bookings.' },
  roomOccupancy: {
    short: 'Overlapping bookings of one room are merged; hours outside Mon–Fri 08–20 are not counted.',
    template:
      'Overlapping bookings of one room are merged; hours outside Mon–Fri 08–20 are not counted ({outsideHours} in this period).',
  },
  roomsRanking: {
    short: "Old room names that no longer exist are listed as 'Unlisted rooms' and left out of the %.",
  },

  // --- Guests ---------------------------------------------------------------------------------------
  guestsSource: {
    short:
      'Guest registrations come from the public sign-in form. They are not linked to events or entrance taps, and the form is shared by every university using SimuFlow.',
  },
  guestRegistrations: { short: 'Registrations = filled sign-in forms, not measured visits.' },
  guestsByCountry: { short: 'Country as chosen in the form.' },
  guestsByInstitution: {
    short: 'Free text, cleaned up; institutions with fewer than 3 people are merged.',
  },
  guestEvents: { short: 'Created by center staff in the calendar.' },
};

// DEFINITIONS[key].template with its {placeholders} filled in, e.g.
// fillHint('roomOccupancy', { outsideHours: '12 h' }). Falls back to `short` when the key has
// no template or a value is missing, so a sentence never shows a raw placeholder.
export const fillHint = (key, values = {}) => {
  const definition = DEFINITIONS[key];
  if (!definition) return '';
  if (!definition.template) return definition.short;
  let complete = true;
  const text = definition.template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = values[name];
    if (value === null || value === undefined || value === '') {
      complete = false;
      return match;
    }
    return String(value);
  });
  return complete ? text : definition.short;
};
