// Free-text clean-up for fields people type themselves in the app and the guest form.
// Each value gets a KEY (used for grouping) and a LABEL (shown). The label is a known
// alias, or else the spelling most people used — pass a `spellings` index built with
// spellingIndex() over all values to get that; without it the value's own spelling is kept.

export const NOT_SPECIFIED = 'Not specified';
export const COURSE_ORDER = ['1', '2', '3', '4', '5', '6'];
export const COURSE_OTHER = 'Other';

const COMBINING_MARKS = /[̀-ͯ]/g;
const stripDiacritics = (s) => s.normalize('NFD').replace(COMBINING_MARKS, '');
const collapse = (s) => s.replace(/\s+/g, ' ').trim();
const display = (raw) => (raw === null || raw === undefined ? '' : collapse(String(raw)));
const baseKey = (raw) => stripDiacritics(display(raw)).toLowerCase();

const hasUpperCase = (s) => s !== s.toLowerCase();
const capitaliseFirst = (s) => (hasUpperCase(s) || !s ? s : s[0].toUpperCase() + s.slice(1));
const capitaliseWords = (s) =>
  (hasUpperCase(s) ? s : s.replace(/(^|[\s-])(\p{L})/gu, (m, lead, letter) => lead + letter.toUpperCase()));

// Map key → most frequent spelling (ties: alphabetical, which also puts "Medicine" before
// "medicine"). Empty values are ignored.
export const spellingIndex = (rawValues, keyOf) => {
  const counts = new Map();
  (rawValues || []).forEach((raw) => {
    const key = keyOf(raw);
    const spelling = display(raw);
    if (!key || !spelling) return;
    if (!counts.has(key)) counts.set(key, new Map());
    const bySpelling = counts.get(key);
    bySpelling.set(spelling, (bySpelling.get(spelling) || 0) + 1);
  });
  const index = new Map();
  counts.forEach((bySpelling, key) => {
    let best = null;
    let bestCount = 0;
    bySpelling.forEach((count, spelling) => {
      if (count > bestCount || (count === bestCount && spelling < best)) {
        best = spelling;
        bestCount = count;
      }
    });
    index.set(key, best);
  });
  return index;
};

// ---------------------------------------------------------------------------
// Year of study
// ---------------------------------------------------------------------------

const COURSE_RE = /^\s*([1-6])\s*(?:\.|st|nd|rd|th)?\s*(?:kursas|kurso|k\.?|course|year|yr)?\s*$/i;
const COURSE_PREFIXED_RE = /^\s*(?:kursas|course|year|yr)\s*([1-6])\s*$/i;
const COURSE_ROMAN_RE = /^\s*(iii|ii|iv|vi|i|v)\s*\.?\s*(?:kursas|kurso|k\.?|course|year|yr)?\s*$/i;
const ROMAN = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6' };

// '1'..'6' | 'Other'. Only a plain year counts: "1 semestre masters" is Other.
export const normalizeCourse = (raw) => {
  const text = display(raw);
  if (!text) return COURSE_OTHER;
  const digit = COURSE_RE.exec(text) || COURSE_PREFIXED_RE.exec(text);
  if (digit) return digit[1];
  const roman = COURSE_ROMAN_RE.exec(text);
  return roman ? ROMAN[roman[1].toLowerCase()] : COURSE_OTHER;
};

export const courseLabel = (course) => (COURSE_ORDER.includes(course) ? `Year ${course}` : COURSE_OTHER);

// ---------------------------------------------------------------------------
// Faculty
// ---------------------------------------------------------------------------

const FACULTY_ALIASES = {
  medicine: 'Medicine',
  medicina: 'Medicine',
  medicinos: 'Medicine',
  mf: 'Medicine',
};

export const facultyKey = (raw) =>
  collapse(
    baseKey(raw)
      .replace(/[^\p{L}\p{N}&]+/gu, ' ')
      .replace(/\b(?:fakultetas|faculty of|faculty)\b/g, ' ')
  );

export const normalizeFaculty = (raw, spellings = null) => {
  const key = facultyKey(raw);
  if (!key) return NOT_SPECIFIED;
  if (FACULTY_ALIASES[key]) return FACULTY_ALIASES[key];
  return spellings?.get(key) || capitaliseFirst(display(raw));
};

// ---------------------------------------------------------------------------
// Group — a matching key only ("MED-08" and "MED-8" stay different groups)
// ---------------------------------------------------------------------------

export const normalizeGroup = (raw) => display(raw).toLowerCase();

// ---------------------------------------------------------------------------
// Country (guest form)
// ---------------------------------------------------------------------------

const COUNTRY_ALIASES = {
  lithuania: 'Lithuania',
  lietuva: 'Lithuania',
  lt: 'Lithuania',
};

export const countryKey = (raw) => baseKey(raw);

export const normalizeCountry = (raw, spellings = null) => {
  const key = countryKey(raw);
  if (!key) return NOT_SPECIFIED;
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  return spellings?.get(key) || capitaliseWords(display(raw));
};

// ---------------------------------------------------------------------------
// Affiliation / institution (guest form)
// ---------------------------------------------------------------------------

const VU = 'Vilnius University';
const VU_MF = 'VU Faculty of Medicine';
const SANTAROS = 'Santaros Klinikos';
const LSMU = 'LSMU';

// Keys are written the way affiliationKey() produces them (no diacritics, no "of"/"the").
const AFFILIATION_ALIASES = {
  vu: VU,
  'vilnius university': VU,
  'university vilnius': VU,
  'vilniaus universitetas': VU,
  'vu mf': VU_MF,
  'vu medicinos fakultetas': VU_MF,
  'vu faculty medicine': VU_MF,
  'vu medical faculty': VU_MF,
  'vilnius university faculty medicine': VU_MF,
  'vilnius university medical faculty': VU_MF,
  'faculty medicine vilnius university': VU_MF,
  'vilniaus universiteto medicinos fakultetas': VU_MF,
  'vilniaus universitetas medicinos fakultetas': VU_MF,
  santaros: SANTAROS,
  santara: SANTAROS,
  'santaros klinikos': SANTAROS,
  'santaros clinics': SANTAROS,
  vulsk: SANTAROS,
  'vul sk': SANTAROS,
  'vul santaros klinikos': SANTAROS,
  'vilniaus universiteto ligonine santaros klinikos': SANTAROS,
  'vilnius university hospital santaros klinikos': SANTAROS,
  'vilnius university hospital santaros clinics': SANTAROS,
  lsmu: LSMU,
  'lietuvos sveikatos mokslu universitetas': LSMU,
  'lithuanian university health sciences': LSMU,
};

const AFFILIATION_NOISE = new Set(['uab', 'vsi', 'the', 'of']);

export const affiliationKey = (raw) =>
  baseKey(raw)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((word) => word && !AFFILIATION_NOISE.has(word))
    .join(' ');

// → { key, label }. Known institutions share one key, however they were typed.
export const normalizeAffiliation = (raw, spellings = null) => {
  const key = affiliationKey(raw);
  if (!key) return { key: '', label: NOT_SPECIFIED };
  const alias = AFFILIATION_ALIASES[key];
  if (alias) return { key: `alias:${alias}`, label: alias };
  return { key, label: spellings?.get(key) || display(raw) };
};
