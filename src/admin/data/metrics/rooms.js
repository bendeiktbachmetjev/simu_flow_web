// Space: rooms have no NFC tags, so everything here comes from calendar bookings (classes
// + guest events), never from live use.
//   occupancy % = booked time inside Mon–Fri open hours (overlaps of one room merged)
//                 ÷ listed rooms × open hours
// horizon 'elapsed' (default) counts what has happened up to now; 'full' counts the whole
// period including planned bookings (used when the selected period lies in the future).
// Old room names that match no current room are "unlisted": shown apart, outside every %.
// A "booking" is one class or event in one room (a class in two rooms = two room bookings).
import { CLOSE_HOUR, HEAT_SLOT_MIN, OPEN_HOUR, WORKDAYS } from '../constants.js';
import { addDays, availability, dayKeyOf, eachDay, isoWeekdayOfDate } from '../period.js';
import { clipSegments, mergeSegments, slotLabels, slotMatrix, sumMinutes } from '../intervals.js';
import { roomKey } from '../clean/bookings.js';
import {
  WEEKDAY_SHORT,
  effectiveRange,
  elapsedSegments,
  hoursOf,
  pct,
  remainingSegments,
  wallMinuteOf,
} from './shared.js';

const NEXT_DAYS = 30;
const OPEN_MIN = OPEN_HOUR * 60;
const CLOSE_MIN = CLOSE_HOUR * 60;
const KIND_LABELS = { class: 'Teacher classes', event: 'Guest events' };

const bookingId = (seg) => `${seg.kind}:${seg.sourceId}`;
const isWorkday = (date) => WORKDAYS.includes(isoWeekdayOfDate(date));

const groupByResource = (segs) => {
  const groups = new Map();
  segs.forEach((seg) => {
    if (!groups.has(seg.resourceKey)) groups.set(seg.resourceKey, []);
    groups.get(seg.resourceKey).push(seg);
  });
  return groups;
};

// Most rooms booked at the same moment: { rooms, date, startMin } of the first time the
// maximum is reached. `perRoomSegs` are already merged per room, so one room counts once.
const findPeak = (perRoomSegs) => {
  const marksByDate = new Map();
  perRoomSegs.forEach((segs) => {
    segs.forEach((seg) => {
      if (!marksByDate.has(seg.date)) marksByDate.set(seg.date, []);
      marksByDate.get(seg.date).push([seg.startMin, 1], [seg.endMin, -1]);
    });
  });
  let peak = null;
  [...marksByDate.keys()].sort().forEach((date) => {
    let current = 0;
    // An end is handled before a start at the same minute: back-to-back is not "at once".
    marksByDate.get(date).sort((a, b) => a[0] - b[0] || a[1] - b[1]).forEach(([minute, change]) => {
      current += change;
      if (change > 0 && (!peak || current > peak.rooms)) peak = { rooms: current, date, startMin: minute };
    });
  });
  return peak;
};

export const computeRooms = (ds, ref, period, { horizon = 'elapsed' } = {}) => {
  const rooms = ref?.rooms || [];
  const elapsed = horizon !== 'full';
  const range = effectiveRange(period, ds, { horizon: elapsed ? 'elapsed' : 'full' });
  const open = availability({ from: range.from, toExcl: range.toExcl }, ds.nowMs, {
    openHour: OPEN_HOUR,
    closeHour: CLOSE_HOUR,
    horizon: elapsed ? 'elapsed' : 'full',
  });
  const insideOpenHours = (segs) =>
    clipSegments(segs, { openMin: open.openMin, closeMin: open.closeMin, perDay: open.perDay });
  const insideMinutes = (segs) => sumMinutes(mergeSegments(insideOpenHours(segs)));
  const availableMin = open.minutesPerResource;

  const roomSegs = (ds?.bookingSegs || []).filter((seg) => seg.resourceType === 'room');
  const inRange = roomSegs.filter((seg) => seg.date >= range.from && seg.date < range.toExcl);
  const counted = elapsed ? elapsedSegments(inRange, ds.nowMs) : inRange;
  const listedGroups = groupByResource(counted.filter((seg) => seg.listed));
  const unlistedGroups = groupByResource(counted.filter((seg) => !seg.listed));

  // --- per room ------------------------------------------------------------------------------
  const kindStats = { class: { minutes: 0, bookings: 0 }, event: { minutes: 0, bookings: 0 } };
  const mergedPerRoom = [];
  const heatSegs = [];
  let bookedMinTotal = 0;
  let outsideMinTotal = 0;
  let bookingsTotal = 0;
  let roomsUsed = 0;

  const perRoom = rooms
    .map((room, order) => {
      const segs = listedGroups.get(roomKey(room.name)) || [];
      const merged = mergeSegments(segs);
      const bookedMinutes = insideMinutes(segs);
      const sources = new Set(segs.map(bookingId));
      const kindMinutes = { class: 0, event: 0 };
      Object.keys(kindMinutes).forEach((kind) => {
        const ofKind = segs.filter((seg) => seg.kind === kind);
        kindMinutes[kind] = insideMinutes(ofKind);
        kindStats[kind].minutes += kindMinutes[kind];
        kindStats[kind].bookings += new Set(ofKind.map(bookingId)).size;
      });

      mergedPerRoom.push(merged);
      // The heatmap shows weekends when they are booked, so it clips to the hours only.
      heatSegs.push(...mergeSegments(clipSegments(segs, { openMin: OPEN_MIN, closeMin: CLOSE_MIN })));
      bookedMinTotal += bookedMinutes;
      outsideMinTotal += sumMinutes(merged) - bookedMinutes;
      bookingsTotal += sources.size;
      if (sources.size > 0) roomsUsed += 1;

      return {
        order,
        minutes: bookedMinutes,
        row: {
          id: room.id,
          name: room.name,
          bookedHours: hoursOf(bookedMinutes),
          occupancyPct: pct(bookedMinutes, availableMin),
          bookings: sources.size,
          daysUsed: new Set(segs.map((seg) => seg.date)).size,
          classHours: hoursOf(kindMinutes.class),
          eventHours: hoursOf(kindMinutes.event),
        },
      };
    })
    .sort((a, b) => b.minutes - a.minutes || a.order - b.order)
    .map((item) => item.row);

  // --- unlisted rooms ------------------------------------------------------------------------
  let unlisted = null;
  if (unlistedGroups.size > 0) {
    let minutes = 0;
    let bookings = 0;
    unlistedGroups.forEach((segs) => {
      minutes += insideMinutes(segs);
      bookings += new Set(segs.map(bookingId)).size;
    });
    unlisted = {
      names: [...unlistedGroups.keys()]
        .map((resourceKey) => resourceKey.slice(roomKey('').length))
        .sort((a, b) => a.localeCompare(b)),
      bookedHours: hoursOf(minutes),
      bookings,
    };
  }

  // --- weekday × two-hour slot ---------------------------------------------------------------
  const slots = slotLabels({ slotMin: HEAT_SLOT_MIN, openMin: OPEN_MIN, closeMin: CLOSE_MIN });
  const bookedMatrix = slotMatrix(heatSegs, { slotMin: HEAT_SLOT_MIN, openMin: OPEN_MIN, closeMin: CLOSE_MIN });
  // Room-minutes that could have been booked: every day of the range, and of today only the
  // part of each slot that has already passed.
  const openMatrix = Array.from({ length: 8 }, () => new Array(slots.length).fill(0));
  const today = dayKeyOf(ds.nowMs);
  const nowMin = wallMinuteOf(ds.nowMs);
  eachDay(range.from, range.toExcl).forEach((date) => {
    const row = openMatrix[isoWeekdayOfDate(date)];
    slots.forEach((label, slot) => {
      const slotStart = OPEN_MIN + slot * HEAT_SLOT_MIN;
      const slotEnd = Math.min(slotStart + HEAT_SLOT_MIN, CLOSE_MIN);
      let minutes = slotEnd - slotStart;
      if (elapsed && date === today) minutes = Math.max(0, Math.min(nowMin, slotEnd) - slotStart);
      row[slot] += minutes * rooms.length;
    });
  });

  const weekdays = [1, 2, 3, 4, 5, 6, 7].filter(
    (weekday) => weekday <= 5 || bookedMatrix[weekday].some((minutes) => minutes > 0)
  );
  let maxPct = 0;
  let topSlot = null;
  const cells = slots.map((label, slot) =>
    weekdays.map((weekday) => {
      const share = pct(bookedMatrix[weekday][slot], openMatrix[weekday][slot]);
      if (share !== null && share > maxPct) {
        maxPct = share;
        topSlot = { weekdayLabel: WEEKDAY_SHORT[weekday - 1], slot: label, pct: share };
      }
      return share;
    })
  );

  // --- next 30 days, whatever the period ----------------------------------------------------
  const horizonEnd = addDays(today, NEXT_DAYS);
  const ahead = remainingSegments(
    roomSegs.filter((seg) => seg.listed && seg.date >= today && seg.date < horizonEnd),
    ds.nowMs
  );
  let aheadMinutes = 0;
  let aheadBookings = 0;
  groupByResource(ahead).forEach((segs) => {
    aheadMinutes += sumMinutes(
      mergeSegments(clipSegments(segs, { openMin: OPEN_MIN, closeMin: CLOSE_MIN, dayFilter: isWorkday }))
    );
    aheadBookings += new Set(segs.map(bookingId)).size;
  });

  const availableTotalMin = availableMin * rooms.length;
  return {
    totals: {
      rooms: rooms.length,
      roomsUsed,
      bookings: bookingsTotal,
      bookedHours: hoursOf(bookedMinTotal),
      availableHours: hoursOf(availableTotalMin),
      occupancyPct: pct(bookedMinTotal, availableTotalMin),
      outsideHours: hoursOf(outsideMinTotal),
      unlistedBookedHours: unlisted ? unlisted.bookedHours : 0,
      peak: findPeak(mergedPerRoom),
    },
    perRoom,
    unlisted,
    heatmap: {
      weekdays,
      weekdayLabels: weekdays.map((weekday) => WEEKDAY_SHORT[weekday - 1]),
      slots,
      cells,
      bookedHours: slots.map((label, slot) => weekdays.map((weekday) => hoursOf(bookedMatrix[weekday][slot]))),
      maxPct,
      topSlot,
    },
    byKind: ['class', 'event'].map((kind) => ({
      kind,
      label: KIND_LABELS[kind],
      hours: hoursOf(kindStats[kind].minutes),
      bookings: kindStats[kind].bookings,
    })),
    next30: { bookings: aheadBookings, hours: hoursOf(aheadMinutes) },
    availability: {
      workingDays: open.workingDays,
      openHour: OPEN_HOUR,
      closeHour: CLOSE_HOUR,
      minutesPerRoom: availableMin,
      clipped: range.clipped,
      countedFrom: range.from,
      horizon: elapsed ? 'elapsed' : 'full',
    },
  };
};
