import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { Users, BookOpen, Activity, LayoutDashboard, LogOut } from 'lucide-react';
import moment from 'moment';
import StatCard from './StatCard';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeSimulators: 0,
    totalSimulators: 0,
    visitorsToday: 0,
    visitorsMonth: 0,
    activeTeachers: 0,
    activeStudents: 0,
  });
  
  const [simulatorUsage, setSimulatorUsage] = useState([]);
  const [userBreakdown, setUserBreakdown] = useState([]);
  const [trafficData, setTrafficData] = useState([]);
  const [timeRange, setTimeRange] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange, customStart, customEnd]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { count: totalSims, error: simError } = await supabase
        .from('simulators')
        .select('*', { count: 'exact', head: true });
      if (simError) throw simError;

      const { count: activeSims, error: activeError } = await supabase
        .from('simulator_sessions')
        .select('*', { count: 'exact', head: true })
        .is('end_time', null);
      if (activeError) throw activeError;

      const now = moment();
      const startOfDay = now.clone().startOf('day').toISOString();
      const startOfMonth = now.clone().startOf('month').toISOString();
      
      const { count: todaysVisitors, error: todayErr } = await supabase
        .from('center_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('entry_time', startOfDay);
      if (todayErr) throw todayErr;

      const { count: monthVisitors, error: monthErr } = await supabase
        .from('center_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('entry_time', startOfMonth);
      if (monthErr) throw monthErr;

      // Active users in center (for admins)
      const { data: activeCenterSessions, error: activeCenterErr } = await supabase
        .from('center_sessions')
        .select('user_id')
        .is('exit_time', null);
      if (activeCenterErr) throw activeCenterErr;

      const activeUserIds = [...new Set(activeCenterSessions?.map(s => s.user_id) || [])];
      let activeTeachers = 0;
      let activeStudents = 0;

      if (activeUserIds.length > 0) {
        const { data: activeStd } = await supabase.from('students').select('id').in('id', activeUserIds);
        const { data: activeTch } = await supabase.from('teachers').select('id').in('id', activeUserIds);
        activeStudents = activeStd?.length || 0;
        activeTeachers = activeTch?.length || 0;
      }

      // Time range for traffic chart
      let rangeStart = now.clone().startOf('day');
      let rangeEnd = now.clone();

      if (timeRange === 'yesterday') {
        rangeStart = now.clone().subtract(1, 'day').startOf('day');
        rangeEnd = now.clone().subtract(1, 'day').endOf('day');
      } else if (timeRange === 'week') {
        rangeStart = now.clone().startOf('isoWeek');
      } else if (timeRange === 'month') {
        rangeStart = now.clone().startOf('month');
      } else if (timeRange === 'year') {
        rangeStart = now.clone().startOf('year');
      } else if (timeRange === 'custom' && customStart && customEnd) {
        rangeStart = moment(customStart).startOf('day');
        rangeEnd = moment(customEnd).endOf('day');
      }

      // User Breakdown
      const { data: recentSessions, error: breakdownErr } = await supabase
        .from('center_sessions')
        .select('user_id')
        .gte('entry_time', startOfMonth);
      if (breakdownErr) throw breakdownErr;
      
      const userIds = [...new Set(recentSessions?.map(s => s.user_id) || [])];
      let studentCount = 0;
      let teacherCount = 0;
      
      if (userIds.length > 0) {
        const { data: stdData } = await supabase.from('students').select('id').in('id', userIds);
        const { data: tchrData } = await supabase.from('teachers').select('id').in('id', userIds);
        studentCount = stdData?.length || 0;
        teacherCount = tchrData?.length || 0;
      }

      // Simulator Usage List (aggregate total hours per simulator for the current month)
      const { data: allSessions, error: usageErr } = await supabase
        .from('simulator_sessions')
        .select('simulator_id, start_time, end_time')
        .gte('start_time', startOfMonth);
      if (usageErr) throw usageErr;

      const usageMap = {};
      allSessions?.forEach(s => {
        if (!s.simulator_id || !s.start_time) return;
        const start = moment(s.start_time);
        const end = s.end_time ? moment(s.end_time) : moment();
        const minutes = Math.max(end.diff(start, 'minutes'), 0);
        const hours = minutes / 60;
        usageMap[s.simulator_id] = (usageMap[s.simulator_id] || 0) + hours;
      });
      
      let usageData = [];
      if (Object.keys(usageMap).length > 0) {
        // Fetch simulator names
        const { data: simsData } = await supabase.from('simulators').select('id, name').in('id', Object.keys(usageMap));
        const namesMap = {};
        simsData?.forEach(sim => namesMap[sim.id] = sim.name);
        
        usageData = Object.keys(usageMap)
          .map(id => ({
            name: namesMap[id] || `Sim ${id}`,
            hours: parseFloat(usageMap[id].toFixed(1)), // one decimal place
          }))
          .sort((a, b) => b.hours - a.hours)
          .slice(0, 5);
      }

      // Center traffic over time (number of open sessions per bucket)
      const { data: trafficSessions, error: trafficErr } = await supabase
        .from('center_sessions')
        .select('entry_time, exit_time')
        .lte('entry_time', rangeEnd.toISOString())
        .or(`exit_time.is.null,exit_time.gte.${rangeStart.toISOString()}`);
      if (trafficErr) throw trafficErr;

      const totalDays = rangeEnd.endOf('day').diff(rangeStart.startOf('day'), 'days');
      const bucketStep =
        timeRange === 'week' || timeRange === 'month' || timeRange === 'year'
          ? 'day'
          : 'hour';

      const buckets = [];
      const bucketIndex = {};

      let cursor = rangeStart.clone().startOf(bucketStep);
      const endCursor = rangeEnd.clone().endOf(bucketStep);

      while (cursor.isSameOrBefore(endCursor)) {
        const key = cursor.toISOString();
        buckets.push({
          key,
          label: bucketStep === 'hour' ? cursor.format('HH:mm') : cursor.format('MMM D'),
          count: 0,
        });
        bucketIndex[key] = buckets.length - 1;
        cursor.add(1, bucketStep);
      }

      trafficSessions?.forEach(s => {
        if (!s.entry_time) return;
        const sessionStart = moment(s.entry_time);
        const sessionEnd = s.exit_time ? moment(s.exit_time) : now;

        buckets.forEach((bucket, index) => {
          const bucketStart = moment(bucket.key);
          const bucketEnd = bucketStart.clone().add(1, bucketStep);

          const overlaps =
            sessionStart.isBefore(bucketEnd) &&
            sessionEnd.isAfter(bucketStart);

          if (overlaps) {
            buckets[index].count += 1;
          }
        });
      });

      setStats({
        totalSimulators: totalSims || 0,
        activeSimulators: activeSims || 0,
        visitorsToday: todaysVisitors || 0,
        visitorsMonth: monthVisitors || 0,
        activeTeachers,
        activeStudents,
      });

      setUserBreakdown([
        { name: 'Students', value: studentCount },
        { name: 'Teachers', value: teacherCount }
      ]);
      setSimulatorUsage(usageData);
      setTrafficData(buckets);

    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-sm shadow-blue-200">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
              SimuFlow Analytics
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-500 font-semibold hidden sm:block">
              {moment().format('MMMM Do YYYY, h:mm a')}
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-sm">
            <h3 className="font-bold text-red-800 mb-1">Error Loading Data</h3>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-32">
            <div className="flex flex-col items-center gap-4 text-blue-600">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-t-4 border-blue-600 border-opacity-30"></div>
              <span className="font-bold tracking-wide">Crunching the numbers...</span>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                title="Visitors Today" 
                value={stats.visitorsToday} 
                icon={<Users className="h-7 w-7 text-blue-600" />} 
                trend="Active Today"
                trendUp={true}
              />
              <StatCard 
                title="Active Simulators" 
                value={`${stats.activeSimulators} / ${stats.totalSimulators}`} 
                icon={<Activity className="h-7 w-7 text-emerald-500" />} 
                trend="Live Updates"
                trendUp={true}
              />
              <StatCard 
                title="Monthly Footprint" 
                value={stats.visitorsMonth} 
                icon={<BookOpen className="h-7 w-7 text-purple-500" />} 
                trend="This Month"
                trendUp={true}
              />
              <StatCard 
                title="Total Assets" 
                value={stats.totalSimulators} 
                icon={<LayoutDashboard className="h-7 w-7 text-amber-500" />} 
                trend="Simulators in DB"
              />
              <StatCard 
                title="Teachers In Center" 
                value={stats.activeTeachers} 
                icon={<Users className="h-7 w-7 text-emerald-600" />} 
                trend="Teachers currently inside"
                trendUp={true}
              />
              <StatCard 
                title="Students In Center" 
                value={stats.activeStudents} 
                icon={<Users className="h-7 w-7 text-indigo-600" />} 
                trend="Students currently inside"
                trendUp={true}
              />
            </div>

            {/* Center traffic over time */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-500" />
                    Center Occupancy Over Time
                  </h3>
                  <p className="text-xs font-semibold text-slate-400 mt-1">
                    Number of visitors inside the center across the selected period
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'today', label: 'Today' },
                    { id: 'yesterday', label: 'Yesterday' },
                    { id: 'week', label: 'This Week' },
                    { id: 'month', label: 'This Month' },
                    { id: 'year', label: 'This Year' },
                    { id: 'custom', label: 'Custom' },
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => setTimeRange(option.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                        timeRange === option.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {timeRange === 'custom' && (
                <div className="flex flex-wrap items-center gap-3 mb-6 text-xs font-semibold text-slate-600">
                  <span>Custom range:</span>
                  <input
                    type="date"
                    className="border border-slate-200 rounded-lg px-2 py-1"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                  <span>to</span>
                  <input
                    type="date"
                    className="border border-slate-200 rounded-lg px-2 py-1"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </div>
              )}

              <div className="h-80">
                {trafficData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 font-medium">
                    No visitor data for selected range.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trafficData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontWeight: 600, fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontWeight: 600, fontSize: 12 }} allowDecimals={false} />
                      <RechartsTooltip
                        cursor={{ stroke: '#94a3b8', strokeWidth: 1 }}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value) => [`${value}`, 'Visitors']}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#2563eb"
                        strokeWidth={3}
                        dot={{ r: 3, strokeWidth: 1, stroke: '#eff6ff', fill: '#2563eb' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
                <h3 className="text-lg font-extrabold text-slate-800 mb-1 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-500" />
                  Most Used Simulators (by hours)
                </h3>
                <p className="text-xs font-semibold text-slate-400 mb-6">
                  Total hours of usage this month per simulator
                </p>
                <div className="h-80">
                  {simulatorUsage.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 font-medium">No session data available yet.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={simulatorUsage} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 600, fontSize: 12}} />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#64748b', fontWeight: 600, fontSize: 12}}
                          tickFormatter={(value) => value.toFixed(1)}
                        />
                        <RechartsTooltip 
                          cursor={{fill: '#f8fafc'}} 
                          contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                          formatter={(value) => [`${value.toFixed(1)} h`, 'Hours']}
                        />
                        <Bar 
                          dataKey="hours" 
                          fill="#2563eb" 
                          radius={[6, 6, 0, 0]} 
                          barSize={40}
                        >
                          {simulatorUsage.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 flex flex-col">
                <h3 className="text-lg font-extrabold text-slate-800 mb-8 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-500" />
                  Demographics (Monthly)
                </h3>
                
                <div className="flex-1 min-h-[250px] flex flex-col justify-center">
                  {userBreakdown.every(v => v.value === 0) ? (
                    <div className="flex items-center justify-center text-slate-400 font-medium h-full">No visitor data available.</div>
                  ) : (
                    <>
                      <div className="h-56 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={userBreakdown}
                              cx="50%"
                              cy="50%"
                              innerRadius={70}
                              outerRadius={90}
                              paddingAngle={8}
                              dataKey="value"
                              stroke="none"
                            >
                              {userBreakdown.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#8b5cf6'} />
                              ))}
                            </Pie>
                            <RechartsTooltip 
                              contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-3xl font-extrabold text-slate-800">
                            {userBreakdown.reduce((a, b) => a + b.value, 0)}
                          </span>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Total</span>
                        </div>
                      </div>
                      
                      <div className="flex justify-center gap-6 mt-6">
                        {userBreakdown.map((entry, index) => (
                          <div key={entry.name} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{backgroundColor: index === 0 ? '#3b82f6' : '#8b5cf6'}}></div>
                            <span className="text-sm font-bold text-slate-600">{entry.name}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
