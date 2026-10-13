import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPLY_MAX_LENGTH,
  applyMessageToThreads,
  dayLabel,
  displayName,
  filterThreads,
  groupByDay,
  initialsOf,
  isClassPlanMessage,
  isStaffMessage,
  isWaiting,
  mergeMessages,
  messagePreview,
  messageTimeTitle,
  needsSpecialist,
  normalizeMessage,
  normalizeMessages,
  normalizeThread,
  normalizeThreads,
  prepareReply,
  roleLabel,
  searchKey,
  threadTimeLabel,
  timestampMs,
  vilniusClock,
  vilniusDayKey,
  waitingCount,
} from '../support/threads.js';
import { makeDemoSupport } from '../../dev/demoSupport.js';

// --- fixtures ---------------------------------------------------------------------------
const ADMIN = 'admin-1';
const OTHER_ADMIN = 'admin-2';

const threadRow = (clientId, lastSenderId, createdAt, extra = {}) => ({
  client_id: clientId,
  client_name: 'Vaida',
  client_surname: 'Petrauskienė',
  client_university: 'Vilnius University',
  client_role: 'teacher',
  last_message_id: `m-${clientId}-${createdAt}`,
  last_message_sender_id: lastSenderId,
  last_message_content: 'Laba diena',
  last_message_created_at: createdAt,
  ...extra,
});

// A support_messages_with_profiles row; `bare` drops the profile columns like a realtime row.
const messageRow = (id, clientId, senderId, createdAt, content = 'Sveiki', { bare = false } = {}) => {
  const row = { id, client_id: clientId, sender_id: senderId, content, created_at: createdAt };
  if (bare) return row;
  return { ...row, sender_name: senderId === clientId ? 'Vaida' : 'Rūta', sender_surname: 'X', sender_role: 'teacher' };
};

// --- time -------------------------------------------------------------------------------
test('timestampMs: PostgREST and realtime spellings of a timestamptz', () => {
  const expected = Date.UTC(2026, 9, 13, 8, 12, 0, 123);
  assert.equal(timestampMs('2026-10-13T08:12:00.123456+00:00'), expected, 'six fraction digits');
  assert.equal(timestampMs('2026-10-13T08:12:00.123456+00'), expected, 'realtime: offset without minutes');
  assert.equal(timestampMs('2026-10-13 08:12:00.123+00'), expected, 'space instead of T');
  assert.equal(timestampMs('2026-10-13T08:12:00.123Z'), expected);
  assert.equal(timestampMs('2026-10-13T11:12:00.123+03:00'), expected, 'east of UTC');
  assert.equal(timestampMs('2026-10-13T05:42:00.123-0230'), expected, 'west of UTC, no colon');
  assert.equal(timestampMs('2026-10-13T08:12'), Date.UTC(2026, 9, 13, 8, 12), 'no seconds, no zone = UTC');
  assert.equal(timestampMs(expected), expected, 'epoch ms pass through');
  assert.equal(timestampMs('yesterday'), null);
  assert.equal(timestampMs(null), null);
  assert.equal(timestampMs(Number.NaN), null);
});

test('vilniusDayKey / vilniusClock: the Vilnius calendar, not UTC and not the machine zone', () => {
  // Summer time (UTC+3): 21:30 UTC is already the next day in Vilnius.
  assert.equal(vilniusDayKey(Date.UTC(2026, 9, 13, 21, 30)), '2026-10-14');
  assert.equal(vilniusClock(Date.UTC(2026, 9, 13, 21, 30)), '00:30');
  // Winter time (UTC+2).
  assert.equal(vilniusDayKey(Date.UTC(2026, 11, 1, 21, 59)), '2026-12-01');
  assert.equal(vilniusClock(Date.UTC(2026, 11, 1, 21, 59)), '23:59');
  assert.equal(vilniusDayKey(Date.UTC(2026, 11, 1, 22, 0)), '2026-12-02');
  // The night the clocks go back (25 Oct 2026, 04:00 EEST → 03:00 EET).
  assert.equal(vilniusClock(Date.UTC(2026, 9, 25, 0, 59)), '03:59');
  assert.equal(vilniusClock(Date.UTC(2026, 9, 25, 1, 0)), '03:00');
  // Midnight is 00, never 24.
  assert.equal(vilniusClock(Date.UTC(2026, 9, 13, 21, 0)), '00:00');
});

test('dayLabel: Today, Yesterday, then the date; the year only when it differs', () => {
  const now = Date.UTC(2026, 9, 14, 5, 0); // Wed 14 Oct 2026, 08:00 in Vilnius
  assert.equal(dayLabel('2026-10-14', now), 'Today');
  assert.equal(dayLabel('2026-10-13', now), 'Yesterday');
  assert.equal(dayLabel('2026-10-12', now), 'Mon 12 Oct');
  assert.equal(dayLabel('2025-10-14', now), 'Tue 14 Oct 2025');
  // 22:30 UTC on 13 Oct is 01:30 on 14 Oct in Vilnius: that message is from today.
  assert.equal(dayLabel(vilniusDayKey(Date.UTC(2026, 9, 13, 22, 30)), now), 'Today');
  // Yesterday across a year boundary.
  assert.equal(dayLabel('2026-12-31', Date.UTC(2027, 0, 1, 10, 0)), 'Yesterday');
  assert.equal(messageTimeTitle(Date.UTC(2026, 9, 14, 11, 5)), 'Wed 14 Oct 2026, 14:05');
  assert.equal(messageTimeTitle(null), '');
});

test('threadTimeLabel: time today, Yesterday, then day and month', () => {
  const now = Date.UTC(2026, 9, 14, 12, 0);
  assert.equal(threadTimeLabel(Date.UTC(2026, 9, 14, 6, 5), now), '09:05');
  assert.equal(threadTimeLabel(Date.UTC(2026, 9, 13, 20, 0), now), 'Yesterday');
  assert.equal(threadTimeLabel(Date.UTC(2026, 9, 13, 21, 30), now), '00:30', 'after midnight in Vilnius = today');
  assert.equal(threadTimeLabel(Date.UTC(2026, 8, 2, 12, 0), now), '2 Sep');
  assert.equal(threadTimeLabel(Date.UTC(2025, 11, 30, 12, 0), now), '30 Dec 2025');
  assert.equal(threadTimeLabel(null, now), '');
});

// --- people -----------------------------------------------------------------------------
test('displayName, initials, role labels and the search key', () => {
  assert.equal(displayName('Vaida', 'Petrauskienė'), 'Vaida Petrauskienė');
  assert.equal(displayName(' Vaida ', ''), 'Vaida');
  assert.equal(displayName(null, 'Petrauskienė'), 'Petrauskienė');
  assert.equal(displayName(null, '  '), 'Unknown user');
  assert.equal(initialsOf('Vaida', 'Petrauskienė'), 'VP');
  assert.equal(initialsOf('ąžuolas', null), 'Ą');
  assert.equal(initialsOf(null, null), '?');
  assert.equal(roleLabel('teacher'), 'Teacher');
  assert.equal(roleLabel('guest'), 'Guest');
  assert.equal(roleLabel('admin'), 'Admin');
  assert.equal(roleLabel('janitor'), null);
  assert.equal(roleLabel(null), null);
  assert.equal(searchKey('  Žukauskas   Ąžuolė '), 'zukauskas azuole');
  assert.equal(searchKey('ČIURLIONYTĖ'), 'ciurlionyte');
});

// --- threads ----------------------------------------------------------------------------
test('normalizeThread: view columns → page shape', () => {
  const thread = normalizeThread(threadRow('c1', 'c1', '2026-10-13T08:12:00.000000+00:00'));
  assert.equal(thread.clientId, 'c1');
  assert.equal(thread.displayName, 'Vaida Petrauskienė');
  assert.equal(thread.searchKey, 'vaida petrauskiene');
  assert.equal(thread.university, 'Vilnius University');
  assert.equal(thread.role, 'teacher');
  assert.equal(thread.lastSenderId, 'c1');
  assert.equal(thread.lastContent, 'Laba diena');
  assert.equal(thread.lastMs, Date.UTC(2026, 9, 13, 8, 12));
  assert.equal(normalizeThread({ client_id: null }), null);
  assert.equal(normalizeThread(null), null);

  const unnamed = normalizeThread(threadRow('c2', 'c2', null, { client_name: null, client_surname: null, client_role: null }));
  assert.equal(unnamed.displayName, 'Unknown user');
  assert.equal(unnamed.lastMs, null);
});

test('normalizeThreads: one row per client, newest first, stable ties', () => {
  const threads = normalizeThreads([
    threadRow('c-old', 'c-old', '2026-10-01T08:00:00+00:00'),
    threadRow('c-b', ADMIN, '2026-10-12T08:00:00+00:00'),
    threadRow('c-a', ADMIN, '2026-10-12T08:00:00+00:00'),
    threadRow('c-new', 'c-new', '2026-10-13T08:00:00+00:00'),
    // A paged read met c-old twice: the newer copy wins.
    threadRow('c-old', ADMIN, '2026-10-02T08:00:00+00:00'),
    { client_id: null },
  ]);
  assert.deepEqual(threads.map((t) => t.clientId), ['c-new', 'c-a', 'c-b', 'c-old']);
  assert.equal(threads[3].lastSenderId, ADMIN);
  assert.deepEqual(normalizeThreads(null), []);
});

test('isWaiting: the last message came from the client (the mobile admin app rule)', () => {
  const threads = normalizeThreads([
    threadRow('c1', 'c1', '2026-10-13T08:00:00+00:00'),
    threadRow('c2', ADMIN, '2026-10-13T07:00:00+00:00'),
    threadRow('c3', OTHER_ADMIN, '2026-10-13T06:00:00+00:00'),
    threadRow('c4', 'c4', '2026-10-13T05:00:00+00:00'),
  ]);
  assert.deepEqual(threads.filter(isWaiting).map((t) => t.clientId), ['c1', 'c4']);
  assert.equal(waitingCount(threads), 2);
  assert.equal(waitingCount([]), 0);
  assert.equal(isWaiting(null), false);
});

test('filterThreads: accent-insensitive name search, every word, and the waiting filter', () => {
  const threads = normalizeThreads([
    threadRow('c1', 'c1', '2026-10-13T08:00:00+00:00'),
    threadRow('c2', ADMIN, '2026-10-13T07:00:00+00:00', { client_name: 'Lukas', client_surname: 'Žukauskas' }),
    threadRow('c3', 'c3', '2026-10-13T06:00:00+00:00', { client_name: 'Gabija', client_surname: 'Kazlauskaitė' }),
  ]);
  const ids = (list) => list.map((t) => t.clientId);
  assert.deepEqual(ids(filterThreads(threads, { query: 'petrauskiene' })), ['c1']);
  assert.deepEqual(ids(filterThreads(threads, { query: 'ZUKAUS' })), ['c2']);
  assert.deepEqual(ids(filterThreads(threads, { query: 'kazlauskaitė gab' })), ['c3'], 'words in any order');
  assert.deepEqual(ids(filterThreads(threads, { query: 'auskas' })), ['c2']);
  assert.deepEqual(ids(filterThreads(threads, { query: 'nobody' })), []);
  assert.deepEqual(ids(filterThreads(threads, { query: '   ' })), ['c1', 'c2', 'c3']);
  assert.deepEqual(ids(filterThreads(threads, { waitingOnly: true })), ['c1', 'c3']);
  assert.deepEqual(ids(filterThreads(threads, { query: 'kazl', waitingOnly: true })), ['c3']);
  assert.deepEqual(ids(filterThreads(threads, { query: 'lukas', waitingOnly: true })), []);
});

test('applyMessageToThreads: a new message moves its thread up; known, older and unknown change nothing', () => {
  const threads = normalizeThreads([
    threadRow('c1', 'c1', '2026-10-13T08:00:00+00:00'),
    threadRow('c2', 'c2', '2026-10-13T07:00:00+00:00'),
  ]);

  const reply = normalizeMessage(messageRow('r1', 'c2', ADMIN, '2026-10-13T09:00:00+00:00', 'Laba diena!', { bare: true }));
  const next = applyMessageToThreads(threads, reply);
  assert.deepEqual(next.map((t) => t.clientId), ['c2', 'c1']);
  assert.equal(next[0].lastMessageId, 'r1');
  assert.equal(next[0].lastContent, 'Laba diena!');
  assert.equal(isWaiting(next[0]), false, 'answered');
  assert.equal(waitingCount(next), 1);
  assert.equal(threads[1].lastSenderId, 'c2', 'the input is not changed');

  assert.equal(applyMessageToThreads(next, reply), next, 'same message again (realtime echo)');
  const older = normalizeMessage(messageRow('o1', 'c1', ADMIN, '2026-10-13T06:00:00+00:00'));
  assert.equal(applyMessageToThreads(next, older), next, 'older than the last one');
  const stranger = normalizeMessage(messageRow('s1', 'c9', 'c9', '2026-10-13T10:00:00+00:00'));
  assert.equal(applyMessageToThreads(next, stranger), next, 'unknown client: the caller reads the list again');
  assert.equal(applyMessageToThreads(next, null), next);
});

test('messagePreview: one line, cut without breaking an emoji', () => {
  assert.equal(messagePreview('📋 Class plan on 15.10.2026\nSimulators: SimMan\n\nNotes'), '📋 Class plan on 15.10.2026 Simulators: SimMan Notes');
  assert.equal(messagePreview('  a \t b  '), 'a b');
  assert.equal(messagePreview(null), '');
  const long = messagePreview(`${'x'.repeat(159)}😀😀😀`);
  assert.equal(Array.from(long).length, 160);
  assert.ok(long.endsWith('😀'), 'the last kept character is a whole emoji');
});

// --- messages ---------------------------------------------------------------------------
test('normalizeMessage: view row vs bare realtime row', () => {
  const full = normalizeMessage(messageRow('m1', 'c1', ADMIN, '2026-10-13T08:00:00.5+00:00', 'Ačiū'));
  assert.equal(full.id, 'm1');
  assert.equal(full.clientId, 'c1');
  assert.equal(full.senderId, ADMIN);
  assert.equal(full.content, 'Ačiū');
  assert.equal(full.createdMs, Date.UTC(2026, 9, 13, 8, 0, 0, 500));
  assert.equal(full.senderName, 'Rūta');
  assert.equal(full.hasProfile, true);

  const bare = normalizeMessage(messageRow('m1', 'c1', ADMIN, '2026-10-13T08:00:00.5+00', 'Ačiū', { bare: true }));
  assert.equal(bare.hasProfile, false);
  assert.equal(bare.senderName, null);
  assert.equal(bare.createdMs, full.createdMs);

  assert.equal(normalizeMessage({ id: 'x', client_id: 'c1' }), null, 'no sender');
  assert.equal(normalizeMessage(undefined), null);
  assert.equal(isStaffMessage(full, 'c1'), true, 'staff = anyone but the client');
  assert.equal(isStaffMessage(normalizeMessage(messageRow('m2', 'c1', 'c1', '2026-10-13T08:00:00Z')), 'c1'), false);
});

test('mergeMessages: once per id, oldest first; a bare row never replaces the view row', () => {
  const m1 = normalizeMessage(messageRow('m1', 'c1', 'c1', '2026-10-13T08:00:00Z'));
  const m2 = normalizeMessage(messageRow('m2', 'c1', ADMIN, '2026-10-13T09:00:00Z'));
  const tieB = normalizeMessage(messageRow('m4b', 'c1', 'c1', '2026-10-13T10:00:00Z'));
  const tieA = normalizeMessage(messageRow('m4a', 'c1', 'c1', '2026-10-13T10:00:00Z'));

  const list = mergeMessages([], [m2, m1, tieB, tieA]);
  assert.deepEqual(list.map((m) => m.id), ['m1', 'm2', 'm4a', 'm4b'], 'time, then id');

  // Your own reply: the insert answer, then its realtime echo.
  const echo = normalizeMessage(messageRow('m2', 'c1', ADMIN, '2026-10-13T09:00:00+00', 'Sveiki', { bare: true }));
  assert.equal(mergeMessages(list, [echo]), list, 'bare echo of a known message → same array');
  assert.equal(mergeMessages(list, [m1, m2]), list, 'nothing new → same array');
  assert.equal(mergeMessages(list, []), list);

  // Realtime first, the view row later: the view row (with the name) takes over.
  const bareNew = normalizeMessage(messageRow('m3', 'c1', OTHER_ADMIN, '2026-10-13T09:30:00Z', 'Labas', { bare: true }));
  const withBare = mergeMessages(list, [bareNew]);
  assert.equal(withBare.length, 5);
  assert.equal(withBare[2].senderName, null);
  const fullNew = normalizeMessage(messageRow('m3', 'c1', OTHER_ADMIN, '2026-10-13T09:30:00Z', 'Labas'));
  const withFull = mergeMessages(withBare, [fullNew]);
  assert.equal(withFull.length, 5);
  assert.equal(withFull[2].senderName, 'Rūta');

  assert.deepEqual(mergeMessages(null, [null, m1]).map((m) => m.id), ['m1']);
  assert.deepEqual(normalizeMessages([messageRow('m1', 'c1', 'c1', '2026-10-13T08:00:00Z'), { id: 'bad' }]).map((m) => m.id), ['m1']);
});

test('groupByDay: Vilnius days with their labels, oldest first', () => {
  const now = Date.UTC(2026, 9, 14, 9, 0); // 14 Oct, 12:00 in Vilnius
  const messages = normalizeMessages([
    messageRow('a', 'c1', 'c1', '2026-10-12T10:00:00Z'),
    messageRow('b', 'c1', ADMIN, '2026-10-13T20:59:00Z'), // 23:59 on 13 Oct in Vilnius
    messageRow('c', 'c1', 'c1', '2026-10-13T21:01:00Z'), // 00:01 on 14 Oct in Vilnius
    messageRow('d', 'c1', ADMIN, '2026-10-14T08:00:00Z'),
  ]);
  const groups = groupByDay(messages, now);
  assert.deepEqual(groups.map((g) => g.label), ['Mon 12 Oct', 'Yesterday', 'Today']);
  assert.deepEqual(groups.map((g) => g.messages.map((m) => m.id)), [['a'], ['b'], ['c', 'd']]);
  assert.deepEqual(groupByDay([], now), []);

  const undated = normalizeMessages([messageRow('x', 'c1', 'c1', 'not a date')]);
  assert.deepEqual(groupByDay(undated, now).map((g) => g.label), ['Date unknown']);
});

test('class plan notes: recognised by the line the teacher app writes', () => {
  // Built exactly like teacher_schedule_form_view.dart builds it.
  const plan = [
    '📋 Class plan on 15.10.2026, 10:00–12:00',
    'Simulators: SimMan 3G • Rooms: 203',
    '⚑ Simulation specialist needed',
    '',
    'Gaivinimo scenarijus.',
  ].join('\n');
  assert.equal(isClassPlanMessage(plan), true);
  assert.equal(needsSpecialist(plan), true);
  const withoutHelp = '📋 Class plan on 15.10.2026, 10:00–12:00\n\nTik pastaba.';
  assert.equal(isClassPlanMessage(withoutHelp), true);
  assert.equal(needsSpecialist(withoutHelp), false);
  assert.equal(isClassPlanMessage('Ar galiu atsiųsti class plan?'), false);
  assert.equal(needsSpecialist('⚑ Simulation specialist needed'), false, 'only inside a class plan note');
  assert.equal(isClassPlanMessage(null), false);
});

// --- reply ------------------------------------------------------------------------------
test('prepareReply: trimmed, never empty, at most REPLY_MAX_LENGTH characters', () => {
  assert.deepEqual(prepareReply('  Laba diena!\n'), { content: 'Laba diena!', error: null });
  assert.deepEqual(prepareReply('Pirma eilutė\n\nAntra'), { content: 'Pirma eilutė\n\nAntra', error: null }, 'inner new lines stay');
  assert.equal(prepareReply('   \n\t ').error, 'empty');
  assert.equal(prepareReply('').error, 'empty');
  assert.equal(prepareReply(null).error, 'empty');
  assert.equal(prepareReply(42).error, 'empty');
  assert.equal(REPLY_MAX_LENGTH, 2000);
  assert.equal(prepareReply('a'.repeat(REPLY_MAX_LENGTH)).error, null);
  assert.equal(prepareReply(` ${'a'.repeat(REPLY_MAX_LENGTH)} `).error, null, 'spaces around do not count');
  assert.equal(prepareReply('a'.repeat(REPLY_MAX_LENGTH + 1)).error, 'tooLong');
});

// --- dev demo ---------------------------------------------------------------------------
test('makeDemoSupport: deterministic rows with the view columns', () => {
  const now = Date.UTC(2026, 9, 14, 9, 0);
  const admin = { id: 'demo-admin', name: 'Demo', surname: 'Admin' };
  const rows = makeDemoSupport(now, admin);
  assert.deepEqual(makeDemoSupport(now, admin), rows, 'same input, same rows');
  const columns = ['id', 'client_id', 'sender_id', 'content', 'created_at', 'sender_name', 'sender_surname', 'sender_role'];
  rows.forEach((row) => assert.deepEqual(Object.keys(row).sort(), [...columns].sort()));
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length, 'unique ids');

  const messages = normalizeMessages(rows);
  assert.equal(messages.length, rows.length, 'every row normalizes');
  assert.ok(messages.every((m) => m.createdMs <= now), 'nothing in the future');
  assert.equal(messages.filter((m) => isClassPlanMessage(m.content)).length, 1);
  assert.ok(messages.some((m) => m.senderId === admin.id), 'some replies are "mine"');
  assert.ok(messages.some((m) => m.content.includes('ą') || m.content.includes('ė')), 'Lithuanian samples');
});
