import React, { useContext, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chart, bucketTitles, CHART_FRAME_CLASS } from './theme.js';
import ChartTooltip from './ChartTooltip.jsx';
import { fmt } from '../format.js';
import { usePrintMode } from '../context/usePrintMode.js';
import useReducedMotion from '../ui/useReducedMotion.js';
import { ChartFrameContext } from '../ui/ChartCard.jsx';

// The fixed height is for the screen; on paper the frame follows the scaled svg.
const FRAME_CLASS = `w-full min-w-0 print:h-auto! ${CHART_FRAME_CLASS}`;

// With many narrow columns two neighbouring value labels would run into each other.
const DENSE_COLUMNS = 16;

// Single-series columns over time (one hue).
//   rows        [{ key, label, value, isPartial, isFuture, longLabel? }]
//   unit        word shown after the value in the tooltip ("visits")
//   valueFormat fmt key or function, used by the tooltip and the two value labels
//   footer      (row) => string | string[] for the tooltip
//   height      px; inside a ChartCard it follows the card's plot box
//   ariaLabel   defaults to the ChartCard title
// A partial bucket is drawn lighter, a future bucket stays an empty slot.
export default function TimeColumns({ rows = [], unit, valueFormat = 'int', footer, height, ariaLabel }) {
  const frame = useContext(ChartFrameContext);
  const { printing } = usePrintMode();
  const reduced = useReducedMotion();
  const [first, setFirst] = useState(true);

  const boxHeight = height ?? frame?.height ?? 320;

  const data = useMemo(() => {
    const titles = bucketTitles(rows);
    return rows.map((row, index) => ({
      index,
      bucket: row.key ?? String(index),
      label: row.label,
      value: row.isFuture || !Number.isFinite(row.value) ? null : row.value,
      isPartial: Boolean(row.isPartial) && !row.isFuture,
      tipTitle: titles[index],
      row,
    }));
  }, [rows]);

  const scale = useMemo(() => chart.yScale(Math.max(0, ...data.map((d) => d.value ?? 0))), [data]);

  // Direct labels stay sparing: the tallest column and the latest one that has a value.
  const labelled = useMemo(() => {
    let tallest = -1;
    let latest = -1;
    data.forEach((d, index) => {
      if (!(d.value > 0)) return;
      if (tallest === -1 || d.value > data[tallest].value) tallest = index;
      latest = index;
    });
    const picked = new Set();
    if (tallest >= 0) picked.add(tallest);
    const collides = data.length > DENSE_COLUMNS && Math.abs(latest - tallest) === 1;
    if (latest >= 0 && !collides) picked.add(latest);
    return picked;
  }, [data]);

  // recharts leaves out zero-height bars, so the label list is matched by the datum, not by position.
  const labelOf = (entry) => {
    const datum = entry?.payload;
    return datum && labelled.has(datum.index) ? fmt.value(datum.value, valueFormat) : undefined;
  };

  return (
    <div className={FRAME_CLASS} style={{ height: boxHeight }}>
      <ResponsiveContainer {...chart.container(boxHeight)}>
        <BarChart
          data={data}
          margin={chart.margin}
          barCategoryGap={chart.barCategoryGap}
          aria-label={ariaLabel ?? frame?.title}
        >
          <CartesianGrid {...chart.grid} />
          <XAxis {...chart.xAxis} tick={chart.tick} />
          <YAxis
            {...chart.yAxis}
            tick={chart.tick}
            tickFormatter={fmt.compact}
            domain={scale.domain}
            ticks={scale.ticks}
          />
          <Tooltip
            {...chart.tooltip}
            content={<ChartTooltip unit={unit} valueFormat={valueFormat} footer={footer} />}
          />
          <Bar
            dataKey="value"
            name={unit}
            fill={chart.single}
            {...chart.bar}
            {...chart.anim(first, reduced, printing)}
            onAnimationEnd={() => setFirst(false)}
          >
            {data.map((d) => (
              <Cell key={d.bucket} fill={chart.single} fillOpacity={d.isPartial ? 0.45 : 1} />
            ))}
            <LabelList {...chart.label} valueAccessor={labelOf} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
