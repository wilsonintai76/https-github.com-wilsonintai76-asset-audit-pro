
import React from 'react';
import { AuditSchedule, Department } from '../types';
import { ClipboardList, Clock, UserPlus, CheckCircle, Boxes } from 'lucide-react';

interface StatsCardsProps {
  schedules: AuditSchedule[];
  departments?: Department[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({ schedules, departments = [] }) => {
  const total = schedules?.length || 0;
  const pending = schedules?.filter(s => s.status === 'Pending').length || 0;
  const needsAuditors = schedules?.filter(s => !s.auditor1 || !s.auditor2).length || 0;
  const completed = schedules?.filter(s => s.status === 'Completed').length || 0;
  const totalInstitutionAssets = departments.reduce((sum, d) => sum + (d.totalAssets || 0), 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      {/* Total Institution Assets */}
      <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-6 rounded-3xl shadow-lg border border-violet-500/30 flex items-center justify-between group hover:shadow-xl transition-all duration-300 col-span-1">
        <div>
          <span className="text-violet-200 text-sm font-semibold block mb-2">Total Assets</span>
          <div className="text-3xl font-black text-white">{totalInstitutionAssets.toLocaleString()}</div>
          <span className="text-[10px] text-violet-300 font-bold uppercase tracking-widest">Institution-wide</span>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
          <Boxes className="w-6 h-6" />
        </div>
      </div>
      {/* Total Audits */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all duration-300">
        <div>
          <span className="text-slate-500 text-sm font-semibold block mb-2">Total Audits</span>
          <div className="text-3xl font-black text-slate-900">{total}</div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
          <ClipboardList className="w-6 h-6" />
        </div>
      </div>

      {/* Pending */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all duration-300">
        <div>
          <span className="text-slate-500 text-sm font-semibold block mb-2">Pending</span>
          <div className="text-3xl font-black text-slate-900">{pending}</div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
          <Clock className="w-6 h-6" />
        </div>
      </div>

      {/* Open Slots */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all duration-300">
        <div>
          <span className="text-slate-500 text-sm font-semibold block mb-2">Open Slots</span>
          <div className="text-3xl font-black text-slate-900">{needsAuditors}</div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
          <UserPlus className="w-6 h-6" />
        </div>
      </div>

      {/* Completed */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all duration-300">
        <div>
          <span className="text-slate-500 text-sm font-semibold block mb-2">Completed</span>
          <div className="text-3xl font-black text-slate-900">{completed}</div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
          <CheckCircle className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};
