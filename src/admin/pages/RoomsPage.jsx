import React, { useMemo, useState } from 'react';
import { BarChart3, CalendarClock, DoorOpen, ListOrdered, RefreshCw, Table2, Users } from 'lucide-react';
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
  Heatmap,
  KpiTile,
  LiveDot,
  PageHeader,
  PrintAppendix,
  PrintHeader,
} from '../ui';
import { useAdmin } from '../context/AdminContext.jsx';
import { useAnalytics, usePeriod, useRooms } from '../context/AnalyticsContext.jsx';
import { useLive } from '../context/useLive.js';
import { usePrintMode } from '../context/usePrintMode.js';
import { DEFINITIONS, fillHint } from '../data/definitions.js';
import { csvFilename } from '../export/csv.js';
import { fmt } from '../format.js';

const SECTION = 'rooms';

// A period that has not started yet is read from the calendar as it is planned.
const FULL_HORIZON = { horizon: 'full' };

const MIN_BOOKINGS_FOR_PATTERN = 5;
const TOP_ROOMS = 10;
const MAX_IDLE_CHIPS = 12;
const MAX_BUSY_CHIPS = 12;
const MAX_UNLISTED_NAMES = 3;

// Heights of the first-load placeholders = the heights the blocks have with data.
const HEATMAP_HEIGHT = 352;
const RANKING_MIN_HEIGHT = 320;
const KIND_TABLE_HEIGHT = 128;

const RISE_STEP_MS = 40;
const RISE_MAX_MS = 240;

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';
const ROUND_ICON =
  'w-8 h-8 flex items-center justify-center rounded-full border border-[#DCDCDC] text-[#414141]/70 hover:bg-[#DCDCDC]/20 transition-colors';
const ROUND_ICON_ON =
  'w-8 h-8 flex items-center justify-center rounded-full border border-[#78003F]/40 bg-[#78003F]/10 text-[#78003F] transition-colors';
const LIVE_PILL = 'inline-flex items-center gap-2 h-8 px-3 rounded-full bg-[#E64164]/8 text-xs font-bold text-[#414141]';
const BUSY_CHIP =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-[#78003F]/10 text-[#78003F] border-[#78003F]/40';
const COUNT_BADGE = 'px-3 py-1.5 rounded-full text-xs font-semibold bg-[#DCDCDC]/30 text-[#414141]/70';
const QUIET_LINE = 'text-xs font-medium text-[#414141]/75';

const BOOKING_KIND = { class: 'Class', event: 'Guest event' };

const EN_DASH_GAP = ' – ';

const plural = (n, one, many) => `${fmt.int(n)} ${n === 1 ? one : many}`;

// "between 1 Jan and 20 Sep 2026", or "on 20 Sep 2026" for a single day.
const spanText = (period) => {
  const range = fmt.range(period.from, period.isFuture ? period.to : period.effTo);
  return range.includes(EN_DASH_GAP) ? `between ${range.replace(EN_DASH_GAP, ' and ')}` : `on ${range}`;
};

// A booking that runs past midnight names its day: "until Thu 17 Sep 12:00".
const untilText = (untilMs, nowMs) =>
  fmt.date(untilMs) === fmt.date(nowMs) ? fmt.time(untilMs) : `${fmt.dayShort(untilMs)} ${fmt.time(untilMs)}`;

// The year is spelled out only when the peak is not in the current one.
const peakWhen = (peak, period) => {
  const thisYear = String(period?.today || '').slice(0, 4);
  const day = peak.date.slice(0, 4) === thisYear ? fmt.dayShort(peak.date) : fmt.dayLong(peak.date);
  return `${day} ${fmt.clock(peak.startMin)}`;
};

// ---------------------------------------------------------------------------
// Rows of the table twins (the CSV files carry exactly the same values)
// ---------------------------------------------------------------------------

const slotRowsOf = (heatmap) =>
  heatmap.weekdayLabels.flatMap((weekday, col) =>
    heatmap.slots.map((slot, row) => ({
      key: `${weekday}-${slot}`,
      weekday,
      weekdayOrder: heatmap.weekdays[col],
      slot,
      bookedHours: heatmap.bookedHours[row][col],
      occupancyPct: heatmap.cells[row][col],
    })),
  );

const roomRowsOf = (data) => {
  const rows = data.perRoom.map((room) => ({
    key: room.id,
    name: room.name,
    bookedHours: room.bookedHours,
    occupancyPct: room.occupancyPct,
    bookings: room.bookings,
    daysUsed: room.daysUsed,
    classHours: room.classHours,
    eventHours: room.eventHours,
  }));
  if (data.unlisted) {
    rows.push({
      key: 'unlisted',
      name: 'Unlisted rooms',
      bookedHours: data.unlisted.bookedHours,
      occupancyPct: null,
      bookings: data.unlisted.bookings,
      daysUsed: null,
      classHours: null,
      eventHours: null,
      muted: true,
    });
  }
  return rows;
};

const kindRowsOf = (data) => data.byKind.map((row) => ({ key: row.kind, ...row }));

const SLOT_COLUMNS = [
  { key: 'weekday', header: 'Weekday', type: 'text', sortValue: (row) => row.weekdayOrder },
  { key: 'slot', header: 'Time slot', type: 'text' },
  { key: 'bookedHours', header: 'Booked room-hours', type: 'hours' },
  { key: 'occupancyPct', header: 'Occupancy', type: 'pct' },
];

const ROOM_COLUMNS = [
  { key: 'name', header: 'Room', type: 'text' },
  { key: 'bookedHours', header: 'Booked hours', type: 'hours' },
  { key: 'occupancyPct', header: 'Occupancy', type: 'pct' },
  { key: 'bookings', header: 'Bookings', type: 'int' },
  { key: 'daysUsed', header: 'Days used', type: 'int' },
];

const KIND_COLUMNS = [
  { key: 'label', header: 'Booked by', type: 'text', sortable: false },
  { key: 'hours', header: 'Hours', type: 'hours', sortable: false },
  { key: 'bookings', header: 'Bookings', type: 'int', sortable: false },
];

const CSV_SLOT_COLUMNS = [
  { key: 'weekday', header: 'weekday', type: 'text' },
  { key: 'slot', header: 'slot', type: 'text' },
  { key: 'bookedHours', header: 'booked_room_hours', type: 'num' },
  { key: 'occupancyPct', header: 'occupancy_pct', type: 'pct' },
];

const CSV_ROOM_COLUMNS = [
  { key: 'name', header: 'room', type: 'text' },
  { key: 'bookedHours', header: 'booked_hours', type: 'num' },
  { key: 'occupancyPct', header: 'occupancy_pct', type: 'pct' },
  { key: 'bookings', header: 'bookings', type: 'int' },
  { key: 'daysUsed', header: 'days_used', type: 'int' },
  { key: 'classHours', header: 'hours_from_classes', type: 'num' },
  { key: 'eventHours', header: 'hours_from_events', type: 'num' },
];

const CSV_KIND_COLUMNS = [
  { key: 'label', header: 'kind', type: 'text' },
  { key: 'hours', header: 'hours', type: 'num' },
  { key: 'bookings', header: 'bookings', type: 'int' },
];

// ---------------------------------------------------------------------------
// Small page-local pieces
// ---------------------------------------------------------------------------

// A top-level block of the page: it rises once, when the numbers land.
function Rise({ ready, index, className = '', children }) {
  return (
    <div
      className={[className, ready ? 'sf-rise' : ''].filter(Boolean).join(' ')}
      style={ready ? { animationDelay: `${Math.min(index * RISE_STEP_MS, RISE_MAX_MS)}ms` } : undefined}
    >
      {children}
    </div>
  );
}

function LoadingBox({ height }) {
  return (
    <div className="flex items-center justify-center text-xs font-medium text-[#414141]/60" style={{ height }}>
      Loading…
    </div>
  );
}

// ---------------------------------------------------------------------------
// 0 · Free right now (live, from bookings; never printed)
// ---------------------------------------------------------------------------

function FreeNowCard({ live, next30 }) {
  const { data = null, error = null, isStale = false, updatedAt = null, refresh } = live;
  const failed = Boolean(isStale || error);
  const rooms = data?.rooms ?? null;
  const stamp = updatedAt ?? data?.updatedAt ?? null;

  const busy = rooms?.busy ?? [];
  const shownBusy = busy.slice(0, MAX_BUSY_CHIPS);
  const hiddenBusy = busy.length - shownBusy.length;
  const freeText = rooms ? fmt.int(rooms.freeNow) : fmt.empty;

  let detail = null;
  if (!rooms) {
    detail = failed ? <p className={QUIET_LINE}>Current bookings could not be loaded.</p> : null;
  } else if (rooms.total === 0) {
    detail = <p className={QUIET_LINE}>No rooms are listed in SimuFlow yet.</p>;
  } else if (busy.length === 0) {
    detail = <p className="text-sm font-semibold text-[#414141]/80">All {fmt.int(rooms.total)} rooms are free</p>;
  } else {
    detail = (
      <ul aria-label="Rooms booked right now" className="flex flex-wrap gap-2">
        {shownBusy.map((room) => (
          <li key={room.name} className={BUSY_CHIP}>
            {room.name} · until {untilText(room.untilMs, data.updatedAt)} · {BOOKING_KIND[room.kind] ?? BOOKING_KIND.class}
          </li>
        ))}
        {hiddenBusy > 0 && (
          <li className={COUNT_BADGE} aria-label={`and ${fmt.int(hiddenBusy)} more`}>
            +{fmt.int(hiddenBusy)}
          </li>
        )}
      </ul>
    );
  }

  let ahead = `Next 30 days: ${fmt.empty}`;
  if (next30) {
    ahead =
      next30.bookings > 0
        ? `Next 30 days: ${plural(next30.bookings, 'booking', 'bookings')} · ${fmt.hours(next30.hours)}`
        : 'Next 30 days: nothing booked yet';
  }

  const status = (
    <>
      <span className={LIVE_PILL}>
        <LiveDot active={!failed && Boolean(data)} />
        <span>
          {failed ? "Couldn't refresh" : 'Right now'}
          {stamp ? ` · ${fmt.time(stamp)}` : ''}
        </span>
      </span>
      {failed && typeof refresh === 'function' && (
        <button
          type="button"
          aria-label="Refresh live numbers"
          onClick={() => refresh()}
          className={`${ROUND_ICON} ${RING}`}
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </>
  );

  return (
    <Card as="section" padding="md" data-print="hide" aria-label="Free right now">
      <CardHeader title="Free right now" icon={DoorOpen} hintKey="roomsFreeNow" right={status} />
      <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
        <p className="flex items-baseline gap-2 whitespace-nowrap">
          <span
            key={freeText}
            className={
              rooms
                ? 'sf-fade text-4xl leading-none font-extrabold tracking-[-0.02em] text-[#414141]'
                : 'text-4xl leading-none font-extrabold tracking-[-0.02em] text-[#414141]/25'
            }
          >
            {freeText}
          </span>
          <span className="text-base font-bold text-[#414141]/60">
            {rooms ? `of ${fmt.int(rooms.total)} rooms free` : 'rooms free'}
          </span>
        </p>
        <div className="flex-1 min-w-[240px] min-h-[32px] flex items-center">{detail}</div>
      </div>
      <p className={`mt-4 ${QUIET_LINE}`}>{ahead}</p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 1 · Headline numbers
// ---------------------------------------------------------------------------

function RoomKpis({ first, totals, delta, compareLabel, period }) {
  const peak = totals?.peak ?? null;
  const hasRooms = Boolean(totals && totals.rooms > 0);
  const idleRooms = totals ? totals.rooms - totals.roomsUsed : 0;

  const occupancySub =
    totals && totals.availableHours > 0
      ? `${fmt.hours(totals.bookedHours)} of ${fmt.int(totals.availableHours)} open room-hours`
      : null;
  let usedSub = null;
  if (hasRooms) usedSub = idleRooms > 0 ? `${fmt.int(idleRooms)} without bookings` : 'All rooms booked at least once';

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:gap-6 xl:grid-cols-4">
        <KpiTile
          label="Room occupancy"
          format="pct"
          firstLoad={first}
          value={totals?.occupancyPct ?? null}
          meter={totals?.occupancyPct == null ? null : totals.occupancyPct / 100}
          sub={occupancySub}
          delta={delta((d) => d.totals.occupancyPct, 'pp')}
          compareLabel={compareLabel}
        />
        <KpiTile
          label="Booked hours"
          format="hours"
          firstLoad={first}
          value={totals?.bookedHours ?? null}
          sub={totals ? plural(totals.bookings, 'booking', 'bookings') : null}
          delta={delta((d) => d.totals.bookedHours)}
          compareLabel={compareLabel}
        />
        <KpiTile
          label="Rooms used"
          format="int"
          firstLoad={first}
          value={hasRooms ? totals.roomsUsed : null}
          unit={hasRooms ? `of ${fmt.int(totals.rooms)}` : undefined}
          sub={usedSub}
          delta={delta((d) => d.totals.roomsUsed)}
          compareLabel={compareLabel}
        />
        <KpiTile
          label="Peak demand"
          format="int"
          firstLoad={first}
          value={peak ? peak.rooms : null}
          unit={peak ? (peak.rooms === 1 ? 'room at once' : 'rooms at once') : undefined}
          sub={peak ? peakWhen(peak, period) : null}
          delta={delta((d) => (d.totals.peak ? d.totals.peak.rooms : null))}
          compareLabel={compareLabel}
        />
      </div>
      <p className="mt-3 text-xs font-semibold text-[#414141]/75">
        {fillHint('roomOccupancy', { outsideHours: totals ? fmt.hours(totals.outsideHours) : null })}
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// 2 · When space is booked (two-hour slots × weekdays)
// ---------------------------------------------------------------------------

function BookedHeatmap({ first, data, period }) {
  const heatmap = data?.heatmap ?? null;
  const bookings = data?.totals.bookings ?? 0;
  const slotRows = useMemo(() => (heatmap ? slotRowsOf(heatmap) : []), [heatmap]);

  let state = 'ready';
  let empty = null;
  if (first || !heatmap) {
    state = 'first';
  } else if (bookings === 0) {
    state = 'empty';
    empty = { icon: CalendarClock, title: `No room bookings ${spanText(period)}`, action: 'widen' };
  } else if (bookings < MIN_BOOKINGS_FOR_PATTERN) {
    state = 'empty';
    empty = {
      icon: CalendarClock,
      title: `Only ${plural(bookings, 'room booking', 'room bookings')} in this period — not enough for a pattern.`,
      action: 'widen',
    };
  } else if (!heatmap.topSlot) {
    state = 'empty';
    empty = {
      icon: CalendarClock,
      title: 'No pattern to show for this period',
      hint: 'The room bookings fall outside 08–20 or are too short to register.',
      action: 'widen',
    };
  }

  const ready = state === 'ready';

  return (
    <ChartCard
      title="When space is booked"
      icon={CalendarClock}
      hintKey="roomsHeat"
      height={HEATMAP_HEIGHT}
      state={state}
      empty={empty}
      table={ready ? { columns: SLOT_COLUMNS, rows: slotRows } : undefined}
    >
      {ready && (
        <>
          <p className="mb-3 text-sm font-semibold text-[#414141]/80">
            Busiest slot:{' '}
            <strong className="font-extrabold text-[#414141]">
              {heatmap.topSlot.weekdayLabel} {heatmap.topSlot.slot}
            </strong>{' '}
            · {fmt.pct(heatmap.topSlot.pct)} of room-hours booked
          </p>
          <Heatmap
            rowLabels={heatmap.slots}
            colLabels={heatmap.weekdayLabels}
            values={heatmap.cells}
            format="pct"
            ariaLabel="When space is booked"
            valueName="of room-hours booked"
            legendText={`0–${fmt.pct(heatmap.maxPct)} of room-hours booked`}
            cellLabel={(row, col, value) =>
              value == null
                ? `${heatmap.weekdayLabels[col]}, ${heatmap.slots[row]}: no data`
                : `${heatmap.weekdayLabels[col]}, ${heatmap.slots[row]}: ${fmt.pct(value)} of room-hours booked, ${fmt.hours(heatmap.bookedHours[row][col])} in total`
            }
          />
        </>
      )}
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 3 · Most and least used rooms
// ---------------------------------------------------------------------------

// A card of its own rather than ChartCard: the list grows with "Show all" and the chips wrap,
// so the block needs its natural height, not the fixed plot box of a chart.
function RoomRanking({ first, data, period }) {
  const [view, setView] = useState('bars');
  const { printing } = usePrintMode();

  const roomRows = useMemo(() => (data ? roomRowsOf(data) : []), [data]);
  const hasBookings = Boolean(data) && (data.totals.bookings > 0 || Boolean(data.unlisted));
  const ready = !first && hasBookings;
  const tableView = ready && view === 'table';
  const showBars = ready && (!tableView || printing);
  const ToggleIcon = tableView ? BarChart3 : Table2;

  const usedRooms = ready ? data.perRoom.filter((room) => room.bookings > 0) : [];
  const idleRooms = ready ? data.perRoom.filter((room) => room.bookings === 0) : [];
  const shownIdle = idleRooms.slice(0, MAX_IDLE_CHIPS);
  const hiddenIdle = idleRooms.length - shownIdle.length;

  const unlisted = ready ? data.unlisted : null;
  const unlistedNames = unlisted ? unlisted.names.slice(0, MAX_UNLISTED_NAMES) : [];
  const moreUnlisted = unlisted ? unlisted.names.length - unlistedNames.length : 0;

  const toggle = ready ? (
    <button
      type="button"
      aria-pressed={tableView}
      aria-label="View as table"
      title={tableView ? 'View as bars' : 'View as table'}
      onClick={() => setView(tableView ? 'bars' : 'table')}
      className={`${tableView ? ROUND_ICON_ON : ROUND_ICON} ${RING}`}
    >
      <ToggleIcon className="w-4 h-4" aria-hidden="true" />
    </button>
  ) : null;

  return (
    <Card padding="lg" className="min-w-0">
      <CardHeader title="Most and least used rooms" icon={ListOrdered} hintKey="roomsRanking" right={toggle} />

      {first && <LoadingBox height={RANKING_MIN_HEIGHT} />}

      {!first && !hasBookings && (
        <EmptyState
          icon={DoorOpen}
          title={`No room bookings ${spanText(period)}`}
          action="widen"
          minHeight={RANKING_MIN_HEIGHT}
        />
      )}

      {showBars && (
        <>
          <BarList
            items={usedRooms.map((room) => ({
              key: room.id,
              label: room.name,
              value: room.bookedHours,
              sub: plural(room.bookings, 'booking', 'bookings'),
            }))}
            format="hours"
            unit="booked"
            maxRows={TOP_ROOMS}
            emptyText="No listed room has bookings in this period"
          />

          {idleRooms.length > 0 ? (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold text-[#414141]/75">
                Rooms with no bookings ({fmt.int(idleRooms.length)})
              </p>
              <ul className="flex flex-wrap gap-2">
                {shownIdle.map((room) => (
                  <li key={room.id} className={COUNT_BADGE}>
                    {room.name}
                  </li>
                ))}
                {hiddenIdle > 0 && (
                  <li className={COUNT_BADGE} aria-label={`and ${fmt.int(hiddenIdle)} more`}>
                    +{fmt.int(hiddenIdle)}
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <p className={`mt-5 ${QUIET_LINE}`}>Every room has at least one booking in this period.</p>
          )}

          {unlisted && (
            <p className={`mt-4 ${QUIET_LINE}`}>
              Unlisted rooms ({unlistedNames.join(', ')}
              {moreUnlisted > 0 ? ` and ${fmt.int(moreUnlisted)} more` : ''}): {fmt.hours(unlisted.bookedHours)} in{' '}
              {plural(unlisted.bookings, 'booking', 'bookings')}, left out of the %.
            </p>
          )}
        </>
      )}

      {/* Bars view keeps the twin in the DOM for a bare Cmd+P; the print report shows both as well. */}
      {ready && (
        <div className={tableView ? 'print:mt-4' : 'hidden print:block print:mt-4'}>
          <DataTable
            columns={ROOM_COLUMNS}
            rows={roomRows}
            maxHeight={printing ? null : 480}
            caption="Most and least used rooms"
          />
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 4 · Who books rooms
// ---------------------------------------------------------------------------

function WhoBooksRooms({ first, data }) {
  const rows = useMemo(() => (data ? kindRowsOf(data) : []), [data]);

  return (
    <Card padding="lg" className="min-w-0">
      <CardHeader title="Who books rooms" icon={Users} />
      {first || !data ? (
        <LoadingBox height={KIND_TABLE_HEIGHT} />
      ) : (
        <DataTable columns={KIND_COLUMNS} rows={rows} maxHeight={null} caption="Who books rooms" />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RoomsPage() {
  const { admin } = useAdmin();
  const { status, error, isStale, lastUpdated, refresh } = useAnalytics();
  const { period } = usePeriod();
  const planned = Boolean(period?.isFuture);
  const { data, isRefetching, compareLabel, delta } = useRooms(planned ? FULL_HORIZON : undefined);
  const live = useLive({ enabled: true });

  const failed = status === 'error';
  const first = !failed && (status === 'loading' || !data);
  const ready = !failed && !first;

  const exportTables = useMemo(
    () => [
      {
        label: 'When space is booked',
        filename: csvFilename(SECTION, 'rooms_weekday_slot', period),
        columns: CSV_SLOT_COLUMNS,
        getRows: () => (data ? slotRowsOf(data.heatmap) : []),
      },
      {
        label: 'Rooms',
        filename: csvFilename(SECTION, 'rooms', period),
        columns: CSV_ROOM_COLUMNS,
        getRows: () => (data ? roomRowsOf(data) : []),
      },
      {
        label: 'Who books rooms',
        filename: csvFilename(SECTION, 'room_hours_by_kind', period),
        columns: CSV_KIND_COLUMNS,
        getRows: () => (data ? kindRowsOf(data) : []),
      },
    ],
    [data, period],
  );

  const scopeLine = planned
    ? [admin?.university, fmt.range(period.from, period.to), 'planned bookings'].filter(Boolean).join(' · ')
    : undefined;
  const counted = data
    ? { clipped: data.availability.clipped, fromLabel: fmt.date(data.availability.countedFrom) }
    : undefined;

  return (
    <>
      <PrintHeader section={SECTION} />
      <PageHeader
        title="Rooms"
        question="How full the space is, and when."
        scopeLine={scopeLine}
        counted={counted}
        note={DEFINITIONS.roomsSource.short}
      />
      {planned && (
        <p className="hidden print:block mb-4 text-[9pt] font-semibold text-[#414141]/75">
          This period has not started yet: the numbers are planned bookings.
        </p>
      )}
      <FilterBar exportTables={exportTables} />

      {failed ? (
        <ErrorBanner error={error} onRetry={refresh} />
      ) : (
        <BusyRegion busy={isRefetching}>
          {isStale && error && (
            <div data-print="hide" className="mb-6">
              <ErrorBanner error={error} staleAt={lastUpdated} onRetry={refresh} />
            </div>
          )}

          <Rise ready={ready} index={0}>
            <FreeNowCard live={live} next30={data?.next30 ?? null} />
          </Rise>

          <Rise ready={ready} index={1} className="mt-6">
            <RoomKpis
              first={first}
              totals={data?.totals ?? null}
              delta={delta}
              compareLabel={compareLabel}
              period={period}
            />
          </Rise>

          <Rise ready={ready} index={2} className="mt-8">
            <BookedHeatmap first={first} data={data} period={period} />
          </Rise>

          <Rise ready={ready} index={3} className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 min-w-0">
              <RoomRanking first={first} data={data} period={period} />
            </div>
            <div className="lg:col-span-4 min-w-0">
              <WhoBooksRooms first={first} data={data} />
            </div>
          </Rise>
        </BusyRegion>
      )}

      <PrintAppendix section={SECTION} />
    </>
  );
}
