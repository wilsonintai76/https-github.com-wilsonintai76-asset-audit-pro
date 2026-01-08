
import React, { useState } from 'react';
import { AuditSchedule } from '../types';
import { StatsCards } from './StatsCards';
// import { AIInsights } from './AIInsights';
import { CustomizeDashboardModal } from './CustomizeDashboardModal';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';

export const OverviewDashboard: React.FC = () => {
  const { currentUser, updateConfig } = useAuth();
  const { schedules, crossAuditPermissions } = useData();
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  // Filter schedules based on role
  const filteredSchedules = React.useMemo(() => {
    if (!currentUser) return [];

    const userRoles = currentUser.roles || [];
    const isAdmin = userRoles.includes('Admin');
    const isSupervisor = userRoles.includes('Supervisor');
    const isAuditor = userRoles.includes('Auditor');
    const userDept = currentUser.department;

    if (isAdmin) return schedules;

    const authorizedAuditeeDepts = crossAuditPermissions
      .filter(p => p.isActive)
      .flatMap(p => {
        const auths = [];
        if (p.auditorDept === userDept) auths.push(p.targetDept);
        if (p.isMutual && p.targetDept === userDept) auths.push(p.auditorDept);
        return auths;
      });

    return schedules.filter(s => {
      if (isSupervisor) {
        if (s.department !== userDept) return false;
      }

      if (isAuditor && !isSupervisor) {
        const isOwnDept = s.department === userDept;
        const isAuthorizedCrossDept = authorizedAuditeeDepts.includes(s.department);
        const isGeneral = s.department === 'General';
        // Auditors see their assignments, their dept, or cross-audit targets
        const isAssigned = s.auditor1 === currentUser.name || s.auditor2 === currentUser.name;
        if (!isOwnDept && !isAuthorizedCrossDept && !isGeneral && !isAssigned) return false;
      }
      return true;
    });
  }, [schedules, currentUser, crossAuditPermissions]);


  const dashboardConfig = currentUser?.dashboardConfig || {
    showStats: true,
    showTrends: true,
    showUpcoming: true,
    showCertification: true,
    showDeptDistribution: true
  };

  // Added explicit types to resolve potential TS inference issues in sort
  const upcomingAudits = [...filteredSchedules]
    .filter(s => s.status !== 'Completed')
    .sort((a: AuditSchedule, b: AuditSchedule) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  const deptCounts = filteredSchedules.reduce((acc, curr) => {
    acc[curr.department] = (acc[curr.department] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedDepts = (Object.entries(deptCounts) as [string, number][]).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Institutional Dashboard</h2>
          <p className="text-slate-500 text-lg mt-1">Real-time status of your institutional asset auditing operations.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCustomizeOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
          >
            <i className="fa-solid fa-sliders text-blue-500"></i>
            Customize View
          </button>
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">System Status</p>
            <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 justify-end">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              All Systems Operational
            </p>
          </div>
        </div>
      </div>

      {dashboardConfig.showStats && <StatsCards schedules={filteredSchedules} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* AI Insights disabled per user request (Cost saving) */}
          {/* <AIInsights schedules={filteredSchedules} /> */}

          {dashboardConfig.showTrends && (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Compliance Trends</h3>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <span className="text-xs font-bold text-slate-500 uppercase">Weekly Goal</span>
                </div>
              </div>
              <div className="h-48 flex items-end gap-3 md:gap-6">
                {[45, 78, 55, 90, 65, 82, 95].map((height, i) => (
                  <div key={i} className="flex-grow flex flex-col items-center group">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ${i === 6 ? 'bg-blue-600' : 'bg-slate-100 group-hover:bg-slate-200'}`}
                      style={{ height: `${height}%` }}
                    ></div>
                    <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Day 0{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dashboardConfig.showDeptDistribution && (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Departmental Distribution</h3>
              <div className="space-y-4">
                {sortedDepts.map(([dept, count], idx: number) => (
                  <div key={dept} className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-700">{dept}</span>
                      <span className="text-slate-400">{count} Audits</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 delay-${idx * 100} ${idx % 3 === 0 ? 'bg-blue-500' : idx % 3 === 1 ? 'bg-indigo-500' : 'bg-slate-400'
                          }`}
                        style={{ width: `${(count / (filteredSchedules.length || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-8">
          {dashboardConfig.showUpcoming && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Upcoming Audits</h3>
              <div className="space-y-4">
                {upcomingAudits.map((audit) => (
                  <div key={audit.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-4 hover:border-blue-200 transition-colors group">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] font-black text-blue-600 uppercase">Nov</span>
                      <span className="text-xs font-bold text-slate-900">{audit.date.split('-')[2]}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                        {audit.location}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{audit.department}</p>
                    </div>
                  </div>
                ))}
                {upcomingAudits.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-xs text-slate-400 font-medium italic">No upcoming audits scheduled.</p>
                  </div>
                )}
                <button className="w-full py-3 text-xs font-bold text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-50 transition-colors">
                  View Full Calendar
                </button>
              </div>
            </div>
          )}

          {dashboardConfig.showCertification && (
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
              <i className="fa-solid fa-graduation-cap absolute -right-4 -bottom-4 text-white/10 text-8xl"></i>
              <div className="relative z-10">
                <h4 className="text-lg font-bold mb-2">Certification Status</h4>
                <p className="text-blue-100 text-sm mb-4 leading-relaxed">Your institutional auditor certificate expires in 45 days. Renew now for priority access.</p>
                <button className="w-full py-3 bg-white text-blue-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-50 transition-colors">
                  Renew Certificate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isCustomizeOpen && (
        <CustomizeDashboardModal
          config={dashboardConfig}
          onClose={() => setIsCustomizeOpen(false)}
          onSave={(newConfig) => {
            updateConfig(newConfig);
            setIsCustomizeOpen(false);
          }}
        />
      )}
    </div>
  );
};