import React from 'react';
import { Link } from 'react-router-dom';
import { fmt } from '../format.js';
import { usePrintMode } from '../context/usePrintMode.js';
import Card from './Card.jsx';
import Delta from './Delta.jsx';
import InfoHint from './InfoHint.jsx';
import Meter from './Meter.jsx';
import Sparkline from './Sparkline.jsx';
import useCountUp from './useCountUp.js';
import useReducedMotion from './useReducedMotion.js';

// The label is the link; its ::after covers the whole card, so the tile is one click target
// while the hint button (raised with z-[1]) stays clickable on top of it.
const STRETCHED =
  'after:absolute after:inset-0 after:rounded-[24px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[#78003F]/40';
const STRETCHED_ON_ACCENT =
  'after:absolute after:inset-0 after:rounded-[24px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-white/70';

const STYLES = {
  default: {
    padding: 'md',
    card: 'flex flex-col min-h-[168px] print:min-h-0',
    label: 'text-[13px] font-semibold text-[#414141]/75',
    link: STRETCHED,
    value: 'mt-3 sf-kpi-value text-4xl xl:text-[40px] leading-none font-extrabold tracking-[-0.02em] text-[#414141] print:text-[22pt]',
    valueEmpty: 'mt-3 sf-kpi-value text-4xl xl:text-[40px] leading-none font-extrabold tracking-[-0.02em] text-[#414141]/25 print:text-[22pt]',
    unit: 'ml-1 text-base leading-none font-bold text-[#414141]/60',
    unitTight: 'ml-0.5 text-base leading-none font-bold text-[#414141]/60',
    deltaRow: 'mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 min-h-[24px]',
    caption: 'text-xs font-medium text-[#414141]/75',
    sub: 'mt-1 min-h-[16px] text-xs font-medium text-[#414141]/60',
    foot: 'mt-auto pt-4',
  },
  hero: {
    padding: 'lg',
    card: 'flex flex-col min-h-[360px] print:min-h-0',
    label: 'text-sm font-semibold text-white/80',
    link: STRETCHED_ON_ACCENT,
    value: 'mt-4 sf-kpi-value text-[56px] xl:text-[64px] leading-none font-extrabold tracking-[-0.03em] text-white print:text-[22pt]',
    valueEmpty: 'mt-4 sf-kpi-value text-[56px] xl:text-[64px] leading-none font-extrabold tracking-[-0.03em] text-white/40 print:text-[22pt]',
    unit: 'ml-1.5 text-xl leading-none font-bold text-white/75',
    unitTight: 'ml-0.5 text-xl leading-none font-bold text-white/75',
    deltaRow: 'mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 min-h-[24px] max-w-[60%] print:max-w-none',
    caption: 'text-xs font-medium text-white/75',
    sub: 'mt-1.5 min-h-[16px] max-w-[60%] text-xs font-medium text-white/75 print:max-w-none',
    foot: 'mt-auto pt-6',
  },
};

// Stat tile: label · value · signed change against a named period · optional trend.
//   label, value    value is a number (formatted with `format`), a ready string, or null
//   format          'int' | 'pct' | 'hours' | 'duration' (any fmt key)
//   unit            extra word after the number ("rooms")
//   sub             one quiet line under the change
//   delta           makeDelta result; null = "No earlier data to compare"; undefined = the tile has no comparison
//   compareLabel    'vs Aug 2026'
//   goodWhen        'up' | 'down' — passed to Delta
//   spark           number[] for the sparkline (pass [] while loading to keep its space)
//   meter           0–1, draws a thin meter instead of the sparkline (shares such as reach or utilisation);
//                   pass null while loading to keep its space
//   hintKey         key in DEFINITIONS → InfoHint
//   to              route; makes the whole tile a link
//   variant         'default' | 'hero' (the one gradient tile of a page)
//   firstLoad       true while the first data load runs: "—" in the final layout, no jump afterwards
export default function KpiTile({
  label,
  value,
  format = 'int',
  unit,
  sub,
  delta,
  compareLabel,
  goodWhen = 'up',
  spark,
  meter,
  hintKey,
  to,
  variant = 'default',
  firstLoad = false,
  className = '',
}) {
  const hero = variant === 'hero';
  const styles = hero ? STYLES.hero : STYLES.default;
  const { printing } = usePrintMode();
  const reduced = useReducedMotion();

  const numeric = typeof value === 'number' && Number.isFinite(value);
  const missing = !firstLoad && (value == null || value === '' || (typeof value === 'number' && !numeric));
  const counter = useCountUp(numeric && !firstLoad ? value : null, { enabled: !reduced && !printing });

  const showValue = !firstLoad && !missing;
  const shown = counter.running ? counter.value : value;
  const parts = showValue ? fmt.parts(shown, format, value) : [];
  const finalText = showValue ? [fmt.value(value, format), unit].filter(Boolean).join(' ') : null;

  let caption = null;
  if (!firstLoad) {
    if (missing) caption = 'Not enough data';
    else if (delta === null) caption = 'No earlier data to compare';
    else if (delta) caption = compareLabel;
  }

  // A tile that is given `meter` or `spark` (even an empty one while loading) keeps that space
  // from the first paint, so nothing moves when the numbers arrive.
  const hasMeter = meter !== undefined;
  const hasSpark = !hasMeter && spark !== undefined;
  const sparkHeight = hero ? 88 : 36;

  return (
    <Card
      variant={hero ? 'accent' : 'default'}
      padding={styles.padding}
      interactive={!hero}
      className={[styles.card, className].filter(Boolean).join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        {to ? (
          <Link to={to} className={`${styles.label} ${styles.link}`}>
            {label}
          </Link>
        ) : (
          <p className={styles.label}>{label}</p>
        )}
        {hintKey && (
          <span className="relative z-[1] shrink-0 print:hidden">
            <InfoHint hintKey={hintKey} label={typeof label === 'string' ? label : undefined} tone={hero ? 'onAccent' : 'default'} />
          </span>
        )}
      </div>

      {showValue ? (
        <p className={counter.running ? `${styles.value} tabular-nums` : styles.value}>
          <span aria-hidden="true">
            {parts.map((part, index) => (
              <React.Fragment key={`${index}-${part.unit}`}>
                {index > 0 && ' '}
                {part.num}
                {part.unit && <span className={part.unit === '%' ? styles.unitTight : styles.unit}>{part.unit}</span>}
              </React.Fragment>
            ))}
            {unit && <span className={styles.unit}>{unit}</span>}
          </span>
          <span className="sr-only">{finalText}</span>
        </p>
      ) : (
        <p className={styles.valueEmpty}>
          <span aria-hidden="true">—</span>
          <span className="sr-only">{firstLoad ? 'Loading' : 'No value'}</span>
        </p>
      )}

      <div className={styles.deltaRow}>
        {!firstLoad && !missing && delta && (
          <Delta delta={delta} goodWhen={goodWhen} onAccent={hero} compareLabel={compareLabel} />
        )}
        {caption && <span className={styles.caption}>{caption}</span>}
      </div>

      <p className={styles.sub}>{firstLoad ? null : sub}</p>

      {hasMeter && (
        <div className={styles.foot}>
          {firstLoad || missing ? (
            <div className="h-1.5" />
          ) : (
            <Meter value={meter} size="sm" ariaLabel={typeof label === 'string' ? label : undefined} />
          )}
        </div>
      )}
      {hasSpark && (
        <div className={`${styles.foot} print:hidden`}>
          {firstLoad ? (
            <div style={{ height: sparkHeight }} />
          ) : (
            <Sparkline data={spark} height={sparkHeight} tone={hero ? 'onAccent' : 'default'} area={hero} />
          )}
        </div>
      )}
    </Card>
  );
}
