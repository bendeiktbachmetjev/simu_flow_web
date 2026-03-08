import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts'
import { Users, BookOpen, Activity, LayoutDashboard } from 'lucide-react'
import moment from 'moment'

// You must replace these with your actual Supabase URL and Anon Key via the .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

function App() {
  const [stats, setStats] = useState({
    activeSimulators: 0,
    totalSimulators: 0,
    visitorsToday: 0,
    visitorsMonth: 0,
  })
  
  const [simulatorUsage, setSimulatorUsage] = useState([])
  const [userBreakdown, setUserBreakdown] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // 1. Fetch total simulators
      const { count: totalSims, error: simError } = await supabase
        .from('simulators')
        .select('*', { count: 'exact', head: true })
      if (simError) throw simError

      // 2. Fetch Active Simulators
      const { count: activeSims, error: activeError } = await supabase
        .from('simulator_sessions')
        .select('*', { count: 'exact', head: true })
        .is('end_time', null)
      if (activeError) throw activeError

      // 3. Fetch Center Sessions (for visitors today & month)
      const startOfDay = moment().startOf('day').toISOString()
      const startOfMonth = moment().startOf('month').toISOString()
      
      const { count: todaysVisitors, error: todayErr } = await supabase
        .from('center_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('entry_time', startOfDay)
      if (todayErr) throw todayErr

      const { count: monthVisitors, error: monthErr } = await supabase
        .from('center_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('entry_time', startOfMonth)
      if (monthErr) throw monthErr

      // 4. Fetch User Breakdown (Approximation from recent center sessions)
      const { data: recentSessions, error: breakdownErr } = await supabase
        .from('center_sessions')
        .select('role')
        .gte('entry_time', startOfMonth)
      if (breakdownErr) throw breakdownErr
      
      let studentCount = 0
      let teacherCount = 0
      recentSessions?.forEach(s => {
        if (s.role === 'student') studentCount++
        else if (s.role === 'teacher') teacherCount++
      })

      // 5. Fetch Simulator Usage (Mock aggregation or real from completed sessions)
      // For a real dashboard, you'd aggregate session duration per simulator_id
      const { data: allSessions, error: usageErr } = await supabase
        .from('simulator_sessions')
        .select('simulator_id, start_time, end_time')
        .not('end_time', 'is', null)
        .order('start_time', { ascending: false })
        .limit(100) // Last 100 sessions
      if (usageErr) throw usageErr

      // Aggregate counts by simulator ID (Simple version)
      const usageMap = {}
      allSessions?.forEach(s => {
        usageMap[s.simulator_id] = (usageMap[s.simulator_id] || 0) + 1
      })
      const usageData = Object.keys(usageMap)
        .map(id => ({ name: `Sim ${id}`, sessions: usageMap[id] }))
        .sort((a, b) => b.sessions - a.sessions).slice(0, 5)

      setStats({
        totalSimulators: totalSims || 0,
        activeSimulators: activeSims || 0,
        visitorsToday: todaysVisitors || 0,
        visitorsMonth: monthVisitors || 0,
      })

      setUserBreakdown([
        { name: 'Students', value: studentCount },
        { name: 'Teachers', value: teacherCount }
      ])
      
      setSimulatorUsage(usageData)
      setRecentActivity(allSessions?.slice(0, 5) || [])

    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-red-50">
        <div className="text-center text-red-600 p-8 bg-white rounded-xl shadow-lg border border-red-200">
          <h2 className="text-2xl font-bold mb-2">Supabase Configuration Required</h2>
          <p>Please update or create the `web_special/.env` file with your URL and Anon Key.</p>
          <p className="text-sm mt-4 text-red-400">Error details: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              SimuFlow Admin Center
            </h1>
          </div>
          <div className="text-sm text-slate-500 font-medium">
            {moment().format('MMMM Do YYYY, h:mm a')}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                title="Visitors Today" 
                value={stats.visitorsToday} 
                icon={<Users className="h-8 w-8 text-blue-500" />} 
                trend="+12% from yesterday"
                trendUp={true}
              />
              <StatCard 
                title="Active Simulators" 
                value={`${stats.activeSimulators} / ${stats.totalSimulators}`} 
                icon={<Activity className="h-8 w-8 text-green-500" />} 
                trend="Live"
                trendUp={true}
              />
              <StatCard 
                title="Visitors This Month" 
                value={stats.visitorsMonth} 
                icon={<BookOpen className="h-8 w-8 text-purple-500" />} 
                trend="Steady"
                trendUp={true}
              />
              <StatCard 
                title="Total Simulators" 
                value={stats.totalSimulators} 
                icon={<LayoutDashboard className="h-8 w-8 text-orange-500" />} 
                trend="All registered units"
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Main Chart */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Most Used Simulators (Recent Sessions)</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={simulatorUsage}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                      <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="sessions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Visitor Breakdown (This Month)</h3>
                <div className="h-64 flex justify-center">
                  {userBreakdown.every(v => v.value === 0) ? (
                    <div className="flex items-center text-slate-400">No data available</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={userBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {userBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="flex justify-center gap-4 mt-4">
                  {userBreakdown.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                      <span className="text-sm font-medium text-slate-600">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </>
        )}
      </main>
    </div>
  )
}

function StatCard({ title, value, icon, trend, trendUp }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
        <div className="p-2 bg-slate-50 rounded-xl">{icon}</div>
      </div>
      <div className="flex flex-col">
        <span className="text-3xl font-bold tracking-tight text-slate-800">{value}</span>
        {trend && (
          <span className={`text-sm font-medium mt-2 ${trendUp ? 'text-green-600' : 'text-slate-500'}`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  )
}

export default App
