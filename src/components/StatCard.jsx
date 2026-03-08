import React from 'react';

export default function StatCard({ title, value, icon, trend, trendUp }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all hover:shadow-md hover:border-blue-100 group">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{title}</h3>
        <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors">
          {icon}
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-4xl font-extrabold tracking-tight text-slate-800">{value}</span>
        {trend && (
          <span className={`text-sm font-semibold mt-2 ${trendUp ? 'text-emerald-600' : 'text-slate-500'}`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
