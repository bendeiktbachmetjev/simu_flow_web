import test from 'node:test';
import assert from 'node:assert/strict';
import {
  affiliationKey, countryKey, courseLabel, facultyKey, normalizeAffiliation, normalizeCountry, normalizeCourse,
  normalizeFaculty, normalizeGroup, spellingIndex,
} from '../normalize.js';

test('normalizeCourse: a plain year, in digits, words or Roman numerals', () => {
  assert.equal(normalizeCourse('1 semestre masters'), 'Other');
  assert.equal(normalizeCourse('3 kursas'), '3');
  assert.equal(normalizeCourse('III'), '3');

  const cases = {
    '1': '1', ' 6 ': '6', '2.': '2', '3rd': '3', '4th year': '4', '5 k.': '5', '2 kurso': '2', '1st course': '1',
    'Year 3': '3', 'iv': '4', 'VI kursas': '6', 'II k': '2',
    '7': 'Other', '0': 'Other', '12': 'Other', 'VII': 'Other', 'masters': 'Other', '': 'Other', '3 semestras': 'Other',
  };
  Object.entries(cases).forEach(([raw, expected]) => assert.equal(normalizeCourse(raw), expected, `"${raw}"`));
  assert.equal(normalizeCourse(3), '3', 'numbers are accepted');
  assert.equal(normalizeCourse(null), 'Other');
  assert.equal(normalizeCourse(undefined), 'Other');

  assert.equal(courseLabel('3'), 'Year 3');
  assert.equal(courseLabel('Other'), 'Other');
});

test('normalizeFaculty: spelling variants of Medicine are one faculty', () => {
  ['Medicinos', 'medicine', 'Medicina ', 'Medicine', 'MEDICINE', 'Medicinos fakultetas', 'Faculty of Medicine', 'MF', 'Medicine faculty']
    .forEach((raw) => assert.equal(normalizeFaculty(raw), 'Medicine', `"${raw}"`));
  assert.equal(normalizeFaculty(''), 'Not specified');
  assert.equal(normalizeFaculty('   '), 'Not specified');
  assert.equal(normalizeFaculty(null), 'Not specified');
  assert.equal(normalizeFaculty('Life  Sciences Centre'), 'Life Sciences Centre');
  assert.equal(normalizeFaculty('chemistry'), 'Chemistry');
  assert.equal(facultyKey('Gyvybės mokslų fakultetas'), 'gyvybes mokslu');
});

test('normalizeFaculty: other faculties take their most frequent spelling (tie → alphabetical)', () => {
  const values = ['Life Sciences Centre', 'life sciences centre', 'Life Sciences Centre', 'Chemistry', 'chemistry', 'medicina'];
  const spellings = spellingIndex(values, facultyKey);
  assert.equal(normalizeFaculty('LIFE SCIENCES CENTRE', spellings), 'Life Sciences Centre');
  assert.equal(normalizeFaculty('life sciences centre', spellings), 'Life Sciences Centre');
  assert.equal(normalizeFaculty('chemistry', spellings), 'Chemistry', 'one each: alphabetical order wins');
  assert.equal(normalizeFaculty('medicina', spellings), 'Medicine', 'aliases beat spellings');
  assert.equal(normalizeFaculty('Physics', spellings), 'Physics', 'a value outside the index keeps its own spelling');
});

test('normalizeGroup: a matching key, nothing more', () => {
  assert.equal(normalizeGroup(' MED-08 '), 'med-08');
  assert.equal(normalizeGroup('med  04'), 'med 04');
  assert.notEqual(normalizeGroup('MED-08'), normalizeGroup('MED-8'));
  assert.equal(normalizeGroup(5), '5');
  assert.equal(normalizeGroup(null), '');
});

test('normalizeCountry: "lithuania" groups with "Lithuania"', () => {
  assert.equal(normalizeCountry('lithuania'), 'Lithuania');
  assert.equal(normalizeCountry('lithuania'), normalizeCountry('Lithuania'));
  ['Lietuva', 'LT', ' lietuva ', 'LITHUANIA'].forEach((raw) => assert.equal(normalizeCountry(raw), 'Lithuania', `"${raw}"`));
  assert.equal(normalizeCountry('poland'), 'Poland');
  assert.equal(normalizeCountry('united states'), 'United States');
  assert.equal(normalizeCountry('Bosnia and Herzegovina'), 'Bosnia and Herzegovina');
  assert.equal(normalizeCountry(''), 'Not specified');
  assert.equal(normalizeCountry(null), 'Not specified');

  const spellings = spellingIndex(['Latvia', 'Latvia', 'LATVIA', 'latvia'], countryKey);
  assert.equal(normalizeCountry('LATVIA', spellings), 'Latvia');
  assert.equal(normalizeCountry('latvia', spellings), 'Latvia');
});

test('normalizeAffiliation: known institutions share one key, others their most frequent spelling', () => {
  const vu = normalizeAffiliation('Vilnius University');
  assert.equal(vu.label, 'Vilnius University');
  ['VU', 'vu', 'Vilniaus universitetas', 'University of Vilnius', 'The Vilnius University']
    .forEach((raw) => assert.deepEqual(normalizeAffiliation(raw), vu, `"${raw}"`));

  const mf = normalizeAffiliation('VU MF');
  assert.equal(mf.label, 'VU Faculty of Medicine');
  assert.deepEqual(normalizeAffiliation('Vilnius University, Faculty of Medicine'), mf);
  assert.deepEqual(normalizeAffiliation('Vilniaus universiteto Medicinos fakultetas'), mf);
  assert.notEqual(mf.key, vu.key);

  const santaros = normalizeAffiliation('VšĮ VUL Santaros klinikos');
  assert.equal(santaros.label, 'Santaros Klinikos');
  assert.deepEqual(normalizeAffiliation('Santaros'), santaros);
  assert.equal(normalizeAffiliation('lsmu').label, 'LSMU');
  assert.equal(normalizeAffiliation('Lietuvos sveikatos mokslų universitetas').label, 'LSMU');

  assert.deepEqual(normalizeAffiliation(''), { key: '', label: 'Not specified' });
  assert.deepEqual(normalizeAffiliation(null), { key: '', label: 'Not specified' });

  assert.equal(affiliationKey('UAB "Medicinos Technika"'), 'medicinos technika');
  const values = ['Kauno klinikos', 'kauno klinikos', 'Kauno klinikos', 'Kauno klinikos.'];
  const spellings = spellingIndex(values, affiliationKey);
  values.forEach((raw) => {
    assert.deepEqual(normalizeAffiliation(raw, spellings), { key: 'kauno klinikos', label: 'Kauno klinikos' });
  });
  assert.deepEqual(normalizeAffiliation('Riga Stradins', spellings), { key: 'riga stradins', label: 'Riga Stradins' });
});
