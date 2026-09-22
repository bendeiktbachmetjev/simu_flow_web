// Shared constants for the admin analytics.
// Pure file: no React, no Supabase, no window — it is also imported by the Node tests.
import { DEFAULT_OPEN_HOUR, DEFAULT_CLOSE_HOUR } from '../../components/timeline/model.js';

// Opening hours are the same ones the calendar draws, so "available hours" and the
// timeline grid can never disagree.
export const OPEN_HOUR = DEFAULT_OPEN_HOUR; // 8
export const CLOSE_HOUR = DEFAULT_CLOSE_HOUR; // 20
export const WORKDAYS = [1, 2, 3, 4, 5]; // ISO weekdays, Mon–Fri
export const TIMEZONE = 'Europe/Vilnius';

// Analytics count from this Vilnius calendar day on. The center started real operation in
// September 2026; earlier rows are pilot/demo data and would dilute every occupancy %.
// The rule itself ("does this day count?") lives in one block of period.js.
export const STATS_START_DATE = '2026-09-01';

// Visit cleaning (center_sessions)
export const VISIT_MIN_MIN = 1; // shorter = accidental tap
export const VISIT_MAX_MIN = 480; // a visit never counts for more than 8 h
export const VISIT_FALLBACK_MEDIAN_MIN = 120;

// Simulator session cleaning (simulator_sessions)
export const SIM_MIN_MIN = 1;
export const SIM_MAX_MIN = 240;
export const SIM_FALLBACK_MEDIAN_MIN = 20;

// A median is trusted only when it comes from at least this many normally closed rows.
export const BASELINE_MIN_SAMPLE = 20;

// Rows that cover fewer people than this are folded into "Other".
export const PRIVACY_MIN_PEOPLE = 3;

// Loading
export const PAGE_SIZE = 1000; // PostgREST row cap
export const MAX_ROWS = 50000; // above this a table is reported as TRUNCATED
export const IN_CHUNK = 150; // ids per .in() filter (URL length)
export const STALE_MS = 5 * 60 * 1000;
export const LIVE_INTERVAL_MS = 60 * 1000;

// Rooms heatmap: two-hour slots between OPEN_HOUR and CLOSE_HOUR.
export const HEAT_SLOT_MIN = 120;

export const STORAGE = {
  period: 'simuflow.admin.period',
  lastSection: 'simuflow.admin.lastSection',
  returnTo: 'simuflow.admin.returnTo', // sessionStorage
  demo: 'simuflow.admin.demo', // dev server only
};

export const ROLE_ORDER = ['student', 'teacher', 'resident', 'guest'];
export const ROLE_LABELS = {
  student: 'Students',
  teacher: 'Teachers',
  resident: 'Residents',
  guest: 'Guests (app)',
};
