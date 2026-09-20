import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { STORAGE } from './data/constants';
import { DEFAULT_SECTION, isSectionId, sectionFromPath } from './nav';

const readReturnTo = () => {
  try {
    return sectionFromPath(window.sessionStorage.getItem(STORAGE.returnTo));
  } catch {
    return null;
  }
};

const readLastSection = () => {
  try {
    const stored = window.localStorage.getItem(STORAGE.lastSection);
    return isSectionId(stored) ? stored : null;
  } catch {
    return null;
  }
};

/**
 * The ONLY redirect away from /admin. It renders inside the shell, that is after the Supabase
 * session (including the OAuth ?code= exchange) and the administrator check have resolved.
 * Target: the deep link saved before login → the last visited section → Overview.
 */
export default function AdminIndexRedirect() {
  // Read during the first render only; the value is removed in an effect so that a
  // StrictMode double render still sees it.
  const [target] = useState(() => readReturnTo() || readLastSection() || DEFAULT_SECTION);

  useEffect(() => {
    try {
      window.sessionStorage.removeItem(STORAGE.returnTo);
    } catch {
      // Nothing to clean up when storage is blocked.
    }
  }, []);

  return <Navigate replace to={`/admin/${target}`} />;
}
