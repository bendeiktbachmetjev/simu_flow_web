// Dev-server-only demo mode: visual QA with generated data and no credentials.
// `import.meta.env.DEV` is replaced by `false` in production builds, so isDemoMode() is
// constant false there. Every use site repeats the `import.meta.env.DEV &&` guard and loads
// the generated rows with a dynamic import('…/dev/demoData.js'), which keeps the demo code
// out of the production bundle and makes it impossible to skip sign-in in production.
import { STORAGE } from '../data/constants.js';

export const DEMO_ADMIN = {
  id: 'demo-admin',
  name: 'Demo',
  surname: 'Admin',
  university: 'Vilnius University',
};

export const DEMO_USER = { id: DEMO_ADMIN.id, email: 'demo@simuflow.local' };

const readFlag = () => {
  try {
    return window.localStorage.getItem(STORAGE.demo) === '1';
  } catch {
    return false;
  }
};

const writeFlag = (on) => {
  try {
    if (on) window.localStorage.setItem(STORAGE.demo, '1');
    else window.localStorage.removeItem(STORAGE.demo);
  } catch {
    // Storage can be blocked; demo mode then lasts only while ?demo stays in the URL.
  }
};

// `?demo` turns the mode on and remembers it, so in-app navigation keeps it; `?demo=0` turns it off.
export const isDemoMode = () => {
  if (!import.meta.env.DEV) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.has('demo')) {
    const on = params.get('demo') !== '0';
    writeFlag(on);
    return on;
  }
  return readFlag();
};

// "Sign out" in demo mode: forget the flag and reload without the query string.
export const exitDemoMode = () => {
  if (!import.meta.env.DEV) return;
  writeFlag(false);
  window.location.replace(window.location.pathname);
};
