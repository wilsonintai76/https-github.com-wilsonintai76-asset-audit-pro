
import React, { useState, useMemo } from 'react';
import { AuditSchedule, DashboardConfig, AuditPhase, KPITier, Department, Location, User, AuditInsight } from '../types';
import { StatsCards } from './StatsCards';
import { CustomizeDashboardModal } from './CustomizeDashboardModal';
import { KPIStatsWidget } from './KPIStatsWidget';
import { AIInsightBox } from './AIInsightBox';
import { analyzeSchedule } from '../services/geminiService';
import { Sliders, GraduationCap } from 'lucide-react';

interface OverviewDashboardProps {
  schedules: AuditSchedule[];
  config: DashboardConfig;
  onUpdateConfig: (config: DashboardConfig) => void;
  phases?: AuditPhase[];
  kpiTiers?: KPITier[];
  departments?: Department[];
  locations?: Location[];
  currentUser: User;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ 
  schedules,
  config,
  onUpdateConfig,
  phases = [],
  kpiTiers = [],
  departments = [],
  locations = [],
  currentUser
}) => {
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [aiInsight, setAiInsight] = useState<AuditInsight | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Dynamic Certification Status
  const certInfo = useMemo(() => {
    if (!currentUser.certificationExpiry) return null;
    
    const expiry = new Date(currentUser.certificationExpiry);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let status: 'safe' | 'warning' | 'expired' = 'safe';
    if (diffDays <= 0) status = 'expired';
    else if (diffDays <= 30) status = 'warning';
    
    return { days: diffDays, status };
  }, [currentUser]);

  const upcomingAudits = [...schedules]
    .filter(s => s.status !== 'Completed' && s.date != null)
    .sort((a: AuditSchedule, b: AuditSchedule) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
    .slice(0, 3);

  const deptCounts = schedules.reduce((acc, curr) => {
    const deptName = departments.find(d => d.id === curr.departmentId)?.name || 'Unknown';
    acc[deptName] = (acc[deptName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedDepts = (Object.entries(deptCounts) as [string, number][]).sort((a, b) => b[1] - a[1]);

  const handleGenerateInsight = async () => {
    setIsAiLoading(true);
    try {
        const insight = await analyzeSchedule(schedules);
        setAiInsight(insight);
    } catch (e) {
        console.error("Failed to generate insight", e);
    } finally {
        setIsAiLoading(false);
    }
  };

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
            <Sliders className="w-4 h-4 text-blue-500" />
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

      {/* AI Morning Briefing Widget */}
      <AIInsightBox 
        insight={aiInsight} 
        loading={isAiLoading} 
        onGenerate={handleGenerateInsight} 
      />

      {config.showStats && <StatsCards schedules={schedules} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            
          {/* KPI Widget */}
          {phases.length > 0 && kpiTiers.length > 0 && (
            <KPIStatsWidget 
                phases={phases}
                kpiTiers={kpiTiers}
                departments={departments}
                schedules={schedules}
            />
          )}

          {config.showTrends && (
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
                    <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Day 0{i+1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {config.showDeptDistribution && (
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
                        className={`h-full rounded-full transition-all duration-1000 delay-${idx * 100} ${
                          idx % 3 === 0 ? 'bg-blue-500' : idx % 3 === 1 ? 'bg-indigo-500' : 'bg-slate-400'
                        }`}
                        style={{ width: `${(count / (schedules.length || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-8">
          {config.showUpcoming && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Upcoming Audits</h3>
              <div className="space-y-4">
                {upcomingAudits.map((audit) => (
                  <div key={audit.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-4 hover:border-blue-200 transition-colors group">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] font-black text-blue-600 uppercase">
                        {audit.date ? new Date(audit.date).toLocaleString('default', { month: 'short' }) : '--'}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{audit.date ? audit.date.split('-')[2] : '--'}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                        {locations.find(l => l.id === audit.locationId)?.name || '—'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{departments.find(d => d.id === audit.departmentId)?.name || '—'}</p>
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

          {config.showCertification && certInfo && (
            <div className={`rounded-3xl p-6 text-white shadow-xl relative overflow-hidden transition-colors duration-500 ${
                certInfo.status === 'safe' ? 'bg-gradient-to-br from-indigo-600 to-blue-700 shadow-blue-500/20' :
                certInfo.status === 'warning' ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20' :
                'bg-gradient-to-br from-rose-600 to-red-700 shadow-rose-500/20'
            }`}>
              <GraduationCap className="absolute -right-4 -bottom-4 text-white/10 w-24 h-24" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold">Certification Status</h4>
                  <div className="w-10 h-10 rounded-full border-4 border-white/20 flex items-center justify-center text-[10px] font-black">
                     {certInfo.status === 'expired' ? 'EXP' : certInfo.days}d
                  </div>
                </div>
                
                <p className="text-white/90 text-sm mb-4 leading-relaxed">
                  {certInfo.status === 'safe' && `Your institutional auditor certificate expires in ${certInfo.days} days.`}
                  {certInfo.status === 'warning' && `Urgent: Certification expiring in ${certInfo.days} days. Renew immediately.`}
                  {certInfo.status === 'expired' && `Critical: Your certificate has expired. Audit operations suspended.`}
                </p>

                <button 
                    onClick={() => window.location.hash = '#profile'}
                    className={`w-full py-3 bg-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${
                        certInfo.status === 'safe' ? 'text-blue-700 hover:bg-blue-50' :
                        certInfo.status === 'warning' ? 'text-amber-700 hover:bg-amber-50' :
                        'text-rose-700 hover:bg-rose-50'
                    }`}
                >
                  Renew Certificate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isCustomizeOpen && (
        <CustomizeDashboardModal 
          config={config}
          onClose={() => setIsCustomizeOpen(false)}
          onSave={(newConfig) => {
            onUpdateConfig(newConfig);
            setIsCustomizeOpen(false);
          }}
        />
      )}
    </div>
  );
};
