// Support chat threads for the whole admin area: mounted once in the shell, so the floating chat
// button can show how many people wait for a reply on every page, and its panel reuses the
// same list and the same realtime channel. Only the threads view is read here (one row per
// conversation); the messages of a conversation are read when it is opened (useConversation).
//
// Fresh data comes from three places: a realtime channel on new support_messages rows, a quiet
// re-read on a timer while the tab is visible (every 30 s when realtime is down, every 60 s as a
// safety net when it is up), and one re-read each time the channel (re)connects, which picks up
// whatever was written while it was not listening.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAdmin } from './AdminContext';
import { DataError, toDataError } from '../data/errors.js';
import { liveSupport } from '../data/support/loadSupport.js';
import {
  applyMessageToThreads,
  findThread,
  normalizeMessage,
  normalizeThreads,
  waitingCount as countWaiting,
} from '../data/support/threads.js';

const POLL_MS = 30 * 1000;
const POLL_LIVE_MS = 60 * 1000;

// "(2) SimuFlow" while two people wait for a reply.
const TITLE_COUNT = /^\(\d+\+?\) /;

async function sourceFor(demo, admin) {
  if (import.meta.env.DEV && demo) {
    const demoSupport = await import('../dev/demoSupport.js');
    return demoSupport.demoSupportSource(admin, Date.now());
  }
  return liveSupport;
}

const LOADING = { status: 'loading', threads: [], error: null, isStale: false, updatedAt: null };
const NO_UNIVERSITY = { ...LOADING, status: 'error', error: new DataError('NO_UNIVERSITY') };

const SupportContext = createContext(null);

export function SupportProvider({ children }) {
  const { admin, isDemo } = useAdmin();
  const demo = import.meta.env.DEV && Boolean(isDemo);
  const universityKey = admin?.university ? `${demo ? 'demo' : 'live'}|${admin.id}|${admin.university}` : null;

  const [state, setState] = useState(() => (universityKey ? LOADING : NO_UNIVERSITY));
  const [live, setLive] = useState(false);

  const controllerRef = useRef(null); // the threads read in flight, if any
  const pendingRef = useRef(false); // something changed while that read was on its way
  const lastReadRef = useRef(0);
  const liveRef = useRef(false);
  const threadsRef = useRef(state.threads);
  const listenersRef = useRef(new Set());
  const loadRef = useRef(null);

  useEffect(() => {
    threadsRef.current = state.threads;
  }, [state.threads]);

  const getSource = useCallback(() => sourceFor(demo, admin), [demo, admin]);

  const load = useCallback(async () => {
    if (!universityKey) return;
    if (controllerRef.current) {
      pendingRef.current = true;
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    pendingRef.current = false;
    let readAgain = false;
    try {
      const source = await getSource();
      const rows = await source.loadThreads(controller.signal);
      if (controller.signal.aborted) return;
      lastReadRef.current = Date.now();
      // A message arrived while this read was on its way, so its answer may already be behind the
      // list on screen: read once more instead of showing it (a first answer is shown anyway).
      readAgain = pendingRef.current;
      if (!readAgain || threadsRef.current.length === 0) {
        setState({ status: 'ready', threads: normalizeThreads(rows), error: null, isStale: false, updatedAt: Date.now() });
      }
    } catch (err) {
      const error = toDataError(err);
      // A failed re-read keeps the list on screen and marks it stale.
      if (error.code !== 'ABORTED' && !controller.signal.aborted) {
        setState((current) =>
          current.status === 'ready' ? { ...current, error, isStale: true } : { ...current, status: 'error', error }
        );
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (readAgain && !controller.signal.aborted) loadRef.current?.();
    }
  }, [universityKey, getSource]);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  // A new message from realtime, or the administrator's own reply from the page. Threads that are
  // already listed update in place; a person who writes for the first time needs the threads view
  // for the name, so the list is read again. Listeners (the open conversation) get every message.
  const receive = useCallback(
    (row) => {
      const message = normalizeMessage(row);
      if (!message) return;
      if (!findThread(threadsRef.current, message.clientId)) load();
      else if (controllerRef.current) pendingRef.current = true;
      setState((current) => {
        const threads = applyMessageToThreads(current.threads, message);
        return threads === current.threads ? current : { ...current, threads };
      });
      listenersRef.current.forEach((listener) => listener(message));
    },
    [load]
  );

  const receiveRef = useRef(receive);
  useEffect(() => {
    receiveRef.current = receive;
  }, [receive]);

  // First read, then the timer. The timer ticks every POLL_MS and reads when the last good read is
  // older than the interval that fits the realtime state.
  useEffect(() => {
    if (!universityKey) return undefined;
    load();

    const due = (interval) => Date.now() - lastReadRef.current >= interval;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && due(liveRef.current ? POLL_LIVE_MS : POLL_MS)) load();
    }, POLL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && due(POLL_MS)) load();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      controllerRef.current?.abort();
      controllerRef.current = null;
      pendingRef.current = false;
    };
  }, [universityKey, load]);

  // Realtime: one channel for the whole admin area. RLS delivers only this university's rows.
  useEffect(() => {
    if (!universityKey) return undefined;
    let active = true;
    let unsubscribe = null;

    getSource().then(
      (source) => {
        if (!active) return;
        unsubscribe = source.subscribe({
          onInsert: (row) => {
            if (active) receiveRef.current(row);
          },
          onStatus: (status) => {
            if (!active) return;
            const isLive = status === 'SUBSCRIBED';
            const wasLive = liveRef.current;
            liveRef.current = isLive;
            setLive(isLive);
            if (isLive && !wasLive) loadRef.current?.();
          },
        });
      },
      (err) => console.error(err)
    );

    return () => {
      active = false;
      unsubscribe?.();
      liveRef.current = false;
      setLive(false);
    };
  }, [universityKey, getSource]);

  const waiting = useMemo(() => countWaiting(state.threads), [state.threads]);

  // The tab title counts the people waiting, so a background tab still shows it.
  useEffect(() => {
    const base = document.title.replace(TITLE_COUNT, '');
    return () => {
      document.title = base;
    };
  }, []);

  useEffect(() => {
    const base = document.title.replace(TITLE_COUNT, '');
    document.title = waiting > 0 ? `(${waiting}) ${base}` : base;
  }, [waiting]);

  // `listener(message)` for every new message (normalized); returns the unsubscribe.
  const onMessage = useCallback((listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value = useMemo(
    () => ({
      status: state.status,
      threads: state.threads,
      error: state.error,
      isStale: state.isStale,
      updatedAt: state.updatedAt,
      waitingCount: waiting,
      live,
      refresh: load,
      receive,
      onMessage,
      getSource,
    }),
    [state, waiting, live, load, receive, onMessage, getSource]
  );

  return <SupportContext.Provider value={value}>{children}</SupportContext.Provider>;
}

/**
 * → { status: 'loading'|'ready'|'error', threads, error, isStale, updatedAt, waitingCount, live,
 *     refresh(), receive(row), onMessage(listener), getSource() }
 */
export function useSupport() {
  const value = useContext(SupportContext);
  if (!value) throw new Error('useSupport must be used inside SupportProvider');
  return value;
}
