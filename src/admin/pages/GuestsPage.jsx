import React, { useMemo, useState } from 'react';
import { BarChart3, Building2, CalendarDays, Globe, Table2, TrendingUp } from 'lucide-react';
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
  PageHeader,
  PrintAppendix,
  PrintHeader,
} from '../ui';
import TimeColumns from '../charts/TimeColumns.jsx';
import { chart } from '../charts/theme.js';
import { useAnalytics, useGuests, usePeriod } from '../context/AnalyticsContext.jsx';
import { PRIVACY_MIN_PEOPLE } from '../data/constants.js';
import { DEFINITIONS } from '../data/definitions.js';
import { csvFilename } from '../export/csv.js';
import { fmt } from '../format.js';

const SECTION = 'guests';

// Name the guests metric gives to a country or an institution that was left blank in the form.
const BLANK = 'Not specified';

const DAY_MS = 24 * 60 * 60 * 1000;

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';
const ROUND_ICON =
  'w-8 h-8 flex items-center justify-center rounded-full border border-[#DCDCDC] text-[#414141]/70 hover:bg-[#DCDCDC]/20 transition-colors';
const ROUND_ICON_ON =
  'w-8 h-8 flex items-center justify-center rounded-full border border-[#78003F]/40 bg-[#78003F]/10 text-[#78003F] transition-colors';

const SENTENCE = 'text-sm font-semibold leading-snug text-[#414141]/80';
const STRONG = 'font-extrabold text-[#414141]';

const registrationsText = (n) => `${fmt.int(n)} ${n === 1 ? 'registration' : 'registrations'}`;
const appGuestsText = (n) => `${fmt.int(n)} app ${n === 1 ? 'guest' : 'guests'}`;

const BUCKET_WORD = { day: 'day', week: 'week', month: 'month' };
const BUCKET_HEADER = { day: 'Day', week: 'Week', month: 'Month' };

// Status of a guest event, as inferred from NFC activity. Colours are the ones of the class charts.
const EVENT_STATUS = {
  held: { label: 'Past · NFC activity', color: chart.status.held },
  past: { label: 'Past', color: chart.status.noActivity },
  upcoming: { label: 'Upcoming', color: chart.status.upcoming },
};
const statusLabel = (status) => EVENT_STATUS[status]?.label ?? null;

function StatusMark({ status }) {
  const known = EVENT_STATUS[status];
  if (!known) return fmt.empty;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden="true" className="w-2 h-2 shrink-0 rounded-full" style={{ background: known.color }} />
      {known.label}
    </span>
  );
}

// Tooltip line under the number of a bucket.
const abroadFooter = (row) => (row.registrations > 0 ? `${fmt.int(row.abroad)} from abroad` : null);

// "18 Sep 2026", or "18 Sep – 19 Sep 2026" for an event that runs past midnight.
const eventDate = (row) => fmt.range(row.startMs, row.endMs - 1 + DAY_MS);

// On a phone the table scrolls sideways; the name keeps a readable width and the date stays on one line.
const eventTitleCell = (row) => <span className="block min-w-[160px]">{row.title}</span>;
const eventDateCell = (row) => <span className="whitespace-nowrap">{eventDate(row)}</span>;

const COUNTRY_COLUMNS = [
  { key: 'country', header: 'Country', type: 'text' },
  { key: 'registrations', header: 'Registrations', type: 'int' },
  { key: 'pct', header: 'Share', type: 'pct' },
];

const INSTITUTION_COLUMNS = [
  { key: 'institution', header: 'Institution', type: 'text' },
  { key: 'registrations', header: 'Registrations', type: 'int' },
];

// The access code of an event is not part of the metric, so it can be neither shown nor exported.
const EVENT_COLUMNS = [
  { key: 'title', header: 'Event', type: 'text', render: eventTitleCell },
  { key: 'startMs', header: 'Date', type: 'date', render: eventDateCell },
  { key: 'hours', header: 'Length', type: 'hours' },
  { key: 'simulatorsBooked', header: 'Simulators', type: 'int' },
  { key: 'roomsBooked', header: 'Rooms', type: 'int' },
  { key: 'appGuests', header: 'App guests', type: 'int' },
  { key: 'statusLabel', header: 'Status', type: 'text', render: (row) => <StatusMark status={row.status} /> },
];

const csvColumn = (key, type) => ({ key, header: key, type });

const CSV_COLUMNS = {
  overTime: [
    csvColumn('bucket_start', 'date'),
    csvColumn('bucket_label', 'text'),
    csvColumn('registrations', 'int'),
    csvColumn('from_abroad', 'int'),
  ],
  byCountry: [csvColumn('country', 'text'), csvColumn('registrations', 'int'), csvColumn('share_pct', 'pct')],
  byInstitution: [csvColumn('institution', 'text'), csvColumn('registrations', 'int')],
  events: [
    csvColumn('event_name', 'text'),
    csvColumn('start', 'datetime'),
    csvColumn('end', 'datetime'),
    csvColumn('hours', 'num'),
    csvColumn('simulators_booked', 'int'),
    csvColumn('rooms_booked', 'int'),
    csvColumn('app_guests', 'int'),
    csvColumn('status', 'text'),
  ],
};

// Buckets that have not begun carry no numbers; they are empty slots on the chart only.
const elapsedBuckets = (series) => series.filter((row) => !row.isFuture);
const bucketName = (row) => row.longLabel ?? row.label;

// Named institutions in the metric's order, then everything that is only counted together.
const institutionRows = (data) => {
  const rows = data.byAffiliation.map((row) => ({
    key: row.affiliation,
    institution: row.affiliation,
    registrations: row.registrations,
    muted: row.affiliation === BLANK,
  }));
  const other = data.otherAffiliations;
  if (other.count > 0) {
    rows.push({
      key: 'other-institutions',
      institution: `Other institutions (${fmt.int(other.count)})`,
      registrations: other.registrations,
      muted: true,
    });
  }
  return rows;
};

const CSV_ROWS = {
  overTime: (data) =>
    elapsedBuckets(data.series).map((row) => ({
      bucket_start: row.from,
      bucket_label: bucketName(row),
      registrations: row.registrations,
      from_abroad: row.abroad,
    })),
  byCountry: (data) =>
    data.byCountry.map((row) => ({ country: row.country, registrations: row.registrations, share_pct: row.pct })),
  byInstitution: (data) =>
    institutionRows(data).map((row) => ({ institution: row.institution, registrations: row.registrations })),
  events: (data) =>
    data.events.map((row) => ({
      event_name: row.title,
      start: row.startMs,
      end: row.endMs,
      hours: row.hours,
      simulators_booked: row.simulatorsBooked,
      rooms_booked: row.roomsBooked,
      app_guests: row.appGuests,
      status: statusLabel(row.status),
    })),
};

// Rows for the chart, the tables and the list of the page. Formatting only: every number is the metric's own.
const buildView = (data) => ({
  chartRows: data.series.map((row) => ({ ...row, value: row.registrations })),
  seriesRows: elapsedBuckets(data.series).map((row) => ({
    key: row.key,
    from: row.from,
    bucket: row.isPartial ? `${bucketName(row)} (in progress)` : bucketName(row),
    registrations: row.registrations,
    abroad: row.abroad,
  })),
  countryRows: data.byCountry.map((row) => ({
    key: row.country,
    country: row.country,
    registrations: row.registrations,
    pct: row.pct,
    muted: row.country === BLANK,
  })),
  institutionRows: institutionRows(data),
  eventRows: data.events.map((row) => ({ ...row, key: row.id, statusLabel: statusLabel(row.status) })),
});

// shareText gives "36%" for a large group and already names both numbers for a small one
// ("72% (13 of 18)", "2 of 3"); only the missing words are added here.
const abroadSub = (totals) => {
  if (totals.registrations === 0) return null;
  const share = totals.abroadText;
  if (share.endsWith('%')) return `${share} of registrations`;
  return share.includes('%') ? share : `${share} registrations`;
};

const countriesSub = (data) => {
  if (data.totals.registrations === 0) return null;
  const blank = data.byCountry.find((row) => row.country === BLANK);
  return blank ? `${registrationsText(blank.registrations)} without a country` : 'Every registration names a country';
};

const eventsSub = (totals) =>
  totals.guestEvents > 0
    ? `${fmt.hours(totals.guestEventHours)} planned · ${appGuestsText(totals.appGuestAccounts)}`
    : 'No guest events in this period';

// 'YYYY-MM-DD' exclusive end → the last day inside, as a local instant.
const lastDayMs = (endExclusive) => {
  const [year, month, day] = endExclusive.split('-').map(Number);
  return new Date(year, month - 1, day - 1).getTime();
};

// "between 1 Jan 2026 and 20 Sep 2026": the days that could hold registrations, as in the page header.
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

// Card around a ranking list or a plain table. ChartCard keeps a fixed plot height, which suits a
// chart but not a block whose number of rows follows the data, so these get this lighter frame:
// same states, same "View as table" switch (only when a list has a table twin). On paper the list
// and its table are both printed.
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

function SingleCountry({ country }) {
  if (country === BLANK) return <p className={SENTENCE}>None of the registrations names a country.</p>;
  return (
    <p className={SENTENCE}>
      All registrations are from <strong className={STRONG}>{country}</strong>.
    </p>
  );
}

// Every institution of the period stayed under the privacy limit, so there is no name to list.
function OnlySmallInstitutions({ other }) {
  return (
    <p className={SENTENCE}>
      No institution has {PRIVACY_MIN_PEOPLE} or more registrations in this period, so none is listed by name:{' '}
      <strong className={STRONG}>{registrationsText(other.registrations)}</strong> from{' '}
      {fmt.int(other.count)} {other.count === 1 ? 'institution' : 'institutions'}.
    </p>
  );
}

export default function GuestsPage() {
  const { status, error, isRefetching, isStale, lastUpdated, refresh } = useAnalytics();
  const { period } = usePeriod();
  const { data, compareLabel, delta } = useGuests();

  const view = useMemo(() => (data ? buildView(data) : null), [data]);

  const seriesColumns = useMemo(
    () => [
      // Sorted by date, not by the words of the label.
      { key: 'bucket', header: BUCKET_HEADER[period.granularity] ?? 'Period', type: 'text', sortValue: (row) => row.from },
      { key: 'registrations', header: 'Registrations', type: 'int' },
      { key: 'abroad', header: 'From abroad', type: 'int' },
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
      table('Registrations over time', 'guest_registrations_over_time', 'overTime'),
      table('By country', 'guests_by_country', 'byCountry'),
      table('By institution', 'guests_by_institution', 'byInstitution'),
      table('Guest events', 'guest_events', 'events'),
    ];
  }, [data, period]);

  const firstLoad = !data;
  const landed = Boolean(data);
  const totals = data?.totals ?? null;
  const hasRegistrations = Boolean(totals && totals.registrations > 0);
  const hasEvents = Boolean(view && view.eventRows.length > 0);
  const stateOf = (filled) => (firstLoad ? 'first' : filled ? 'ready' : 'empty');
  const emptyTitle = `No guest registrations ${spanText(period)}`;

  const countryRows = view?.countryRows ?? [];
  const namedInstitutions = data?.byAffiliation.length ?? 0;

  return (
    <div>
      <PrintHeader section={SECTION} />
      <PageHeader
        title="Guests"
        question="Who comes from outside, and from where."
        note={DEFINITIONS.guestsSource.short}
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
                label="Guest registrations"
                value={totals?.registrations}
                format="int"
                sub={hasRegistrations ? 'Sign-in forms filled in' : 'No guest registrations in this period'}
                delta={data ? delta((d) => d.totals.registrations) : undefined}
                compareLabel={compareLabel}
                hintKey="guestRegistrations"
                firstLoad={firstLoad}
              />
              <KpiTile
                label="Countries"
                value={totals?.countries}
                format="int"
                sub={data ? countriesSub(data) : null}
                delta={data ? delta((d) => d.totals.countries) : undefined}
                compareLabel={compareLabel}
                hintKey="guestsByCountry"
                firstLoad={firstLoad}
              />
              <KpiTile
                label="From abroad"
                value={totals?.abroad}
                format="int"
                sub={totals ? abroadSub(totals) : null}
                delta={data ? delta((d) => d.totals.abroad) : undefined}
                compareLabel={compareLabel}
                // "Abroad" is read from the same form field as the countries.
                hintKey="guestsByCountry"
                firstLoad={firstLoad}
              />
              <KpiTile
                label="Guest events so far"
                value={totals?.guestEventsPast}
                format="int"
                unit={totals && totals.guestEvents > 0 ? `of ${fmt.int(totals.guestEvents)}` : undefined}
                sub={totals ? eventsSub(totals) : null}
                delta={data ? delta((d) => d.totals.guestEventsPast) : undefined}
                compareLabel={compareLabel}
                hintKey="guestEvents"
                firstLoad={firstLoad}
              />
            </Block>

            <h2 className="sr-only">Trend and breakdowns</h2>
            <Block index={1} landed={landed} className="mt-8">
              <ChartCard
                title="Registrations over time"
                icon={TrendingUp}
                height={320}
                state={stateOf(hasRegistrations)}
                empty={{ icon: TrendingUp, title: emptyTitle, action: 'widen' }}
                // Names what the columns show: the axis has no title.
                legend={
                  <p className="text-xs font-semibold text-[#414141]/75">
                    Guest registrations per {BUCKET_WORD[period.granularity] ?? 'period'}
                  </p>
                }
                table={{ columns: seriesColumns, rows: view?.seriesRows ?? [] }}
              >
                <TimeColumns rows={view?.chartRows ?? []} unit="registrations" valueFormat="int" footer={abroadFooter} />
              </ChartCard>
            </Block>

            <Block index={2} landed={landed} className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ListCard
                title="By country"
                icon={Globe}
                hintKey="guestsByCountry"
                state={stateOf(countryRows.length > 0)}
                emptyTitle={emptyTitle}
                minHeight={240}
                table={countryRows.length > 1 ? { columns: COUNTRY_COLUMNS, rows: countryRows } : null}
              >
                {countryRows.length === 1 && <SingleCountry country={countryRows[0].country} />}
                {countryRows.length > 1 && (
                  <BarList
                    items={countryRows.map((row) => ({
                      key: row.key,
                      label: row.country,
                      value: row.registrations,
                      muted: row.muted,
                    }))}
                    format="int"
                    unit="registrations"
                    showShare
                  />
                )}
              </ListCard>

              <ListCard
                title="By institution"
                icon={Building2}
                hintKey="guestsByInstitution"
                state={stateOf(hasRegistrations)}
                emptyTitle={emptyTitle}
                minHeight={240}
              >
                {data && namedInstitutions === 0 ? (
                  <OnlySmallInstitutions other={data.otherAffiliations} />
                ) : (
                  // At most eleven rows: shown in full, so "Other institutions" is never below a scroll edge.
                  <DataTable
                    columns={INSTITUTION_COLUMNS}
                    rows={view?.institutionRows ?? []}
                    maxHeight={null}
                    caption="By institution"
                  />
                )}
              </ListCard>
            </Block>

            <Block index={3} landed={landed} className="mt-6">
              <ListCard
                title="Guest events"
                icon={CalendarDays}
                hintKey="guestEvents"
                state={stateOf(hasEvents)}
                emptyTitle="No guest events in this period"
                minHeight={240}
              >
                <DataTable columns={EVENT_COLUMNS} rows={view?.eventRows ?? []} caption="Guest events" />
              </ListCard>
            </Block>
          </BusyRegion>
        </>
      )}

      <PrintAppendix section={SECTION} />
    </div>
  );
}
