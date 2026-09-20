import React, { useMemo, useState } from 'react';
import { BarChart3, Building2, GraduationCap, Repeat, Table2, TrendingUp } from 'lucide-react';
import {
  BarList,
  BusyRegion,
  Card,
  CardHeader,
  ChartCard,
  DataNotes,
  DataTable,
  EmptyState,
  ErrorBanner,
  FilterBar,
  KpiTile,
  PageHeader,
  PrintAppendix,
  PrintHeader,
  Segmented,
} from '../ui';
import TimeColumns from '../charts/TimeColumns.jsx';
import { useAnalytics, usePeriod, useStudents, useVisitors } from '../context/AnalyticsContext.jsx';
import { DEFINITIONS } from '../data/definitions.js';
import { csvFilename } from '../export/csv.js';
import { fmt } from '../format.js';

const SECTION = 'students';

// Names the students metric gives to its catch-all rows (year or faculty that is not a real one).
const OTHER = 'Other';
const BLANK_FACULTY = 'Not specified';

// Below this many registered students a percentage says little, so reach reads "2 of 3".
const SMALL_GROUP = 5;

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';
const ROUND_ICON =
  'w-8 h-8 flex items-center justify-center rounded-full border border-[#DCDCDC] text-[#414141]/70 hover:bg-[#DCDCDC]/20 transition-colors';
const ROUND_ICON_ON =
  'w-8 h-8 flex items-center justify-center rounded-full border border-[#78003F]/40 bg-[#78003F]/10 text-[#78003F] transition-colors';

const studentsText = (n) => `${fmt.int(n)} ${n === 1 ? 'student' : 'students'}`;
const visitsText = (n) => `${fmt.int(n)} ${n === 1 ? 'visit' : 'visits'}`;

// What the chart can show. `footer` adds the neighbouring number of the same bucket to the tooltip.
const MEASURES = {
  visits: {
    label: 'Visits',
    caption: 'Student visits',
    unit: 'visits',
    format: 'int',
    footer: (row) => (row.visits > 0 ? `by ${studentsText(row.unique)}` : null),
  },
  unique: {
    label: 'Unique students',
    caption: 'Unique students',
    unit: 'students',
    format: 'int',
    footer: (row) => (row.visits > 0 ? `${visitsText(row.visits)} in total` : null),
  },
  hours: {
    label: 'Training hours',
    caption: 'Training hours',
    unit: 'in the center',
    format: 'hours',
    footer: (row) => (row.visits > 0 ? `over ${visitsText(row.visits)}` : null),
  },
};
const MEASURE_OPTIONS = Object.keys(MEASURES).map((value) => ({ value, label: MEASURES[value].label }));

const BUCKET_WORD = { day: 'day', week: 'week', month: 'month' };
const BUCKET_HEADER = { day: 'Day', week: 'Week', month: 'Month' };

const YEAR_COLUMNS = [
  { key: 'label', header: 'Year', type: 'text', sortable: false },
  { key: 'registered', header: 'Registered', type: 'int' },
  { key: 'unique', header: 'Visited', type: 'int' },
  // The cell can hold "2 of 3" for a tiny year group; sorting always follows the percentage.
  { key: 'reach', header: 'Reach', type: 'bar', sortValue: (row) => row.coveragePct },
  { key: 'visits', header: 'Visits', type: 'int' },
  { key: 'hours', header: 'Training hours', type: 'hours' },
  { key: 'visitsPerStudent', header: 'Visits per student', type: 'decimal' },
];

const FACULTY_COLUMNS = [
  { key: 'faculty', header: 'Faculty', type: 'text' },
  { key: 'registered', header: 'Registered', type: 'int' },
  { key: 'unique', header: 'Visited', type: 'int' },
  { key: 'visits', header: 'Visits', type: 'int' },
  { key: 'hours', header: 'Training hours', type: 'hours' },
];

const csvColumn = (key, type) => ({ key, header: key, type });

const CSV_COLUMNS = {
  overTime: [
    csvColumn('bucket_start', 'date'),
    csvColumn('bucket_label', 'text'),
    csvColumn('visits', 'int'),
    csvColumn('unique_students', 'int'),
    csvColumn('training_hours', 'num'),
  ],
  byYear: [
    csvColumn('year_of_study', 'text'),
    csvColumn('registered', 'int'),
    csvColumn('visited', 'int'),
    csvColumn('reach_pct', 'pct'),
    csvColumn('visits', 'int'),
    csvColumn('training_hours', 'num'),
    csvColumn('visits_per_student', 'num'),
  ],
  byFaculty: [
    csvColumn('faculty', 'text'),
    csvColumn('registered', 'int'),
    csvColumn('visited', 'int'),
    csvColumn('visits', 'int'),
    csvColumn('training_hours', 'num'),
  ],
  frequency: [csvColumn('visits_bucket', 'text'), csvColumn('students', 'int')],
};

// Buckets that have not begun carry no numbers; they are empty slots on the chart only.
const elapsedBuckets = (series) => series.filter((row) => !row.isFuture);
const bucketName = (row) => row.longLabel ?? row.label;

const CSV_ROWS = {
  overTime: (data) =>
    elapsedBuckets(data.series).map((row) => ({
      bucket_start: row.from,
      bucket_label: bucketName(row),
      visits: row.visits,
      unique_students: row.unique,
      training_hours: row.hours,
    })),
  byYear: (data) =>
    data.byCourse.map((row) => ({
      year_of_study: row.course,
      registered: row.registered,
      visited: row.unique,
      reach_pct: row.coveragePct,
      visits: row.visits,
      training_hours: row.hours,
      visits_per_student: row.visitsPerStudent,
    })),
  byFaculty: (data) =>
    data.byFaculty.map((row) => ({
      faculty: row.faculty,
      registered: row.registered,
      visited: row.unique,
      visits: row.visits,
      training_hours: row.hours,
    })),
  // The label ("2–3 visits"), not the bucket id: Excel would read "2-3" as a date.
  frequency: (data) => data.frequency.map((row) => ({ visits_bucket: row.label, students: row.students })),
};

const reachCell = ({ registered, unique, coveragePct, coverageText }) =>
  registered > 0 && registered < SMALL_GROUP ? coverageText ?? `${unique} of ${registered}` : coveragePct;

// Rows for the tables and lists of the page. Formatting only: every number is the metric's own.
const buildView = (data) => {
  const { totals } = data;
  return {
    seriesRows: elapsedBuckets(data.series).map((row) => ({
      key: row.key,
      from: row.from,
      bucket: row.isPartial ? `${bucketName(row)} (in progress)` : bucketName(row),
      visits: row.visits,
      unique: row.unique,
      hours: row.hours,
    })),
    yearRows: data.byCourse.map((row) => ({
      key: row.course,
      label: row.label,
      registered: row.registered,
      unique: row.unique,
      reach: reachCell(row),
      coveragePct: row.coveragePct,
      visits: row.visits,
      hours: row.hours,
      visitsPerStudent: row.visitsPerStudent,
      muted: row.course === OTHER,
    })),
    yearFooter: {
      label: 'All years',
      registered: totals.registered,
      unique: totals.uniqueStudents,
      reach: reachCell({ ...totals, unique: totals.uniqueStudents }),
      visits: totals.visits,
      hours: totals.trainingHours,
      visitsPerStudent: totals.visitsPerStudent,
    },
    facultyRows: data.byFaculty.map((row) => ({
      key: row.faculty,
      faculty: row.faculty,
      registered: row.registered,
      unique: row.unique,
      visits: row.visits,
      hours: row.hours,
      muted: row.faculty === OTHER || row.faculty === BLANK_FACULTY,
    })),
    frequencyItems: data.frequency.map((row) => ({ key: row.bucket, label: row.label, value: row.students })),
  };
};

// 'YYYY-MM-DD' exclusive end → the last day inside, as a local instant.
const lastDayMs = (endExclusive) => {
  const [year, month, day] = endExclusive.split('-').map(Number);
  return new Date(year, month - 1, day - 1).getTime();
};

// "between 1 Jan 2026 and 20 Sep 2026": the days that could hold visits, as in the page header.
const spanText = (period) => {
  const from = fmt.date(period.from);
  const to = fmt.date(lastDayMs(period.isFuture ? period.to : period.effTo));
  return from === to ? `on ${from}` : `between ${from} and ${to}`;
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
function ListCard({ title, icon, hintKey, state, emptyTitle, table, minHeight = 160, children }) {
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

function SingleFaculty({ faculty }) {
  let sentence = (
    <>
      All visiting students are from <strong className="font-extrabold text-[#414141]">{faculty}</strong>.
    </>
  );
  if (faculty === BLANK_FACULTY) sentence = 'None of the visiting students has a faculty in their profile.';
  if (faculty === OTHER) sentence = 'All visiting students are from faculties with fewer than 3 registered students.';
  return <p className="text-sm font-semibold leading-snug text-[#414141]/80">{sentence}</p>;
}

export default function StudentsPage() {
  const { status, error, isRefetching, isStale, lastUpdated, refresh } = useAnalytics();
  const { period } = usePeriod();
  const students = useStudents();
  const visitors = useVisitors();
  const [measure, setMeasure] = useState('visits');

  const { data, compareLabel, delta } = students;
  const view = useMemo(() => (data ? buildView(data) : null), [data]);

  const chartRows = useMemo(
    () => (data ? data.series.map((row) => ({ ...row, value: row[measure] })) : []),
    [data, measure]
  );

  const seriesColumns = useMemo(
    () => [
      // Sorted by date, not by the words of the label.
      { key: 'bucket', header: BUCKET_HEADER[period.granularity] ?? 'Period', type: 'text', sortValue: (row) => row.from },
      { key: 'visits', header: 'Visits', type: 'int' },
      { key: 'unique', header: 'Unique students', type: 'int' },
      { key: 'hours', header: 'Training hours', type: 'hours' },
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
      table('Student visits over time', 'students_over_time', 'overTime'),
      table('By year of study', 'students_by_year', 'byYear'),
      table('By faculty', 'students_by_faculty', 'byFaculty'),
      table('How often students come', 'visit_frequency', 'frequency'),
    ];
  }, [data, period]);

  const firstLoad = !data;
  const landed = Boolean(data);
  const totals = data?.totals ?? null;
  const hasVisits = Boolean(totals && totals.visits > 0);
  const stateOf = (filled) => (firstLoad ? 'first' : filled ? 'ready' : 'empty');
  const emptyTitle = `No student visits ${spanText(period)}`;
  const shown = MEASURES[measure];

  let notes = visitors.data?.dataNotes ?? [];
  if (hasVisits && visitors.data && notes.length === 0) notes = ['No corrections were needed in this period.'];

  return (
    <div>
      <PrintHeader section={SECTION} />
      <PageHeader title="Students" question="Which students we reach, how often, and for how many hours." />
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
                label="Student visits"
                value={totals?.visits}
                format="int"
                sub={
                  totals && totals.visitsPerStudent != null
                    ? `${fmt.decimal(totals.visitsPerStudent)} visits per student`
                    : 'No student visits in this period'
                }
                delta={data ? delta((d) => d.totals.visits) : undefined}
                compareLabel={compareLabel}
                hintKey="studentVisits"
                firstLoad={firstLoad}
              />
              <KpiTile
                label="Unique students"
                value={totals?.uniqueStudents}
                format="int"
                sub={
                  totals && totals.registered > 0
                    ? `of ${fmt.int(totals.registered)} registered in SimuFlow`
                    : 'No students registered in SimuFlow yet'
                }
                delta={data ? delta((d) => d.totals.uniqueStudents) : undefined}
                compareLabel={compareLabel}
                hintKey="uniqueStudents"
                firstLoad={firstLoad}
              />
              <KpiTile
                label="Reach"
                value={totals?.coveragePct}
                format="pct"
                sub={
                  totals && totals.registered > 0
                    ? `${fmt.int(totals.uniqueStudents)} of ${fmt.int(totals.registered)} registered students`
                    : 'No students registered in SimuFlow yet'
                }
                delta={data ? delta((d) => d.totals.coveragePct, 'pp') : undefined}
                compareLabel={compareLabel}
                meter={typeof totals?.coveragePct === 'number' ? totals.coveragePct / 100 : null}
                hintKey="reach"
                firstLoad={firstLoad}
              />
              <KpiTile
                label="Training hours"
                value={totals?.trainingHours}
                format="hours"
                sub={
                  totals && totals.medianVisitMin != null ? `typical visit ${fmt.duration(totals.medianVisitMin)}` : null
                }
                delta={data ? delta((d) => d.totals.trainingHours) : undefined}
                compareLabel={compareLabel}
                hintKey="trainingHours"
                firstLoad={firstLoad}
              />
            </Block>

            <h2 className="sr-only">Trend and breakdowns</h2>
            <Block index={1} landed={landed} className="mt-8">
              <ChartCard
                title="Student visits over time"
                icon={TrendingUp}
                hintKey="studentVisitsOverTime"
                height={320}
                state={stateOf(hasVisits)}
                empty={{ title: emptyTitle, action: 'widen' }}
                // Names what the columns show: the switch above is not printed, and the axis has no title.
                legend={
                  <p className="text-xs font-semibold text-[#414141]/75">
                    {shown.caption} per {BUCKET_WORD[period.granularity] ?? 'period'}
                  </p>
                }
                controls={
                  <Segmented
                    size="sm"
                    ariaLabel="Number shown in the chart"
                    options={MEASURE_OPTIONS}
                    value={measure}
                    onChange={setMeasure}
                  />
                }
                table={{ columns: seriesColumns, rows: view?.seriesRows ?? [] }}
              >
                <TimeColumns rows={chartRows} unit={shown.unit} valueFormat={shown.format} footer={shown.footer} />
              </ChartCard>
            </Block>

            <Block index={2} landed={landed} className="mt-6">
              <Card padding="lg" className="min-w-0">
                <CardHeader title="By year of study" icon={GraduationCap} hintKey="byYearOfStudy" />
                {view ? (
                  <DataTable
                    columns={YEAR_COLUMNS}
                    rows={view.yearRows}
                    footerRow={view.yearFooter}
                    caption="By year of study"
                  />
                ) : (
                  <LoadingBox minHeight={360} />
                )}
              </Card>
            </Block>

            <Block index={3} landed={landed} className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ListCard
                title="By faculty"
                icon={Building2}
                hintKey="byFaculty"
                state={stateOf(Boolean(view && view.facultyRows.length > 0))}
                emptyTitle={emptyTitle}
                table={view && view.facultyRows.length > 1 ? { columns: FACULTY_COLUMNS, rows: view.facultyRows } : null}
              >
                {view && view.facultyRows.length === 1 && <SingleFaculty faculty={view.facultyRows[0].faculty} />}
                {view && view.facultyRows.length > 1 && (
                  <BarList
                    items={view.facultyRows.map((row) => ({
                      key: row.key,
                      label: row.faculty,
                      value: row.unique,
                      muted: row.muted,
                    }))}
                    format="int"
                    unit="students"
                    showShare
                  />
                )}
              </ListCard>

              <ListCard
                title="How often students come"
                icon={Repeat}
                hintKey="visitFrequency"
                state={stateOf(Boolean(totals && totals.uniqueStudents > 0))}
                emptyTitle={emptyTitle}
              >
                <BarList items={view?.frequencyItems ?? []} format="int" unit="students" maxRows={4} showShare />
              </ListCard>
            </Block>

            <Block index={4} landed={landed}>
              <DataNotes
                notes={notes}
                hint={`${DEFINITIONS.dataNotes.short} The counts cover visits of every role, not only students.`}
              />
            </Block>
          </BusyRegion>
        </>
      )}

      <PrintAppendix section={SECTION} />
    </div>
  );
}
