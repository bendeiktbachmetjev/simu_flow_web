// Chart constants and prop factories shared by every chart in the admin area.
// One hue (cherry) by default; the categorical set is only for identity and never follows rank.
import { fmt } from '../format.js';

const NICE_STEPS = [1, 2, 5, 10];

// Smallest 1/2/5×10^n that is ≥ rough, never below 1 so count axes keep integer ticks.
const niceStep = (rough) => {
  if (!(rough > 1)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const factor = NICE_STEPS.find((step) => step * magnitude >= rough - 1e-9) || 10;
  return factor * magnitude;
};

// Axis top: ≥ floor and a whole number of 1/2/5×10^n steps, at most four of them.
const niceMax = (max, floor = 4) => {
  const top = Math.max(Number.isFinite(max) ? max : 0, floor, 1);
  const step = niceStep(top / 4);
  return step * Math.ceil(top / step - 1e-9);
};

// The tick values that belong to a niceMax() top: 0, step, … , top.
const niceTicks = (top) => {
  const step = niceStep(top / 4);
  const ticks = [];
  for (let value = 0; value <= top + 1e-9; value += step) ticks.push(value);
  return ticks;
};

export const chart = {
  single: '#78003F',
  singleHover: '#4A0027',
  mute: '#BDBDBD',
  gridColor: '#DCDCDC',
  ink: '#414141',
  surface: '#FFFFFF',
  ramp: ['#E98FAE', '#E64164', '#B3205A', '#78003F', '#4A0027'],
  cat: { student: '#9E1455', resident: '#E8853A', teacher: '#2A82C4', guest: '#E64164', unknown: '#BDBDBD' },
  status: { held: '#78003F', noActivity: '#BDBDBD', upcoming: 'rgba(120,0,63,0.25)' },
  tick: { fill: '#414141', fillOpacity: 0.75, fontSize: 11, fontWeight: 600 },
  margin: { top: 16, right: 8, bottom: 0, left: 0 },
  grid: { vertical: false, stroke: '#DCDCDC', strokeOpacity: 0.7 },
  xAxis: {
    dataKey: 'label',
    axisLine: false,
    tickLine: false,
    tickMargin: 10,
    minTickGap: 16,
    interval: 'preserveStartEnd',
    height: 32,
  },
  yAxis: { axisLine: false, tickLine: false, width: 40, tickCount: 4, allowDecimals: false },
  tooltip: {
    cursor: { fill: '#DCDCDC', fillOpacity: 0.3, radius: 8 },
    isAnimationActive: false,
    offset: 12,
    allowEscapeViewBox: { x: false, y: true },
    wrapperStyle: { outline: 'none', zIndex: 40, pointerEvents: 'none' },
  },
  bar: { radius: [4, 4, 0, 0], maxBarSize: 24, activeBar: { fill: '#4A0027' } },
  label: { position: 'top', offset: 6, fill: '#414141', fontSize: 11, fontWeight: 700 },
  barCategoryGap: '28%',
  // recharts measures its parent; the start size keeps a chart quiet (no 0×0 warning)
  // when its page mounts while hidden or comes back from the calendar.
  container: (height = 320) => ({
    width: '100%',
    height: '100%',
    minWidth: 0,
    initialDimension: { width: 600, height },
  }),
  anim: (first, reduced, printing) => ({
    isAnimationActive: Boolean(first) && !reduced && !printing,
    animationDuration: 400,
    animationEasing: 'ease-out',
  }),
  niceMax,
  niceTicks,
  // recharts would pick steps such as 0 / 7 / 14 / 20 for a fixed domain, so ticks are explicit.
  yScale: (max, floor = 4) => {
    const top = niceMax(max, floor);
    return { domain: [0, top], ticks: niceTicks(top) };
  },
};

// Classes for the element that wraps a <ResponsiveContainer>.
// Screen: the svg is the keyboard entry of a recharts chart (arrow keys walk the columns), so it gets the focus ring.
// Print: recharts sizes the chart in pixels inside a zero-size shim <div>. On paper every layer is
// released to width 100% / height auto instead, so the svg scales by its viewBox to the page width.
export const CHART_FRAME_CLASS =
  '[&_.recharts-surface]:outline-none [&_.recharts-surface]:rounded-[8px] [&_.recharts-surface:focus-visible]:shadow-[0_0_0_2px_rgba(120,0,63,0.4)] print:[&_.recharts-responsive-container>div]:w-full! print:[&_.recharts-responsive-container>div]:h-auto! print:[&_.recharts-wrapper]:w-full! print:[&_.recharts-wrapper]:h-auto! print:[&_.recharts-surface]:w-full! print:[&_.recharts-surface]:h-auto!';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY = /^\d{4}-\d{2}$/;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Day and week buckets share the 'YYYY-MM-DD' key; week buckets are keyed by Mondays seven days apart.
const looksWeekly = (rows) => {
  if (rows.length < 2 || !DAY_KEY.test(rows[0].key) || !DAY_KEY.test(rows[1].key)) return false;
  const gap = Date.parse(`${rows[1].key}T00:00:00Z`) - Date.parse(`${rows[0].key}T00:00:00Z`);
  return gap === WEEK_MS;
};

// Full tooltip title of a time bucket. The axis label ("Jun", "15 Jun") is too short once a
// period covers two years, so the title spells out month and year.
export const bucketTitles = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  const weekly = looksWeekly(list);
  return list.map((row) => {
    if (row.longLabel) return row.longLabel;
    if (typeof row.key === 'string' && MONTH_KEY.test(row.key)) return fmt.month(row.key);
    if (typeof row.key === 'string' && DAY_KEY.test(row.key)) {
      return weekly ? `Week of ${fmt.date(row.key)}` : fmt.dayLong(row.key);
    }
    return row.label;
  });
};

export default chart;
