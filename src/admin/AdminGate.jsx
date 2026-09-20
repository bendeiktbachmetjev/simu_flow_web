import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AdminShell from './AdminShell';
import Splash from './ui/Splash';
import { AdminProvider } from './context/AdminContext';
import { resetAnalyticsCache } from './context/AnalyticsContext';
import { DEMO_USER, exitDemoMode } from './dev/demo';

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';

const PAGE_CLASS =
  'min-h-screen flex items-center justify-center bg-gradient-to-b from-[#FFFFFF] via-[#DCDCDC]/20 to-[#FFFFFF] p-4';
const CARD_CLASS =
  'max-w-md w-full bg-[#FFFFFF] rounded-[24px] shadow-[0_8px_20px_rgba(65,65,65,0.08)] border border-[#DCDCDC]/60 p-8 text-center';
const PRIMARY_BUTTON_CLASS = `w-full px-4 py-3 rounded-full bg-gradient-to-br from-[#78003F] to-[#E64164] text-white font-bold hover:opacity-90 transition-opacity ${RING}`;
const SECONDARY_BUTTON_CLASS = `inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-[#DCDCDC] bg-[#FFFFFF] text-[#414141]/80 hover:bg-[#DCDCDC]/20 transition-colors ${RING}`;

// The admins table lets a user read only their own row, so "no row" means "not an administrator".
const toAdmin = (row) => ({
  id: row.id,
  name: row.name || '',
  surname: row.surname || '',
  university: typeof row.university === 'string' && row.university.trim() ? row.university : null,
});

/**
 * The admin area is administrator-only: any other signed-in account would silently see
 * empty or foreign data through RLS, and the calendar does no check of its own.
 * Mounted with key = user id, so a different user always starts from 'checking'.
 */
export default function AdminGate({ session = null, demoAdmin = null }) {
  const demo = import.meta.env.DEV && demoAdmin ? demoAdmin : null;
  const user = demo ? DEMO_USER : session?.user ?? null;
  const userId = user?.id ?? null;

  const [access, setAccess] = useState(() =>
    demo ? { status: 'admin', admin: demo } : { status: 'checking', admin: null }
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (demo) return undefined;
    if (!userId) {
      setAccess({ status: 'denied', admin: null });
      return undefined;
    }

    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('admins')
          .select('id, name, surname, university')
          .eq('id', userId)
          .maybeSingle();
        if (error) throw error;
        if (!active) return;
        setAccess(data ? { status: 'admin', admin: toAdmin(data) } : { status: 'denied', admin: null });
      } catch (err) {
        console.error(err);
        if (active) setAccess({ status: 'error', admin: null });
      }
    })();

    return () => {
      active = false;
    };
  }, [demo, userId, attempt]);

  // Sign-out or a different user: analytics of the previous administrator must not survive.
  useEffect(() => () => resetAnalyticsCache(), [userId]);

  const signOut = useCallback(async () => {
    if (import.meta.env.DEV && demo) {
      exitDemoMode();
      return;
    }
    resetAnalyticsCache();
    const { error } = await supabase.auth.signOut();
    // The server could not be reached: still end the session in this browser.
    if (error) await supabase.auth.signOut({ scope: 'local' });
  }, [demo]);

  const retry = useCallback(() => {
    setAccess({ status: 'checking', admin: null });
    setAttempt((n) => n + 1);
  }, []);

  const contextValue = useMemo(
    () => ({ user, admin: access.admin, signOut, isDemo: Boolean(demo) }),
    [user, access.admin, signOut, demo]
  );

  if (access.status === 'checking') return <Splash />;

  if (access.status === 'denied') {
    return (
      <div className={PAGE_CLASS}>
        <div className={CARD_CLASS}>
          <div className="w-16 h-16 bg-[#E64164]/10 rounded-[20px] mx-auto flex items-center justify-center mb-5">
            <LogOut className="w-8 h-8 text-[#E64164]" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-extrabold text-[#414141] mb-2">No administrator access</h2>
          <p className="text-sm text-[#414141]/70 mb-1">You are signed in as</p>
          <p className="text-sm font-bold text-[#414141] mb-4 break-all">{user?.email || 'unknown account'}</p>
          <p className="text-sm text-[#414141]/70 mb-6">
            This account is not registered as an administrator, so the dashboard
            cannot show any center data. Sign out and use your administrator account.
          </p>
          <button type="button" onClick={signOut} className={PRIMARY_BUTTON_CLASS}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (access.status === 'error') {
    return (
      <div className={PAGE_CLASS}>
        <div className={CARD_CLASS} role="alert">
          <div className="w-16 h-16 bg-[#E64164]/10 rounded-[20px] mx-auto flex items-center justify-center mb-5">
            <ShieldAlert className="w-8 h-8 text-[#E64164]" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-extrabold text-[#414141] mb-2">Could not check access</h2>
          <p className="text-sm text-[#414141]/70 mb-6">
            We could not confirm that this account is an administrator. Check your
            connection and try again.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button type="button" onClick={retry} className={SECONDARY_BUTTON_CLASS}>
              Retry
            </button>
            <button type="button" onClick={signOut} className={SECONDARY_BUTTON_CLASS}>
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminProvider value={contextValue}>
      <AdminShell />
    </AdminProvider>
  );
}
