import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { CalendarDays, Loader2, Pencil, RefreshCw, Trash2, X } from 'lucide-react';
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
const DELETE_BLOCKED_BY_GUESTS_MESSAGE =
  'Guests have already registered with this code, so the event cannot be deleted. Clear its dates instead — that takes it off the calendar while the code keeps working.';
const UPDATE_NOT_PERMITTED_MESSAGE =
  'Could not save — you may not have permission to edit this event.';

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-[16px] border border-transparent bg-[#DCDCDC]/40 text-[#414141] font-medium placeholder:text-[#414141]/40 focus:outline-none focus:ring-2 focus:ring-[#78003F] focus:bg-[#DCDCDC]/30 transition-all';
// Native date/time inputs need their intrinsic width inside a 2-column grid at 375px.
const DATE_INPUT_CLASS = `${INPUT_CLASS.replace('px-4', 'px-3')} min-w-0`;
const LABEL_CLASS = 'block text-sm font-bold text-[#414141] mb-1.5';
const CHIP_CLASS = 'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors';
const CHIP_ACTIVE_CLASS =
  'bg-gradient-to-br from-[#78003F] to-[#E64164] text-white border-transparent';
const CHIP_IDLE_CLASS =
  'bg-[#FFFFFF] text-[#414141]/80 border-[#DCDCDC] hover:bg-[#DCDCDC]/20';
// ~30 rooms plus the simulators would push the footer off-screen; each chip group scrolls on its own.
const CHIP_BOX_CLASS = 'flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1';
const HINT_CLASS = 'text-[11px] font-medium text-[#414141]/50 mt-1.5';

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
    selectedRooms: [],
  };
};

// Prefills from the raw event_codes row (real starts_at/ends_at, never a day-clipped copy),
// so saving a multi-day event never shortens it.
const buildEditForm = (ev) => {
  const start = ev.starts_at ? moment(ev.starts_at) : null;
  const end = ev.ends_at ? moment(ev.ends_at) : null;
  return {
    name: ev.event_name || '',
    code: ev.code || '',
    startDate: start ? start.format('YYYY-MM-DD') : '',
    startTime: start ? start.format('HH:mm') : '',
    endDate: end ? end.format('YYYY-MM-DD') : '',
    endTime: end ? end.format('HH:mm') : '',
    // Changing the start must not re-derive an end the admin chose earlier.
    endEdited: true,
    selected: (ev.allowed_simulators || []).map(String),
    selectedRooms: Array.isArray(ev.rooms) ? ev.rooms.filter(Boolean) : [],
  };
};

export default function EventModal({
  open,
  mode = 'create',
  event = null,
  onClose,
  onSaved,
  onDeleted,
  university,
  userId,
  simulators,
  rooms,
  defaultDate,
}) {
  const isEdit = mode === 'edit';

  const [form, setForm] = useState(() => buildInitialForm(defaultDate));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState(null);

  const defaultDateRef = useRef(defaultDate);
  defaultDateRef.current = defaultDate;
  // The reset effect runs on [open] only; refs carry the latest mode/event into it.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const eventRef = useRef(event);
  eventRef.current = event;
  // True only while a press that began on the backdrop itself is in flight, so a
  // text drag that starts inside the card and ends on the backdrop cannot close it.
  const backdropPressRef = useRef(false);

  const busy = saving || deleting;

  useEffect(() => {
    if (!open) return;
    setForm(
      modeRef.current === 'edit' && eventRef.current
        ? buildEditForm(eventRef.current)
        : buildInitialForm(defaultDateRef.current)
    );
    setError(null);
    setSaving(false);
    setDeleting(false);
    setConfirmDelete(false);
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
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  const sims = Array.isArray(simulators) ? simulators : [];
  const roomList = Array.isArray(rooms) ? rooms.filter(Boolean) : [];
  const selectedCount = form.selected.length;
  const selectedRoomCount = form.selectedRooms.length;

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

  const clearDates = () =>
    setForm((f) => ({
      ...f,
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      endEdited: true,
    }));

  const toggleSim = (number) =>
    setForm((f) => ({
      ...f,
      selected: f.selected.includes(number)
        ? f.selected.filter((n) => n !== number)
        : [...f.selected, number],
    }));

  const toggleRoom = (name) =>
    setForm((f) => ({
      ...f,
      selectedRooms: f.selectedRooms.includes(name)
        ? f.selectedRooms.filter((r) => r !== name)
        : [...f.selectedRooms, name],
    }));

  const requestClose = () => {
    if (!busy) onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const name = form.name.trim();
    const code = form.code.trim().toUpperCase();
    const fail = (message) => setError(message);

    if (!name) return fail('Please enter an event name.');
    if (!isEdit && !code) return fail('Please enter an access code.');

    // Dates: create needs both; edit accepts both or neither (neither = off the calendar).
    const hasStart = Boolean(form.startDate && form.startTime);
    const hasEnd = Boolean(form.endDate && form.endTime);
    const datesEmpty = !form.startDate && !form.startTime && !form.endDate && !form.endTime;
    let startsAt = null;
    let endsAt = null;
    if (isEdit && datesEmpty) {
      // Dates cleared on purpose: the event leaves the calendar, the code keeps working.
    } else {
      if (!hasStart || !hasEnd) {
        return fail(
          isEdit
            ? 'Please set both start and end, or clear both.'
            : 'Please select event start and end.'
        );
      }
      const start = moment(`${form.startDate} ${form.startTime}`, 'YYYY-MM-DD HH:mm');
      const end = moment(`${form.endDate} ${form.endTime}`, 'YYYY-MM-DD HH:mm');
      if (!start.isValid() || !end.isValid()) return fail('Please select event start and end.');
      if (!end.isAfter(start)) return fail('End must be after start.');
      // Local wall-clock → UTC instant; the timelines convert back to local when reading.
      startsAt = start.toISOString();
      endsAt = end.toISOString();
    }
    if (!isEdit && !university) return fail(`${NO_UNIVERSITY_MESSAGE}.`);
    if (isEdit && !event?.id) return fail('This event can no longer be found. Close and try again.');

    const allowedSimulators = [...form.selected].sort(
      (a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0)
    );
    // Alphabetical like the mobile app, so the saved list does not depend on click order.
    // Names no longer present in `rooms` stay in the payload (same rule as simulators).
    const sortedRooms = [...form.selectedRooms].sort((a, b) => a.localeCompare(b));

    setSaving(true);
    try {
      if (isEdit) {
        const { data, error: updateError } = await supabase
          .from('event_codes')
          .update({
            event_name: name,
            allowed_simulators: allowedSimulators,
            rooms: sortedRooms,
            starts_at: startsAt ?? null,
            ends_at: endsAt ?? null,
          })
          .eq('id', event.id)
          .select('id')
          .single();
        // No row back means RLS filtered the update away (PGRST116 from .single()).
        if (updateError?.code === 'PGRST116' || (!updateError && !data)) {
          return fail(UPDATE_NOT_PERMITTED_MESSAGE);
        }
        if (updateError) throw updateError;

        onSaved?.({
          id: event.id,
          code: event.code,
          starts_at: startsAt ?? null,
          ends_at: endsAt ?? null,
          mode: 'edit',
        });
        onClose();
      } else {
        const { data, error: insertError } = await supabase
          .from('event_codes')
          .insert([
            {
              code,
              event_name: name,
              university,
              allowed_simulators: allowedSimulators,
              rooms: sortedRooms,
              created_by: userId,
              starts_at: startsAt,
              ends_at: endsAt,
            },
          ])
          .select('id')
          .single();
        if (insertError) throw insertError;

        onSaved?.({
          id: data?.id ?? null,
          code,
          starts_at: startsAt,
          ends_at: endsAt,
          mode: 'create',
        });
        onClose();
      }
    } catch (err) {
      console.error(err);
      setError(
        !isEdit && err?.code === '23505'
          ? 'This code already exists — regenerate it.'
          : err?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  const handleDelete = async () => {
    if (busy || !isEdit || !event?.id) return;
    setError(null);
    setDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from('event_codes')
        .delete()
        .eq('id', event.id);
      if (deleteError) throw deleteError;

      onDeleted?.({ id: event.id });
      onClose();
    } catch (err) {
      console.error(err);
      // guest_users.code_id references event_codes(id) without cascade: 23503 = guests registered.
      if (err?.code === '23503') {
        setError(DELETE_BLOCKED_BY_GUESTS_MESSAGE);
        setConfirmDelete(false);
      } else {
        setError(err?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const renderChip = (key, label, active, onToggle) => (
    <button
      key={key}
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={active}
      className={`${CHIP_CLASS} ${active ? CHIP_ACTIVE_CLASS : CHIP_IDLE_CLASS}`}
    >
      {label}
    </button>
  );

  const selectionHint = (() => {
    if (selectedCount === 0 && selectedRoomCount === 0) {
      return 'No simulators or rooms selected — guests get no simulator access and the event will not occupy any row on the calendar.';
    }
    const simText = `${selectedCount} ${selectedCount === 1 ? 'simulator' : 'simulators'}`;
    const roomText = `${selectedRoomCount} ${selectedRoomCount === 1 ? 'room' : 'rooms'}`;
    return `${simText} · ${roomText} selected`;
  })();

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#414141]/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
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
              id="event-modal-title"
              className="text-lg font-extrabold text-[#414141] flex items-center gap-2"
            >
              {isEdit ? (
                <Pencil className="w-5 h-5 text-[#78003F]" />
              ) : (
                <CalendarDays className="w-5 h-5 text-[#78003F]" />
              )}
              {isEdit ? 'Edit event' : 'Create event'}
            </h3>
            <p className="text-xs font-semibold text-[#414141]/60 mt-1">
              {isEdit
                ? 'Change the name, dates, simulators and rooms. The access code stays the same.'
                : 'Guests join with the code; the event occupies the selected simulators and rooms on the calendar.'}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={busy}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full border border-[#DCDCDC] text-[#414141]/70 hover:bg-[#DCDCDC]/20 transition-colors disabled:opacity-70"
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
            <label htmlFor="event-modal-name" className={LABEL_CLASS}>
              Event name
            </label>
            <input
              id="event-modal-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Cardiology Workshop 2026"
              autoFocus
              disabled={busy}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="event-modal-code" className={LABEL_CLASS}>
              Access code
            </label>
            {isEdit ? (
              <>
                <input
                  id="event-modal-code"
                  type="text"
                  value={form.code}
                  readOnly
                  aria-readonly="true"
                  spellCheck={false}
                  className={`${INPUT_CLASS} font-mono text-sm uppercase min-w-0 sm:flex-1 bg-[#DCDCDC]/25 text-[#414141]/70 cursor-default focus:ring-0`}
                />
                <p className={HINT_CLASS}>The code cannot be changed after creation.</p>
              </>
            ) : (
              // Stacks on narrow screens so the code is never clipped next to the button.
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  id="event-modal-code"
                  type="text"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                  }
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="GUEST-XXXX-XXXX"
                  disabled={busy}
                  className={`${INPUT_CLASS} font-mono text-sm uppercase min-w-0 sm:flex-1`}
                />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, code: generateEventCode() }))}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-[#DCDCDC] bg-[#FFFFFF] text-[#414141]/80 hover:bg-[#DCDCDC]/20 transition-colors shrink-0 self-start sm:self-auto disabled:opacity-70"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate
                </button>
              </div>
            )}
          </div>

          <div>
            <span className={LABEL_CLASS}>Start</span>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => updateStart({ startDate: e.target.value })}
                aria-label="Start date"
                disabled={busy}
                className={DATE_INPUT_CLASS}
              />
              <input
                type="time"
                step="300"
                value={form.startTime}
                onChange={(e) => updateStart({ startTime: e.target.value })}
                aria-label="Start time"
                disabled={busy}
                className={DATE_INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center mb-1.5">
              <span className="text-sm font-bold text-[#414141]">End</span>
              {isEdit && (
                <button
                  type="button"
                  onClick={clearDates}
                  disabled={busy}
                  className="text-[11px] font-semibold text-[#78003F] hover:underline ml-auto disabled:opacity-70"
                >
                  Clear dates
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(e) => updateEnd({ endDate: e.target.value })}
                aria-label="End date"
                disabled={busy}
                className={DATE_INPUT_CLASS}
              />
              <input
                type="time"
                step="300"
                value={form.endTime}
                onChange={(e) => updateEnd({ endTime: e.target.value })}
                aria-label="End time"
                disabled={busy}
                className={DATE_INPUT_CLASS}
              />
            </div>
            <p className={HINT_CLASS}>Times are in your local time zone.</p>
            {isEdit && (
              <p className={HINT_CLASS}>
                Leave both empty to take the event off the calendar. Guests can still join with the code.
              </p>
            )}
          </div>

          <div>
            <span className={LABEL_CLASS}>Simulators</span>
            {sims.length === 0 ? (
              <p className="text-xs font-medium text-[#414141]/50">
                No simulators found for your center.
              </p>
            ) : (
              <div className={CHIP_BOX_CLASS}>
                {sims.map((sim) => {
                  const number = String(sim.number);
                  return renderChip(
                    number,
                    `№ ${number} · ${sim.name}`,
                    form.selected.includes(number),
                    () => toggleSim(number)
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <span className={LABEL_CLASS}>Rooms</span>
            {roomList.length === 0 ? (
              <p className="text-xs font-medium text-[#414141]/50">
                No rooms found for your center.
              </p>
            ) : (
              <div className={CHIP_BOX_CLASS}>
                {roomList.map((name) =>
                  renderChip(
                    name,
                    name,
                    form.selectedRooms.includes(name),
                    () => toggleRoom(name)
                  )
                )}
              </div>
            )}
            <p className="text-[11px] font-medium text-[#414141]/50 mt-2">{selectionHint}</p>
          </div>

          <div className="flex flex-col gap-3 pt-1">
            {isEdit && confirmDelete && (
              <div className="bg-[#E64164]/10 border border-[#E64164]/20 rounded-[16px] p-4 text-sm">
                <p className="font-semibold text-[#414141]">
                  Delete this event? Guests will no longer be able to join with this code.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={busy}
                    className="px-4 py-2 rounded-full text-xs font-semibold border border-[#DCDCDC] bg-[#FFFFFF] text-[#414141]/80 hover:bg-[#DCDCDC]/20 transition-colors disabled:opacity-70"
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#E64164] text-white hover:opacity-90 transition-opacity disabled:opacity-70"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Deleting…
                      </>
                    ) : (
                      'Yes, delete'
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              {isEdit && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy || confirmDelete}
                  className="inline-flex items-center gap-1.5 px-4 py-3.5 rounded-full text-sm font-bold border border-[#E64164]/40 text-[#E64164] hover:bg-[#E64164]/10 transition-colors disabled:opacity-70"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={requestClose}
                disabled={busy}
                className="flex-1 bg-[#FFFFFF] border border-[#DCDCDC] hover:bg-[#DCDCDC]/20 text-[#414141] font-bold py-3.5 rounded-full transition-all shadow-sm flex items-center justify-center disabled:opacity-70"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 bg-gradient-to-br from-[#78003F] to-[#E64164] text-white font-bold py-3.5 rounded-full transition-all shadow-[0_8px_20px_rgba(65,65,65,0.08)] flex items-center justify-center gap-2 disabled:opacity-70 active:scale-[0.98]"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isEdit ? 'Saving…' : 'Creating…'}
                  </>
                ) : isEdit ? (
                  'Save changes'
                ) : (
                  'Create event'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
