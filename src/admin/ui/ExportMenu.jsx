import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Download, FileSpreadsheet, Printer } from 'lucide-react';
import { useAnalytics } from '../context/AnalyticsContext.jsx';
import { usePrintMode } from '../context/usePrintMode.js';
import { downloadCsv, toCsv } from '../export/csv.js';
import MenuPanel from './MenuPanel.jsx';

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';
const FLASH_MS = 1200;

const TRIGGER_CLASS = `inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-[#DCDCDC] bg-[#FFFFFF] text-[#414141]/80 hover:bg-[#DCDCDC]/20 transition-colors ${RING}`;
const ITEM_CLASS = `w-full flex items-center gap-2 px-3 py-2 rounded-[10px] text-left text-[13px] font-semibold text-[#414141] hover:bg-[#DCDCDC]/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent ${RING}`;
const ITEM_ICON_CLASS = 'w-4 h-4 shrink-0 text-[#414141]/60';

const withCsvExtension = (name) => (/\.csv$/i.test(name) ? name : `${name}.csv`);

/**
 * One export menu per page. Each table is `{ label, filename, columns, getRows }`:
 * `getRows()` runs at click time, so the file always holds the period that is on screen;
 * `filename` is the finished name from csvFilename() (a function is called at click time too).
 */
export default function ExportMenu({ tables = [] }) {
  const { status } = useAnalytics();
  const { printReport } = usePrintMode();
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(null); // { index, ok } for FLASH_MS after a click
  const triggerRef = useRef(null);
  const flashTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const showFlash = (index, ok) => {
    window.clearTimeout(flashTimer.current);
    setFlash({ index, ok });
    flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS);
  };

  const exportTable = (table, index) => {
    try {
      const rows = table.getRows() || [];
      const filename = typeof table.filename === 'function' ? table.filename() : table.filename;
      downloadCsv(withCsvExtension(String(filename)), toCsv(rows, table.columns));
      showFlash(index, true);
    } catch {
      showFlash(index, false);
    }
  };

  const handlePrint = () => {
    setOpen(false);
    printReport();
  };

  const ready = status === 'ready';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={TRIGGER_CLASS}
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        Export
        <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      <MenuPanel open={open} anchorRef={triggerRef} onClose={() => setOpen(false)} width="w-64" ariaLabel="Export">
        {tables.length > 0 && (
          <>
            <div className="px-3 pt-2 pb-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#414141]/75">
              CSV from this page
            </div>
            {tables.map((table, index) => {
              const flashed = flash?.index === index ? flash : null;
              return (
                <button
                  key={table.label}
                  type="button"
                  disabled={!ready}
                  onClick={() => exportTable(table, index)}
                  className={ITEM_CLASS}
                >
                  {!flashed && <FileSpreadsheet className={ITEM_ICON_CLASS} aria-hidden="true" />}
                  {flashed?.ok === true && <Check className="w-4 h-4 shrink-0 text-[#78003F]" aria-hidden="true" />}
                  {flashed?.ok === false && (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-[#E64164]" aria-hidden="true" />
                  )}
                  <span className="min-w-0 truncate">{flashed?.ok === false ? 'Could not export' : table.label}</span>
                </button>
              );
            })}
          </>
        )}
        <button
          type="button"
          onClick={handlePrint}
          className={tables.length > 0 ? `mt-1.5 ${ITEM_CLASS}` : ITEM_CLASS}
        >
          <Printer className={ITEM_ICON_CLASS} aria-hidden="true" />
          Print / Save as PDF
        </button>
        <p className="px-3 py-2 text-[11px] font-medium text-[#414141]/75">
          {"For a clean PDF, untick 'Headers and footers' in the print dialog."}
        </p>
        <span role="status" className="sr-only">
          {flash && (flash.ok ? 'File downloaded' : 'Export failed')}
        </span>
      </MenuPanel>
    </>
  );
}
