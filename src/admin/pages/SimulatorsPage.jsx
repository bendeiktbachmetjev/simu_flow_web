import React, { useMemo, useState } from 'react';
import { CalendarCheck, CalendarClock, Clock, RefreshCw, Scale } from 'lucide-react';
import {
  BarList,
  BusyRegion,
  Card,
  ChartCard,
  ErrorBanner,
  FilterBar,
  InfoHint,
  KpiTile,
  LiveDot,
  PageHeader,
  PrintAppendix,
  PrintHeader,
  Segmented,
} from '../ui';
import TimeColumns from '../charts/TimeColumns.jsx';
import { useAnalytics, useSimulators } from '../context/AnalyticsContext.jsx';
import { useLive } from '../context/useLive.js';
import { usePrintMode } from '../context/usePrintMode.js';
import { DEFINITIONS } from '../data/definitions.js';
import { csvFilename } from '../export/csv.js';
import { fmt } from '../format.js';

const SECTION = 'simulators';

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';
const ROUND_ICON = `w-8 h-8 flex items-center justify-center rounded-full border border-[#DCDCDC] text-[#414141]/70 hover:bg-[#DCDCDC]/20 transition-colors ${RING}`;

const KPI_GRID = 'grid grid-cols-2 gap-3 md:gap-6 xl:grid-cols-4 print:grid-cols-4 print:gap-2';

// The 700 px print layout is set by script, so breakpoints (which follow the window) cannot
// stack the two lower cards on their own; a bare Cmd+P is covered by the print: classes.
const SPLIT = {
  screen: {
    grid: 'grid grid-cols-1 lg:grid-cols-12 gap-6 print:grid-cols-1',
    wide: 'min-w-0 lg:col-span-7 print:col-span-1',
    narrow: 'min-w-0 lg:col-span-5 print:col-span-1',
  },
  print: { grid: 'grid grid-cols-1 gap-6', wide: 'min-w-0', narrow: 'min-w-0' },
};

// Plot boxes have a fixed height, so a bar list gets the exact height of its rows:
// compare rows are 48 px under a one-line legend, single rows are 40 px.
const COMPARE_ROW_PX = 48;
const COMPARE_LEGEND_PX = 32;
const SINGLE_ROW_PX = 40;
const PLOT_PX = 320;
const ROWS_BEFORE_DATA = 10;

const MAX_LISTED_IDLE = 12;

const MODES = [
  { value: 'hours', label: 'Hours used' },
  { value: 'sessions', label: 'Sessions' },
];

const SIMULATOR_COLUMNS = [
  { key: 'simulator', header: 'Simulator', type: 'text' },
  { key: 'sessions', header: 'Sessions', type: 'int' },
  { key: 'hours', header: 'Used', type: 'hours' },
  { key: 'bookedHours', header: 'Booked', type: 'hours' },
  { key: 'utilisationPct', header: 'In use', type: 'pct' },
  { key: 'idleHours', header: 'Idle', type: 'hours' },
  { key: 'lastUsed', header: 'Last used', type: 'date' },
];

const TIME_COLUMNS = [
  { key: 'bucket', header: 'Period', type: 'text', sortValue: (row) => row.from },
  { key: 'hours', header: 'Hours used', type: 'hours' },
  { key: 'bookedHours', header: 'Hours booked', type: 'hours' },
  { key: 'sessions', header: 'Sessions', type: 'int' },
];

const CLINIC_COLUMNS = [
  { key: 'clinic', header: 'Clinic', type: 'text' },
  { key: 'simulatorHours', header: 'Booked hours', type: 'hours' },
  { key: 'classes', header: 'Classes / events', type: 'int' },
];

const CSV_SIMULATORS = [
  { key: 'number', header: 'number', type: 'text' },
  { key: 'name', header: 'name', type: 'text' },
  { key: 'sessions', header: 'sessions', type: 'int' },
  { key: 'hours_used', header: 'hours_used', type: 'num' },
  { key: 'hours_booked', header: 'hours_booked', type: 'num' },
  { key: 'hours_available', header: 'hours_available', type: 'num' },
  { key: 'utilisation_pct', header: 'utilisation_pct', type: 'pct' },
  { key: 'booked_pct', header: 'booked_pct', type: 'pct' },
  { key: 'idle_hours', header: 'idle_hours', type: 'num' },
  { key: 'last_used', header: 'last_used', type: 'date' },
];

const CSV_OVER_TIME = [
  { key: 'bucket_start', header: 'bucket_start', type: 'date' },
  { key: 'bucket_label', header: 'bucket_label', type: 'text' },
  { key: 'hours_used', header: 'hours_used', type: 'num' },
  { key: 'hours_booked', header: 'hours_booked', type: 'num' },
  { key: 'sessions', header: 'sessions', type: 'int' },
];

const CSV_BY_CLINIC = [
  { key: 'clinic', header: 'clinic', type: 'text' },
  { key: 'booked_hours', header: 'booked_hours', type: 'num' },
  { key: 'classes', header: 'classes', type: 'int' },
];

const plural = (n, one, many) => `${fmt.int(n)} ${n === 1 ? one : many}`;

// "No. 3" for a plain number, "X1" as it is — the way the center names its simulators.
const shortName = (number) => (/^\d+$/.test(String(number)) ? `No. ${number}` : String(number));

// Periods end on an exclusive day; people read the last day that is inside.
const lastDayInside = (endExclusive) =>
  new Date(Number(endExclusive.slice(0, 4)), Number(endExclusive.slice(5, 7)) - 1, Number(endExclusive.slice(8, 10)) - 1);

const spanText = (period) => {
  if (!period) return 'in this period';
  const from = fmt.date(period.from);
  const to = fmt.date(lastDayInside(period.isFuture ? period.to : period.effTo));
  return from === to ? `on ${from}` : `between ${from} and ${to}`;
};

const isSameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const untilText = (untilMs, nowMs) => (isSameDay(untilMs, nowMs) ? fmt.time(untilMs) : fmt.dayShort(untilMs));

// ---------------------------------------------------------------------------
// Block 0 — right now (live, independent of the period)
// ---------------------------------------------------------------------------

const CHIP_IN_USE =
  'sf-fade flex items-center gap-1.5 min-w-0 h-8 px-3 rounded-full text-xs font-semibold border bg-[#78003F]/10 text-[#78003F] border-[#78003F]/40';
const CHIP_CLASS = {
  in_use: CHIP_IN_USE,
  in_use_booked: CHIP_IN_USE,
  booked:
    'sf-fade flex items-center gap-1.5 min-w-0 h-8 px-3 rounded-full text-xs font-semibold border-[1.5px] bg-[#78003F]/8 text-[#78003F] border-[#78003F]',
  free: 'sf-fade flex items-center gap-1.5 min-w-0 h-8 px-3 rounded-full text-xs font-semibold border bg-[#FFFFFF] text-[#414141]/80 border-[#DCDCDC]',
};

// Equal cells from `sm` up: a chip keeps its place whatever its state, so the card does not
// reflow when the live numbers change. The loading box reserves the rows of ten simulators.
const CHIP_LIST = 'flex flex-wrap gap-2 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
const CHIP_LIST_LOADING =
  'flex items-center justify-center min-h-[192px] md:min-h-[152px] lg:min-h-[112px] xl:min-h-[72px] text-xs font-medium text-[#414141]/60';

function SimulatorChip({ item, nowMs }) {
  const inUse = item.state === 'in_use' || item.state === 'in_use_booked';
  const booked = item.state === 'booked' || item.state === 'in_use_booked';
  const bookedText = booked ? `booked until ${untilText(item.bookedUntilMs, nowMs)}` : null;

  let text = 'free';
  if (inUse) text = `in use since ${fmt.time(item.sinceMs)}`;
  else if (booked) text = bookedText;
  const extra = inUse && booked ? bookedText : null;

  return (
    <li className={CHIP_CLASS[item.state] || CHIP_CLASS.free} title={[item.label, text, extra].filter(Boolean).join(' · ')}>
      {inUse && <span aria-hidden="true" className="w-1.5 h-1.5 shrink-0 rounded-full bg-[#E64164]" />}
      {!inUse && booked && <CalendarClock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      <span className="min-w-0 truncate">
        <span className="font-extrabold">{shortName(item.number)}</span>
        {` · ${text}`}
      </span>
      {extra && (
        <>
          <CalendarClock className="ml-auto w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="sr-only">{`, ${extra}`}</span>
        </>
      )}
    </li>
  );
}

const liveSummary = (simulators) => {
  const lead =
    simulators.inUse > 0
      ? `${fmt.int(simulators.inUse)} of ${fmt.int(simulators.total)} in use`
      : 'No simulator in use';
  return simulators.bookedNow > 0 ? `${lead} · ${fmt.int(simulators.bookedNow)} booked now` : lead;
};

function RightNowCard({ live }) {
  const { data, status, error, isStale, updatedAt, refresh } = live;
  const failed = Boolean(isStale || error);
  const stamp = updatedAt ?? data?.updatedAt ?? null;
  const simulators = data?.simulators ?? null;

  let body;
  if (simulators && simulators.items.length > 0) {
    body = (
      <ul aria-label="Simulator status right now" className={CHIP_LIST}>
        {simulators.items.map((item) => (
          <SimulatorChip key={`${item.id}:${item.state}`} item={item} nowMs={data.updatedAt} />
        ))}
      </ul>
    );
  } else if (simulators) {
    body = <p className="text-sm font-medium text-[#414141]/60">No simulators are listed for this university yet.</p>;
  } else if (status === 'error') {
    body = <p className="text-sm font-medium text-[#414141]/60">The live status could not be loaded.</p>;
  } else {
    body = <div className={CHIP_LIST_LOADING}>Loading…</div>;
  }

  return (
    <Card as="section" padding="md" data-print="hide" aria-label="Simulators right now" className="mb-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-[#E64164]/8 text-xs font-bold text-[#414141]">
          <LiveDot active={!failed && Boolean(data)} />
          <span>
            {failed ? "Couldn't refresh" : 'Right now'}
            {stamp ? ` · ${fmt.time(stamp)}` : ''}
          </span>
        </div>
        {simulators && simulators.items.length > 0 && (
          <p className="text-sm font-semibold text-[#414141]/80">{liveSummary(simulators)}</p>
        )}
        <div className="ml-auto flex items-center gap-2">
          {failed && (
            <button type="button" aria-label="Refresh live status" onClick={() => refresh()} className={ROUND_ICON}>
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          <InfoHint hintKey="liveNow" label="Right now" />
        </div>
      </div>
      {body}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Block 2 — the sentence above the bars
// ---------------------------------------------------------------------------

function IdleLine({ perSimulator }) {
  const total = perSimulator.length;
  if (total === 0) return null;
  const idle = perSimulator.filter((row) => row.sessions === 0);

  let content;
  if (idle.length === 0) {
    content = (
      <>
        <strong className="font-extrabold text-[#414141]">{`All ${fmt.int(total)}`}</strong>
        {total === 1 ? ' simulator was used in this period.' : ' simulators were used in this period.'}
      </>
    );
  } else if (idle.length === total) {
    content = total === 1 ? 'The simulator was not used in this period.' : `None of the ${fmt.int(total)} simulators was used in this period.`;
  } else {
    const listed = idle.slice(0, MAX_LISTED_IDLE).map((row) => row.number);
    const rest = idle.length - listed.length;
    content = (
      <>
        <strong className="font-extrabold text-[#414141]">{`${fmt.int(idle.length)} of ${fmt.int(total)}`}</strong>
        {` ${idle.length === 1 ? 'was' : 'were'} not used in this period: ${listed.join(', ')}`}
        {rest > 0 ? ` +${fmt.int(rest)} more` : ''}
      </>
    );
  }

  return <p className="text-sm font-semibold leading-snug text-[#414141]/80">{content}</p>;
}

// Top-level blocks rise in once, when the numbers land.
function Rise({ landed, index, className = '', children }) {
  return (
    <div
      className={[landed ? 'sf-rise' : '', className].filter(Boolean).join(' ')}
      style={landed ? { animationDelay: `${Math.min(index * 40, 240)}ms` } : undefined}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SimulatorsPage() {
  const { data, status, error, isRefetching, isStale, period, compareLabel, delta } = useSimulators();
  const { lastUpdated, refresh } = useAnalytics();
  const live = useLive({ enabled: true });
  const { printing } = usePrintMode();
  const [mode, setMode] = useState('hours');

  const firstLoad = status === 'loading';
  const failed = status === 'error';
  const landed = Boolean(data);
  const totals = data?.totals ?? null;

  const compareItems = useMemo(() => {
    if (!data) return [];
    return [
      ...data.perSimulator.map((row) => ({
        key: row.id,
        label: row.label,
        value: row.hours,
        ghost: row.bookedHours,
        sub: plural(row.sessions, 'session', 'sessions'),
      })),
      // Removed simulators keep their bookings, but nobody can tap in on them: use is unknown, not zero.
      ...data.removed.map((row) => ({
        key: `removed-${row.number}`,
        label: row.label,
        value: null,
        ghost: row.bookedHours,
        sub: plural(row.bookings, 'booking', 'bookings'),
        muted: true,
      })),
    ];
  }, [data]);

  const simulatorTable = useMemo(() => {
    if (!data) return null;
    const rows = [
      ...data.perSimulator.map((row) => ({
        key: row.id,
        simulator: row.label,
        sessions: row.sessions,
        hours: row.hours,
        bookedHours: row.bookedHours,
        utilisationPct: row.utilisationPct,
        idleHours: row.idleHours,
        lastUsed: row.lastUsedMs,
      })),
      ...data.removed.map((row) => ({
        key: `removed-${row.number}`,
        simulator: row.label,
        sessions: null,
        hours: null,
        bookedHours: row.bookedHours,
        utilisationPct: null,
        idleHours: null,
        lastUsed: null,
        muted: true,
      })),
    ];
    const footerRow = {
      simulator: 'All current simulators',
      sessions: data.totals.sessions,
      hours: data.totals.hours,
      bookedHours: data.totals.bookedHours,
      utilisationPct: data.totals.utilisationPct,
      idleHours: data.totals.idleHours,
    };
    return { columns: SIMULATOR_COLUMNS, rows, footerRow };
  }, [data]);

  const timeRows = useMemo(
    () =>
      (data?.series ?? []).map((row) => ({
        key: row.key,
        label: row.label,
        longLabel: row.longLabel,
        isPartial: row.isPartial,
        isFuture: row.isFuture,
        value: mode === 'hours' ? row.hours : row.sessions,
        hours: row.hours,
        bookedHours: row.bookedHours,
        sessions: row.sessions,
      })),
    [data, mode]
  );

  const timeTable = useMemo(() => {
    if (!data) return null;
    const rows = data.series
      .filter((row) => !row.isFuture)
      .map((row) => ({
        key: row.key,
        from: row.from,
        bucket: row.longLabel ?? row.label,
        hours: row.hours,
        bookedHours: row.bookedHours,
        sessions: row.sessions,
      }));
    return { columns: TIME_COLUMNS, rows };
  }, [data]);

  const clinicItems = useMemo(
    () =>
      (data?.bookedByClinic ?? []).map((row) => {
        const key = row.isGuestEvents ? 'guest-events' : row.clinicId ?? 'no-clinic';
        return {
          key,
          label: row.clinic,
          value: row.simulatorHours,
          sub: row.isGuestEvents ? plural(row.classes, 'event', 'events') : plural(row.classes, 'class', 'classes'),
          muted: key === 'no-clinic',
        };
      }),
    [data]
  );

  const clinicTable = useMemo(() => {
    if (!data) return null;
    const rows = data.bookedByClinic.map((row) => ({
      key: row.isGuestEvents ? 'guest-events' : row.clinicId ?? 'no-clinic',
      clinic: row.clinic,
      simulatorHours: row.simulatorHours,
      classes: row.classes,
    }));
    return { columns: CLINIC_COLUMNS, rows };
  }, [data]);

  // Same rows and the same rounded values as the table twins; read at click time.
  const exportTables = useMemo(() => {
    if (!data || !period) return [];
    return [
      {
        label: 'Simulators: booked vs used',
        filename: csvFilename(SECTION, 'simulators', period),
        columns: CSV_SIMULATORS,
        getRows: () => [
          ...data.perSimulator.map((row) => ({
            number: row.number,
            name: row.name,
            sessions: row.sessions,
            hours_used: row.hours,
            hours_booked: row.bookedHours,
            hours_available: row.availableHours,
            utilisation_pct: row.utilisationPct,
            booked_pct: row.bookedPct,
            idle_hours: row.idleHours,
            last_used: row.lastUsedMs,
          })),
          ...data.removed.map((row) => ({
            number: row.number,
            name: row.label,
            hours_booked: row.bookedHours,
          })),
        ],
      },
      {
        label: 'Simulator hours over time',
        filename: csvFilename(SECTION, 'simulator_hours_over_time', period),
        columns: CSV_OVER_TIME,
        getRows: () =>
          data.series
            .filter((row) => !row.isFuture)
            .map((row) => ({
              bucket_start: row.from,
              bucket_label: row.longLabel ?? row.label,
              hours_used: row.hours,
              hours_booked: row.bookedHours,
              sessions: row.sessions,
            })),
      },
      {
        label: 'Booked hours by clinic',
        filename: csvFilename(SECTION, 'booked_hours_by_clinic', period),
        columns: CSV_BY_CLINIC,
        getRows: () =>
          data.bookedByClinic.map((row) => ({
            clinic: row.clinic,
            booked_hours: row.simulatorHours,
            classes: row.classes,
          })),
      },
    ];
  }, [data, period]);

  const span = spanText(period);
  const split = printing ? SPLIT.print : SPLIT.screen;

  const availability = data?.availability ?? null;
  const counted =
    availability?.clipped && period && availability.countedFrom < period.effTo
      ? { clipped: true, fromLabel: fmt.date(availability.countedFrom) }
      : null;

  const hasUseOrBookings = Boolean(totals) && (totals.sessions > 0 || totals.bookedHours > 0 || data.removed.length > 0);
  const hasSessions = Boolean(totals) && totals.sessions > 0;
  const hasBookings = clinicItems.length > 0;

  let compareState = 'first';
  if (!firstLoad) compareState = hasUseOrBookings ? 'ready' : 'empty';
  let timeState = 'first';
  if (!firstLoad) timeState = hasSessions ? 'ready' : 'empty';
  let clinicState = 'first';
  if (!firstLoad) clinicState = hasBookings ? 'ready' : 'empty';

  const compareHeight = COMPARE_LEGEND_PX + (data ? Math.max(1, compareItems.length) : ROWS_BEFORE_DATA) * COMPARE_ROW_PX;
  const clinicHeight = Math.max(PLOT_PX, clinicItems.length * SINGLE_ROW_PX);

  const timeFooter = (row) =>
    mode === 'hours'
      ? [`${fmt.hours(row.bookedHours)} booked`, plural(row.sessions, 'session', 'sessions')]
      : [`${fmt.hours(row.hours)} in use`];

  return (
    <div>
      <PrintHeader section={SECTION} />
      <PageHeader
        title="Simulators"
        question="Is the equipment used enough, and which devices are over- or under-booked."
        counted={counted}
      />

      {/* Live and independent of the period, so it sits above the filter row that scopes the rest. */}
      {!failed && <RightNowCard live={live} />}

      <FilterBar exportTables={exportTables} />

      {failed ? (
        <ErrorBanner error={error} onRetry={refresh} />
      ) : (
        <BusyRegion busy={isRefetching}>
          {isStale && error && <ErrorBanner error={error} staleAt={lastUpdated} onRetry={refresh} className="mb-6" />}

          <Rise landed={landed} index={0}>
            <h2 className="sr-only">Key numbers</h2>
            <div className={KPI_GRID}>
              <KpiTile
                label="In use (NFC)"
                value={totals?.utilisationPct ?? null}
                format="pct"
                sub={
                  totals
                    ? `${fmt.hours(totals.hoursInOpen)} of ${fmt.int(totals.availableHours)} open hours`
                    : null
                }
                delta={delta((d) => d.totals.utilisationPct, 'pp')}
                compareLabel={compareLabel}
                meter={totals?.utilisationPct == null ? null : totals.utilisationPct / 100}
                hintKey="utilisation"
                firstLoad={firstLoad}
              />
              <KpiTile
                label="Booked"
                value={totals?.bookedPct ?? null}
                format="pct"
                sub={
                  totals
                    ? `${fmt.hours(totals.bookedHours)} of ${fmt.int(totals.availableHours)} open hours`
                    : null
                }
                delta={delta((d) => d.totals.bookedPct, 'pp')}
                compareLabel={compareLabel}
                meter={totals?.bookedPct == null ? null : totals.bookedPct / 100}
                hintKey="bookedVsUsed"
                firstLoad={firstLoad}
              />
              <KpiTile
                label="Simulator hours"
                value={totals?.hours ?? null}
                format="hours"
                sub={
                  totals?.medianSessionMin != null ? `typical session ${fmt.duration(totals.medianSessionMin)}` : null
                }
                delta={delta((d) => d.totals.hours)}
                compareLabel={compareLabel}
                hintKey="simulatorHoursOverTime"
                firstLoad={firstLoad}
              />
              <KpiTile
                label="Sessions"
                value={totals?.sessions ?? null}
                format="int"
                sub={
                  totals
                    ? `${fmt.int(totals.activeSimulators)} of ${fmt.int(totals.simulators)} simulators used`
                    : null
                }
                delta={delta((d) => d.totals.sessions)}
                compareLabel={compareLabel}
                firstLoad={firstLoad}
              />
            </div>
            <p className="mt-3 text-xs font-semibold text-[#414141]/75">{DEFINITIONS.realUse.short}</p>
          </Rise>

          <h2 className="sr-only">Breakdowns</h2>

          <Rise landed={landed} index={1} className="mt-8">
            <ChartCard
              title="Booked vs used per simulator"
              icon={Scale}
              hintKey="bookedVsUsed"
              legend={data ? <IdleLine perSimulator={data.perSimulator} /> : null}
              height={compareHeight}
              state={compareState}
              empty={{
                icon: Scale,
                title: `No simulator sessions or bookings ${span}`,
                hint: "A session starts with a tap on a simulator's NFC tag; bookings come from the calendar.",
                action: 'widen',
              }}
              table={simulatorTable}
            >
              <BarList items={compareItems} variant="compare" format="hours" maxRows={Math.max(10, compareItems.length)} />
            </ChartCard>
          </Rise>

          <Rise landed={landed} index={2} className={`mt-6 ${split.grid}`}>
            <ChartCard
              className={split.wide}
              title="Simulator hours over time"
              icon={Clock}
              hintKey="simulatorHoursOverTime"
              height={PLOT_PX}
              state={timeState}
              empty={{
                icon: Clock,
                title: `No simulator sessions ${span}`,
                hint: "A session starts with a tap on a simulator's NFC tag.",
                action: 'widen',
              }}
              table={timeTable}
              controls={<Segmented size="sm" ariaLabel="Measure" options={MODES} value={mode} onChange={setMode} />}
            >
              <TimeColumns
                rows={timeRows}
                unit={mode === 'hours' ? 'in use' : 'sessions'}
                valueFormat={mode === 'hours' ? 'hours' : 'int'}
                footer={timeFooter}
              />
            </ChartCard>

            <ChartCard
              className={split.narrow}
              title="Who books the equipment"
              icon={CalendarCheck}
              hintKey="bookedByClinic"
              height={clinicHeight}
              state={clinicState}
              empty={{
                icon: CalendarCheck,
                title: `No simulator bookings ${span}`,
                hint: 'Bookings come from classes and guest events in the calendar.',
                action: 'widen',
              }}
              table={clinicTable}
            >
              <BarList items={clinicItems} format="hours" unit="booked" maxRows={Math.max(6, clinicItems.length)} />
            </ChartCard>
          </Rise>

          <Rise landed={landed} index={3}>
            <p className="mt-8 text-xs font-medium text-[#414141]/60">{DEFINITIONS.simulatorsNotRecorded.short}</p>
          </Rise>
        </BusyRegion>
      )}

      <PrintAppendix section={SECTION} />
    </div>
  );
}
