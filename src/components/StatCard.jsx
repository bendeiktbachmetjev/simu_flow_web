import React from 'react';

export default function StatCard({ title, value, icon, trend, trendUp }) {
  return (
    <div className="bg-[#FFFFFF] rounded-[24px] shadow-[0_8px_20px_rgba(65,65,65,0.08)] border border-[#DCDCDC]/60 p-6 transition-all hover:shadow-[0_10px_24px_rgba(65,65,65,0.1)] group">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-[#414141]/70 uppercase tracking-wider">{title}</h3>
        <div className="p-3 bg-[#DCDCDC]/30 rounded-[16px] group-hover:bg-[#DCDCDC]/45 transition-colors">
          {icon}
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-4xl font-extrabold tracking-tight text-[#414141]">{value}</span>
        {trend && (
          <span className={`text-sm font-semibold mt-2 ${trendUp ? 'text-[#78003F]' : 'text-[#414141]/60'}`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
