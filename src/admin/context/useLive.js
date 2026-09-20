// "Right now" numbers: polled once a minute while the tab is visible. Independent of the period.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdmin } from './AdminContext';
import { useAnalytics } from './AnalyticsContext';
import { LIVE_INTERVAL_MS } from '../data/constants.js';
import { toDataError } from '../data/errors.js';
import { loadLive, scopeLive } from '../data/loadLive.js';
import { computeLive } from '../data/metrics/live.js';

// Last successful read, kept across page switches so Overview → Simulators does not refetch
// within the same minute. Tied to the Reference object: a new sign-in or a data refresh
// produces a new Reference and therefore a fresh read.
let lastLive = null; // { ref, raw, updatedAt }

const EMPTY = { raw: null, updatedAt: null, error: null, isStale: false };

const stateFor = (ref) =>
  lastLive && ref && lastLive.ref === ref
    ? { raw: lastLive.raw, updatedAt: lastLive.updatedAt, error: null, isStale: false }
    : EMPTY;

export function useLive({ enabled = true } = {}) {
  const { isDemo } = useAdmin();
  const { status: analyticsStatus, error: analyticsError, ref, dataset } = useAnalytics();
  const demo = import.meta.env.DEV && Boolean(isDemo);

  const [state, setState] = useState(() => stateFor(ref));
  const controllerRef = useRef(null); // the read in flight, if any

  const load = useCallback(async () => {
    if (!ref || controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const nowMs = Date.now();
      let raw;
      if (import.meta.env.DEV && demo) {
        const demoData = await import('../dev/demoData.js');
        raw = scopeLive({ nowMs, ...demoData.makeDemoLive(nowMs) }, ref);
      } else {
        raw = await loadLive(ref, nowMs, controller.signal);
      }
      if (controller.signal.aborted) return;
      lastLive = { ref, raw, updatedAt: nowMs };
      setState({ raw, updatedAt: nowMs, error: null, isStale: false });
    } catch (err) {
      const error = toDataError(err);
      // Keep the last numbers on screen; the strip only turns its dot gray.
      if (error.code !== 'ABORTED' && !controller.signal.aborted) {
        setState((current) => ({ ...current, error, isStale: true }));
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [ref, demo]);

  useEffect(() => {
    if (!enabled || !ref) return undefined;

    const lastReadAt = () => (lastLive && lastLive.ref === ref ? lastLive.updatedAt : 0);
    if (Date.now() - lastReadAt() >= LIVE_INTERVAL_MS) load();

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, LIVE_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastReadAt() >= LIVE_INTERVAL_MS) load();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [enabled, ref, load]);

  const { raw } = state;
  const data = useMemo(
    () => (raw && ref ? computeLive(raw, ref, raw.nowMs, dataset) : null),
    [raw, ref, dataset]
  );

  let status = 'loading';
  let error = state.error;
  if (data) status = 'ready';
  else if (analyticsStatus === 'error') {
    status = 'error';
    error = analyticsError;
  } else if (state.error) status = 'error';

  return { data, status, error, isStale: state.isStale, updatedAt: state.updatedAt, refresh: load };
}
