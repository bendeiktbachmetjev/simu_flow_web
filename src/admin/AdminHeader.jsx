import React, { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import appIcon from '../assets/app-icon.png';
import { useAdmin } from './context/AdminContext';
import { useAnalytics } from './context/AnalyticsContext';
import { SECTIONS } from './nav';

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';

const PILL_BASE = `shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${RING}`;
const PILL_ACTIVE = 'bg-[#78003F] text-white';
const PILL_IDLE = 'text-[#414141]/70 hover:bg-[#DCDCDC]/20';

// The analytics sections stand a little apart from the two "home" sections.
const GAP_AFTER = 'calendar';

// Sticky glass header. It is the only element of the admin area with backdrop-blur and it is a
// sibling of <main>, never an ancestor of the calendar (a blurred ancestor would misplace the
// calendar's position: fixed tooltip). z-10 keeps it below that tooltip (50) and the event modal (60).
export default function AdminHeader() {
  const { admin, signOut, isDemo } = useAdmin();
  const { isRefetching } = useAnalytics();
  const { pathname } = useLocation();
  const navRef = useRef(null);

  // On narrow screens the pills scroll sideways: keep the active one in view after a navigation.
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector('[aria-current="page"]');
    if (!nav || !active) return;
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < nav.scrollLeft) nav.scrollLeft = left - 8;
    else if (right > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = right - nav.clientWidth + 8;
  }, [pathname]);

  return (
    <header className="bg-[#FFFFFF]/80 backdrop-blur border-b border-[#DCDCDC]/60 shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-[12px] bg-[#DCDCDC]/40 overflow-hidden shadow-[0_8px_20px_rgba(65,65,65,0.08)]">
            <img src={appIcon} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="hidden sm:block">
            <div className="text-xl font-extrabold text-[#414141] leading-6">SimuFlow</div>
            {admin?.university && (
              <div className="hidden xl:block max-w-[200px] truncate text-xs font-semibold text-[#414141]/60 leading-4">
                {admin.university}
              </div>
            )}
          </div>
        </div>

        {/* The inner row centres itself with auto margins, which collapse when the pills do not
            fit — so on narrow screens the row starts at the left edge and scrolls sideways. */}
        <nav ref={navRef} aria-label="Sections" className="sf-nav-scroll relative flex-1 min-w-0 flex overflow-x-auto">
          <div className="mx-auto flex items-center gap-1 p-1">
            {SECTIONS.map((section, index) => {
              const afterGap = index > 0 && SECTIONS[index - 1].id === GAP_AFTER;
              return (
                <NavLink
                  key={section.id}
                  to={section.path}
                  className={({ isActive }) =>
                    `${PILL_BASE} ${isActive ? PILL_ACTIVE : PILL_IDLE}${afterGap ? ' ml-4' : ''}`
                  }
                >
                  {section.label}
                </NavLink>
              );
            })}
          </div>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {import.meta.env.DEV && isDemo && (
            <span className="hidden xl:inline-flex px-3 py-1.5 rounded-full text-xs font-semibold bg-[#DCDCDC]/30 text-[#414141]/70">
              Demo data
            </span>
          )}
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full border border-[#DCDCDC]/80 hover:bg-[#DCDCDC]/30 text-[#414141] font-semibold transition-colors ${RING}`}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {isRefetching && (
        <div className="absolute inset-x-0 -bottom-px h-0.5 overflow-hidden" role="progressbar" aria-label="Refreshing data">
          <div className="sf-progress h-full w-1/4 bg-[#78003F]" />
        </div>
      )}
    </header>
  );
}
