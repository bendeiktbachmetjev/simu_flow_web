import React from 'react';
import { useAdmin } from '../context/AdminContext.jsx';
import { usePeriod } from '../context/AnalyticsContext.jsx';
import { fmt } from '../format.js';

// Numbers only ever cover the elapsed part of a period; a period that has not started yet
// is shown with its planned dates instead.
const rangeOf = (period) => fmt.range(period.from, period.isFuture ? period.to : period.effTo);

const defaultScopeLine = (university, period, prevPeriod) =>
  [
    university,
    period ? rangeOf(period) : null,
    prevPeriod ? `compared with ${fmt.range(prevPeriod.from, prevPeriod.to)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * Top of every analytics page. `scopeLine` defaults to
 * "Vilnius University · 1 Jan – 20 Sep 2026 · compared with 13 Apr – 31 Dec 2025", built from
 * the admin and the selected period; pass a string to replace it. `counted` is the metric's
 * `{ clipped, fromLabel }`: when the period starts before the first recorded activity, the
 * header says from when things are counted. `note` is a permanent remark about the page.
 * A <div>, not a <header>: the print rules hide every <header> inside the admin area.
 */
export default function PageHeader({ title, question, scopeLine, note, counted }) {
  const { admin } = useAdmin();
  const { period, prevPeriod } = usePeriod();
  const university = admin?.university || null;
  const scope = scopeLine ?? defaultScopeLine(university, period, prevPeriod);

  return (
    <div className="pt-2 pb-5">
      {/* In print the university and the dates are carried by PrintHeader. */}
      {university && (
        <p className="mb-1 text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#414141]/60 print:hidden">
          {university}
        </p>
      )}
      <h1 className="text-3xl font-extrabold tracking-tight text-[#414141]">{title}</h1>
      {question && <p className="mt-1 text-sm font-medium text-[#414141]/75">{question}</p>}
      {scope && <p className="mt-1 text-xs font-semibold text-[#414141]/60 print:hidden">{scope}</p>}
      {counted?.clipped && counted.fromLabel && (
        <p className="mt-1 text-xs font-semibold text-[#414141]/60">
          Counted from {counted.fromLabel}, when SimuFlow recording began.
        </p>
      )}
      {note && <p className="mt-3 max-w-3xl text-xs font-semibold text-[#414141]/75">{note}</p>}
    </div>
  );
}
