// Support chat (the "Messages" section): pure helpers over the two chat views.
// Pure file: no React, no Supabase, no window — the Node tests import it as well.
//
// A conversation ("thread") is every message with the same client_id. The client wrote a
// message when sender_id = client_id; anyone else is staff. sender_role is not used for that:
// the profile lookup returns the first matching role, so an administrator who also teaches comes
// back as 'teacher'. The database has no read/unread data, so "waiting for a reply" means what
// it means in the mobile admin app: the last message of the thread came from the client.
// Times are UTC from the server and are always shown on the Vilnius clock, whatever the zone of
// the browser.
import { TIMEZONE } from '../constants.js';

export const REPLY_MAX_LENGTH = 2000;

// The teacher app writes a class plan note into the chat as an ordinary client message that
// starts with this line (teacher_schedule_form_view.dart). The prefix is the only marker.
export const CLASS_PLAN_PREFIX = '📋 Class plan on';
const SPECIALIST_LINE = '⚑ Simulation specialist needed';

const UNKNOWN_NAME = 'Unknown user';
const PREVIEW_MAX = 160; // characters; the list row cuts it to one line anyway

const ROLE_NAMES = {
  student: 'Student',
  teacher: 'Teacher',
  resident: 'Resident',
  guest: 'Guest',
  admin: 'Admin',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const cleanText = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

// PostgREST sends '2026-10-13T08:12:00.123456+00:00'; a realtime row can end in '+00'. Both are
// read by hand: engines disagree on six fraction digits, and V8 rejects an offset without minutes.
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

// ISO string (or epoch ms) → epoch ms, or null. A string without a zone is read as UTC, which is
// what the server means by it.
export const timestampMs = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const match = ISO_RE.exec(value.trim());
  if (!match) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const [, year, month, day, hour, minute, second = '0', fraction = '', zone] = match;
  let ms = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second, Number(`${fraction}000`.slice(0, 3)));
  if (zone && zone.toUpperCase() !== 'Z') {
    const digits = zone.slice(1).replace(':', '');
    const offsetMin = Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4) || 0);
    ms -= (zone[0] === '-' ? -1 : 1) * offsetMin * 60000;
  }
  return Number.isFinite(ms) ? ms : null;
};

const VILNIUS_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const vilniusParts = (ms) => {
  const parts = {};
  for (const part of VILNIUS_PARTS.formatToParts(new Date(ms))) parts[part.type] = part.value;
  return parts;
};

// Epoch ms → 'YYYY-MM-DD' of the Vilnius calendar day.
export const vilniusDayKey = (ms) => {
  const { year, month, day } = vilniusParts(ms);
  return `${year}-${month}-${day}`;
};

// Epoch ms → 'HH:mm' on the Vilnius clock.
export const vilniusClock = (ms) => {
  const { hour, minute } = vilniusParts(ms);
  return `${hour}:${minute}`;
};

const keyParts = (dayKey) => dayKey.split('-').map(Number);

const shiftDayKey = (dayKey, days) => {
  const [year, month, day] = keyParts(dayKey);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

// 'Wed 14 Oct' or 'Wed 14 Oct 2025' — the look of fmt.dayShort / fmt.dayLong.
const dayText = (dayKey, withYear) => {
  const [year, month, day] = keyParts(dayKey);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} ${day} ${MONTHS[month - 1]}${withYear ? ` ${year}` : ''}`;
};

const sameYear = (keyA, keyB) => keyA.slice(0, 4) === keyB.slice(0, 4);

// Separator between the days of a conversation: 'Today', 'Yesterday', 'Wed 14 Oct',
// 'Tue 14 Oct 2025' (another year).
export const dayLabel = (dayKey, nowMs) => {
  const today = vilniusDayKey(nowMs);
  if (dayKey === today) return 'Today';
  if (dayKey === shiftDayKey(today, -1)) return 'Yesterday';
  return dayText(dayKey, !sameYear(dayKey, today));
};

// Time beside a conversation in the list: '14:05' today, 'Yesterday', '12 Oct', '12 Oct 2025'.
export const threadTimeLabel = (ms, nowMs) => {
  if (!Number.isFinite(ms)) return '';
  const key = vilniusDayKey(ms);
  const today = vilniusDayKey(nowMs);
  if (key === today) return vilniusClock(ms);
  if (key === shiftDayKey(today, -1)) return 'Yesterday';
  const [year, month, day] = keyParts(key);
  return `${day} ${MONTHS[month - 1]}${sameYear(key, today) ? '' : ` ${year}`}`;
};

// Full date and time for a tooltip: 'Wed 14 Oct 2026, 14:05'.
export const messageTimeTitle = (ms) =>
  Number.isFinite(ms) ? `${dayText(vilniusDayKey(ms), true)}, ${vilniusClock(ms)}` : '';

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

// "Name Surname"; 'Unknown user' when the profile has neither.
export const displayName = (name, surname) =>
  [cleanText(name), cleanText(surname)].filter(Boolean).join(' ') || UNKNOWN_NAME;

// 'VP' for Vaida Petrauskienė; '?' without a name.
export const initialsOf = (name, surname) => {
  const letters = [cleanText(name), cleanText(surname)]
    .filter(Boolean)
    .map((part) => Array.from(part)[0].toUpperCase());
  return letters.length ? letters.join('') : '?';
};

// 'teacher' → 'Teacher'; an unknown or missing role → null (no badge).
export const roleLabel = (role) => ROLE_NAMES[role] ?? null;

// Case- and accent-insensitive key, so "petrauskiene" finds "Petrauskienė".
export const searchKey = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// ---------------------------------------------------------------------------
// Threads (support_chat_threads)
// ---------------------------------------------------------------------------

// One row of support_chat_threads → the shape the page uses, or null for a row without a client.
export const normalizeThread = (row) => {
  if (!row || !row.client_id) return null;
  const name = cleanText(row.client_name);
  const surname = cleanText(row.client_surname);
  return {
    clientId: row.client_id,
    name,
    surname,
    displayName: displayName(name, surname),
    searchKey: searchKey(`${name ?? ''} ${surname ?? ''}`),
    university: cleanText(row.client_university),
    role: cleanText(row.client_role),
    lastMessageId: row.last_message_id != null ? String(row.last_message_id) : null,
    lastSenderId: row.last_message_sender_id ?? null,
    lastContent: typeof row.last_message_content === 'string' ? row.last_message_content : '',
    lastMs: timestampMs(row.last_message_created_at),
  };
};

const newestFirst = (a, b) => {
  const ta = Number.isFinite(a.lastMs) ? a.lastMs : -Infinity;
  const tb = Number.isFinite(b.lastMs) ? b.lastMs : -Infinity;
  if (ta !== tb) return ta > tb ? -1 : 1;
  if (a.clientId === b.clientId) return 0;
  return a.clientId < b.clientId ? -1 : 1;
};

// Newest conversation first; equal times in client id order, so the list never reshuffles.
export const sortThreads = (threads) => [...threads].sort(newestFirst);

// View rows → threads, one per client (a paged read can meet a thread twice when it moves to the
// top between pages; the newer copy wins), newest first.
export const normalizeThreads = (rows) => {
  const byClient = new Map();
  for (const row of rows || []) {
    const thread = normalizeThread(row);
    if (!thread) continue;
    const known = byClient.get(thread.clientId);
    if (!known || newestFirst(thread, known) < 0) byClient.set(thread.clientId, thread);
  }
  return sortThreads([...byClient.values()]);
};

export const findThread = (threads, clientId) =>
  (clientId && (threads || []).find((thread) => thread.clientId === clientId)) || null;

// The last message came from the client: nobody has answered yet.
export const isWaiting = (thread) => Boolean(thread?.clientId) && thread.lastSenderId === thread.clientId;

export const waitingCount = (threads) => (threads || []).filter(isWaiting).length;

// `query` matches every word against the name; `waitingOnly` keeps the unanswered threads.
export const filterThreads = (threads, { query = '', waitingOnly = false } = {}) => {
  const words = searchKey(query).split(' ').filter(Boolean);
  return (threads || []).filter(
    (thread) =>
      (!waitingOnly || isWaiting(thread)) && words.every((word) => thread.searchKey.includes(word))
  );
};

// A new message becomes the last one of its thread, which moves to the top. An older or already
// known message changes nothing (the same array comes back, so React skips the render). A client
// who is not in the list yet is not added here: the name only comes with the threads view.
export const applyMessageToThreads = (threads, message) => {
  if (!message) return threads;
  const index = threads.findIndex((thread) => thread.clientId === message.clientId);
  if (index === -1) return threads;
  const thread = threads[index];
  if (thread.lastMessageId === message.id) return threads;
  if (Number.isFinite(thread.lastMs) && !(Number.isFinite(message.createdMs) && message.createdMs >= thread.lastMs)) {
    return threads;
  }
  const next = threads.slice();
  next[index] = {
    ...thread,
    lastMessageId: message.id,
    lastSenderId: message.senderId,
    lastContent: message.content,
    lastMs: message.createdMs,
  };
  return sortThreads(next);
};

// The last message on one line, for the list row.
export const messagePreview = (content) => {
  const text = String(content ?? '').replace(/\s+/g, ' ').trim();
  return text.length > PREVIEW_MAX ? Array.from(text).slice(0, PREVIEW_MAX).join('') : text;
};

// ---------------------------------------------------------------------------
// Messages (support_messages_with_profiles, or a bare support_messages row from realtime)
// ---------------------------------------------------------------------------

// `hasProfile` tells a view row (with the sender's name) from a bare table row.
export const normalizeMessage = (row) => {
  if (!row || row.id == null || !row.client_id || !row.sender_id) return null;
  return {
    id: String(row.id),
    clientId: row.client_id,
    senderId: row.sender_id,
    content: typeof row.content === 'string' ? row.content : '',
    createdMs: timestampMs(row.created_at),
    senderName: cleanText(row.sender_name),
    senderSurname: cleanText(row.sender_surname),
    senderRole: cleanText(row.sender_role),
    hasProfile: 'sender_name' in row || 'sender_surname' in row,
  };
};

const oldestFirst = (a, b) => {
  const ta = Number.isFinite(a.createdMs) ? a.createdMs : Infinity;
  const tb = Number.isFinite(b.createdMs) ? b.createdMs : Infinity;
  if (ta !== tb) return ta < tb ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
};

const sameMessage = (a, b) =>
  a.content === b.content &&
  a.createdMs === b.createdMs &&
  a.senderId === b.senderId &&
  a.senderName === b.senderName &&
  a.senderSurname === b.senderSurname &&
  a.hasProfile === b.hasProfile;

// Adds `incoming` to `current` once per id, oldest first. Your own reply comes back twice (the
// insert answer and the realtime event); the view row of a message is never replaced by its bare
// realtime row. Nothing new → the same `current` array.
export const mergeMessages = (current, incoming) => {
  const base = current || [];
  const byId = new Map(base.map((message) => [message.id, message]));
  let changed = false;
  for (const message of incoming || []) {
    if (!message) continue;
    const known = byId.get(message.id);
    if (known && ((known.hasProfile && !message.hasProfile) || sameMessage(known, message))) continue;
    byId.set(message.id, message);
    changed = true;
  }
  return changed ? [...byId.values()].sort(oldestFirst) : base;
};

// View rows → messages, oldest first, one per id.
export const normalizeMessages = (rows) => mergeMessages([], (rows || []).map(normalizeMessage));

// Staff = anyone but the client (other administrators included).
export const isStaffMessage = (message, clientId) => message.senderId !== clientId;

// Sorted messages → [{ key, label, messages }] per Vilnius day, oldest day first.
export const groupByDay = (messages, nowMs) => {
  const groups = [];
  for (const message of messages || []) {
    const key = Number.isFinite(message.createdMs) ? vilniusDayKey(message.createdMs) : 'unknown';
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, label: key === 'unknown' ? 'Date unknown' : dayLabel(key, nowMs), messages: [] };
      groups.push(group);
    }
    group.messages.push(message);
  }
  return groups;
};

export const isClassPlanMessage = (content) =>
  typeof content === 'string' && content.trimStart().startsWith(CLASS_PLAN_PREFIX);

// A class plan note whose teacher ticked "Simulation specialist needed".
export const needsSpecialist = (content) =>
  isClassPlanMessage(content) && content.split('\n').some((line) => line.trim() === SPECIALIST_LINE);

// ---------------------------------------------------------------------------
// Reply
// ---------------------------------------------------------------------------

// What the reply box may send: the trimmed text, never empty, at most REPLY_MAX_LENGTH
// characters. `error` is null, 'empty' or 'tooLong'.
export const prepareReply = (text) => {
  const content = typeof text === 'string' ? text.trim() : '';
  if (!content) return { content: '', error: 'empty' };
  if (content.length > REPLY_MAX_LENGTH) return { content, error: 'tooLong' };
  return { content, error: null };
};
