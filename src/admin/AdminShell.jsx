import React, { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import './admin.css';
import SimulatorTimeline from '../components/SimulatorTimeline';
import AdminHeader from './AdminHeader';
import AdminIndexRedirect from './AdminIndexRedirect';
import { AnalyticsProvider } from './context/AnalyticsContext';
import { usePrintMode } from './context/usePrintMode';
import { STORAGE } from './data/constants';
import { sectionFromPath } from './nav';
import OverviewPage from './pages/OverviewPage';
import StudentsPage from './pages/StudentsPage';
import ClassesPage from './pages/ClassesPage';
import SimulatorsPage from './pages/SimulatorsPage';
import RoomsPage from './pages/RoomsPage';
import GuestsPage from './pages/GuestsPage';

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';

// A rendering fault in one analytics page must not take the header and the calendar down with
// it. (Error boundaries have to be classes; React logs the error itself.)
class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        className="max-w-xl mx-auto mt-8 p-8 text-center bg-[#FFFFFF] rounded-[24px] border border-[#DCDCDC]/60 shadow-[0_8px_20px_rgba(65,65,65,0.08)]"
      >
        <div className="w-14 h-14 rounded-[20px] bg-[#E64164]/10 mx-auto flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-[#E64164]" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-extrabold text-[#414141]">This page could not be shown</h1>
        <p className="mt-1 text-sm font-medium text-[#414141]/75">
          Something went wrong while preparing these numbers. The calendar and the other sections still work.
        </p>
        <button
          type="button"
          onClick={() => this.setState({ failed: false })}
          className={`mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-[#DCDCDC] bg-[#FFFFFF] text-[#414141]/80 hover:bg-[#DCDCDC]/20 transition-colors ${RING}`}
        >
          Try again
        </button>
      </div>
    );
  }
}

/**
 * Layout rules that keep the calendar working (it renders a position: fixed tooltip in place
 * and resets its state when unmounted):
 * - the calendar is mounted on the first visit and then only hidden with display: none;
 * - none of its ancestors may get transform, filter, backdrop-filter, perspective, contain,
 *   transitions or animation classes — the blurred header is a sibling of <main>;
 * - everything here stays at z-index ≤ 40 (calendar tooltip 50, event modal 60);
 * - no Escape handler and no moment.locale() call.
 */
export default function AdminShell() {
  const { pathname } = useLocation();
  const { printing } = usePrintMode();
  const section = sectionFromPath(pathname);
  const isCalendar = section === 'calendar';

  const [calendarSeen, setCalendarSeen] = useState(isCalendar);
  if (isCalendar && !calendarSeen) setCalendarSeen(true);

  useEffect(() => {
    if (!section) return;
    try {
      window.localStorage.setItem(STORAGE.lastSection, section);
      // A deep link saved before login has done its job once any section is on screen.
      window.sessionStorage.removeItem(STORAGE.returnTo);
    } catch {
      // Storage can be blocked; /admin then simply opens Overview.
    }
  }, [section]);

  // A new section starts at its top; the first render keeps the browser's restored position.
  const previousSection = useRef(section);
  useEffect(() => {
    if (previousSection.current === section) return;
    previousSection.current = section;
    window.scrollTo(0, 0);
  }, [section]);

  // Print mode narrows the page to A4 width so the charts re-measure before the dialog opens.
  const pagesStyle = {
    display: isCalendar ? 'none' : 'block',
    ...(printing ? { width: 700, margin: '0 auto' } : null),
  };

  return (
    <AnalyticsProvider>
      <div className="sf-admin min-h-screen bg-gradient-to-b from-[#FFFFFF] via-[#DCDCDC]/20 to-[#FFFFFF] text-[#414141] font-sans">
        <a
          href="#sf-main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-40 focus:px-4 focus:py-2 focus:rounded-full focus:bg-[#FFFFFF] focus:text-sm focus:font-bold focus:text-[#78003F] focus:shadow-[0_8px_20px_rgba(65,65,65,0.08)] focus:outline-none focus:ring-2 focus:ring-[#78003F]/40"
        >
          Skip to content
        </a>
        <AdminHeader />
        <main id="sf-main" tabIndex={-1} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 focus:outline-none">
          <div style={pagesStyle}>
            <PageErrorBoundary key={section || 'index'}>
              <Routes>
                <Route index element={<AdminIndexRedirect />} />
                <Route path="overview" element={<OverviewPage />} />
                <Route path="students" element={<StudentsPage />} />
                <Route path="classes" element={<ClassesPage />} />
                <Route path="simulators" element={<SimulatorsPage />} />
                <Route path="rooms" element={<RoomsPage />} />
                <Route path="guests" element={<GuestsPage />} />
                <Route path="calendar" element={null} />
                <Route path="*" element={<Navigate to="/admin/overview" replace />} />
              </Routes>
            </PageErrorBoundary>
          </div>
          {calendarSeen && (
            <div data-calendar-root style={{ display: isCalendar ? 'block' : 'none' }}>
              <SimulatorTimeline />
            </div>
          )}
        </main>
        {printing && (
          <div
            role="status"
            className="fixed inset-0 z-40 bg-[#FFFFFF] flex items-center justify-center text-sm font-semibold text-[#414141]/75 print:hidden"
          >
            Preparing report…
          </div>
        )}
      </div>
    </AnalyticsProvider>
  );
}
