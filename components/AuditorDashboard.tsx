
import React, { useMemo } from 'react';
import { AuditSchedule, User, AuditPhase, KPITier, Department, Location } from '../types';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  GraduationCap,
  ChevronRight,
  MapPin,
  Building2
} from 'lucide-react';

interface AuditorDashboardProps {
  schedules: AuditSchedule[];
  currentUser: User;
  phases: AuditPhase[];
  kpiTiers: KPITier[];
  departments: Department[];
  locations: Location[];
}

export const AuditorDashboard: React.FC<AuditorDashboardProps> = ({ 
  schedules, 
  currentUser,
  phases,
  kpiTiers,
  departments,
  locations
}) => {
  // Filter audits assigned to the current user
  const myAudits = useMemo(() => {
    return schedules.filter(s => 
      s.auditor1Id === currentUser.id || s.auditor2Id === currentUser.id
    );
  }, [schedules, currentUser.id]);

  const stats = useMemo(() => {
    const total = myAudits?.length || 0;
    const completed = myAudits?.filter(s => s.status === 'Completed').length || 0;
    const inProgress = myAudits?.filter(s => s.status === 'In Progress').length || 0;
    const pending = myAudits?.filter(s => s.status === 'Pending').length || 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, pending, completionRate };
  }, [myAudits]);

  const upcomingAudits = useMemo(() => {
    return [...myAudits]
      .filter(s => s.status !== 'Completed')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }, [myAudits]);

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

  if (!certInfo || certInfo.status === 'expired') {
     return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <GraduationCap className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Certification Required</h2>
            <p className="text-slate-500 max-w-md mb-8">
                {certInfo?.status === 'expired' 
                    ? "Your auditor certification has expired. You must renew your certification to access the auditor dashboard and perform audits."
                    : "You do not have an active auditor certification. Please contact an administrator to update your certification status."}
            </p>
            <button className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
                Request Certification
            </button>
        </div>
     )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Auditor Command Center</h2>
          <p className="text-slate-500 text-lg mt-1">Welcome back, {currentUser.name}. Here is your personal audit summary.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Personal Status</p>
            <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 justify-end">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Active Duty
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Assigned</p>
            <p className="text-2xl font-black text-slate-900">{stats.total}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed</p>
            <p className="text-2xl font-black text-slate-900">{stats.completed}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">In Progress</p>
            <p className="text-2xl font-black text-slate-900">{stats.inProgress}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completion Rate</p>
            <p className="text-2xl font-black text-slate-900">{stats.completionRate}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upcoming Audits List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Your Upcoming Schedule</h3>
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase">
                Next {upcomingAudits?.length || 0} Audits
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {upcomingAudits.map((audit) => (
                <div key={audit.id} className="p-6 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-black text-blue-600 uppercase">
                        {audit.date ? new Date(audit.date).toLocaleString('default', { month: 'short' }) : 'N/A'}
                      </span>
                      <span className="text-lg font-black text-slate-900">{audit.date ? audit.date.split('-')[2] : '-'}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg">
                        {locations.find(l => l.id === audit.locationId)?.name || audit.locationId}
                      </h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                          <Building2 className="w-3 h-3" />
                          {departments.find(d => d.id === audit.departmentId)?.name || audit.departmentId}
                        </span>
                        {(() => {
                          const loc = locations.find(l => l.id === audit.locationId);
                          if (loc?.building) {
                            return (
                              <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                                <MapPin className="w-3 h-3" />
                                {loc.building}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                      audit.status === 'In Progress' 
                        ? 'bg-amber-50 text-amber-600 border-amber-100' 
                        : 'bg-slate-50 text-slate-600 border-slate-100'
                    }`}>
                      {audit.status}
                    </div>
                    <button className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              {(!upcomingAudits || upcomingAudits.length === 0) && (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-medium">No upcoming audits assigned to you.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-8">
          {/* Certification Widget */}
          {certInfo && (
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

          {/* Performance Insight */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Performance Metrics
            </h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Audit Accuracy</span>
                  <span className="text-xs font-black text-slate-900">98.2%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '98.2%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">On-Time Completion</span>
                  <span className="text-xs font-black text-slate-900">94.5%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '94.5%' }}></div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                  <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                    You're performing above the institutional average for this phase. Keep up the high accuracy!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
