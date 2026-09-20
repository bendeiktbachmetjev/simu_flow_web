import React, { createContext, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Table2 } from 'lucide-react';
import { DEFINITIONS } from '../data/definitions.js';
import { usePrintMode } from '../context/usePrintMode.js';
import Card from './Card.jsx';
import CardHeader from './CardHeader.jsx';
import InfoHint from './InfoHint.jsx';
import EmptyState from './EmptyState.jsx';
import DataTable from './DataTable.jsx';
import Legend from './Legend.jsx';

// The charts inside a card read their plot height and their accessible name from here,
// so the box and the chart can never disagree.
export const ChartFrameContext = createContext(null);

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';
const ROUND_ICON =
  'w-8 h-8 flex items-center justify-center rounded-full border border-[#DCDCDC] text-[#414141]/70 hover:bg-[#DCDCDC]/20 transition-colors';
const ROUND_ICON_ON =
  'w-8 h-8 flex items-center justify-center rounded-full border border-[#78003F]/40 bg-[#78003F]/10 text-[#78003F] transition-colors';

const definitionOf = (hintKey) => {
  const definition = hintKey ? DEFINITIONS[hintKey] : null;
  if (!definition) return null;
  return typeof definition === 'string' ? { short: definition } : definition;
};

// Card around one chart: title row, optional legend, plot box of a fixed height, and a table twin.
//   title, icon    as in CardHeader
//   hint           one-line "how we count" subtitle; defaults to DEFINITIONS[hintKey].short
//   hintKey        adds the InfoHint popover when the definition has a long text
//   legend         Legend items ([{ key, label, color, shape }]) or a ready node, shown above the plot
//   height         px of the plot box: 320 for a main chart, 240 for a secondary one
//   state          'ready' | 'first' (first load: "Loading…") | 'empty' | 'error'
//   empty          { title, hint, action?, icon? } for the empty state; action as in EmptyState
//   table          { columns, rows, defaultSort?, footerRow? } — the table twin behind "View as table"
//   controls       node in the header (a Segmented switch)
//   children       the chart
// On paper chart and table are both shown: a printed page has no toggle and no tooltip.
export default function ChartCard({
  title,
  icon,
  hint,
  hintKey,
  legend,
  height = 320,
  state = 'ready',
  empty,
  table,
  controls,
  children,
  className = '',
}) {
  const [view, setView] = useState('chart');
  const { printing } = usePrintMode();

  const definition = definitionOf(hintKey);
  const label = typeof title === 'string' ? title : undefined;
  const frame = useMemo(() => ({ height, title: label }), [height, label]);

  const ready = state === 'ready';
  const hasTable = ready && Boolean(table?.columns?.length);
  const tableView = hasTable && view === 'table';
  const showChart = !tableView || printing;
  const ToggleIcon = tableView ? BarChart3 : Table2;

  const tableTwin = hasTable ? (
    <DataTable
      columns={table.columns}
      rows={table.rows}
      defaultSort={table.defaultSort}
      footerRow={table.footerRow}
      maxHeight={printing ? null : height}
      caption={label}
    />
  ) : null;

  const right = (
    <>
      {controls}
      {definition?.long && <InfoHint hintKey={hintKey} label={label} />}
      {hasTable && (
        <button
          type="button"
          aria-pressed={tableView}
          aria-label="View as table"
          title={tableView ? 'View as chart' : 'View as table'}
          onClick={() => setView(tableView ? 'chart' : 'table')}
          className={`${tableView ? ROUND_ICON_ON : ROUND_ICON} ${RING}`}
        >
          <ToggleIcon className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </>
  );

  return (
    <Card padding="lg" className={['min-w-0', className].filter(Boolean).join(' ')}>
      <CardHeader title={title} icon={icon} hint={hint ?? definition?.short} right={right} />

      {state === 'first' && (
        <div className="flex items-center justify-center text-xs font-medium text-[#414141]/60" style={{ height }}>
          Loading…
        </div>
      )}

      {state === 'empty' && (
        <EmptyState
          icon={empty?.icon ?? BarChart3}
          title={empty?.title ?? 'Nothing to show for this period'}
          hint={empty?.hint}
          action={empty?.action}
          minHeight={height}
        />
      )}

      {state === 'error' && (
        <EmptyState
          icon={AlertTriangle}
          title="Could not load this chart"
          hint="Use Refresh data at the top of the page to try again."
          minHeight={height}
        />
      )}

      {ready && showChart && (
        <>
          {legend && <div className="mb-3">{Array.isArray(legend) ? <Legend items={legend} /> : legend}</div>}
          <div className="min-w-0 print:h-auto!" style={{ height }}>
            <ChartFrameContext.Provider value={frame}>{children}</ChartFrameContext.Provider>
          </div>
        </>
      )}

      {/* Chart view keeps the twin in the DOM for a bare Cmd+P; the print report shows both as well. */}
      {hasTable && (
        <div className={tableView ? 'print:mt-4' : 'hidden print:block print:mt-4'} style={{ minHeight: tableView ? height : undefined }}>
          {tableTwin}
        </div>
      )}
    </Card>
  );
}
