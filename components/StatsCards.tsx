
import React from 'react';
import { AuditSchedule } from '../types';

interface StatsCardsProps {
  schedules: AuditSchedule[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({ schedules }) => {
  const total = schedules.length;
  const pending = schedules.filter(s => s.status === 'Pending').length;
  const needsAuditors = schedules.filter(s => !s.auditor1 || !s.auditor2).length;
  const completed = schedules.filter(s => s.status === 'Completed').length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Total Audits */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all duration-300">
        <div>
          <span className="text-slate-500 text-sm font-semibold block mb-2">Total Audits</span>
          <div className="text-3xl font-black text-slate-900">{total}</div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
          <i className="fa-solid fa-clipboard-list text-xl"></i>
        </div>
      </div>

      {/* Pending */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all duration-300">
        <div>
          <span className="text-slate-500 text-sm font-semibold block mb-2">Pending</span>
          <div className="text-3xl font-black text-slate-900">{pending}</div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
          <i className="fa-solid fa-clock text-xl"></i>
        </div>
      </div>

      {/* Open Slots */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all duration-300">
        <div>
          <span className="text-slate-500 text-sm font-semibold block mb-2">Open Slots</span>
          <div className="text-3xl font-black text-slate-900">{needsAuditors}</div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
          <i className="fa-solid fa-user-plus text-xl"></i>
        </div>
      </div>

      {/* Completed */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all duration-300">
        <div>
          <span className="text-slate-500 text-sm font-semibold block mb-2">Completed</span>
          <div className="text-3xl font-black text-slate-900">{completed}</div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
          <i className="fa-solid fa-check-circle text-xl"></i>
        </div>
      </div>
    </div>
  );
};
