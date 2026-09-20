// UI kit barrel. Pages import from '../ui' only.

// Layout and page chrome
export { default as Card } from './Card.jsx';
export { default as CardHeader } from './CardHeader.jsx';
export { default as SectionTitle } from './SectionTitle.jsx';
export { default as PageHeader } from './PageHeader.jsx';
export { default as FilterBar } from './FilterBar.jsx';
export { default as PeriodPicker } from './PeriodPicker.jsx';
export { default as Segmented } from './Segmented.jsx';
export { default as MenuPanel } from './MenuPanel.jsx';
export { default as ExportMenu } from './ExportMenu.jsx';
export { default as InfoHint } from './InfoHint.jsx';

// Numbers and marks
export { default as KpiTile } from './KpiTile.jsx';
export { default as Delta } from './Delta.jsx';
export { default as Sparkline } from './Sparkline.jsx';
export { default as Meter } from './Meter.jsx';
export { default as BarList } from './BarList.jsx';
export { default as ShareBar } from './ShareBar.jsx';
export { default as Heatmap } from './Heatmap.jsx';
export { default as DataTable } from './DataTable.jsx';
export { default as Legend } from './Legend.jsx';
export { default as ChartCard } from './ChartCard.jsx';

// States
export { default as EmptyState } from './EmptyState.jsx';
export { default as ErrorBanner } from './ErrorBanner.jsx';
export { default as BusyRegion } from './BusyRegion.jsx';
export { default as Splash } from './Splash.jsx';

// Live and narrative blocks
export { default as LiveDot } from './LiveDot.jsx';
export { default as RightNowStrip } from './RightNowStrip.jsx';
export { default as InsightRow } from './InsightRow.jsx';
export { default as DataNotes } from './DataNotes.jsx';

// Print
export { default as PrintHeader } from './PrintHeader.jsx';
export { default as PrintAppendix } from './PrintAppendix.jsx';
export { PrintHintsContext, createHintRegistry, usePrintHint, usePrintNotes } from './PrintAppendix.jsx';

// Hooks
export { default as useCountUp } from './useCountUp.js';
export { default as useReducedMotion } from './useReducedMotion.js';
