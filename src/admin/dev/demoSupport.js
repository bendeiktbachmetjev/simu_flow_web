// Generated support chat for the dev-only demo mode (see ./demo.js). The chat panel loads
// this file with a dynamic import behind `import.meta.env.DEV`, so it never reaches a production
// bundle, and in demo nothing is read from or written to Supabase.
//
// makeDemoSupport(nowMs, adminId) is pure and deterministic: the same people and messages, timed
// relative to `nowMs`, with the column names of support_messages_with_profiles.
// demoSupportSource() wraps those rows in the same interface as liveSupport (loadSupport.js) and
// keeps them in memory, so a reply typed in demo stays in its conversation. To exercise the live
// path it also plays two realtime events: the client answers 6 s after each demo reply, and a new
// person writes for the first time 30 s after the demo starts. A reply that contains "#fail" is
// refused like a network failure, to show the error banner.
import { vilniusDayKey } from '../data/support/threads.js';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const LOAD_DELAY_MS = 250;
const CLIENT_ANSWER_MS = 6 * 1000;
const NEW_PERSON_MS = 30 * 1000;

const clientId = (n) => `demo-support-client-${n}`;
const OTHER_ADMIN_ID = 'demo-support-admin-2';

const PEOPLE = {
  [clientId(1)]: { name: 'Vaida', surname: 'Petrauskienė', role: 'teacher' },
  [clientId(2)]: { name: 'Lukas', surname: 'Žukauskas', role: 'student' },
  [clientId(3)]: { name: 'Gabija', surname: 'Kazlauskaitė', role: 'resident' },
  [clientId(4)]: { name: 'Emma', surname: 'Schulz', role: 'guest' },
  [clientId(5)]: { name: 'Tomas', surname: 'Vasiliauskas', role: 'teacher' },
  [clientId(6)]: { name: null, surname: null, role: null }, // profile gone: shown as "Unknown user"
  [clientId(7)]: { name: 'Ieva', surname: 'Stankevičiūtė', role: 'student' }, // writes 30 s in
  [OTHER_ADMIN_ID]: { name: 'Rūta', surname: 'Jankauskienė', role: 'admin' },
};

const UNIVERSITY = 'Vilnius University';

// 'DD.MM.YYYY' of the Vilnius day `days` after `nowMs` — the date format of the app's class plan line.
const planDate = (nowMs, days) => vilniusDayKey(nowMs + days * DAY).split('-').reverse().join('.');

// [client number, sender ('client' | 'me' | 'other'), age in ms, content]
const script = (nowMs) => [
  [1, 'client', 9 * DAY + 5 * HOUR, 'Laba diena, ar galėčiau kitą savaitę gauti abu kabinetus vienam užsiėmimui?'],
  [1, 'other', 9 * DAY + 4 * HOUR + 30 * MIN, 'Laba diena! Taip, trečiadienį abu kabinetai laisvi nuo 12 val.'],
  [1, 'client', 9 * DAY + 4 * HOUR + 20 * MIN, 'Puiku. O ar bus kas nors, kas padės paruošti simuliatorių?'],
  [1, 'other', 9 * DAY + 4 * HOUR, 'Taip, pažymėkite tai savo plane ir simuliacijų specialistas ateis 15 min. anksčiau.'],
  [1, 'client', 9 * DAY + 3 * HOUR + 50 * MIN, 'Ačiū!'],
  [1, 'client', 1 * DAY + 3 * HOUR, 'Laba diena, ar penktadienį nuo 10 val. bus laisvas SimMan simuliatorius?'],
  [1, 'me', 1 * DAY + 2 * HOUR + 40 * MIN, 'Laba diena! Taip, penktadienį nuo 10 iki 13 val. jis laisvas. Galite jį pažymėti savo plane.'],
  [1, 'client', 1 * DAY + 2 * HOUR + 30 * MIN, 'Puiku, ačiū!'],
  [
    1,
    'client',
    35 * MIN,
    [
      `📋 Class plan on ${planDate(nowMs, 2)}, 10:00–12:00`,
      'Simulators: SimMan 3G • Rooms: 203',
      '⚑ Simulation specialist needed',
      '',
      'Trečio kurso studentams – gaivinimo scenarijus. Prašau paruošti defibriliatorių ir vaistų rinkinį.',
    ].join('\n'),
  ],
  [2, 'client', 2 * HOUR + 10 * MIN, 'Sveiki, programėlė neatpažįsta mano NFC žymos prie įėjimo. Ką daryti?'],
  [2, 'client', 2 * HOUR + 8 * MIN, 'Bandžiau kelis kartus, telefonas naujas.'],
  [3, 'client', 3 * DAY + 5 * HOUR, 'Ar centras dirba šeštadieniais?'],
  [3, 'me', 3 * DAY + 4 * HOUR, 'Laba diena, šeštadieniais centras nedirba. Darbo dienomis laukiame nuo 8 iki 20 val.'],
  [
    4,
    'client',
    6 * DAY + 2 * HOUR,
    'Hello! I registered for the workshop through https://www.simuflow.net/guest/register — is that enough, or do I need to bring anything?',
  ],
  [4, 'other', 6 * DAY + HOUR + 45 * MIN, 'Hello! That is enough, thank you. Please bring an ID document.'],
  [
    5,
    'client',
    20 * DAY + 3 * HOUR,
    'Sveiki,\nnoriu pasitikslinti dėl kitos savaitės užsiėmimų:\n1) ar bus galima naudotis abiem kabinetais;\n2) ar reikia iš anksto užregistruoti studentų grupes?\nAčiū',
  ],
  [
    5,
    'me',
    20 * DAY + 2 * HOUR,
    'Laba diena,\n1) taip, abu kabinetai tą dieną laisvi;\n2) ne, studentai prisiregistruoja programėlėje patys.',
  ],
  [6, 'client', 45 * DAY + HOUR, 'Laba diena, kaip pakeisti programėlės kalbą?'],
  [6, 'other', 45 * DAY + 30 * MIN, 'Laba diena! Atidarykite nustatymus ir pasirinkite „Kalba“.'],
];

const profileOf = (senderId, admin) => {
  if (senderId === admin.id) return { name: admin.name, surname: admin.surname, role: 'admin' };
  return PEOPLE[senderId] ?? { name: null, surname: null, role: null };
};

// One support_messages_with_profiles row.
const viewRow = ({ id, client, sender, createdMs, content }, admin) => {
  const profile = profileOf(sender, admin);
  return {
    id,
    client_id: client,
    sender_id: sender,
    content,
    created_at: new Date(createdMs).toISOString(),
    sender_name: profile.name,
    sender_surname: profile.surname,
    sender_role: profile.role,
  };
};

/** → support_messages_with_profiles rows of every demo conversation, oldest first. */
export function makeDemoSupport(nowMs, admin) {
  const senderOf = { me: admin.id, other: OTHER_ADMIN_ID };
  return script(nowMs)
    .map(([n, who, ageMs, content], index) =>
      viewRow(
        {
          id: `demo-support-msg-${String(index + 1).padStart(3, '0')}`,
          client: clientId(n),
          sender: senderOf[who] ?? clientId(n),
          createdMs: nowMs - ageMs,
          content,
        },
        admin
      )
    )
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
}

// support_chat_threads over the in-memory rows: the newest message of each client, newest first.
const threadRows = (rows) => {
  const last = new Map();
  for (const row of rows) last.set(row.client_id, row); // rows are oldest first
  return [...last.values()]
    .sort((a, b) => (a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0))
    .map((row) => {
      const client = PEOPLE[row.client_id] ?? {};
      return {
        client_id: row.client_id,
        client_name: client.name ?? null,
        client_surname: client.surname ?? null,
        client_university: UNIVERSITY,
        client_role: client.role ?? null,
        last_message_id: row.id,
        last_message_sender_id: row.sender_id,
        last_message_content: row.content,
        last_message_created_at: row.created_at,
      };
    });
};

const later = (value) => new Promise((resolve) => setTimeout(() => resolve(value), LOAD_DELAY_MS));
const copy = (row) => ({ ...row });

// Bare support_messages row, the way realtime delivers it.
const bareRow = ({ id, client_id, sender_id, content, created_at }) => ({ id, client_id, sender_id, content, created_at });

let store = null; // { adminId, source } — one per demo administrator, shared by StrictMode remounts

function createStore(admin, nowMs) {
  const rows = makeDemoSupport(nowMs, admin);
  const listeners = new Set();
  let seq = 0;

  const add = ({ client, sender, content }) => {
    seq += 1;
    const row = viewRow({ id: `demo-support-new-${seq}`, client, sender, createdMs: Date.now(), content }, admin);
    rows.push(row);
    return row;
  };

  // A message "from someone else": stored, then delivered like a realtime INSERT.
  const arrive = (client, content) => {
    const row = add({ client, sender: client, content });
    listeners.forEach((listener) => listener.onInsert(bareRow(row)));
  };

  setTimeout(
    () => arrive(clientId(7), 'Laba diena, kur programėlėje rasti savo grupės užsiėmimų tvarkaraštį?'),
    NEW_PERSON_MS
  );

  const source = {
    loadThreads: () => later(threadRows(rows)),
    loadMessages: (client) => later(rows.filter((row) => row.client_id === client).map(copy)),
    loadMessage: (id) => {
      const row = rows.find((candidate) => candidate.id === id);
      return later(row ? copy(row) : null);
    },
    async sendReply({ clientId: client, adminId, content }) {
      await later(null);
      // The error a browser gives for a lost connection; useConversation words it like a real one.
      if (String(content).includes('#fail')) throw new TypeError('Failed to fetch');
      const row = add({ client, sender: adminId, content: String(content).trim() });
      listeners.forEach((listener) => listener.onInsert(bareRow(row))); // the realtime echo of your own insert
      setTimeout(() => arrive(client, 'Ačiū, supratau.'), CLIENT_ANSWER_MS);
      return copy(row);
    },
    subscribe(listener) {
      listeners.add(listener);
      setTimeout(() => {
        if (listeners.has(listener)) listener.onStatus('SUBSCRIBED');
      }, 0);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return { adminId: admin.id, source };
}

/** The demo data source for `admin`, created on first use and then kept for the visit. */
export function demoSupportSource(admin, nowMs) {
  if (!store || store.adminId !== admin.id) store = createStore(admin, nowMs);
  return store.source;
}
