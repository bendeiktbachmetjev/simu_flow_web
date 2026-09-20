import test from 'node:test';
import assert from 'node:assert/strict';
import * as csvModule from '../../export/csv.js';
import { resolvePeriod } from '../period.js';
import { localMs } from './fixtures.mjs';

const { toCsv, csvFilename, downloadCsv } = csvModule;

const COLUMNS = [
  { key: 'clinic', header: 'clinic', type: 'text' },
  { key: 'held', header: 'held', type: 'int' },
  { key: 'hours', header: 'class_hours', type: 'num' },
  { key: 'share', header: 'share_pct', type: 'pct' },
  { key: 'day', header: 'date', type: 'date' },
];

test('toCsv: ";" delimiter, decimal comma, CRLF, no BOM', () => {
  const csv = toCsv(
    [{ clinic: 'Pulmonologijos klinika', held: 9, hours: 12.5, share: 56.3, day: '2026-06-15' }],
    COLUMNS
  );
  assert.equal(csv, 'clinic;held;class_hours;share_pct;date\r\nPulmonologijos klinika;9;12,5;56,3;2026-06-15\r\n');
  assert.notEqual(csv.charCodeAt(0), 0xfeff, 'the BOM belongs to downloadCsv');
  assert.equal(csv.includes('12,5'), true);
  assert.equal(csv.replace(/\r\n/g, '').includes('\n'), false, 'every line break is CRLF');
});

test('toCsv: quoting and the formula guard', () => {
  const rows = [
    { clinic: 'Surgery; abdominal', held: 1 },
    { clinic: 'The "old" clinic', held: 2 },
    { clinic: 'two\nlines', held: 3 },
    { clinic: '=cmd|\' /C calc\'!A0', held: 4 },
    { clinic: '+370 600 00000', held: 5 },
    { clinic: '-1', held: 6 },
    { clinic: '@SUM(A1)', held: 7 },
    { clinic: '\tTabbed', held: 8 },
    { clinic: '=1;2', held: 9 },
  ];
  const lines = toCsv(rows, COLUMNS.slice(0, 2)).split('\r\n');
  assert.equal(lines[1], '"Surgery; abdominal";1');
  assert.equal(lines[2], '"The ""old"" clinic";2');
  assert.equal(lines[3], '"two\nlines";3', 'a line break inside a cell is quoted, the record stays whole');
  assert.equal(lines[4], '\'=cmd|\' /C calc\'!A0;4');
  assert.equal(lines[5], '\'+370 600 00000;5');
  assert.equal(lines[6], '\'-1;6');
  assert.equal(lines[7], '\'@SUM(A1);7');
  assert.equal(lines[8], '\'\tTabbed;8');
  assert.equal(lines[9], '"\'=1;2";9', 'guarded first, quoted second');
  assert.equal(lines.length, 11, 'header + 9 records + the empty tail after the last CRLF');
});

test('toCsv: numbers stay numbers, empty values stay empty', () => {
  const rows = [
    { clinic: 'A', held: -4, hours: -4.5, share: 0, day: localMs('2026-06-15 23:30') },
    { clinic: null, held: null, hours: undefined, share: NaN, day: null },
    { clinic: 'B', held: 12.6, hours: 1234.5, share: '—', day: '2026-06-15T21:30:00Z' },
    { clinic: 'C', held: 0, hours: 0.0000001, share: 100, day: new Date(2026, 0, 5) },
  ];
  const lines = toCsv(rows, COLUMNS).split('\r\n');
  assert.equal(lines[1], 'A;-4;-4,5;0;2026-06-15', 'a negative NUMBER needs no guard');
  assert.equal(lines[2], ';;;;');
  assert.equal(lines[3], 'B;13;1234,5;—;2026-06-16', 'timestamps become the local (Vilnius) day');
  assert.equal(lines[4], 'C;0;0,0000001;100;2026-01-05');
});

test('toCsv: other column types, options and empty input', () => {
  const columns = [
    { key: 'start', header: 'start', type: 'datetime' },
    { key: 'groups', header: 'groups', type: 'text' },
    { key: 'specialist', header: 'specialist_requested', type: 'text' },
  ];
  const csv = toCsv([{ start: localMs('2026-09-15 09:05'), groups: ['5', '6'], specialist: true }], columns);
  assert.equal(csv.split('\r\n')[1], '2026-09-15 09:05;5, 6;yes');
  assert.equal(toCsv([{ groups: -2.5 }], [columns[1]]), 'groups\r\n-2,5\r\n', 'a number in a text column is still a number');

  assert.equal(toCsv([], COLUMNS.slice(0, 2)), 'clinic;held\r\n');
  assert.equal(toCsv(null, COLUMNS.slice(0, 2)), 'clinic;held\r\n');
  assert.equal(
    toCsv([{ clinic: 'a,b', held: 1.5 }], [COLUMNS[0], { key: 'held', header: 'held', type: 'num' }], { delimiter: ',', decimal: '.', eol: '\n' }),
    'clinic,held\n"a,b",1.5\n'
  );
});

test('csvFilename: section, table and the INCLUSIVE last day', () => {
  const now = localMs('2026-09-20 13:30');
  assert.equal(
    csvFilename('students', 'students_by_year', resolvePeriod('thisYear', now)),
    'simuflow_students_students_by_year_2026-01-01_2026-12-31.csv'
  );
  assert.equal(
    csvFilename('Overview', 'summary', resolvePeriod('custom', now, { custom: { from: '2026-07-06', to: '2026-08-19' } })),
    'simuflow_overview_summary_2026-07-06_2026-08-19.csv'
  );
  assert.equal(
    csvFilename('rooms', 'rooms', { from: '2026-02-01', to: '2026-03-01' }),
    'simuflow_rooms_rooms_2026-02-01_2026-02-28.csv'
  );
});

test('csv.js is import-safe in Node: nothing touches the browser until downloadCsv runs', () => {
  assert.equal(typeof downloadCsv, 'function');
  assert.deepEqual(Object.keys(csvModule).sort(), ['csvFilename', 'downloadCsv', 'toCsv']);
});
