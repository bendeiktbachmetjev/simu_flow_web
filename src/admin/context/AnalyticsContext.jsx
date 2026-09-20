// Analytics data for the whole admin area: the full history is loaded ONCE per session, turned
// into one cleaned dataset, and every period is then computed in memory. Changing the period
// never touches the network. The calendar does not depend on anything in this file.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAdmin } from './AdminContext';
import { STALE_MS, STORAGE, TIMEZONE } from '../data/constants.js';
import { DataError, toDataError } from '../data/errors.js';
import { buildReference } from '../data/buildReference.js';
import { loadReference } from '../data/loadReference.js';
import { loadHistory } from '../data/loadHistory.js';
import { buildDataset } from '../data/buildDataset.js';
import { DEFAULT_PRESET, PRESETS, addDays, canShiftPeriod, previousPeriod, resolvePeriod } from '../data/period.js';
import { comparable, makeDelta } from '../data/metrics/shared.js';
import { computeOverview } from '../data/metrics/overview.js';
import { computeVisitors } from '../data/metrics/visitors.js';
import { computeStudents } from '../data/metrics/students.js';
import { computeClasses } from '../data/metrics/classes.js';
import { computeSimulators } from '../data/metrics/simulators.js';
import { computeRooms } from '../data/metrics/rooms.js';
import { computeGuests } from '../data/metrics/guests.js';

// ---------------------------------------------------------------------------
// Module-level cache: survives page switches and provider remounts.
// ---------------------------------------------------------------------------

let cache = null; // { universityKey, ref, raw, dataset, loadedAt }
let inflight = null; // { universityKey, promise, controller }
let generation = 0; // bumped by resetAnalyticsCache so a late result of an old load is dropped

const metricMemo = new Map();
let memoDataset = null;
const MEMO_LIMIT = 160;

export function resetAnalyticsCache() {
  generation += 1;
  cache = null;
  if (inflight) {
    inflight.controller.abort();
    inflight = null;
  }
  metricMemo.clear();
  memoDataset = null;
}

async function loadAll({ university, demo, signal }) {
  if (import.meta.env.DEV && demo) {
    // Generated rows, then exactly the same Reference builder, cleaning and metrics as live data.
    const demoData = await import('../dev/demoData.js');
    const nowMs = Date.now();
    const ref = buildReference(university, demoData.makeDemoReferenceRows(), nowMs);
    const raw = demoData.makeDemoRaw(nowMs);
    return { ref, raw, dataset: buildDataset(raw, ref, nowMs) };
  }
  const ref = await loadReference(university, signal);
  const raw = await loadHistory(ref, signal);
  return { ref, raw, dataset: buildDataset(raw, ref, Date.now()) };
}

// One load at a time per university: a second caller (React StrictMode mounts effects twice,
// a refresh click during the first load) gets the promise that is already running.
function startLoad(universityKey, params) {
  if (inflight && inflight.universityKey === universityKey) return inflight.promise;
  if (inflight) inflight.controller.abort();

  const controller = new AbortController();
  const startedIn = generation;
  const promise = loadAll({ ...params, signal: controller.signal })
    .then((result) => {
      if (startedIn !== generation || controller.signal.aborted) throw new DataError('ABORTED');
      cache = { universityKey, ...result, loadedAt: Date.now() };
      return cache;
    })
    .finally(() => {
      if (inflight && inflight.controller === controller) inflight = null;
    });

  inflight = { universityKey, promise, controller };
  return promise;
}

const EMPTY_FLAGS = { isRefetching: false, isStale: false };

function stateFor(universityKey) {
  if (!universityKey) {
    return {
      key: null, status: 'error', dataset: null, ref: null,
      error: new DataError('NO_UNIVERSITY'), lastUpdated: null, ...EMPTY_FLAGS,
    };
  }
  if (cache && cache.universityKey === universityKey) {
    return {
      key: universityKey, status: 'ready', dataset: cache.dataset, ref: cache.ref,
      error: null, lastUpdated: cache.loadedAt, ...EMPTY_FLAGS,
    };
  }
  return {
    key: universityKey, status: 'loading', dataset: null, ref: null,
    error: null, lastUpdated: null, ...EMPTY_FLAGS,
  };
}

// ---------------------------------------------------------------------------
// Period persistence
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRESET_IDS = PRESETS.map((preset) => preset.id);
const DEFAULT_PERIOD_STATE = { preset: DEFAULT_PRESET, offset: 0 };
const MIN_OFFSET = -240;

const isValidRange = (from, to) =>
  typeof from === 'string' && typeof to === 'string' && DATE_RE.test(from) && DATE_RE.test(to) && from <= to;

function readStoredPeriod() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE.period));
    if (!stored || !PRESET_IDS.includes(stored.preset)) return DEFAULT_PERIOD_STATE;
    if (stored.preset === 'custom') {
      return isValidRange(stored.from, stored.to)
        ? { preset: 'custom', from: stored.from, to: stored.to }
        : DEFAULT_PERIOD_STATE;
    }
    const offset = Number.isInteger(stored.offset) ? Math.min(0, Math.max(MIN_OFFSET, stored.offset)) : 0;
    return { preset: stored.preset, offset };
  } catch {
    return DEFAULT_PERIOD_STATE;
  }
}

function storePeriod(periodState) {
  try {
    window.localStorage.setItem(STORAGE.period, JSON.stringify(periodState));
  } catch {
    // Storage can be blocked; the choice then lasts for this visit only.
  }
}

// ---------------------------------------------------------------------------
// Time zone note
// ---------------------------------------------------------------------------

// Wall-clock offset of a zone at an instant, in minutes east of UTC.
function zoneOffsetMin(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  }).formatToParts(new Date(ms));
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - Math.floor(ms / 60000) * 60000) / 60000);
}

// Class plans are stored as Vilnius wall-clock and parsed in the browser's zone (the calendar
// does the same). A zone that keeps the same clock as Vilnius (Riga, Helsinki…) is harmless,
// so the note appears only when the clocks really differ, in winter or in summer.
function detectTzWarning() {
  try {
    if (new Intl.DateTimeFormat().resolvedOptions().timeZone === TIMEZONE) return false;
    const year = new Date().getFullYear();
    return [Date.UTC(year, 0, 15, 12), Date.UTC(year, 6, 15, 12)].some(
      (ms) => zoneOffsetMin(ms, TIMEZONE) !== -new Date(ms).getTimezoneOffset()
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

const COMPUTE = {
  visitors: computeVisitors,
  students: computeStudents,
  classes: computeClasses,
  simulators: computeSimulators,
  rooms: computeRooms,
  guests: computeGuests,
};

// Keyed `${dataset.id}|${period.key}|${name}|${JSON(opts)}`; emptied when the dataset changes.
// Overview also depends on the comparison window, so its key carries that window too
// (the overview OF a previous window is computed without one and must not be mixed up
// with the same window selected as the main period).
function runMetric(name, dataset, ref, period, prevPeriod, opts, optsKey) {
  if (memoDataset !== dataset) {
    metricMemo.clear();
    memoDataset = dataset;
  }
  const isOverview = name === 'overview';
  const key = `${dataset.id}|${period.key}|${name}|${optsKey}${isOverview ? `|${prevPeriod ? prevPeriod.key : '-'}` : ''}`;
  if (metricMemo.has(key)) return metricMemo.get(key);

  const value = isOverview
    ? computeOverview(dataset, ref, period, prevPeriod)
    : COMPUTE[name](dataset, ref, period, opts);

  if (metricMemo.size >= MEMO_LIMIT) metricMemo.delete(metricMemo.keys().next().value);
  metricMemo.set(key, value);
  return value;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const DataContext = createContext(null);
const PeriodContext = createContext(null);

export function AnalyticsProvider({ children }) {
  const { admin, isDemo } = useAdmin();
  const university = admin?.university ?? null;
  const demo = import.meta.env.DEV && Boolean(isDemo);
  const universityKey = university ? `${demo ? 'demo' : 'live'}|${admin.id}|${university}` : null;

  const [data, setData] = useState(() => stateFor(universityKey));
  const [periodState, setPeriodState] = useState(readStoredPeriod);
  const [mountedAtMs] = useState(() => Date.now());
  const [tzWarning] = useState(detectTzWarning);

  // Only the latest subscription may write state (StrictMode double effects, refresh clicks).
  const subscriptionRef = useRef(null);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const follow = useCallback((promise) => {
    const token = {};
    subscriptionRef.current = token;
    return promise.then(
      (entry) => {
        if (subscriptionRef.current !== token) return;
        setData({
          key: entry.universityKey, status: 'ready', dataset: entry.dataset, ref: entry.ref,
          error: null, lastUpdated: entry.loadedAt, ...EMPTY_FLAGS,
        });
      },
      (err) => {
        if (subscriptionRef.current !== token) return;
        const error = toDataError(err);
        setData((current) => {
          // ABORTED = sign-out or a newer load took over; never shown as an error.
          if (error.code === 'ABORTED') return { ...current, isRefetching: false };
          // A failed refresh keeps what is on screen and marks it stale.
          if (current.dataset) return { ...current, error, isStale: true, isRefetching: false };
          return { ...current, status: 'error', error, isRefetching: false };
        });
      }
    );
  }, []);

  const refresh = useCallback(() => {
    if (!universityKey) return Promise.resolve();
    setData((current) =>
      current.dataset
        ? { ...current, isRefetching: true }
        : { ...current, status: 'loading', error: null }
    );
    return follow(startLoad(universityKey, { university, demo }));
  }, [universityKey, university, demo, follow]);

  // First load (or a cache hit), and again whenever the administrator's university changes.
  useEffect(() => {
    const initial = stateFor(universityKey);
    setData((current) => (current.key === initial.key && current.status === initial.status ? current : initial));

    if (universityKey) {
      const cached = cache && cache.universityKey === universityKey;
      if (!cached) {
        follow(startLoad(universityKey, { university, demo }));
      } else if (Date.now() - cache.loadedAt > STALE_MS) {
        setData((current) => ({ ...current, isRefetching: true }));
        follow(startLoad(universityKey, { university, demo }));
      }
    }

    return () => {
      subscriptionRef.current = null;
    };
  }, [universityKey, university, demo, follow]);

  // Coming back to the tab after a while: refresh quietly in the background.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const current = dataRef.current;
      if (!current.dataset || current.isRefetching) return;
      if (Date.now() - current.lastUpdated > STALE_MS) refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [refresh]);

  useEffect(() => {
    storePeriod(periodState);
  }, [periodState]);

  // The dataset's own clock keeps periods, "elapsed" hours and buckets consistent with the data.
  const { dataset } = data;
  const nowMs = dataset?.nowMs ?? mountedAtMs;
  const firstActivityMs = dataset?.firstActivityMs ?? null;

  const period = useMemo(
    () =>
      resolvePeriod(periodState.preset, nowMs, {
        offset: periodState.offset ?? 0,
        custom: periodState.preset === 'custom' ? { from: periodState.from, to: periodState.to } : null,
        firstActivityMs,
      }),
    [periodState, nowMs, firstActivityMs]
  );

  // Null for All time, and whenever the window before has nothing recorded to compare with.
  const prevPeriod = useMemo(() => {
    if (!dataset) return null;
    const previous = previousPeriod(period);
    return previous && comparable(dataset, previous) ? previous : null;
  }, [dataset, period]);

  const canShift = useMemo(
    () => canShiftPeriod(period, nowMs, { firstActivityMs }),
    [period, nowMs, firstActivityMs]
  );

  const setPreset = useCallback(
    (id) => {
      if (!PRESET_IDS.includes(id)) return;
      if (id !== 'custom') {
        setPeriodState({ preset: id, offset: 0 });
        return;
      }
      // "Custom" without dates starts from the range that is on screen (its elapsed part;
      // `effTo` and `to` are exclusive, the stored end is inclusive).
      const endExclusive = period.effTo > period.from ? period.effTo : period.to;
      setPeriodState((current) =>
        current.preset === 'custom' ? current : { preset: 'custom', from: period.from, to: addDays(endExclusive, -1) }
      );
    },
    [period]
  );

  const setCustom = useCallback((fromISO, toInclusiveISO) => {
    if (!isValidRange(fromISO, toInclusiveISO)) return false;
    setPeriodState({ preset: 'custom', from: fromISO, to: toInclusiveISO });
    return true;
  }, []);

  // Steps from the RESOLVED period, which can differ from the stored choice when that was unusable.
  const shift = useCallback(
    (direction) => {
      const step = direction < 0 ? -1 : 1;
      if ((step < 0 && !canShift.prev) || (step > 0 && !canShift.next)) return;
      setPeriodState({ preset: period.preset, offset: period.offset + step });
    },
    [canShift, period]
  );

  const dataValue = useMemo(
    () => ({
      status: data.status,
      dataset: data.dataset,
      ref: data.ref,
      error: data.error,
      isRefetching: data.isRefetching,
      isStale: data.isStale,
      lastUpdated: data.lastUpdated,
      refresh,
      tzWarning,
    }),
    [data, refresh, tzWarning]
  );

  const periodValue = useMemo(
    () => ({
      period,
      prevPeriod,
      presets: PRESETS,
      setPreset,
      setCustom,
      shift,
      canShift,
      compareLabel: prevPeriod?.compareLabel ?? null,
    }),
    [period, prevPeriod, setPreset, setCustom, shift, canShift]
  );

  return (
    <DataContext.Provider value={dataValue}>
      <PeriodContext.Provider value={periodValue}>{children}</PeriodContext.Provider>
    </DataContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAnalytics() {
  const value = useContext(DataContext);
  if (!value) throw new Error('useAnalytics must be used inside AnalyticsProvider');
  return value;
}

export function usePeriod() {
  const value = useContext(PeriodContext);
  if (!value) throw new Error('usePeriod must be used inside AnalyticsProvider');
  return value;
}

/**
 * useMetric('students') → { data, prev, status, error, isRefetching, isStale, period, prevPeriod,
 *                           compareLabel, delta }
 * `prev` has the same shape for the comparison window, or is null when there is nothing to
 * compare with. `delta(pick, kind)` is makeDelta over both, e.g.
 * delta((d) => d.totals.visits) or delta((d) => d.totals.coveragePct, 'pp').
 */
export function useMetric(name, opts) {
  const { status, dataset, ref, error, isRefetching, isStale } = useAnalytics();
  const { period, prevPeriod, compareLabel } = usePeriod();
  const optsKey = opts == null ? '' : JSON.stringify(opts);

  return useMemo(() => {
    if (name !== 'overview' && !COMPUTE[name]) throw new Error(`Unknown metric "${name}"`);

    let data = null;
    let prev = null;
    if (dataset && ref) {
      const stableOpts = optsKey ? JSON.parse(optsKey) : undefined;
      data = runMetric(name, dataset, ref, period, prevPeriod, stableOpts, optsKey);
      prev = prevPeriod ? runMetric(name, dataset, ref, prevPeriod, null, stableOpts, optsKey) : null;
    }

    const delta = (pick, kind = 'pct') => {
      if (!data) return null;
      return makeDelta(pick(data), prev ? pick(prev) : null, { kind, comparable: Boolean(prev) });
    };

    return { data, prev, status, error, isRefetching, isStale, period, prevPeriod, compareLabel, delta };
  }, [name, optsKey, dataset, ref, period, prevPeriod, compareLabel, status, error, isRefetching, isStale]);
}

export const useOverview = (opts) => useMetric('overview', opts);
export const useVisitors = (opts) => useMetric('visitors', opts);
export const useStudents = (opts) => useMetric('students', opts);
export const useClasses = (opts) => useMetric('classes', opts);
export const useSimulators = (opts) => useMetric('simulators', opts);
export const useRooms = (opts) => useMetric('rooms', opts);
export const useGuests = (opts) => useMetric('guests', opts);
