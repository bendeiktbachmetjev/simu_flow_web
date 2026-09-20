// One error type for the whole analytics data layer, so the UI can decide what to say
// from `code` alone. Pure file: no React, no Supabase, no window.

export const ERROR_CODES = ['NO_UNIVERSITY', 'NETWORK', 'TIMEOUT', 'AUTH', 'QUERY', 'TRUNCATED', 'ABORTED'];

const DEFAULT_MESSAGES = {
  NO_UNIVERSITY: 'Your administrator account has no university set.',
  NETWORK: 'The server could not be reached. Check your connection and try again.',
  TIMEOUT: 'The server took too long to answer. Please try again.',
  AUTH: 'Your session has expired. Sign out and sign in again.',
  QUERY: 'The data could not be read. Please try again.',
  TRUNCATED: 'There is more data than this page can load at once.',
  ABORTED: 'Loading was cancelled.',
};

export class DataError extends Error {
  constructor(code, message, { table = null, cause = null } = {}) {
    super(message || DEFAULT_MESSAGES[code] || DEFAULT_MESSAGES.QUERY);
    this.name = 'DataError';
    this.code = ERROR_CODES.includes(code) ? code : 'QUERY';
    this.table = table;
    this.cause = cause;
  }
}

const AUTH_CODES = new Set(['PGRST301', 'PGRST302', 'PGRST303', '42501', '28000', '28P01']);
const TIMEOUT_CODES = new Set(['57014', 'PGRST003']);

const textOf = (err) =>
  [err?.name, err?.message, err?.details, err?.hint]
    .filter((part) => typeof part === 'string')
    .join(' ');

// Accepts anything a Supabase call can hand back or throw: a PostgREST error object
// ({ message, details, hint, code }), a fetch TypeError, a DOM AbortError, or a DataError.
// `status` is the HTTP status of the response when the caller has it (0 = request never completed).
export function toDataError(err, { table = null, status = null } = {}) {
  if (err instanceof DataError) {
    if (table && !err.table) err.table = table;
    return err;
  }

  const code = typeof err?.code === 'string' ? err.code : '';
  const text = textOf(err);

  if (err?.name === 'AbortError' || code === 'ABORT_ERR' || /\bAbortError\b/.test(text)) {
    return new DataError('ABORTED', null, { table, cause: err });
  }
  if (TIMEOUT_CODES.has(code) || status === 408 || status === 504 || /statement timeout|timed? ?out/i.test(text)) {
    return new DataError('TIMEOUT', null, { table, cause: err });
  }
  if (AUTH_CODES.has(code) || status === 401 || status === 403 || /\bJWT\b/.test(text)) {
    return new DataError('AUTH', null, { table, cause: err });
  }
  if (
    status === 0 ||
    (status != null && status >= 502 && status <= 599) ||
    /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_network|econn|enotfound/i.test(text)
  ) {
    return new DataError('NETWORK', null, { table, cause: err });
  }
  return new DataError('QUERY', null, { table, cause: err });
}
