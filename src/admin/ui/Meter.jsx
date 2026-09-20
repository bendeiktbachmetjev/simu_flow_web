import React from 'react';

// The unfilled track is a lighter step of the fill colour, so the whole bar reads as one state.
const TRACKS = {
  cherry: { md: 'h-2 rounded-full bg-[#78003F]/10 overflow-hidden', sm: 'h-1.5 rounded-full bg-[#78003F]/10 overflow-hidden' },
  live: { md: 'h-2 rounded-full bg-[#E64164]/12 overflow-hidden', sm: 'h-1.5 rounded-full bg-[#E64164]/12 overflow-hidden' },
};

const FILLS = {
  cherry: 'h-full rounded-full bg-[#78003F] transition-[width] duration-[400ms] ease-out motion-reduce:transition-none',
  live: 'h-full rounded-full bg-[#E64164] transition-[width] duration-[400ms] ease-out motion-reduce:transition-none',
};

// Share of a whole as a thin bar.
//   value      0–1 (clamped; null counts as 0)
//   label      text on the left; without `label` and `valueLabel` only the bar is drawn
//   valueLabel text on the right ("64%"), also read out as the meter's value
//   size       'md' | 'sm'
//   tone       'cherry' | 'live' (red, for the Right now strip)
//   ariaLabel  accessible name when there is no visible label
export default function Meter({ value, label, valueLabel, size = 'md', tone = 'cherry', ariaLabel, className = '' }) {
  const ratio = typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const percent = Math.round(ratio * 1000) / 10;
  const track = (TRACKS[tone] || TRACKS.cherry)[size === 'sm' ? 'sm' : 'md'];
  const fill = FILLS[tone] || FILLS.cherry;
  // role="meter" must have a name, even for the bare bar in the Right now strip.
  const name = ariaLabel ?? (typeof label === 'string' && label ? label : 'Share');

  return (
    <div className={className}>
      {(label || valueLabel) && (
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-xs font-semibold text-[#414141]/75">{label}</span>
          <span className="text-xs font-bold text-[#414141] tabular-nums">{valueLabel}</span>
        </div>
      )}
      <div
        role="meter"
        aria-label={name}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={typeof valueLabel === 'string' ? valueLabel : `${percent}%`}
        className={track}
      >
        {/* A share above zero always shows at least a 2 px sliver. */}
        <div className={fill} style={{ width: `${percent}%`, minWidth: ratio > 0 ? 2 : 0 }} />
      </div>
    </div>
  );
}
