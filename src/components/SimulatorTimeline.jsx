import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { CalendarDays, ChevronLeft, ChevronRight, Headset } from 'lucide-react';
import moment from 'moment';

// Center working hours shown by default; the window expands if a reservation falls outside it.
const DEFAULT_OPEN_HOUR = 8;
const DEFAULT_CLOSE_HOUR = 20;

const LABEL_COL_WIDTH = 190;
const LANE_HEIGHT = 44;
const ROW_PADDING = 12;
const PILL_HEIGHT = 34;

// Per-teacher pill gradients, all within the brand family.
const PILL_GRADIENTS = [
  ['#78003F', '#E64164'],
  ['#4C1D95', '#8B5CF6'],
  ['#831843', '#EC4899'],
  ['#414141', '#737373'],
  ['#9D174D', '#FB7185'],
];

const timeToMinutes = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':');
  return parseInt(h, 10) * 60 + (parseInt(m, 10) || 0);
};

const formatTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// Assign overlapping reservations of one simulator to stacked lanes.
const assignLanes = (items) => {
  const laneEnds = [];
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const placed = sorted.map(item => {
    let lane = laneEnds.findIndex(end => end <= item.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMin);
    } else {
      laneEnds[lane] = item.endMin;
    }
    return { ...item, lane };
  });
  return { items: placed, laneCount: Math.max(laneEnds.length, 1) };
};

export default function SimulatorTimeline() {
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [base, setBase] = useState(null); // { university, simulators, teacherMap, teacherIds }
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hovered, setHovered] = useState(null); // { item, x, top, bottom }

  useEffect(() => {
    const loadBase = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        let university = null;
        if (user?.id) {
          const { data: adminRow } = await supabase
            .from('admins')
            .select('university')
            .eq('id', user.id)
            .maybeSingle();
          university = adminRow?.university || null;
        }

        let simQuery = supabase.from('simulators').select('id, number, name');
        if (university) simQuery = simQuery.eq('university', university);
        const { data: sims, error: simErr } = await simQuery;
        if (simErr) throw simErr;

        let teacherQuery = supabase.from('teachers').select('id, name, surname');
        if (university) teacherQuery = teacherQuery.eq('university', university);
        const { data: tchs, error: tchErr } = await teacherQuery;
        if (tchErr) throw tchErr;

        const teacherMap = {};
        (tchs || []).forEach((t, index) => {
          teacherMap[t.id] = {
            fullName: [t.name, t.surname].filter(Boolean).join(' '),
            gradient: PILL_GRADIENTS[index % PILL_GRADIENTS.length],
          };
        });

        setBase({
          university,
          simulators: [...(sims || [])].sort(
            (a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0)
          ),
          teacherMap,
          teacherIds: (tchs || []).map(t => t.id),
        });
      } catch (err) {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    };
    loadBase();
  }, []);

  useEffect(() => {
    if (!base) return;
    const loadSchedules = async () => {
      try {
        setLoading(true);
        setError(null);
        setHovered(null); // pill may unmount without firing mouseleave

        // A scoped university with no teachers cannot have reservations.
        if (base.university && base.teacherIds.length === 0) {
          setSchedules([]);
          return;
        }

        let query = supabase
          .from('teacher_schedules')
          .select('id, teacher_id, start_time, end_time, simulators, notes, course, groups, needs_assistance')
          .eq('session_date', selectedDate);
        if (base.university) query = query.in('teacher_id', base.teacherIds);

        const { data, error: schedErr } = await query;
        if (schedErr) throw schedErr;
        setSchedules(data || []);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadSchedules();
  }, [base, selectedDate]);

  const timeline = useMemo(() => {
    if (!base) return null;

    const reservations = [];
    schedules.forEach(s => {
      const startMin = timeToMinutes(s.start_time);
      const endMin = timeToMinutes(s.end_time);
      if (startMin === null || endMin === null || endMin <= startMin) return;
      (s.simulators || []).forEach(simNumber => {
        reservations.push({
          id: `${s.id}-${simNumber}`,
          simNumber: String(simNumber),
          startMin,
          endMin,
          teacher: base.teacherMap[s.teacher_id]?.fullName || 'Unknown teacher',
          gradient: base.teacherMap[s.teacher_id]?.gradient || PILL_GRADIENTS[0],
          note: s.notes || '',
          course: s.course || '',
          groups: Array.isArray(s.groups) ? s.groups.filter(Boolean) : [],
          needsAssistance: s.needs_assistance === true,
        });
      });
    });

    let openHour = DEFAULT_OPEN_HOUR;
    let closeHour = DEFAULT_CLOSE_HOUR;
    reservations.forEach(r => {
      openHour = Math.min(openHour, Math.floor(r.startMin / 60));
      closeHour = Math.max(closeHour, Math.ceil(r.endMin / 60));
    });

    const windowStart = openHour * 60;
    const windowLength = (closeHour - openHour) * 60;
    const toPercent = (minutes) => ((minutes - windowStart) / windowLength) * 100;

    const hourStep = closeHour - openHour > 14 ? 2 : 1;
    const hours = [];
    for (let h = openHour; h <= closeHour; h += hourStep) hours.push(h);

    const rows = base.simulators.map(sim => {
      const own = reservations.filter(r => r.simNumber === String(sim.number));
      const { items, laneCount } = assignLanes(own);
      return { sim, items, laneCount, height: laneCount * LANE_HEIGHT + ROW_PADDING };
    });

    const now = moment();
    const isToday = selectedDate === now.format('YYYY-MM-DD');
    const nowMin = now.hours() * 60 + now.minutes();
    const nowPercent =
      isToday && nowMin >= windowStart && nowMin <= windowStart + windowLength
        ? toPercent(nowMin)
        : null;

    return { rows, hours, toPercent, nowPercent, total: reservations.length };
  }, [base, schedules, selectedDate]);

  const shiftDay = (days) =>
    setSelectedDate(moment(selectedDate).add(days, 'day').format('YYYY-MM-DD'));

  const isToday = selectedDate === moment().format('YYYY-MM-DD');

  return (
    <div className="bg-[#FFFFFF] rounded-[24px] shadow-[0_8px_20px_rgba(65,65,65,0.08)] border border-[#DCDCDC]/60 p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-extrabold text-[#414141] flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#78003F]" />
            Simulator Schedule
          </h3>
          <p className="text-xs font-semibold text-[#414141]/60 mt-1">
            Reservations for every simulator in your center on the selected day
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {timeline && timeline.total > 0 && (
            <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#DCDCDC]/30 text-[#414141]/70 mr-1">
              {timeline.total} reservation{timeline.total === 1 ? '' : 's'}
            </span>
          )}
          <button
            onClick={() => shiftDay(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-[#DCDCDC] text-[#414141]/70 hover:bg-[#DCDCDC]/20 transition-colors"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Pick a day"
            />
            <div className="px-4 py-1.5 rounded-full text-xs font-semibold border border-[#DCDCDC] bg-[#FFFFFF] text-[#414141] pointer-events-none min-w-[130px] text-center">
              {moment(selectedDate).format('ddd, MMM D YYYY')}
            </div>
          </div>
          <button
            onClick={() => shiftDay(1)}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-[#DCDCDC] text-[#414141]/70 hover:bg-[#DCDCDC]/20 transition-colors"
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSelectedDate(moment().format('YYYY-MM-DD'))}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              isToday
                ? 'bg-gradient-to-br from-[#78003F] to-[#E64164] text-white border-transparent'
                : 'bg-[#FFFFFF] text-[#414141]/80 border-[#DCDCDC] hover:bg-[#DCDCDC]/20'
            }`}
          >
            Today
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm font-semibold text-[#E64164] mb-4">{error}</div>
      )}

      {!timeline || (loading && schedules.length === 0) ? (
        <div className="h-48 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-t-2 border-[#78003F] border-opacity-40"></div>
        </div>
      ) : timeline.rows.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-[#414141]/60 font-medium">
          No simulators found for your center.
        </div>
      ) : (
        <div className="overflow-x-auto pb-2 pr-5">
          <div className="min-w-[780px]">
            {/* Hour axis */}
            <div className="flex">
              <div style={{ width: LABEL_COL_WIDTH }} className="shrink-0" />
              <div className="relative flex-1 h-7">
                {timeline.hours.map(h => (
                  <span
                    key={h}
                    className="absolute top-0 -translate-x-1/2 text-[11px] font-semibold text-[#414141]/50"
                    style={{ left: `${timeline.toPercent(h * 60)}%` }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </span>
                ))}
                {timeline.nowPercent !== null && (
                  <span
                    className="absolute bottom-0 -translate-x-1/2 w-2 h-2 rounded-full bg-[#E64164] shadow-[0_0_6px_rgba(230,65,100,0.6)]"
                    style={{ left: `${timeline.nowPercent}%` }}
                  />
                )}
              </div>
            </div>

            {/* Simulator rows */}
            <div className="rounded-[16px] border border-[#DCDCDC]/50 overflow-hidden bg-gradient-to-b from-[#FFFFFF] to-[#DCDCDC]/10">
              {timeline.rows.map((row, rowIndex) => (
                <div
                  key={row.sim.id}
                  className={`flex hover:bg-[#DCDCDC]/10 transition-colors ${
                    rowIndex > 0 ? 'border-t border-[#DCDCDC]/40' : ''
                  }`}
                  style={{ height: row.height }}
                >
                  <div
                    style={{ width: LABEL_COL_WIDTH }}
                    className="shrink-0 flex flex-col justify-center px-4 border-r border-[#DCDCDC]/40"
                  >
                    <span className="text-sm font-bold text-[#414141] truncate leading-tight">
                      {row.sim.name}
                    </span>
                    <span className="text-[11px] font-semibold text-[#414141]/40 mt-0.5">
                      № {row.sim.number}
                    </span>
                  </div>

                  <div className="relative flex-1">
                    {timeline.hours
                      .filter(h => {
                        const pct = timeline.toPercent(h * 60);
                        return pct > 0.5 && pct < 99.5;
                      })
                      .map(h => (
                        <div
                          key={h}
                          className="absolute top-0 bottom-0 border-l border-[#DCDCDC]/40"
                          style={{ left: `${timeline.toPercent(h * 60)}%` }}
                        />
                      ))}

                    {timeline.nowPercent !== null && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-[#E64164] z-10"
                        style={{ left: `${timeline.nowPercent}%` }}
                      />
                    )}

                    {row.items.map(item => (
                      <div
                        key={item.id}
                        className="absolute z-[5] rounded-full flex items-center px-3.5 text-white shadow-[0_4px_12px_rgba(120,0,63,0.25)] cursor-default transition-transform duration-150 hover:scale-[1.02]"
                        style={{
                          left: `${timeline.toPercent(item.startMin)}%`,
                          width: `${timeline.toPercent(item.endMin) - timeline.toPercent(item.startMin)}%`,
                          top: ROW_PADDING / 2 + item.lane * LANE_HEIGHT + (LANE_HEIGHT - PILL_HEIGHT) / 2,
                          height: PILL_HEIGHT,
                          minWidth: 44,
                          backgroundImage: `linear-gradient(90deg, ${item.gradient[0]}, ${item.gradient[1]})`,
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHovered({
                            item,
                            x: rect.left + rect.width / 2,
                            top: rect.top,
                            bottom: rect.bottom,
                          });
                        }}
                        onMouseLeave={() => setHovered(null)}
                      >
                        {item.needsAssistance && (
                          <Headset className="w-3 h-3 shrink-0 mr-1" />
                        )}
                        <span className="text-[11px] font-bold truncate shrink-0 max-w-full">
                          {item.teacher}
                        </span>
                        {item.note && (
                          <span className="text-[11px] font-medium text-white/75 truncate ml-1.5">
                            · {item.note}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {timeline.total === 0 && !loading && (
              <div className="text-center text-sm font-medium text-[#414141]/50 mt-4">
                No reservations on {moment(selectedDate).format('MMMM D')} — all simulators are free.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fixed-position tooltip escapes the overflow container */}
      {hovered && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: Math.min(
              Math.max(hovered.x, 150),
              (typeof window !== 'undefined' ? window.innerWidth : 1280) - 150
            ),
            top: hovered.top > 170 ? hovered.top - 10 : hovered.bottom + 10,
            transform:
              hovered.top > 170
                ? 'translate(-50%, -100%)'
                : 'translate(-50%, 0)',
          }}
        >
          <div className="bg-[#414141] text-white rounded-[12px] px-3.5 py-2.5 shadow-xl max-w-[280px] w-max">
            <div className="text-xs font-bold whitespace-nowrap">
              {formatTime(hovered.item.startMin)} – {formatTime(hovered.item.endMin)}
            </div>
            <div className="text-xs font-semibold text-white/90 mt-1 whitespace-nowrap">
              {hovered.item.teacher}
            </div>
            {(hovered.item.course || hovered.item.groups.length > 0) && (
              <div className="text-[11px] font-medium text-white/60 mt-0.5">
                {hovered.item.course && `Course ${hovered.item.course}`}
                {hovered.item.course && hovered.item.groups.length > 0 && ' · '}
                {hovered.item.groups.length > 0 &&
                  `Group${hovered.item.groups.length > 1 ? 's' : ''} ${hovered.item.groups.join(', ')}`}
              </div>
            )}
            {hovered.item.needsAssistance && (
              <div className="text-[11px] font-bold text-[#FB7185] mt-1 flex items-center gap-1">
                <Headset className="w-3 h-3 shrink-0" />
                Simulation specialist needed
              </div>
            )}
            {hovered.item.note && (
              <div className="text-[11px] font-medium text-white/75 mt-1 border-t border-white/10 pt-1.5">
                {hovered.item.note}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
