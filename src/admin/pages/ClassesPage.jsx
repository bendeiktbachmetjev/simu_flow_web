import React, { useMemo, useState } from 'react';
import { BarChart3, GraduationCap, ListChecks, Stethoscope, Table2, TrendingUp, Users } from 'lucide-react';
import {
  BarList,
  BusyRegion,
  Card,
  CardHeader,
  ChartCard,
  DataTable,
  EmptyState,
  ErrorBanner,
  FilterBar,
  KpiTile,
  Legend,
  PageHeader,
  PrintAppendix,
  PrintHeader,
} from '../ui';
import StackedColumns from '../charts/StackedColumns.jsx';
import { chart } from '../charts/theme.js';
import { useAnalytics, useClasses, usePeriod } from '../context/AnalyticsContext.jsx';
import { usePrintMode } from '../context/usePrintMode.js';
import { DEFINITIONS } from '../data/definitions.js';
import { csvFilename } from '../export/csv.js';
import { fmt } from '../format.js';

const SECTION = 'classes';

const CHART_HEIGHT = 320;
const LIST_MIN_HEIGHT = 160;
const YEAR_LIST_HEIGHT = 240;
const KIND_TABLE_HEIGHT = 176;
const CLASS_LIST_HEIGHT = 480;
const CLASS_LIST_EMPTY_HEIGHT = 240;

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';
const ROUND_ICON =
  'w-8 h-8 flex items-center justify-center rounded-full border border-[#DCDCDC] text-[#414141]/70 hover:bg-[#DCDCDC]/20 transition-colors';
const ROUND_ICON_ON =
  'w-8 h-8 flex items-center justify-center rounded-full border border-[#78003F]/40 bg-[#78003F]/10 text-[#78003F] transition-colors';

// Chips of the class list: the toggle-chip "on" look, the count badge and the outline chip.
// On paper a chip may break into two lines: the printed table has to fit an A4 page.
const CHIP_ON =
  'inline-flex items-center min-h-6 px-2 rounded-full text-[11px] font-semibold whitespace-nowrap border bg-[#78003F]/10 text-[#78003F] border-[#78003F]/40 print:py-0.5 print:rounded-[10px] print:whitespace-normal';
const CHIP_BADGE =
  'inline-flex items-center min-h-6 px-2 rounded-full text-[11px] font-semibold whitespace-nowrap bg-[#DCDCDC]/30 text-[#414141]/75 print:py-0.5 print:rounded-[10px] print:whitespace-normal';
const CHIP_OUTLINE =
  'inline-flex items-center min-h-6 px-2 rounded-full text-[11px] font-semibold whitespace-nowrap border-[1.5px] bg-[#78003F]/8 text-[#78003F] border-[#78003F] print:py-0.5 print:rounded-[10px] print:whitespace-normal';

const MUTED_LINE = 'text-xs font-medium text-[#414141]/75';

// The class list is the one wide table of the page: nine columns on screen, eight on paper.
// Slightly tighter cells keep it inside the card without a sideways scroll (the outer edges stay
// where every other table has them); on paper it also gets smaller type to fit an A4 page.
const LIST_TABLE =
  '[&_th]:px-2 [&_td]:px-2 [&_th:first-child]:pl-3 [&_th:last-child]:pr-3 [&_td:last-child]:pr-3 print:[&_th]:px-1.5 print:[&_td]:px-1.5 print:[&_tbody_th]:py-1.5 print:[&_td]:py-1.5 print:[&_tbody_th]:text-[8pt] print:[&_td]:text-[8pt] print:[&_thead_th]:text-[7pt] print:[&_thead_th]:tracking-normal';

const plural = (n, one, many) => `${fmt.int(n)} ${n === 1 ? one : many}`;

// `order` is what the Status column sorts by: held first when sorted downwards.
const STATUS = {
  held: { label: 'Held', className: CHIP_ON, order: 2 },
  no_activity: { label: 'No activity recorded', className: CHIP_BADGE, order: 1 },
  // Guest events only: over, nothing tapped — guests rarely use NFC.
  past: { label: 'Past', className: CHIP_BADGE, order: 1 },
  upcoming: { label: 'Upcoming', className: CHIP_OUTLINE, order: 0 },
};

// Evidence flags of the metric, in the order they are shown. `guests` exists on guest events only.
const EVIDENCE = [
  { key: 'simulator', label: 'Simulator use' },
  { key: 'teacher', label: 'Teacher on site' },
  { key: 'students', label: 'Students on site' },
  { key: 'guests', label: 'Guests on site' },
];

// Drawn bottom to top. A module constant: the chart memoises on this array.
const STATUS_SERIES = [
  { key: 'held', label: 'Held', color: chart.status.held },
  { key: 'noActivity', label: 'No activity recorded', color: chart.status.noActivity },
  { key: 'upcoming', label: 'Upcoming', color: chart.status.upcoming },
];

// Guest events are not part of the columns, so the tooltip names them.
const eventsFooter = (row) => (row.events > 0 ? `Also ${plural(row.events, 'guest event', 'guest events')}` : null);

const CLINIC_SERIES = [
  { key: 'ghost', label: 'Planned' },
  { key: 'value', label: 'Held' },
];
const CLINIC_LEGEND = [
  { key: 'planned', label: 'Planned', color: '#DCDCDC', shape: 'rect' },
  { key: 'held', label: 'Held', color: chart.single, shape: 'rect' },
];

const BUCKET_HEADER = { day: 'Day', week: 'Week', month: 'Month' };

const CLINIC_COLUMNS = [
  { key: 'clinic', header: 'Clinic', type: 'text' },
  { key: 'teachers', header: 'Teachers', type: 'int' },
  { key: 'planned', header: 'Planned', type: 'int' },
  { key: 'held', header: 'Held', type: 'int' },
  { key: 'hours', header: 'Class hours', type: 'hours' },
];

const KIND_COLUMNS = [
  { key: 'label', header: 'Kind', type: 'text', sortable: false },
  { key: 'count', header: 'Count', type: 'int', sortable: false },
  { key: 'hours', header: 'Hours', type: 'hours', sortable: false },
  { key: 'avgDurationMin', header: 'Average length', type: 'duration', sortable: false },
];

// A guest event that runs past midnight names its last day.
const timeText = (row) =>
  row.endDate && row.endDate !== row.date
    ? `${row.start} – ${fmt.dayShort(row.endDate)} ${row.end}`
    : `${row.start}–${row.end}`;

const listOrDash = (values) => (Array.isArray(values) && values.length > 0 ? values.join(', ') : fmt.empty);

// "3 booked · 1 used". Simulator use of a class that has not started cannot be known yet.
// In a narrow column the text breaks between its two halves, never inside one.
function SimulatorsCell({ row }) {
  if (!(row.simulatorsBooked > 0)) return fmt.empty;
  const booked = `${fmt.int(row.simulatorsBooked)} booked`;
  if (row.status === 'upcoming') return <span className="whitespace-nowrap">{booked}</span>;
  return (
    <>
      <span className="whitespace-nowrap">{booked} ·</span>{' '}
      <span className="whitespace-nowrap">{fmt.int(row.simulatorsUsed)} used</span>
    </>
  );
}

function StatusChip({ status }) {
  const meta = STATUS[status];
  if (!meta) return fmt.empty;
  return <span className={meta.className}>{meta.label}</span>;
}

// Two chips fit side by side at the list's minimum width, so a row needs two lines of them at most.
function EvidenceChips({ evidence }) {
  const found = EVIDENCE.filter((item) => evidence?.[item.key]);
  if (found.length === 0) return fmt.empty;
  return (
    <ul className="flex flex-wrap gap-1 min-w-[208px] print:min-w-0">
      {found.map((item) => (
        <li key={item.key} className={CHIP_BADGE}>
          {item.label}
        </li>
      ))}
    </ul>
  );
}

// A guest event has no year or groups: the row says what it is and shows the event's name instead.
const LIST_COLUMNS = [
  {
    key: 'date',
    header: 'Date',
    type: 'text',
    sortValue: (row) => row.startMs,
    render: (row) => <span className="whitespace-nowrap">{fmt.date(row.date)}</span>,
  },
  {
    key: 'time',
    header: 'Time',
    type: 'text',
    sortValue: (row) => row.start,
    render: (row) => <span className="whitespace-nowrap tabular-nums">{timeText(row)}</span>,
  },
  {
    key: 'year',
    header: 'Year',
    type: 'text',
    sortValue: (row) => (row.isEvent ? null : row.course),
    render: (row) => (row.isEvent ? 'Guest event' : <span className="whitespace-nowrap">{row.courseLabel}</span>),
  },
  {
    key: 'groups',
    header: 'Groups',
    type: 'text',
    sortValue: (row) => (row.isEvent ? row.title : row.groups.join(', ')),
    render: (row) =>
      row.isEvent ? (
        <span className="line-clamp-2 min-w-[120px] max-w-[220px] print:min-w-0" title={row.title}>
          {row.title}
        </span>
      ) : (
        listOrDash(row.groups)
      ),
  },
  // Screen only: the short name of a teacher is never printed and never exported.
  {
    key: 'teacher',
    header: 'Teacher',
    type: 'text',
    printHide: true,
    sortValue: (row) => row.teacherShort,
    render: (row) => <span className="whitespace-nowrap">{row.teacherShort ?? fmt.empty}</span>,
  },
  {
    key: 'clinics',
    header: 'Clinic(s)',
    type: 'text',
    sortValue: (row) => row.clinics.join(', '),
    render: (row) => listOrDash(row.clinics),
  },
  {
    key: 'simulators',
    header: 'Simulators',
    type: 'text',
    sortValue: (row) => row.simulatorsBooked,
    render: (row) => <SimulatorsCell row={row} />,
  },
  { key: 'evidence', header: 'Evidence', type: 'node', render: (row) => <EvidenceChips evidence={row.evidence} /> },
  {
    key: 'status',
    header: 'Status',
    type: 'node',
    sortValue: (row) => STATUS[row.status]?.order ?? null,
    render: (row) => <StatusChip status={row.status} />,
  },
];

const LIST_DEFAULT_SORT = { key: 'date', dir: 'desc' };

const csvColumn = (key, type) => ({ key, header: key, type });

const CSV_COLUMNS = {
  overTime: [
    csvColumn('bucket_start', 'date'),
    csvColumn('bucket_label', 'text'),
    csvColumn('held', 'int'),
    csvColumn('no_activity', 'int'),
    csvColumn('upcoming', 'int'),
    csvColumn('guest_events', 'int'),
  ],
  byClinic: [
    csvColumn('clinic', 'text'),
    csvColumn('teachers', 'int'),
    csvColumn('planned', 'int'),
    csvColumn('held', 'int'),
    csvColumn('class_hours', 'num'),
  ],
  byKind: [
    csvColumn('kind', 'text'),
    csvColumn('count', 'int'),
    csvColumn('hours', 'num'),
    csvColumn('avg_minutes', 'int'),
  ],
  byYear: [
    csvColumn('year_of_study', 'text'),
    csvColumn('classes', 'int'),
    csvColumn('held', 'int'),
    csvColumn('class_hours', 'num'),
  ],
  // No teacher column: names never leave the screen.
  list: [
    csvColumn('date', 'date'),
    csvColumn('start', 'text'),
    csvColumn('end', 'text'),
    csvColumn('duration_min', 'int'),
    csvColumn('kind', 'text'),
    csvColumn('year_of_study', 'text'),
    csvColumn('groups', 'text'),
    csvColumn('clinics', 'text'),
    csvColumn('simulators_booked', 'int'),
    csvColumn('simulators_used', 'int'),
    csvColumn('rooms', 'text'),
    csvColumn('specialist_requested', 'text'),
    csvColumn('status', 'text'),
  ],
};

// Upcoming classes and planned events are facts, so a bucket that has not begun stays in the
// table when it holds any; an empty one would only add a row of dashes.
const tableBuckets = (series) => series.filter((row) => !row.isFuture || row.upcoming > 0 || row.events > 0);
const bucketName = (row) => row.longLabel ?? row.label;

const CSV_ROWS = {
  overTime: (data) =>
    tableBuckets(data.series).map((row) => ({
      bucket_start: row.from,
      bucket_label: bucketName(row),
      held: row.held,
      no_activity: row.noActivity,
      upcoming: row.upcoming,
      guest_events: row.events,
    })),
  byClinic: (data) =>
    data.byClinic.map((row) => ({
      clinic: row.clinic,
      teachers: row.teachers,
      planned: row.planned,
      held: row.held,
      class_hours: row.hours,
    })),
  byKind: (data) =>
    data.byKind.map((row) => ({
      kind: row.label,
      count: row.count,
      hours: row.hours,
      avg_minutes: row.avgDurationMin,
    })),
  byYear: (data) =>
    data.byCourse.map((row) => ({
      year_of_study: row.course,
      classes: row.classes,
      held: row.held,
      class_hours: row.hours,
    })),
  list: (data) =>
    data.list.map((row) => ({
      date: row.date,
      start: row.start,
      end: row.end,
      duration_min: row.durationMin,
      kind: row.kind,
      year_of_study: row.course,
      groups: row.groups,
      clinics: row.clinics,
      simulators_booked: row.simulatorsBooked,
      simulators_used: row.simulatorsUsed,
      rooms: row.rooms,
      specialist_requested: row.needsAssistance,
      status: row.status,
    })),
};

// Rows for the tables and lists of the page. Formatting only: every number is the metric's own.
const buildView = (data) => ({
  seriesRows: tableBuckets(data.series).map((row) => ({
    key: row.key,
    from: row.from,
    bucket: row.isPartial && !row.isFuture ? `${bucketName(row)} (in progress)` : bucketName(row),
    held: row.held,
    noActivity: row.noActivity,
    upcoming: row.upcoming,
    events: row.events,
  })),
  clinicRows: data.byClinic.map((row) => ({
    key: row.clinicId ?? 'no-clinic',
    clinic: row.clinic,
    teachers: row.teachers,
    planned: row.planned,
    held: row.held,
    hours: row.hours,
    muted: row.clinicId === null,
  })),
  kindRows: data.byKind.map((row) => ({
    key: row.kind,
    label: row.label,
    count: row.count,
    hours: row.hours,
    avgDurationMin: row.avgDurationMin,
    // A part of the row above it, not a kind of its own.
    muted: row.kind === 'specialist',
  })),
  yearItems: data.byCourse.map((row) => ({
    key: row.course,
    label: row.label,
    value: row.classes,
    sub: row.classes > 0 ? `${fmt.hours(row.hours)} planned` : null,
  })),
  // A class and a guest event come from different tables, so an id alone is not a row key.
  listRows: data.list.map((row) => ({ ...row, key: `${row.kind}:${row.id}` })),
});

// 'YYYY-MM-DD' exclusive end → the last day inside, as a local instant.
const lastDayMs = (endExclusive) => {
  const [year, month, day] = endExclusive.split('-').map(Number);
  return new Date(year, month - 1, day - 1).getTime();
};

// "between 1 Sep 2026 and 30 Sep 2026": planned classes count to the END of the period, so an
// empty block speaks about the whole period, not only about the days that have passed.
const spanText = (period) => {
  const from = fmt.date(period.from);
  const to = fmt.date(lastDayMs(period.to));
  return from === to ? `on ${from}` : `between ${from} and ${to}`;
};

const heldSub = ({ past, upcoming }) => {
  if (past > 0) return `of ${fmt.int(past)} planned so far`;
  return upcoming > 0 ? `${fmt.int(upcoming)} upcoming` : 'No classes planned in this period';
};

const heldRateSub = ({ past, noActivity, upcoming }) => {
  if (past > 0) {
    return noActivity > 0 ? `${fmt.int(noActivity)} with no activity recorded` : 'Every class so far shows activity';
  }
  return upcoming > 0 ? 'No class has taken place yet' : 'No classes planned in this period';
};

const classHoursSub = ({ avgDurationMin }) =>
  avgDurationMin != null ? `held only · average class ${fmt.duration(avgDurationMin)}` : null;

const guestEventsSub = ({ guestEvents, guestEventHours }, periodOver) => {
  if (!(guestEvents > 0)) return 'No guest events in this period';
  const hours = `${fmt.hours(guestEventHours)} in total`;
  return periodOver ? hours : `${hours}, planned events included`;
};

function LoadingBox({ minHeight }) {
  return (
    <div className="flex items-center justify-center text-xs font-medium text-[#414141]/60" style={{ minHeight }}>
      Loading…
    </div>
  );
}

// Top-level block of the page. Rises once when the numbers land; the class then stays, so a
// period change does not replay it.
function Block({ index, landed, className, children }) {
  return (
    <div
      className={[landed ? 'sf-rise' : '', className].filter(Boolean).join(' ') || undefined}
      style={landed ? { animationDelay: `${Math.min(index * 40, 240)}ms` } : undefined}
    >
      {children}
    </div>
  );
}

// Card around a ranking list. ChartCard keeps a fixed plot height, which suits a chart but not
// a list whose number of rows follows the data, so lists get this lighter frame:
// same states, same "View as table" switch. On paper the list and its table are both printed.
function ListCard({ title, icon, hintKey, state, emptyTitle, table, minHeight = LIST_MIN_HEIGHT, children }) {
  const [view, setView] = useState('list');
  const ready = state === 'ready';
  const hasTable = ready && Boolean(table);
  const tableView = hasTable && view === 'table';
  const ToggleIcon = tableView ? BarChart3 : Table2;

  const toggle = hasTable ? (
    <button
      type="button"
      aria-pressed={tableView}
      aria-label="View as table"
      title={tableView ? 'View as list' : 'View as table'}
      onClick={() => setView(tableView ? 'list' : 'table')}
      className={`${tableView ? ROUND_ICON_ON : ROUND_ICON} ${RING}`}
    >
      <ToggleIcon className="w-4 h-4" aria-hidden="true" />
    </button>
  ) : null;

  return (
    <Card padding="lg" className="min-w-0">
      <CardHeader title={title} icon={icon} hintKey={hintKey} right={toggle} />
      {state === 'first' && <LoadingBox minHeight={minHeight} />}
      {state === 'empty' && <EmptyState size="sm" icon={icon} title={emptyTitle} action="widen" minHeight={minHeight} />}
      {ready && <div className={tableView ? 'hidden print:block' : undefined}>{children}</div>}
      {hasTable && (
        <div className={tableView ? 'print:mt-4' : 'hidden print:block print:mt-4'}>
          <DataTable columns={table.columns} rows={table.rows} caption={title} />
        </div>
      )}
    </Card>
  );
}

// Every planned class and guest event of the period, newest first.
function ClassListCard({ state, rows, totals }) {
  const { printing } = usePrintMode();

  const summary = totals
    ? [
        plural(totals.planned, 'teacher class', 'teacher classes'),
        totals.guestEvents > 0 ? plural(totals.guestEvents, 'guest event', 'guest events') : null,
        totals.specialistNeeded > 0 ? `${fmt.int(totals.specialistNeeded)} asked for a simulation specialist` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <Card padding="lg" className="min-w-0">
      <CardHeader title="Class list" icon={ListChecks} hintKey="classList" />
      {state === 'first' && <LoadingBox minHeight={CLASS_LIST_HEIGHT} />}
      {state === 'empty' && (
        <EmptyState
          icon={ListChecks}
          title="No classes planned in this period"
          action="widen"
          minHeight={CLASS_LIST_EMPTY_HEIGHT}
        />
      )}
      {state === 'ready' && (
        <>
          <DataTable
            columns={LIST_COLUMNS}
            rows={rows}
            defaultSort={LIST_DEFAULT_SORT}
            maxHeight={printing ? null : CLASS_LIST_HEIGHT}
            emptyText="No classes planned in this period"
            caption="Class list"
            className={LIST_TABLE}
          />
          {summary && <p className={`mt-4 ${MUTED_LINE}`}>{summary}</p>}
        </>
      )}
    </Card>
  );
}

export default function ClassesPage() {
  const { status, error, isRefetching, isStale, lastUpdated, refresh } = useAnalytics();
  const { period } = usePeriod();
  const { data, compareLabel, delta } = useClasses();

  const view = useMemo(() => (data ? buildView(data) : null), [data]);

  const seriesColumns = useMemo(
    () => [
      // Sorted by date, not by the words of the label.
      { key: 'bucket', header: BUCKET_HEADER[period.granularity] ?? 'Period', type: 'text', sortValue: (row) => row.from },
      { key: 'held', header: 'Held', type: 'int' },
      { key: 'noActivity', header: 'No activity recorded', type: 'int' },
      { key: 'upcoming', header: 'Upcoming', type: 'int' },
      { key: 'events', header: 'Guest events', type: 'int' },
    ],
    [period.granularity]
  );

  // getRows runs at click time, so a file always holds the period that is on screen.
  const exportTables = useMemo(() => {
    const table = (label, name, id) => ({
      label,
      filename: () => csvFilename(SECTION, name, period),
      columns: CSV_COLUMNS[id],
      getRows: () => (data ? CSV_ROWS[id](data) : []),
    });
    return [
      table('Classes over time', 'classes_over_time', 'overTime'),
      table('By clinic', 'classes_by_clinic', 'byClinic'),
      table('Who organises', 'classes_by_kind', 'byKind'),
      table('By year of study', 'classes_by_year', 'byYear'),
      table('Class list', 'classes_list', 'list'),
    ];
  }, [data, period]);

  const firstLoad = !data;
  const landed = Boolean(data);
  const totals = data?.totals ?? null;
  const hasClasses = Boolean(totals && totals.planned > 0);
  const stateOf = (filled) => (firstLoad ? 'first' : filled ? 'ready' : 'empty');
  const emptyTitle = `No classes ${spanText(period)}`;
  // Guest events are counted to the END of the period, planned ones included, while the comparison
  // window is only as long as the days that have passed. The two match once the period is over.
  const periodOver = period.effTo >= period.to;

  return (
    <div>
      <PrintHeader section={SECTION} />
      <PageHeader
        title="Classes"
        question="How much teaching happens here, who brings it, and do planned classes take place."
      />
      <FilterBar exportTables={exportTables} />

      {status === 'error' ? (
        <ErrorBanner error={error} onRetry={refresh} />
      ) : (
        <>
          {isStale && error && (
            <ErrorBanner className="mb-6 print:hidden" error={error} staleAt={lastUpdated} onRetry={refresh} />
          )}

          <BusyRegion busy={isRefetching}>
            <h2 className="sr-only">Key numbers</h2>
            <Block
              index={0}
              landed={landed}
              className="grid grid-cols-2 gap-3 md:gap-6 xl:grid-cols-4 print:grid-cols-4 print:gap-2"
            >
              <KpiTile
                label="Classes held"
                value={totals?.held}
                format="int"
                sub={totals ? heldSub(totals) : null}
                delta={data ? delta((d) => d.totals.held) : undefined}
                compareLabel={compareLabel}
                // The same tile as on the Overview, so the same explanation of what counts as evidence.
                hintKey="classesHeld"
                firstLoad={firstLoad}
              />
              <KpiTile
                label="Held rate"
                value={totals?.heldPct}
                format="pct"
                sub={totals ? heldRateSub(totals) : null}
                delta={data ? delta((d) => d.totals.heldPct, 'pp') : undefined}
                compareLabel={compareLabel}
                meter={typeof totals?.heldPct === 'number' ? totals.heldPct / 100 : null}
                hintKey="heldInferred"
                firstLoad={firstLoad}
              />
              <KpiTile
                label="Class hours"
                value={totals?.heldHours}
                format="hours"
                sub={totals ? classHoursSub(totals) : null}
                delta={data ? delta((d) => d.totals.heldHours) : undefined}
                compareLabel={compareLabel}
                firstLoad={firstLoad}
              />
              <KpiTile
                label="Guest events"
                value={totals?.guestEvents}
                format="int"
                sub={totals ? guestEventsSub(totals, periodOver) : null}
                delta={data && periodOver ? delta((d) => d.totals.guestEvents) : undefined}
                compareLabel={compareLabel}
                hintKey="guestEvents"
                firstLoad={firstLoad}
              />
            </Block>

            <h2 className="sr-only">Trend and breakdowns</h2>
            <Block index={1} landed={landed} className="mt-8">
              <ChartCard
                title="Classes over time"
                icon={TrendingUp}
                hintKey="classesOverTime"
                height={CHART_HEIGHT}
                state={stateOf(hasClasses)}
                empty={{ title: emptyTitle, action: 'widen' }}
                table={{ columns: seriesColumns, rows: view?.seriesRows ?? [] }}
              >
                <StackedColumns rows={data?.series ?? []} series={STATUS_SERIES} valueFormat="int" footer={eventsFooter} />
              </ChartCard>
            </Block>

            <Block index={2} landed={landed} className="mt-6">
              <ListCard
                title="By clinic"
                icon={Stethoscope}
                hintKey="classesByClinic"
                state={stateOf(Boolean(view && view.clinicRows.length > 0))}
                emptyTitle={emptyTitle}
                table={view ? { columns: CLINIC_COLUMNS, rows: view.clinicRows } : null}
              >
                <Legend className="mb-3" items={CLINIC_LEGEND} />
                <BarList
                  items={(view?.clinicRows ?? []).map((row) => ({
                    key: row.key,
                    label: row.clinic,
                    value: row.held,
                    ghost: row.planned,
                    muted: row.muted,
                  }))}
                  series={CLINIC_SERIES}
                  format="int"
                  unit="classes"
                  emptyText="No classes planned in this period"
                />
              </ListCard>
            </Block>

            <Block index={3} landed={landed} className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card padding="lg" className="min-w-0">
                <CardHeader title="Who organises" icon={Users} hintKey="whoOrganises" />
                {view ? (
                  <DataTable columns={KIND_COLUMNS} rows={view.kindRows} maxHeight={null} caption="Who organises" />
                ) : (
                  <LoadingBox minHeight={KIND_TABLE_HEIGHT} />
                )}
              </Card>

              <ListCard
                title="By year of study"
                icon={GraduationCap}
                hintKey="classesByYear"
                state={stateOf(hasClasses)}
                emptyTitle={emptyTitle}
                minHeight={YEAR_LIST_HEIGHT}
              >
                <BarList
                  items={view?.yearItems ?? []}
                  format="int"
                  unit="classes"
                  maxRows={view?.yearItems.length ?? 6}
                  emptyText="No classes planned in this period"
                />
              </ListCard>
            </Block>

            <h2 className="sr-only">Every class</h2>
            <Block index={4} landed={landed} className="mt-6">
              <ClassListCard
                state={stateOf(Boolean(view && view.listRows.length > 0))}
                rows={view?.listRows ?? []}
                totals={totals}
              />
            </Block>

            <Block index={5} landed={landed}>
              <p className="mt-8 text-xs font-medium text-[#414141]/60">{DEFINITIONS.classesNotRecorded.short}</p>
            </Block>
          </BusyRegion>
        </>
      )}

      <PrintAppendix section={SECTION} />
    </div>
  );
}
