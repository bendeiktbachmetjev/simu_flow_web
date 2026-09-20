import React from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useAnalytics, usePeriod } from '../context/AnalyticsContext.jsx';
import { fmt } from '../format.js';
import ExportMenu from './ExportMenu.jsx';
import PeriodPicker from './PeriodPicker.jsx';

const ROUND_ICON_CLASS =
  'w-8 h-8 flex items-center justify-center rounded-full border border-[#DCDCDC] text-[#414141]/70 hover:bg-[#DCDCDC]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';

const STEPPER_PRESETS = ['thisMonth', 'semester', 'academicYear', 'thisYear'];

/**
 * The one filter row of an analytics page: everything below it is scoped by it.
 * `children` = extra page filters, placed after the period controls.
 */
export default function FilterBar({ exportTables, children }) {
  const { period, shift, canShift } = usePeriod();
  const { status, isRefetching, lastUpdated, refresh, tzWarning } = useAnalytics();

  const hasStepper = STEPPER_PRESETS.includes(period?.preset);
  const busy = isRefetching || status === 'loading';

  return (
    <div data-print="hide" className="mb-6 flex flex-wrap items-center gap-3">
      <PeriodPicker />

      {hasStepper && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous period"
            disabled={!canShift?.prev}
            onClick={() => shift(-1)}
            className={ROUND_ICON_CLASS}
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <span aria-live="polite" className="text-[13px] font-bold min-w-[120px] text-center text-[#414141]">
            {period.label}
          </span>
          <button
            type="button"
            aria-label="Next period"
            disabled={!canShift?.next}
            onClick={() => shift(1)}
            className={ROUND_ICON_CLASS}
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* A custom range has no stepper, and its dates are shown nowhere else in the row. */}
      {period?.preset === 'custom' && <span className="text-[13px] font-bold text-[#414141]">{period.label}</span>}

      {children}

      <div className="ml-auto flex items-center gap-3">
        {lastUpdated > 0 && (
          <span className="text-xs font-medium text-[#414141]/60">Updated {fmt.time(lastUpdated)}</span>
        )}
        <button
          type="button"
          aria-label="Refresh data"
          disabled={busy}
          onClick={() => refresh()}
          className={ROUND_ICON_CLASS}
        >
          <RefreshCw
            className={isRefetching ? 'w-4 h-4 animate-spin motion-reduce:animate-none' : 'w-4 h-4'}
            aria-hidden="true"
          />
        </button>
        <ExportMenu tables={exportTables || []} />
      </div>

      {tzWarning && (
        <p className="basis-full text-[11px] font-medium text-[#414141]/75">
          Your browser is not on Vilnius time; class matching assumes Vilnius time.
        </p>
      )}
    </div>
  );
}
