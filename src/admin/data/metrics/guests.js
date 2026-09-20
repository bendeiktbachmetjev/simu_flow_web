// Visitors from outside: anonymous registrations from the public sign-in form (country and
// institution only — no names, not linked to events or entrance taps, shared by every
// university using SimuFlow) and the guest events the center organised.
import { PRIVACY_MIN_PEOPLE } from '../constants.js';
import { NOT_SPECIFIED } from '../normalize.js';
import { eventTotals, eventsInPeriod, hoursOf, inPeriod, makeSeries, pct, shareText } from './shared.js';

// The center is in Lithuania; every other stated country counts as "from abroad".
const HOME_COUNTRY = 'Lithuania';

const isAbroad = (country) => country !== HOME_COUNTRY && country !== NOT_SPECIFIED;

export const computeGuests = (ds, ref, period, { topN = 10 } = {}) => {
  const regs = (ds?.guestRegs || []).filter((reg) => inPeriod(reg.ms, period));
  const events = eventsInPeriod(ds, period);

  const { rows: series, indexOf } = makeSeries(period, ['registrations', 'abroad']);
  const perCountry = new Map();
  const perAffiliation = new Map();
  let abroad = 0;

  regs.forEach((reg) => {
    const fromAbroad = isAbroad(reg.country);
    if (fromAbroad) abroad += 1;
    perCountry.set(reg.country, (perCountry.get(reg.country) || 0) + 1);
    if (!perAffiliation.has(reg.affiliationKey)) {
      perAffiliation.set(reg.affiliationKey, { affiliation: reg.affiliation, registrations: 0 });
    }
    perAffiliation.get(reg.affiliationKey).registrations += 1;

    const index = indexOf(reg.ms);
    if (index < 0) return;
    series[index].registrations += 1;
    if (fromAbroad) series[index].abroad += 1;
  });

  const byCount = (labelKey) => (a, b) =>
    b.registrations - a.registrations || a[labelKey].localeCompare(b[labelKey]);

  const byCountry = [...perCountry.entries()]
    .map(([country, registrations]) => ({ country, registrations, pct: pct(registrations, regs.length) }))
    .sort(byCount('country'));

  // Institutions are free text. One with fewer than 3 registrations could point at a person,
  // so it is only counted in "other institutions" — together with everything below the top N.
  const institutions = [...perAffiliation.values()].sort(byCount('affiliation'));
  const named = institutions.filter((row) => row.registrations >= PRIVACY_MIN_PEOPLE);
  const byAffiliation = named.slice(0, Math.max(0, topN));
  const shown = byAffiliation.reduce((total, row) => total + row.registrations, 0);

  // App guests = accounts created with the access code of one of these events.
  const eventIds = new Set(events.map((event) => event.id));
  const appGuestAccounts = (ref?.guestUsers || []).filter((guest) => eventIds.has(guest.codeId)).length;
  const appGuestVisits = (ds?.visits || []).filter(
    (visit) => visit.role === 'guest' && inPeriod(visit.entryMs, period)
  ).length;

  return {
    totals: {
      registrations: regs.length,
      countries: [...perCountry.keys()].filter((country) => country !== NOT_SPECIFIED).length,
      abroad,
      abroadPct: pct(abroad, regs.length),
      abroadText: shareText(abroad, regs.length),
      ...eventTotals(events),
      appGuestAccounts,
      appGuestVisits,
    },
    series,
    byCountry,
    byAffiliation,
    otherAffiliations: {
      count: institutions.length - byAffiliation.length,
      registrations: regs.length - shown,
    },
    // Newest first. The access code of an event is never loaded, so it cannot appear here.
    events: [...events]
      .sort((a, b) => b.startMs - a.startMs)
      .map((event) => ({
        id: event.id,
        title: event.title,
        startMs: event.startMs,
        endMs: event.endMs,
        hours: hoursOf(event.durationMin),
        simulatorsBooked: event.simNumbers.length,
        roomsBooked: event.roomNames.length,
        appGuests: event.appGuests,
        status: event.status,
      })),
  };
};
