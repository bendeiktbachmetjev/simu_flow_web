// Overview — the page the dean reads: five headline numbers, the trend, a few computed
// sentences and one card per area of the center. Every number comes from useOverview();
// this file only lays them out, words the empty states and wires the CSV exports.
import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  DoorOpen,
  GraduationCap,
  HeartPulse,
  Presentation,
  Sparkles,
  Stethoscope,
  Users,
} from 'lucide-react';
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
  Heatmap,
  InsightRow,
  KpiTile,
  Legend,
  PageHeader,
  PrintAppendix,
  PrintHeader,
  RightNowStrip,
  SectionTitle,
  Segmented,
  ShareBar,
} from '../ui';
import TimeColumns from '../charts/TimeColumns.jsx';
import { chart } from '../charts/theme.js';
import { useAnalytics, useOverview, usePeriod } from '../context/AnalyticsContext.jsx';
import { useLive } from '../context/useLive.js';
import { usePrintMode } from '../context/usePrintMode.js';
import { DEFINITIONS } from '../data/definitions.js';
import { csvFilename } from '../export/csv.js';
import { fmt } from '../format.js';

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';
const CHIP_CLASS = `inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-[#DCDCDC] bg-[#FFFFFF] text-[#414141]/80 hover:bg-[#DCDCDC]/20 transition-colors ${RING}`;
const MORE_LINK_CLASS = `group inline-flex items-center gap-1 rounded-[6px] text-[13px] font-bold text-[#78003F] hover:text-[#E64164] transition-colors print:hidden ${RING}`;
const MUTED_LINE_CLASS = 'text-xs font-medium text-[#414141]/75';

// Sections rise one after another when the first numbers land.
const RISE_STEP_MS = 40;
const RISE_MAX_MS = 240;
const LAST_RISE_INDEX = RISE_MAX_MS / RISE_STEP_MS;

// Plot heights. Loading boxes use the height of the content that replaces them, so nothing jumps.
const TREND_HEIGHT = 320;
const TREND_PRINT_HEIGHT = 220;
const BLOCK_HEIGHT = 280;
const EMPTY_BLOCK_HEIGHT = 220;

// Under this many room bookings a weekday × time pattern would be noise.
const MIN_BOOKINGS_FOR_PATTERN = 5;

// Same gray as the "planned" bar that BarList draws behind the cherry one.
const PLANNED_COLOR = '#DCDCDC';

// The five tiles exist before any number does: label, hint and link are fixed, so the first
// paint already has the final layout. Everything else comes from useOverview().data.kpis.
const KPI_SLOTS = [
  { id: 'studentVisits', label: 'Student visits', format: 'int', hintKey: 'studentVisits', to: '/admin/students' },
  { id: 'uniqueStudents', label: 'Unique students', format: 'int', hintKey: 'uniqueStudents', to: '/admin/students' },
  { id: 'classesHeld', label: 'Classes held', format: 'int', hintKey: 'classesHeld', to: '/admin/classes' },
  { id: 'utilisation', label: 'Simulator use', format: 'pct', hintKey: 'utilisation', to: '/admin/simulators' },
  { id: 'trainingHours', label: 'Training hours', format: 'hours', hintKey: 'trainingHours', to: '/admin/students' },
];
const HERO_KPI = 'studentVisits';

const MEASURE_OPTIONS = [
  { value: 'visits', label: 'Visits' },
  { value: 'unique', label: 'Unique visitors' },
  { value: 'hours', label: 'Training hours' },
];

// `unit` follows the value in the tooltip ("458 h of training"); `nothing` names what is missing
// in the empty state. Visits count every role, training hours are student time only.
const MEASURES = {
  visits: {
    field: 'visits',
    unit: 'visits',
    format: 'int',
    nothing: 'visits',
    footer: (row) => (Number.isFinite(row.studentVisits) ? `${fmt.int(row.studentVisits)} by students` : null),
  },
  unique: { field: 'unique', unit: 'unique visitors', format: 'int', nothing: 'visits' },
  hours: {
    field: 'hours',
    unit: 'of training',
    format: 'hours',
    nothing: 'training hours',
    footer: () => 'Student time in the center',
  },
};

const ACTIVITY_COLUMNS = [
  { key: 'period', header: 'Period', type: 'text', sortValue: (row) => row.from },
  { key: 'visits', header: 'Visits', type: 'int' },
  { key: 'studentVisits', header: 'By students', type: 'int' },
  { key: 'unique', header: 'Unique visitors', type: 'int' },
  { key: 'hours', header: 'Training hours', type: 'hours' },
];

// On paper two cards share the width of an A4 page, so the long column names get a short form.
const screenAndPaper = (screen, paper) => (
  <>
    <span className="print:hidden">{screen}</span>
    <span className="hidden print:inline">{paper}</span>
  </>
);

// Roles keep their fixed order (identity, not rank), so the mini table does not sort.
const ROLE_COLUMNS = [
  { key: 'label', header: 'Role', type: 'text', sortable: false },
  { key: 'unique', header: screenAndPaper('Unique people', 'People'), type: 'int', sortable: false },
  { key: 'visits', header: 'Visits', type: 'int', sortable: false },
  { key: 'hours', header: screenAndPaper('Hours in center', 'Hours'), type: 'hours', sortable: false },
];

const SUMMARY_CSV = [
  { key: 'metric', header: 'metric', type: 'text' },
  { key: 'value', header: 'value', type: 'num' },
  { key: 'unit', header: 'unit', type: 'text' },
  { key: 'previousValue', header: 'previous_value', type: 'num' },
  { key: 'change', header: 'change', type: 'num' },
  { key: 'changeKind', header: 'change_kind', type: 'text' },
  { key: 'periodFrom', header: 'period_from', type: 'date' },
  { key: 'periodTo', header: 'period_to', type: 'date' },
  { key: 'previousFrom', header: 'previous_from', type: 'date' },
  { key: 'previousTo', header: 'previous_to', type: 'date' },
];

const ACTIVITY_CSV = [
  { key: 'from', header: 'bucket_start', type: 'date' },
  { key: 'longLabel', header: 'bucket_label', type: 'text' },
  { key: 'visits', header: 'visits_all', type: 'int' },
  { key: 'studentVisits', header: 'visits_students', type: 'int' },
  { key: 'unique', header: 'unique_visitors', type: 'int' },
  { key: 'hours', header: 'training_hours', type: 'num' },
];

const ROLES_CSV = [
  { key: 'label', header: 'role', type: 'text' },
  { key: 'unique', header: 'unique_people', type: 'int' },
  { key: 'visits', header: 'visits', type: 'int' },
  { key: 'hours', header: 'hours', type: 'num' },
];

// Highlights: one icon per slot (people, rhythm, teaching, equipment); two sentences get their own.
const SLOT_ICONS = { A: Users, B: CalendarDays, C: Presentation, D: HeartPulse };
const INSIGHT_ICONS = { topClinic: Stethoscope, unusedRooms: DoorOpen };

const count = (n, one, many) => `${fmt.int(n)} ${n === 1 ? one : many}`;

// Buckets that have begun. Later ones hold no numbers yet, so tables and files leave them out.
const startedBuckets = (activity) => (activity || []).filter((row) => !row.isFuture);

// Last day inside an exclusive 'YYYY-MM-DD' end, by calendar arithmetic (safe across clock changes).
const lastDayMs = (toExcl) =>
  new Date(Number(toExcl.slice(0, 4)), Number(toExcl.slice(5, 7)) - 1, Number(toExcl.slice(8, 10)) - 1).getTime();

// "between 1 Jan 2026 and 20 Sep 2026" — the counted part of the period, as in the page header.
const spanText = (period) => {
  if (!period) return 'in this period';
  const endExclusive = period.isFuture || !(period.effTo > period.from) ? period.to : period.effTo;
  const first = fmt.date(period.from);
  const last = fmt.date(lastDayMs(endExclusive));
  return first === last ? `on ${first}` : `between ${first} and ${last}`;
};

// Live numbers are only worth fetching while somebody can see them.
const subscribeToVisibility = (onChange) => {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
};
const isTabVisible = () => document.visibilityState === 'visible';
const assumeVisible = () => true;

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

// A top-level section of the page. `active` turns on once the first numbers are there; the
// class then stays, so a new period or a refresh does not replay the animation.
function Rise({ as: Tag = 'div', index, active, className, children, ...rest }) {
  const delay = Math.min(index * RISE_STEP_MS, RISE_MAX_MS);
  return (
    <Tag
      className={[active ? 'sf-rise' : '', className].filter(Boolean).join(' ') || undefined}
      style={active ? { animationDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}

function PlotLoading({ minHeight }) {
  return (
    <div className="flex flex-1 items-center justify-center text-xs font-medium text-[#414141]/60" style={{ minHeight }}>
      Loading…
    </div>
  );
}

function BlockCard({ title, icon, hintKey, firstLoad, loadingHeight = BLOCK_HEIGHT, children }) {
  return (
    <Card padding="lg" className="h-full min-w-0 flex flex-col">
      <CardHeader title={title} icon={icon} hintKey={hintKey} />
      {firstLoad ? <PlotLoading minHeight={loadingHeight} /> : children}
    </Card>
  );
}

function BlockEmpty({ icon, title }) {
  return <EmptyState size="sm" icon={icon} title={title} action="widen" minHeight={EMPTY_BLOCK_HEIGHT} className="flex-1" />;
}

function MoreLink({ to, children }) {
  return (
    <Link to={to} className={MORE_LINK_CLASS}>
      {children}
      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// O1 Headline numbers
// ---------------------------------------------------------------------------

function KpiGrid({ kpis, firstLoad, landed }) {
  const byId = new Map((kpis || []).map((kpi) => [kpi.id, kpi]));

  return (
    <section aria-labelledby="overview-kpis">
      <h2 id="overview-kpis" className="sr-only">
        Headline numbers
      </h2>
      <div className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-12 print:grid-cols-5 print:gap-2">
        {KPI_SLOTS.map((slot, index) => {
          const kpi = { ...slot, ...byId.get(slot.id) };
          const hero = slot.id === HERO_KPI;
          return (
            <Rise
              key={slot.id}
              index={index}
              active={landed}
              className={
                hero
                  ? 'col-span-2 lg:col-span-4 lg:row-span-2 print:col-span-1 print:row-span-1'
                  : 'col-span-1 lg:col-span-4 print:col-span-1'
              }
            >
              <KpiTile
                className="h-full"
                variant={hero ? 'hero' : 'default'}
                label={kpi.label}
                value={kpi.value}
                format={kpi.format}
                sub={kpi.sub}
                delta={kpi.delta}
                compareLabel={kpi.compareLabel}
                spark={kpi.spark ?? []}
                hintKey={kpi.hintKey}
                to={kpi.to}
                firstLoad={firstLoad}
              />
            </Rise>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// O2 Activity over time + Highlights
// ---------------------------------------------------------------------------

function ActivityCard({ activity, peakMonth, period, firstLoad, printing }) {
  const [measureId, setMeasureId] = useState('visits');
  const measure = MEASURES[measureId];

  const rows = useMemo(
    () =>
      (activity || []).map((row) => ({
        key: row.key,
        label: row.label,
        longLabel: row.longLabel,
        value: row[measure.field],
        isPartial: row.isPartial,
        isFuture: row.isFuture,
        studentVisits: row.studentVisits,
      })),
    [activity, measure]
  );

  const table = useMemo(
    () => ({
      columns: ACTIVITY_COLUMNS,
      rows: startedBuckets(activity).map((row) => ({
        key: row.key,
        from: row.from,
        period: row.isPartial ? `${row.longLabel} (so far)` : row.longLabel,
        visits: row.visits,
        studentVisits: row.studentVisits,
        unique: row.unique,
        hours: row.hours,
      })),
    }),
    [activity]
  );

  const hasValues = rows.some((row) => row.value > 0);
  const noVisitsAtAll = !(activity || []).some((row) => row.visits > 0);

  let state = 'ready';
  if (firstLoad) state = 'first';
  else if (!hasValues) state = 'empty';

  return (
    <ChartCard
      className="h-full"
      title="Activity over time"
      icon={Activity}
      hintKey="activityOverTime"
      height={printing ? TREND_PRINT_HEIGHT : TREND_HEIGHT}
      state={state}
      empty={{
        title: `No ${measure.nothing} ${spanText(period)}`,
        hint: noVisitsAtAll && peakMonth ? `Most activity so far was in ${peakMonth.label}.` : undefined,
        action: 'widen',
      }}
      table={table}
      controls={
        <Segmented size="sm" ariaLabel="Measure" options={MEASURE_OPTIONS} value={measureId} onChange={setMeasureId} />
      }
    >
      <TimeColumns rows={rows} unit={measure.unit} valueFormat={measure.format} footer={measure.footer} />
    </ChartCard>
  );
}

function HighlightsCard({ insights, period, firstLoad }) {
  const { setPreset } = usePeriod();
  const list = insights || [];
  const onAllTime = period?.preset === 'allTime';

  let body;
  if (firstLoad) {
    body = <PlotLoading minHeight={TREND_HEIGHT} />;
  } else if (list.length === 0) {
    body = (
      <EmptyState
        size="sm"
        icon={Sparkles}
        title={`No activity recorded ${spanText(period)}.`}
        action="widen"
        minHeight={EMPTY_BLOCK_HEIGHT}
        className="flex-1"
      />
    );
  } else {
    body = (
      <>
        <div className="space-y-2">
          {list.map((insight) => (
            <InsightRow
              key={insight.id}
              icon={INSIGHT_ICONS[insight.id] ?? SLOT_ICONS[insight.slot]}
              tone={insight.tone}
              parts={insight.parts}
              to={insight.to}
            />
          ))}
        </div>
        {list.length < 2 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className={MUTED_LINE_CLASS}>
              {onAllTime
                ? 'More highlights appear as more activity is recorded.'
                : 'Pick a wider period to see more highlights.'}
            </p>
            {!onAllTime && (
              <button type="button" onClick={() => setPreset('allTime')} className={CHIP_CLASS}>
                Show all time
              </button>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <Card padding="lg" className="h-full min-w-0 flex flex-col">
      <CardHeader title="Highlights" icon={Sparkles} hintKey="highlights" />
      {body}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// O3 Breakdowns
// ---------------------------------------------------------------------------

function WhoVisitsCard({ roles, totals, firstLoad }) {
  const list = roles || [];
  const visits = totals?.visits ?? 0;

  return (
    <BlockCard title="Who visits" icon={Users} hintKey="whoVisits" firstLoad={firstLoad}>
      {visits === 0 ? (
        <BlockEmpty icon={Users} title="No visits in this period" />
      ) : (
        <>
          <p className="mb-2 text-xs font-semibold text-[#414141]/75">{count(visits, 'visit', 'visits')} by role</p>
          <ShareBar
            items={list.map((row) => ({
              key: row.role,
              label: row.label,
              value: row.visits,
              color: chart.cat[row.role] ?? chart.cat.unknown,
            }))}
          />
          <DataTable
            className="mt-5"
            caption="Who visits"
            columns={ROLE_COLUMNS}
            rows={list.map((row) => ({ ...row, key: row.role }))}
            footerRow={{ label: 'Total', unique: totals.uniqueVisitors, visits: totals.visits, hours: totals.personHours }}
            maxHeight={null}
            emptyText="No visits in this period"
          />
        </>
      )}
    </BlockCard>
  );
}

// "90% of registered" · "2 of 3 registered" (small years are given as counts, not as a share).
const registeredSub = (row) => {
  if (!(row.registered > 0)) return 'none registered';
  return row.coverageText.includes('%') ? `${row.coverageText} of registered` : `${row.coverageText} registered`;
};

function StudentsByYearCard({ rows, firstLoad }) {
  const list = rows || [];
  const nobody = list.every((row) => row.unique === 0);

  return (
    <BlockCard title="Students by year" icon={GraduationCap} hintKey="studentsByYear" firstLoad={firstLoad}>
      {nobody ? (
        <BlockEmpty icon={GraduationCap} title="No student visits in this period" />
      ) : (
        <BarList
          items={list.map((row) => ({ key: row.course, label: row.label, value: row.unique, sub: registeredSub(row) }))}
          format="int"
          unit="students"
          maxRows={list.length}
          emptyText="No student visits in this period"
        />
      )}
    </BlockCard>
  );
}

const CLINIC_SERIES = [
  { key: 'ghost', label: 'Planned' },
  { key: 'value', label: 'Held' },
];
const CLINIC_LEGEND = [
  { key: 'planned', label: 'Planned', color: PLANNED_COLOR, shape: 'rect' },
  { key: 'held', label: 'Held', color: chart.single, shape: 'rect' },
];

function ClassesByClinicCard({ rows, totals, firstLoad }) {
  const list = rows || [];
  const planned = totals?.planned ?? 0;
  const guestEvents = totals?.guestEvents ?? 0;
  const specialist = totals?.specialistNeeded ?? 0;

  const footer = [
    count(planned, 'teacher class', 'teacher classes'),
    guestEvents > 0 ? count(guestEvents, 'guest event', 'guest events') : null,
    specialist > 0 ? `${fmt.int(specialist)} asked for a simulation specialist` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <BlockCard title="Classes by clinic" icon={Stethoscope} hintKey="classesByClinic" firstLoad={firstLoad}>
      {list.length === 0 ? (
        <BlockEmpty icon={Stethoscope} title="No classes planned in this period" />
      ) : (
        <>
          <Legend className="mb-3" items={CLINIC_LEGEND} />
          <BarList
            items={list.map((row) => ({
              key: row.clinicId ?? 'no-clinic',
              label: row.clinic,
              value: row.held,
              ghost: row.planned,
              muted: row.clinicId === null,
            }))}
            series={CLINIC_SERIES}
            format="int"
            emptyText="No classes planned in this period"
          />
        </>
      )}
      {planned + guestEvents > 0 && <p className={`mt-auto pt-4 ${MUTED_LINE_CLASS}`}>{footer}</p>}
    </BlockCard>
  );
}

function SimulatorsCard({ rows, simulators, firstLoad }) {
  const list = rows || [];

  return (
    <BlockCard title="Simulators: booked vs used" icon={HeartPulse} hintKey="bookedVsUsed" firstLoad={firstLoad}>
      {list.length === 0 ? (
        <BlockEmpty icon={HeartPulse} title="No simulator sessions or bookings in this period" />
      ) : (
        <BarList
          variant="compare"
          items={list.map((row) => ({ key: row.id, label: row.label, value: row.hours, ghost: row.bookedHours }))}
          format="hours"
          maxRows={list.length}
          emptyText="No simulator sessions or bookings in this period"
        />
      )}
      {simulators > 0 && (
        <div className="mt-auto pt-4">
          <MoreLink to="/admin/simulators">See all {fmt.int(simulators)}</MoreLink>
        </div>
      )}
    </BlockCard>
  );
}

function RoomsCard({ heat, line, firstLoad }) {
  const bookings = line?.bookings ?? 0;
  const rooms = line?.rooms ?? 0;

  const cellLabel = (r, c, v) => {
    const where = `${heat.weekdayLabels[c]} ${heat.slots[r]}`;
    if (v == null) return `${where}: no data`;
    return `${where}: ${fmt.pct(v)} of room-hours booked, ${fmt.hours(heat.bookedHours[r][c])}`;
  };

  return (
    <BlockCard title="Rooms: when space is booked" icon={DoorOpen} hintKey="roomsHeat" firstLoad={firstLoad} loadingHeight={TREND_HEIGHT}>
      {bookings === 0 ? (
        <BlockEmpty icon={DoorOpen} title="No room bookings in this period" />
      ) : (
        <>
          <p className="mb-5 text-sm font-medium text-[#414141]/75">
            Room occupancy <strong className="font-extrabold text-[#414141]">{fmt.pct(line.occupancyPct)}</strong>
            {' · '}
            {fmt.int(line.roomsUsed)} of {count(rooms, 'room', 'rooms')} used
            {line.topRoom && ` · most booked: ${line.topRoom.name} (${fmt.hours(line.topRoom.bookedHours)})`}
          </p>
          {bookings < MIN_BOOKINGS_FOR_PATTERN ? (
            <Card variant="inset" padding="sm">
              <p className="text-sm font-medium text-[#414141]/75">
                Only {count(bookings, 'room booking', 'room bookings')} in this period — not enough for a pattern.
              </p>
            </Card>
          ) : (
            <Heatmap
              ariaLabel="Share of room-hours booked, by weekday and time of day"
              rowLabels={heat.slots}
              colLabels={heat.weekdayLabels}
              values={heat.cells}
              format="pct"
              cellLabel={cellLabel}
              valueName="of room-hours booked"
              legendText={`0–${fmt.pct(heat.maxPct)} of room-hours booked`}
            />
          )}
        </>
      )}
      {rooms > 0 && (
        <div className="mt-auto pt-4">
          <MoreLink to="/admin/rooms">See all {count(rooms, 'room', 'rooms')}</MoreLink>
        </div>
      )}
    </BlockCard>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OverviewPage() {
  const { data, status, error, isRefetching, isStale } = useOverview();
  const { refresh, lastUpdated } = useAnalytics();
  const { period } = usePeriod();
  const { printing } = usePrintMode();

  // The poller runs only while this page is mounted and the tab is in front.
  const tabVisible = useSyncExternalStore(subscribeToVisibility, isTabVisible, assumeVisible);
  const live = useLive({ enabled: tabVisible });

  // getRows and filename run at click time, so a file always holds the period on screen.
  const exportTables = useMemo(
    () => [
      {
        label: 'Summary of key numbers',
        filename: () => csvFilename('overview', 'summary', period),
        columns: SUMMARY_CSV,
        getRows: () => data?.summary ?? [],
      },
      {
        label: 'Activity over time',
        filename: () => csvFilename('overview', 'activity', period),
        columns: ACTIVITY_CSV,
        getRows: () => startedBuckets(data?.activity),
      },
      {
        label: 'Visitors by role',
        filename: () => csvFilename('overview', 'visitors_by_role', period),
        columns: ROLES_CSV,
        getRows: () => data?.roles ?? [],
      },
    ],
    [data, period]
  );

  const failed = status === 'error';
  const firstLoad = !data;
  const landed = Boolean(data);

  return (
    <div>
      <PrintHeader section="overview" />
      <PageHeader
        title="Overview"
        question="How the simulation center is doing in the selected period."
        counted={data?.counted}
      />
      {!failed && <RightNowStrip live={live} />}
      <FilterBar exportTables={exportTables} />

      {failed ? (
        <ErrorBanner error={error} onRetry={refresh} />
      ) : (
        <>
          {isStale && error && (
            <ErrorBanner className="mb-6 print:hidden" staleAt={lastUpdated} error={error} onRetry={refresh} />
          )}

          <BusyRegion busy={isRefetching}>
            <KpiGrid kpis={data?.kpis} firstLoad={firstLoad} landed={landed} />

            <section aria-labelledby="overview-trend" className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
              <h2 id="overview-trend" className="sr-only">
                Trend and highlights
              </h2>
              <Rise index={KPI_SLOTS.length} active={landed} className="lg:col-span-8 min-w-0">
                <ActivityCard
                  activity={data?.activity}
                  peakMonth={data?.peakMonth}
                  period={period}
                  firstLoad={firstLoad}
                  printing={printing}
                />
              </Rise>
              <Rise index={LAST_RISE_INDEX} active={landed} className="lg:col-span-4 min-w-0">
                <HighlightsCard insights={data?.insights} period={period} firstLoad={firstLoad} />
              </Rise>
            </section>

            <Rise as="section" index={LAST_RISE_INDEX} active={landed}>
              <SectionTitle title="Who uses the center" action={{ label: 'Students', to: 'students' }} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2">
                <WhoVisitsCard roles={data?.roles} totals={data?.visitorTotals} firstLoad={firstLoad} />
                <StudentsByYearCard rows={data?.byCourse} firstLoad={firstLoad} />
              </div>
            </Rise>

            <Rise as="section" index={LAST_RISE_INDEX} active={landed}>
              <SectionTitle title="Teaching, equipment and rooms" action={{ label: 'Classes', to: 'classes' }} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2">
                <ClassesByClinicCard rows={data?.byClinic} totals={data?.classTotals} firstLoad={firstLoad} />
                <SimulatorsCard
                  rows={data?.simulatorsTop5}
                  simulators={data?.simulatorTotals?.simulators ?? 0}
                  firstLoad={firstLoad}
                />
                <div className="min-w-0 lg:col-span-2 print:col-span-2">
                  <RoomsCard heat={data?.roomsHeat} line={data?.roomsLine} firstLoad={firstLoad} />
                </div>
              </div>
            </Rise>

            <Rise index={LAST_RISE_INDEX} active={landed}>
              <DataNotes notes={data?.dataNotes} />
              <p className="mt-10 text-xs font-medium text-[#414141]/60">{DEFINITIONS.comingLater.short}</p>
            </Rise>
          </BusyRegion>
        </>
      )}

      <PrintAppendix section="overview" />
    </div>
  );
}
