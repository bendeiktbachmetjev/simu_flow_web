import React, { useRef, useState } from 'react';
import moment from 'moment';
import { CalendarRange, Check, ChevronDown, X } from 'lucide-react';
import { usePeriod } from '../context/AnalyticsContext.jsx';
import MenuPanel from './MenuPanel.jsx';
import Segmented from './Segmented.jsx';

const ISO_DAY = 'YYYY-MM-DD';
const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';

const TRIGGER_CLASS = `xl:hidden inline-flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-full border border-[#DCDCDC] bg-[#FFFFFF] text-[13px] font-semibold text-[#414141] hover:bg-[#DCDCDC]/20 transition-colors ${RING}`;
const ROW_CLASS = `w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-left text-[13px] font-semibold text-[#414141] hover:bg-[#DCDCDC]/25 transition-colors ${RING}`;
const GROUP_LABEL_CLASS = 'text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#414141]/75';
const DATE_INPUT_CLASS =
  'flex-1 min-w-0 h-9 px-2.5 rounded-[12px] border border-[#DCDCDC] bg-[#FFFFFF] text-xs font-semibold text-[#414141] focus:outline-none focus:ring-2 focus:ring-[#78003F]';
const CLOSE_CLASS = `w-6 h-6 -mr-1 flex items-center justify-center rounded-full text-[#414141]/60 hover:bg-[#DCDCDC]/25 hover:text-[#414141] transition-colors ${RING}`;
const APPLY_CLASS =
  'shrink-0 h-9 px-4 rounded-full text-xs font-bold text-white bg-gradient-to-br from-[#78003F] to-[#E64164] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40 focus-visible:ring-offset-2';

// Period ends are exclusive; a date input shows the last day that is included.
const lastDayOf = (exclusiveEnd) => {
  const day = moment(exclusiveEnd, ISO_DAY, true);
  return day.isValid() ? day.subtract(1, 'day').format(ISO_DAY) : '';
};

// The form opens on the range that is on screen, so a small adjustment is two clicks.
const initialRange = (period) => {
  if (!period) return { from: '', to: '' };
  if (period.preset === 'custom') return { from: period.from, to: lastDayOf(period.to) };
  if (period.isFuture) return { from: '', to: '' };
  return { from: period.from, to: lastDayOf(period.effTo) };
};

// Mounted only while the popover is open, so its state starts fresh from the current period.
// `standalone` = the form is the whole popover (opened from "Custom" in the Segmented); it then
// gets a close button, which also keeps a date input from being the panel's first tab stop.
function CustomRangeForm({ period, selected, standalone, onApply, onClose }) {
  const today = moment().format(ISO_DAY);
  const [from, setFrom] = useState(() => initialRange(period).from);
  const [to, setTo] = useState(() => initialRange(period).to);

  const complete = Boolean(from && to);
  const inverted = complete && from > to; // ISO dates sort as text
  const inFuture = (from && from > today) || (to && to > today);
  let problem = null;
  if (inverted) problem = 'Start must be before end';
  else if (inFuture) problem = 'Dates cannot be after today';

  const handleSubmit = (event) => {
    event.preventDefault();
    if (complete && !problem) onApply(from, to);
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={standalone ? 'px-3 pt-2 pb-2' : 'mt-1.5 pt-3 border-t border-[#DCDCDC]/50 px-3 pb-2'}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className={GROUP_LABEL_CLASS}>
          Custom range
          {selected && <span className="sr-only"> (selected)</span>}
        </span>
        <span className="flex items-center gap-1">
          {selected && <Check className="w-4 h-4 text-[#78003F]" aria-hidden="true" />}
          {standalone && (
            <button type="button" aria-label="Close" onClick={onClose} className={CLOSE_CLASS}>
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          aria-label="Start date"
          data-autofocus={standalone ? '' : undefined}
          value={from}
          max={today}
          aria-invalid={inverted || undefined}
          onChange={(event) => setFrom(event.target.value)}
          className={DATE_INPUT_CLASS}
        />
        <input
          type="date"
          aria-label="End date"
          value={to}
          max={today}
          aria-invalid={inverted || undefined}
          onChange={(event) => setTo(event.target.value)}
          className={DATE_INPUT_CLASS}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p role="alert" className="min-w-0 text-[11px] font-medium text-[#B3205A]">
          {problem}
        </p>
        <button type="submit" disabled={!complete || Boolean(problem)} className={APPLY_CLASS}>
          Apply
        </button>
      </div>
    </form>
  );
}

/**
 * Period choice for the filter row. From xl up all presets sit in one Segmented and "Custom"
 * opens the date form; below xl a single pill opens the same presets as a list.
 * Both triggers are in the DOM and CSS shows one, so nothing is measured in JS.
 */
export default function PeriodPicker() {
  const { period, presets = [], setPreset, setCustom } = usePeriod();
  const [panel, setPanel] = useState(null); // null | 'list' | 'custom'
  const anchorRef = useRef(null);
  const pillRef = useRef(null);
  const segmentedRef = useRef(null);

  const currentPreset = period?.preset;
  const currentLabel = presets.find((preset) => preset.id === currentPreset)?.label ?? 'Period';
  const listPresets = presets.filter((preset) => preset.id !== 'custom');
  const options = presets.map((preset) => ({
    value: preset.id,
    label: preset.label,
    icon: preset.id === 'custom' ? CalendarRange : undefined,
  }));

  const close = () => setPanel(null);

  const toggle = (kind, anchor) => {
    anchorRef.current = anchor;
    setPanel((open) => (open === kind ? null : kind));
  };

  const choosePreset = (id) => {
    setPreset(id);
    close();
  };

  const handleSegmentedChange = (id) => {
    if (id === 'custom') toggle('custom', segmentedRef.current);
    else choosePreset(id);
  };

  const applyCustom = (from, to) => {
    // The form has already validated the range; a refusal leaves the form open.
    if (setCustom(from, to) !== false) close();
  };

  return (
    <>
      <div ref={segmentedRef} className="hidden xl:inline-flex">
        <Segmented size="md" ariaLabel="Period" options={options} value={currentPreset} onChange={handleSegmentedChange} />
      </div>

      <button
        ref={pillRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={panel === 'list'}
        onClick={() => toggle('list', pillRef.current)}
        className={TRIGGER_CLASS}
      >
        <CalendarRange className="w-4 h-4 text-[#78003F]" aria-hidden="true" />
        <span className="sr-only">Period: </span>
        {currentLabel}
        <ChevronDown className="w-4 h-4 text-[#414141]/60" aria-hidden="true" />
      </button>

      <MenuPanel
        open={panel !== null}
        anchorRef={anchorRef}
        onClose={close}
        width="w-[288px]"
        align={panel === 'custom' ? 'end' : 'start'}
        ariaLabel={panel === 'custom' ? 'Custom range' : 'Choose period'}
      >
        {panel === 'list' &&
          listPresets.map((preset) => {
            const selected = preset.id === currentPreset;
            return (
              <button
                key={preset.id}
                type="button"
                aria-current={selected ? 'true' : undefined}
                data-autofocus={selected ? '' : undefined}
                onClick={() => choosePreset(preset.id)}
                className={ROW_CLASS}
              >
                {preset.label}
                {selected && <Check className="w-4 h-4 text-[#78003F]" aria-hidden="true" />}
              </button>
            );
          })}
        <CustomRangeForm
          period={period}
          selected={currentPreset === 'custom'}
          standalone={panel === 'custom'}
          onApply={applyCustom}
          onClose={close}
        />
      </MenuPanel>
    </>
  );
}
