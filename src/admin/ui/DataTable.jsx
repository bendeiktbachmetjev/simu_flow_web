import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { fmt } from '../format.js';

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';

const SCROLLER = 'sf-table-scroll -mx-3 overflow-auto rounded-[16px]';
const SCROLLER_DEFAULT = 'sf-table-scroll -mx-3 overflow-auto max-h-[480px] rounded-[16px]';
const DEFAULT_MAX_HEIGHT = 480;
const TABLE = 'w-full border-separate border-spacing-0 text-sm';

const TH =
  'group sticky top-0 z-[1] bg-[#FFFFFF] px-3 py-2.5 text-left text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#414141]/75 border-b border-[#DCDCDC]/60 whitespace-nowrap';
const TH_RIGHT =
  'group sticky top-0 z-[1] bg-[#FFFFFF] px-3 py-2.5 text-right text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#414141]/75 border-b border-[#DCDCDC]/60 whitespace-nowrap';

// The button repeats the header type styles: browsers reset text-transform on buttons.
const SORT_BUTTON =
  'inline-flex items-center gap-1 rounded-[6px] hover:text-[#414141] text-[11px] font-extrabold tracking-[0.08em] uppercase print:hidden';

const TD = 'px-3 py-3 border-b border-[#DCDCDC]/40 font-medium text-[#414141]/80 group-hover:bg-[#DCDCDC]/10';
const TD_FIRST = 'px-3 py-3 border-b border-[#DCDCDC]/40 font-semibold text-[#414141] text-left group-hover:bg-[#DCDCDC]/10';
const TD_MUTED = 'px-3 py-3 border-b border-[#DCDCDC]/40 font-medium text-[#414141]/60 group-hover:bg-[#DCDCDC]/10';
const TD_TOTAL = 'px-3 py-3 font-extrabold text-[#414141] border-t border-[#DCDCDC]';

const NUMERIC_TYPES = ['int', 'pct', 'hours', 'duration', 'decimal', 'bar'];
const NEXT_DIR = { none: 'desc', desc: 'asc', asc: 'none' };
const ARIA_SORT = { asc: 'ascending', desc: 'descending', none: 'none' };

const isRight = (column) => (column.align ? column.align === 'right' : NUMERIC_TYPES.includes(column.type));
const canSort = (column) => column.sortable !== false && (column.type !== 'node' || typeof column.sortValue === 'function');
const sortValueOf = (column, row) => (typeof column.sortValue === 'function' ? column.sortValue(row) : row[column.key]);

// Empty values always sink to the bottom, in both directions.
const compare = (a, b, dir) => {
  const emptyA = a == null || a === '';
  const emptyB = b == null || b === '';
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  const order =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  return dir === 'asc' ? order : -order;
};

function BarCell({ value, column }) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fmt.value(value, column.format ?? 'pct');
  const ratio = Math.min(1, Math.max(0, value / (column.max ?? 100)));
  return (
    <span className="flex items-center justify-end gap-2">
      <span aria-hidden="true" className="w-16 h-1.5 rounded-full bg-[#78003F]/10 overflow-hidden">
        <span className="block h-full rounded-full bg-[#78003F]" style={{ width: `${ratio * 100}%`, minWidth: ratio > 0 ? 2 : 0 }} />
      </span>
      {/* Fixed width: the mini bars of a column must start at the same x to be comparable. */}
      <span className="w-11">{fmt.value(value, column.format ?? 'pct')}</span>
    </span>
  );
}

const renderCell = (column, row) => {
  if (typeof column.render === 'function') return column.render(row);
  const value = row[column.key];
  if (column.type === 'node') return value ?? fmt.empty;
  if (column.type === 'bar') return <BarCell value={value} column={column} />;
  return fmt.value(value, column.format ?? column.type ?? 'text');
};

// The table twin of a chart, and the plain tables of the pages.
//   columns     [{ key, header, type: 'text'|'int'|'pct'|'hours'|'duration'|'decimal'|'date'|'bar'|'node', align?, sortable = true,
//                  format?, render?(row), sortValue?(row), max? (bar scale, default 100), printHide? }]
//   rows        objects keyed by column.key; `row.key` or `row.id` identifies a row, `row.muted` grays it
//   defaultSort { key, dir: 'asc' | 'desc' } | null — null keeps the given order
//   maxHeight   px of the scroll box (the header stays in view); null = no limit
//   footerRow   totals row, same keys as a row
//   caption     accessible name of the table
// A header click sorts descending, then ascending, then returns to the default order.
// A string in a numeric column is printed as it is ("2 of 3"); null prints "—".
export default function DataTable({
  columns = [],
  rows = [],
  defaultSort = null,
  maxHeight = DEFAULT_MAX_HEIGHT,
  footerRow,
  emptyText = 'Nothing to show for this period',
  caption,
  className = '',
}) {
  const [userSort, setUserSort] = useState(null);
  const sort = userSort ?? defaultSort;

  const sortedRows = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    const column = sort ? columns.find((c) => c.key === sort.key) : null;
    if (!column) return list;
    return list
      .map((row, index) => ({ row, index }))
      .sort((a, b) => compare(sortValueOf(column, a.row), sortValueOf(column, b.row), sort.dir) || a.index - b.index)
      .map((entry) => entry.row);
  }, [rows, columns, sort]);

  const dirOf = (column) => (sort && sort.key === column.key ? sort.dir : 'none');

  const toggleSort = (column) => {
    let next = NEXT_DIR[dirOf(column)];
    // On the default sort column "back to default" would change nothing, so the cycle starts over.
    if (next === 'none' && !userSort && defaultSort?.key === column.key) next = NEXT_DIR.none;
    setUserSort(next === 'none' ? null : { key: column.key, dir: next });
  };

  return (
    <div
      className={[maxHeight === DEFAULT_MAX_HEIGHT ? SCROLLER_DEFAULT : SCROLLER, RING, className].filter(Boolean).join(' ')}
      style={maxHeight && maxHeight !== DEFAULT_MAX_HEIGHT ? { maxHeight } : undefined}
      role="region"
      aria-label={caption ?? 'Data table'}
      tabIndex={0}
    >
      <table className={TABLE}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => {
              const dir = dirOf(column);
              const hidden = column.printHide ? 'hide' : undefined;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={canSort(column) ? ARIA_SORT[dir] : undefined}
                  data-print={hidden}
                  className={isRight(column) ? TH_RIGHT : TH}
                >
                  {canSort(column) ? (
                    <>
                      <button type="button" onClick={() => toggleSort(column)} className={`${SORT_BUTTON} ${RING}`}>
                        {column.header}
                        {dir === 'asc' && <ArrowUp className="w-3 h-3 text-[#78003F]" aria-hidden="true" />}
                        {dir === 'desc' && <ArrowDown className="w-3 h-3 text-[#78003F]" aria-hidden="true" />}
                      </button>
                      <span className="hidden print:inline">{column.header}</span>
                    </>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {sortedRows.length === 0 && (
            <tr>
              <td colSpan={Math.max(1, columns.length)} className="px-3 py-8 text-center text-sm font-medium text-[#414141]/60">
                {emptyText}
              </td>
            </tr>
          )}
          {sortedRows.map((row, rowIndex) => (
            <tr key={row.key ?? row.id ?? rowIndex} className="group">
              {columns.map((column, columnIndex) => {
                const align = isRight(column) ? ' text-right tabular-nums' : '';
                const hidden = column.printHide ? 'hide' : undefined;
                if (columnIndex === 0) {
                  return (
                    <th key={column.key} scope="row" data-print={hidden} className={row.muted ? `${TD_MUTED} text-left` : TD_FIRST}>
                      {renderCell(column, row)}
                    </th>
                  );
                }
                return (
                  <td key={column.key} data-print={hidden} className={`${row.muted ? TD_MUTED : TD}${align}`}>
                    {renderCell(column, row)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>

        {footerRow && sortedRows.length > 0 && (
          <tfoot>
            <tr>
              {columns.map((column, columnIndex) => {
                const align = isRight(column) ? ' text-right tabular-nums' : ' text-left';
                const hidden = column.printHide ? 'hide' : undefined;
                const Cell = columnIndex === 0 ? 'th' : 'td';
                return (
                  <Cell key={column.key} scope={columnIndex === 0 ? 'row' : undefined} data-print={hidden} className={`${TD_TOTAL}${align}`}>
                    {footerRow[column.key] == null ? '' : renderCell(column, footerRow)}
                  </Cell>
                );
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
