import React, { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import appIcon from '../../assets/app-icon.png';
import { useAdmin } from '../context/AdminContext.jsx';
import { usePeriod } from '../context/AnalyticsContext.jsx';
import { usePrintMode } from '../context/usePrintMode.js';
import { fmt } from '../format.js';
import { SECTIONS } from '../nav.js';

// Numbers cover the elapsed part of a period; a period still ahead prints its planned dates.
const rangeOf = (period) => fmt.range(period.from, period.isFuture ? period.to : period.effTo);

/**
 * Report letterhead, visible only on paper. `section` is a section id ('overview') or a
 * ready label. A <div>, not a <header>: the print rules hide every <header> in the admin area.
 */
export default function PrintHeader({ section }) {
  const { admin } = useAdmin();
  const { period, prevPeriod } = usePeriod();
  const { printing } = usePrintMode();
  const [generatedAt, setGeneratedAt] = useState(() => Date.now());

  // The "Generated" stamp is taken when printing starts, not when the page was opened.
  // `beforeprint` also covers a bare Cmd/Ctrl+P; flushSync gets the new time into the DOM
  // before the browser takes its snapshot.
  useEffect(() => {
    const stamp = () => flushSync(() => setGeneratedAt(Date.now()));
    window.addEventListener('beforeprint', stamp);
    return () => window.removeEventListener('beforeprint', stamp);
  }, []);

  useEffect(() => {
    if (printing) setGeneratedAt(Date.now());
  }, [printing]);

  const sectionLabel = SECTIONS.find((item) => item.id === section)?.label ?? section;
  const range = period ? rangeOf(period) : null;
  const showLabel = period?.label && period.label !== range;

  return (
    <div className="hidden print:flex items-start justify-between pb-4 mb-6 border-b border-[#DCDCDC] text-[#414141]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-[12px] overflow-hidden">
          <img src={appIcon} alt="" className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="text-[15pt] leading-tight font-extrabold">
            Simulation center report{sectionLabel ? ` — ${sectionLabel}` : ''}
          </p>
          {admin?.university && <p className="text-[9pt] text-[#414141]/75">{admin.university}</p>}
        </div>
      </div>
      <div className="text-[9pt] text-right">
        {range && (
          <p>
            {showLabel && `${period.label} · `}
            <strong className="font-bold">{range}</strong>
          </p>
        )}
        {prevPeriod && <p>Compared with {fmt.range(prevPeriod.from, prevPeriod.to)}</p>}
        <p className="text-[#414141]/75">
          Generated {fmt.date(generatedAt)}, {fmt.time(generatedAt)}
        </p>
      </div>
    </div>
  );
}
