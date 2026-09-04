import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { CalendarDays, Loader2, RefreshCw, X } from 'lucide-react';
import moment from 'moment';

// Must match the mobile app's generator so codes look identical everywhere.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const randomBlock = () => {
  let out = '';
  for (let i = 0; i < 4; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
};

export const generateEventCode = () => `GUEST-${randomBlock()}-${randomBlock()}`;

const DEFAULT_START_TIME = '09:00';
const DEFAULT_DURATION_HOURS = 2;
const NO_UNIVERSITY_MESSAGE =
  'Your admin profile has no university, so events cannot be created';

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-[16px] border border-transparent bg-[#DCDCDC]/40 text-[#414141] font-medium placeholder:text-[#414141]/40 focus:outline-none focus:ring-2 focus:ring-[#78003F] focus:bg-[#DCDCDC]/30 transition-all';
// Native date/time inputs need their intrinsic width inside a 2-column grid at 375px.
const DATE_INPUT_CLASS = `${INPUT_CLASS.replace('px-4', 'px-3')} min-w-0`;
const LABEL_CLASS = 'block text-sm font-bold text-[#414141] mb-1.5';

const addHours = (dateStr, timeStr, hours) => {
  const m = moment(`${dateStr} ${timeStr}`, 'YYYY-MM-DD HH:mm');
  if (!dateStr || !timeStr || !m.isValid()) return { date: dateStr, time: timeStr };
  const shifted = m.add(hours, 'hours');
  return { date: shifted.format('YYYY-MM-DD'), time: shifted.format('HH:mm') };
};

const buildInitialForm = (defaultDate) => {
  const startDate = defaultDate || moment().format('YYYY-MM-DD');
  const end = addHours(startDate, DEFAULT_START_TIME, DEFAULT_DURATION_HOURS);
  return {
    name: '',
    code: generateEventCode(),
    startDate,
    startTime: DEFAULT_START_TIME,
    endDate: end.date,
    endTime: end.time,
    endEdited: false,
    selected: [],
  };
};

export default function CreateEventModal({
  open,
  onClose,
  onCreated,
  university,
  userId,
  simulators,
  defaultDate,
}) {
  const [form, setForm] = useState(() => buildInitialForm(defaultDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const defaultDateRef = useRef(defaultDate);
  defaultDateRef.current = defaultDate;
  // True only while a press that began on the backdrop itself is in flight, so a
  // text drag that starts inside the card and ends on the backdrop cannot close it.
  const backdropPressRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setForm(buildInitialForm(defaultDateRef.current));
    setError(null);
    setSaving(false);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  const sims = Array.isArray(simulators) ? simulators : [];
  const selectedCount = form.selected.length;

  const updateStart = (patch) =>
    setForm((f) => {
      const next = { ...f, ...patch };
      if (!f.endEdited) {
        const end = addHours(next.startDate, next.startTime, DEFAULT_DURATION_HOURS);
        next.endDate = end.date;
        next.endTime = end.time;
      }
      return next;
    });

  const updateEnd = (patch) => setForm((f) => ({ ...f, ...patch, endEdited: true }));

  const toggleSim = (number) =>
    setForm((f) => ({
      ...f,
      selected: f.selected.includes(number)
        ? f.selected.filter((n) => n !== number)
        : [...f.selected, number],
    }));

  const requestClose = () => {
    if (!saving) onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError(null);

    const name = form.name.trim();
    const code = form.code.trim().toUpperCase();
    const fail = (message) => setError(message);

    if (!name) return fail('Please enter an event name.');
    if (!code) return fail('Please enter an access code.');
    if (!form.startDate || !form.startTime || !form.endDate || !form.endTime) {
      return fail('Please select event start and end.');
    }
    const start = moment(`${form.startDate} ${form.startTime}`, 'YYYY-MM-DD HH:mm');
    const end = moment(`${form.endDate} ${form.endTime}`, 'YYYY-MM-DD HH:mm');
    if (!start.isValid() || !end.isValid()) return fail('Please select event start and end.');
    if (!end.isAfter(start)) return fail('End must be after start.');
    if (!university) return fail(`${NO_UNIVERSITY_MESSAGE}.`);

    const allowedSimulators = [...form.selected].sort(
      (a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0)
    );
    const startsAt = start.toISOString();
    const endsAt = end.toISOString();

    setSaving(true);
    try {
      const { error: insertError } = await supabase
        .from('event_codes')
        .insert([
          {
            code,
            event_name: name,
            university,
            allowed_simulators: allowedSimulators,
            created_by: userId,
            starts_at: startsAt,
            ends_at: endsAt,
          },
        ])
        .select('id')
        .single();
      if (insertError) throw insertError;

      onCreated?.({ code, starts_at: startsAt });
      onClose();
    } catch (err) {
      console.error(err);
      setError(
        err?.code === '23505'
          ? 'This code already exists — regenerate it.'
          : err?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#414141]/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-event-title"
      onMouseDown={(e) => {
        backdropPressRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        const pressedBackdrop = backdropPressRef.current;
        backdropPressRef.current = false;
        // Close only when both the press and the release landed on the backdrop itself.
        if (pressedBackdrop && e.target === e.currentTarget) requestClose();
      }}
    >
      <div className="bg-[#FFFFFF] rounded-[24px] shadow-[0_8px_20px_rgba(65,65,65,0.08)] border border-[#DCDCDC]/60 p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h3
              id="create-event-title"
              className="text-lg font-extrabold text-[#414141] flex items-center gap-2"
            >
              <CalendarDays className="w-5 h-5 text-[#78003F]" />
              Create event
            </h3>
            <p className="text-xs font-semibold text-[#414141]/60 mt-1">
              Guests join with the code; the event occupies the selected simulators on the calendar.
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full border border-[#DCDCDC] text-[#414141]/70 hover:bg-[#DCDCDC]/20 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-[#E64164]/10 text-[#E64164] text-sm font-semibold p-4 rounded-[16px] mb-6 border border-[#E64164]/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="create-event-name" className={LABEL_CLASS}>
              Event name
            </label>
            <input
              id="create-event-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Cardiology Workshop 2026"
              autoFocus
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="create-event-code" className={LABEL_CLASS}>
              Access code
            </label>
            {/* Stacks on narrow screens so the code is never clipped next to the button. */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                id="create-event-code"
                type="text"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                }
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="GUEST-XXXX-XXXX"
                className={`${INPUT_CLASS} font-mono text-sm uppercase min-w-0 sm:flex-1`}
              />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, code: generateEventCode() }))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-[#DCDCDC] bg-[#FFFFFF] text-[#414141]/80 hover:bg-[#DCDCDC]/20 transition-colors shrink-0 self-start sm:self-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate
              </button>
            </div>
          </div>

          <div>
            <span className={LABEL_CLASS}>Start</span>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => updateStart({ startDate: e.target.value })}
                aria-label="Start date"
                className={DATE_INPUT_CLASS}
              />
              <input
                type="time"
                step="300"
                value={form.startTime}
                onChange={(e) => updateStart({ startTime: e.target.value })}
                aria-label="Start time"
                className={DATE_INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <span className={LABEL_CLASS}>End</span>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(e) => updateEnd({ endDate: e.target.value })}
                aria-label="End date"
                className={DATE_INPUT_CLASS}
              />
              <input
                type="time"
                step="300"
                value={form.endTime}
                onChange={(e) => updateEnd({ endTime: e.target.value })}
                aria-label="End time"
                className={DATE_INPUT_CLASS}
              />
            </div>
            <p className="text-[11px] font-medium text-[#414141]/50 mt-1.5">
              Times are in your local time zone.
            </p>
          </div>

          <div>
            <span className={LABEL_CLASS}>Simulators</span>
            {sims.length === 0 ? (
              <p className="text-xs font-medium text-[#414141]/50">
                No simulators found for your center.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sims.map((sim) => {
                  const number = String(sim.number);
                  const active = form.selected.includes(number);
                  return (
                    <button
                      key={number}
                      type="button"
                      onClick={() => toggleSim(number)}
                      aria-pressed={active}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        active
                          ? 'bg-gradient-to-br from-[#78003F] to-[#E64164] text-white border-transparent'
                          : 'bg-[#FFFFFF] text-[#414141]/80 border-[#DCDCDC] hover:bg-[#DCDCDC]/20'
                      }`}
                    >
                      № {number} · {sim.name}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] font-medium text-[#414141]/50 mt-2">
              {selectedCount > 0
                ? `${selectedCount} selected`
                : 'No simulators selected — guests will have no simulator access, and the event will not occupy any row on the calendar.'}
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={requestClose}
              disabled={saving}
              className="flex-1 bg-[#FFFFFF] border border-[#DCDCDC] hover:bg-[#DCDCDC]/20 text-[#414141] font-bold py-3.5 rounded-full transition-all shadow-sm flex items-center justify-center disabled:opacity-70"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-gradient-to-br from-[#78003F] to-[#E64164] text-white font-bold py-3.5 rounded-full transition-all shadow-[0_8px_20px_rgba(65,65,65,0.08)] flex items-center justify-center gap-2 disabled:opacity-70 active:scale-[0.98]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create event'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
