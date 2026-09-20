import React, { useRef, useState } from 'react';
import { fmt } from '../format.js';
import useChartTooltip from '../charts/useChartTooltip.jsx';

const CELL =
  'h-10 rounded-[6px] flex items-center justify-center text-[11px] font-bold tabular-nums transition-shadow duration-150 hover:shadow-[inset_0_0_0_2px_#414141] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_#414141]';

// One hue, stepped relative to the busiest cell. The printed number is always the true value.
const STEPS = [
  'bg-[#DCDCDC]/25',
  'bg-[#78003F]/10 text-[#414141]',
  'bg-[#78003F]/20 text-[#414141]',
  'bg-[#78003F]/32 text-[#414141]',
  'bg-[#78003F]/65 text-white',
  'bg-[#78003F] text-white',
];

const SWATCH = 'w-4 h-2.5 rounded-[3px]';

const stepOf = (v, max) => {
  if (!(v > 0) || !(max > 0)) return 0;
  return Math.min(5, Math.max(1, Math.ceil((v / max) * 5)));
};

const MOVES = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

// Rows × columns grid of shaded cells (rooms: two-hour slots × weekdays).
//   rowLabels, colLabels  string[]
//   values                (number | null)[][] — values[row][col]; null = no data for that cell
//   format                fmt key or function for the number printed in a cell
//   cellLabel(r, c, v)    full accessible sentence for a cell; defaults to "Tue, 10–12: 4.2%"
//   legendText            what the colour means ("0–12% of room-hours booked")
//   valueName             words after the value in the tooltip ("of room-hours booked")
// Keyboard: the grid is one tab stop; arrow keys, Home and End move between cells.
export default function Heatmap({
  rowLabels = [],
  colLabels = [],
  values = [],
  format = 'pct',
  cellLabel,
  legendText,
  valueName,
  ariaLabel,
  className = '',
}) {
  const [active, setActive] = useState([0, 0]);
  const gridRef = useRef(null);
  const tip = useChartTooltip();

  const rowCount = rowLabels.length;
  const colCount = colLabels.length;
  const valueAt = (r, c) => {
    const v = values[r]?.[c];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };

  let max = 0;
  for (let r = 0; r < rowCount; r += 1) {
    for (let c = 0; c < colCount; c += 1) max = Math.max(max, valueAt(r, c) ?? 0);
  }

  const activeRow = Math.min(active[0], Math.max(0, rowCount - 1));
  const activeCol = Math.min(active[1], Math.max(0, colCount - 1));

  const focusCell = (r, c) => {
    setActive([r, c]);
    gridRef.current?.querySelector(`[data-cell="${r}-${c}"]`)?.focus();
  };

  const onKeyDown = (event, r, c) => {
    let next = null;
    if (MOVES[event.key]) next = [r + MOVES[event.key][0], c + MOVES[event.key][1]];
    else if (event.key === 'Home') next = [r, 0];
    else if (event.key === 'End') next = [r, colCount - 1];
    if (!next) return;
    event.preventDefault();
    const [nr, nc] = next;
    if (nr < 0 || nr >= rowCount || nc < 0 || nc >= colCount) return;
    focusCell(nr, nc);
  };

  const describe = (r, c, v) => {
    if (typeof cellLabel === 'function') return cellLabel(r, c, v);
    return `${colLabels[c]}, ${rowLabels[r]}: ${v == null ? 'no data' : fmt.value(v, format)}`;
  };

  return (
    <div className={className}>
      <div
        ref={gridRef}
        role="grid"
        aria-label={ariaLabel}
        aria-rowcount={rowCount + 1}
        aria-colcount={colCount + 1}
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `56px repeat(${Math.max(1, colCount)},minmax(0,1fr))` }}
      >
        <div role="row" className="contents">
          <div role="columnheader" aria-label="Time" />
          {colLabels.map((label) => (
            <div key={label} role="columnheader" className="pb-1.5 text-center text-[11px] font-semibold text-[#414141]/75">
              {label}
            </div>
          ))}
        </div>

        {rowLabels.map((rowLabel, r) => (
          <div key={rowLabel} role="row" className="contents">
            <div role="rowheader" className="flex items-center text-xs font-semibold text-[#414141]/75 tabular-nums">
              {rowLabel}
            </div>
            {colLabels.map((colLabel, c) => {
              const v = valueAt(r, c);
              const step = stepOf(v, max);
              return (
                <div
                  key={colLabel}
                  role="gridcell"
                  data-cell={`${r}-${c}`}
                  tabIndex={r === activeRow && c === activeCol ? 0 : -1}
                  aria-label={describe(r, c, v)}
                  className={`${CELL} ${STEPS[step]}`}
                  onKeyDown={(event) => onKeyDown(event, r, c)}
                  onClick={() => setActive([r, c])}
                  {...tip.bind({
                    title: `${colLabel} · ${rowLabel}`,
                    rows: [{ value: v == null ? 'No data' : fmt.value(v, format), name: v == null ? undefined : valueName }],
                  })}
                >
                  {step > 0 ? fmt.value(v, format) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-[#414141]/75">
        <span>Less</span>
        <span aria-hidden="true" className="flex items-center gap-0.5">
          {STEPS.slice(1).map((stepClass) => (
            <span key={stepClass} className={`${SWATCH} ${stepClass}`} />
          ))}
        </span>
        <span>More</span>
        {legendText && <span className="ml-1 font-medium">{legendText}</span>}
      </div>

      {tip.tooltip}
    </div>
  );
}
