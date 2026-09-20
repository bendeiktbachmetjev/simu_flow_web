// Paging helpers for PostgREST reads. Pure file: the caller hands in a function that builds
// the Supabase query, so nothing here imports Supabase, React or window.
import { PAGE_SIZE, MAX_ROWS, IN_CHUNK } from './constants.js';
import { DataError, toDataError } from './errors.js';

export { DataError } from './errors.js';

const RETRY_DELAY_MS = 800;
const RETRYABLE = new Set(['NETWORK', 'TIMEOUT']);

const assertNotAborted = (signal, table) => {
  if (signal?.aborted) throw new DataError('ABORTED', null, { table });
};

// Resolves after `ms`, or rejects with ABORTED as soon as the signal fires.
const wait = (ms, signal, table) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DataError('ABORTED', null, { table }));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DataError('ABORTED', null, { table }));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Promise.all for loads that only make sense together: the first failure (or an abort of the
 * outer signal) cancels the requests that are still running instead of letting them finish unused.
 * `makeTasks(linkedSignal)` returns the array of promises.
 */
export async function allOrNothing(signal, makeTasks) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', onAbort, { once: true });
  try {
    return await Promise.all(makeTasks(controller.signal));
  } catch (err) {
    controller.abort();
    throw toDataError(err);
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

async function fetchPage(build, { offset, size, withCount, signal, table }) {
  assertNotAborted(signal, table);
  let response;
  try {
    let query = build(withCount ? { count: 'exact' } : {}).range(offset, offset + size - 1);
    if (signal && typeof query.abortSignal === 'function') query = query.abortSignal(signal);
    response = await query;
  } catch (err) {
    throw toDataError(err, { table });
  }
  // An abort can surface as a generic fetch failure; the signal is the source of truth.
  assertNotAborted(signal, table);
  if (response?.error) throw toDataError(response.error, { table, status: response.status });
  return {
    data: Array.isArray(response?.data) ? response.data : [],
    count: typeof response?.count === 'number' && Number.isFinite(response.count) ? response.count : null,
  };
}

/**
 * Reads every row of one query, page by page.
 * `build(selectOpts)` must return a FRESH builder each call, with all filters applied and an
 * `.order()` chain that ends in a unique column, so pages never overlap or skip rows.
 */
export async function fetchAllPages(build, { pageSize = PAGE_SIZE, maxRows = MAX_ROWS, signal, table = null } = {}) {
  const rows = [];
  const seenIds = new Set();
  let size = Math.max(1, Math.floor(pageSize));
  let offset = 0;
  let total = null;
  let first = true;

  for (;;) {
    let page;
    try {
      page = await fetchPage(build, { offset, size, withCount: first, signal, table });
    } catch (err) {
      if (!RETRYABLE.has(err.code)) throw err;
      // One retry per page, with a smaller page: a slow statement is usually a large one.
      await wait(RETRY_DELAY_MS, signal, table);
      size = Math.max(1, Math.floor(size / 2));
      page = await fetchPage(build, { offset, size, withCount: first, signal, table });
    }

    if (first) {
      total = page.count;
      first = false;
      if (total != null && total > maxRows) {
        throw new DataError('TRUNCATED', null, { table });
      }
    }

    if (page.data.length === 0) break;

    for (const row of page.data) {
      const id = row?.id;
      if (id != null) {
        if (seenIds.has(id)) continue;
        seenIds.add(id);
      }
      rows.push(row);
    }
    if (rows.length > maxRows) throw new DataError('TRUNCATED', null, { table });

    offset += page.data.length;
    if (total != null && rows.length >= total) break;
  }

  return rows;
}

/**
 * Same as fetchAllPages for an `.in()` filter with many ids: the ids are split into chunks
 * (URL length), a few chunks run at a time, and the result keeps chunk order.
 * `buildForChunk(chunk, selectOpts)` follows the same rules as `build` above.
 */
export async function fetchInChunks(
  ids,
  buildForChunk,
  { chunkSize = IN_CHUNK, concurrency = 3, maxRows = MAX_ROWS, pageSize = PAGE_SIZE, signal, table = null } = {}
) {
  const unique = [...new Set((ids || []).filter((id) => id != null))];
  if (unique.length === 0) return [];

  const step = Math.max(1, Math.floor(chunkSize));
  const chunks = [];
  for (let i = 0; i < unique.length; i += step) chunks.push(unique.slice(i, i + step));

  const results = new Array(chunks.length);
  let next = 0;
  let failure = null;

  const worker = async () => {
    while (failure == null && next < chunks.length) {
      const index = next;
      next += 1;
      try {
        results[index] = await fetchAllPages((selectOpts) => buildForChunk(chunks[index], selectOpts), {
          pageSize,
          maxRows,
          signal,
          table,
        });
      } catch (err) {
        if (failure == null) failure = err;
      }
    }
  };

  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), chunks.length) }, worker);
  await Promise.all(workers);
  if (failure != null) throw toDataError(failure, { table });

  const rows = [];
  const seenIds = new Set();
  for (const chunkRows of results) {
    for (const row of chunkRows) {
      const id = row?.id;
      if (id != null) {
        if (seenIds.has(id)) continue;
        seenIds.add(id);
      }
      rows.push(row);
    }
  }
  if (rows.length > maxRows) throw new DataError('TRUNCATED', null, { table });
  return rows;
}
