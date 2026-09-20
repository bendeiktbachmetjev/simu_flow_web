import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Login from '../components/Login';
import AdminGate from './AdminGate';
import Splash from './ui/Splash';
import { STORAGE } from './data/constants';
import { sectionFromPath } from './nav';
import { DEMO_ADMIN, isDemoMode } from './dev/demo';

// Resolves the Supabase session for every /admin/* URL.
// Google OAuth (PKCE) comes back to /admin?code=…; supabase-js finishes the code exchange
// inside getSession(), so nothing here navigates. The only redirect away from /admin is
// AdminIndexRedirect, which renders after the session AND the administrator check.
function SessionRoute() {
  const { pathname } = useLocation();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data?.session ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => setSession(nextSession)
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Remember a deep link while the login form is shown: Google always returns to /admin.
  useEffect(() => {
    if (loading || session) return;
    if (!sectionFromPath(pathname)) return;
    try {
      window.sessionStorage.setItem(STORAGE.returnTo, pathname);
    } catch {
      // Storage can be blocked; the user then lands on the default section.
    }
  }, [loading, session, pathname]);

  if (loading) return <Splash />;
  if (!session) return <Login />;

  // Keyed by user id: a token refresh hands over a new session object for the same user and
  // must not remount the shell (the calendar would lose its state).
  return <AdminGate key={session.user.id} session={session} />;
}

export default function AdminRoute() {
  const [demo] = useState(() => import.meta.env.DEV && isDemoMode());

  if (import.meta.env.DEV && demo) {
    return <AdminGate key={DEMO_ADMIN.id} demoAdmin={DEMO_ADMIN} />;
  }
  return <SessionRoute />;
}
