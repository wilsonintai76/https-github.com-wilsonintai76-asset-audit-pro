
import React, { useMemo, useState } from 'react';
import { AuditPhase, KPITier, KPITierTarget, Department, Location, AuditSchedule, InstitutionKPITarget } from '../types';
import { ChevronDown, Building2, TrendingUp, AlertCircle, CheckCircle2, Trophy } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface KPIStatsWidgetProps {
  phases: AuditPhase[];
  kpiTiers: KPITier[];
  kpiTierTargets: KPITierTarget[];
  departments: Department[];
  locations: Location[];
  schedules: AuditSchedule[];
  institutionKPIs: InstitutionKPITarget[];
}

export const KPIStatsWidget: React.FC<KPIStatsWidgetProps> = ({ phases, kpiTiers, kpiTierTargets, departments, locations, schedules, institutionKPIs }) => {
  const { t } = useLanguage();
  const [expandedTierId, setExpandedTierId] = useState<string | null>(null);
  const today = new Date();
  
  // 1. Identify Current Active Phase
  const activePhase = useMemo(() => {
    return phases.find(p => {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        return today >= start && today <= end;
    }) || phases.sort((a,b) => a.startDate.localeCompare(b.startDate))[0]; // Default to first phase if none active
  }, [phases, today]);

  // 2. Compute Stats per Tier (asset-based)
  const tierStats = useMemo(() => {
    if (!activePhase || !kpiTiers || kpiTiers.length === 0) return [];

    const institutionTotalAssets = departments.reduce((sum, d) => sum + (d.totalAssets || 0), 0);

    // Build location asset lookup
    const locAssets: Record<string, number> = {};
    for (const l of locations) { locAssets[l.id] = l.totalAssets || 0; }

    const sortedTiers = [...kpiTiers].sort((a,b) => a.minAssets - b.minAssets);

    return sortedTiers.map((tier, idx) => {
      const deptsInTier = departments.filter(d => {
        const deptPercentage = institutionTotalAssets > 0 ? ((d.totalAssets || 0) / institutionTotalAssets) * 100 : 0;
        const assignedTier = sortedTiers
          .filter(t => deptPercentage >= t.minAssets)
          .sort((a,b) => b.minAssets - a.minAssets)[0];
        return assignedTier?.id === tier.id;
      });

      // Use relational kpiTierTargets table
      const targetPercentage = kpiTierTargets.find(kt => kt.tierId === tier.id && kt.phaseId === activePhase.id)?.targetPercentage ?? 0;

      // Asset-based per-department progress for the active phase
      const deptDetails = deptsInTier.map(d => {
        const totalDeptAssets = d.totalAssets || 0;
        const completedLocIds = schedules
          .filter(s => s.departmentId === d.id && s.phaseId === activePhase.id && s.status === 'Completed')
          .map(s => s.locationId);
        const inspectedAssets = completedLocIds.reduce((sum, locId) => sum + (locAssets[locId] || 0), 0);
        const isZeroAsset = totalDeptAssets === 0;
        const percentage = isZeroAsset ? 100 : Math.round((inspectedAssets / totalDeptAssets) * 100);
        return {
          id: d.id,
          name: d.name,
          assets: totalDeptAssets,
          inspectedAssets,
          percentage,
          status: (isZeroAsset || percentage >= targetPercentage) ? 'On Track' : 'At Risk'
        };
      }).sort((a, b) => a.percentage - b.percentage);

      const totalTierAssets = deptsInTier.reduce((sum, d) => sum + (d.totalAssets || 0), 0);
      const inspectedTierAssets = deptDetails.reduce((sum, d) => sum + d.inspectedAssets, 0);
      const actualPercentage = totalTierAssets > 0 ? Math.round((inspectedTierAssets / totalTierAssets) * 100) : 0;

      return {
        ...tier,
        isHighestTier: idx === sortedTiers.length - 1,
        nextMin: sortedTiers[idx + 1]?.minAssets || 100,
        departments: deptDetails,
        deptCount: deptsInTier.length,
        actualPercentage,
        targetPercentage,
        status: actualPercentage >= targetPercentage ? 'On Track' : 'At Risk'
      };
    }).sort((a,b) => a.minAssets - b.minAssets);
  }, [kpiTiers, kpiTierTargets, departments, locations, schedules, activePhase]);

  // Global Institutional Progress — asset-based (Global KPI % × institution total assets)
  const globalStats = useMemo(() => {
    if (!activePhase) return null;
    const totalInstitutionAssets = departments.reduce((sum, d) => sum + (d.totalAssets || 0), 0);
    const targetPercentage = institutionKPIs.find(k => k.phaseId === activePhase.id)?.targetPercentage ?? 0;
    const targetAssets = Math.ceil(totalInstitutionAssets * targetPercentage / 100);
    const completedLocIds = new Set(
      schedules.filter(s => s.phaseId === activePhase.id && s.status === 'Completed').map(s => s.locationId)
    );
    const inspectedAssets = locations
      .filter(l => completedLocIds.has(l.id))
      .reduce((sum, l) => sum + (l.totalAssets || 0), 0);
    const actualPercentage = totalInstitutionAssets > 0 ? Math.round((inspectedAssets / totalInstitutionAssets) * 100) : 0;
    return {
      totalInstitutionAssets,
      inspectedAssets,
      targetAssets,
      actualPercentage,
      targetPercentage,
      isOnTrack: actualPercentage >= targetPercentage
    };
  }, [schedules, locations, departments, institutionKPIs, activePhase]);

  const toggleExpand = (id: string) => {
    setExpandedTierId(prev => prev === id ? null : id);
  };

  if (!activePhase) return null;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{t('dashboard.performance')}</h3>
          <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mt-1">
            {t('dashboard.current_phase')}: {activePhase.name}
          </p>
        </div>
        <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 hidden sm:block">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest text-right">{t('dashboard.phase_ends')}</p>
            <p className="text-sm font-black text-slate-700">{activePhase.endDate}</p>
        </div>
      </div>

      {globalStats && (
        <div className="mb-10 bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-900/10 group">
           <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full -mr-20 -mt-20"></div>
           <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 blur-[60px] rounded-full -ml-20 -mb-20"></div>
           
           <div className="relative flex flex-col md:flex-row md:items-center gap-8">
              <div className="flex-grow">
                 <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-white/10 text-blue-400 rounded-xl flex items-center justify-center border border-white/10">
                       <Building2 className="w-5 h-5" />
                    </div>
                    <h4 className="text-lg font-black uppercase tracking-tight">{t('dashboard.progress')}</h4>
                 </div>
                 
                 <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-6xl font-black">{globalStats.actualPercentage}%</span>
                    <span className="text-xl font-bold text-white/40">Overall Completion</span>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                       <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Phase Goal</p>
                       <p className="text-lg font-bold">{globalStats.targetPercentage}%</p>
                       <p className="text-[10px] text-white/50 mt-0.5">{globalStats.targetAssets.toLocaleString()} assets</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                       <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Status</p>
                       <div className="flex items-center gap-1.5">
                          {globalStats.isOnTrack ? (
                             <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                             <AlertCircle className="w-4 h-4 text-amber-400" />
                          )}
                          <p className={`text-sm font-bold ${globalStats.isOnTrack ? 'text-emerald-400' : 'text-amber-400'}`}>
                             {globalStats.isOnTrack ? 'On Track' : 'At Risk'}
                          </p>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="w-full md:w-48 shrink-0 flex flex-col items-center justify-center p-6 bg-white/5 rounded-[24px] border border-white/10">
                 <TrendingUp className={`w-8 h-8 mb-3 ${globalStats.isOnTrack ? 'text-emerald-400' : 'text-amber-400'}`} />
                 <p className="text-[10px] font-black uppercase tracking-widest text-white/40 text-center mb-1">Assets Inspected</p>
                 <p className="text-2xl font-black">{globalStats.inspectedAssets.toLocaleString()}</p>
                 <p className="text-[10px] text-white/40 font-medium">of {globalStats.targetAssets.toLocaleString()} target</p>
              </div>
           </div>

           <div className="h-2 w-full bg-white/10 rounded-full mt-8 relative overflow-hidden">
              <div 
                 className="absolute top-0 bottom-0 w-1 bg-white z-10" 
                 style={{ left: `${globalStats.targetPercentage}%` }}
              ></div>
              <div 
                 className={`h-full rounded-full transition-all duration-1000 ${globalStats.isOnTrack ? 'bg-emerald-400' : 'bg-amber-400'}`}
                 style={{ width: `${globalStats.actualPercentage}%` }}
              ></div>
           </div>
        </div>
      )}

      <div className="space-y-6">
        <h5 className="text-[11px] font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2">
           <Trophy className="w-3.5 h-3.5" />
           {t('dashboard.tier_progress')}
        </h5>
        {tierStats.map(stat => {
           const progressColor = stat.status === 'On Track' ? 'bg-emerald-500' : 'bg-amber-500';
           const width = `${Math.min(100, stat.actualPercentage)}%`;
           const targetMarker = `${Math.min(100, stat.targetPercentage)}%`;
           const isExpanded = expandedTierId === stat.id;

           return (
             <div key={stat.id} className="group border border-slate-100 rounded-2xl p-4 hover:border-blue-100 transition-all bg-slate-50/30">
               <div className="flex justify-between items-end mb-3 cursor-pointer" onClick={() => toggleExpand(stat.id)}>
                 <div>
                   <div className="flex items-center gap-2">
                     <span className="text-sm font-bold text-slate-700 block">{stat.name}</span>
                     <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                   </div>
                   <span className="text-[10px] text-slate-400 font-medium">
                     {stat.minAssets}% - {stat.isHighestTier ? '100' : stat.nextMin - 1}% Size Threshold • {stat.deptCount} Departments
                   </span>
                 </div>
                 <div className="text-right">
                   <span className={`text-xl font-black ${stat.status === 'On Track' ? 'text-emerald-600' : 'text-amber-600'}`}>
                     {stat.actualPercentage}%
                   </span>
                   <span className="text-[10px] text-slate-400 font-medium ml-1 block">
                     Target: {stat.targetPercentage}%
                   </span>
                 </div>
               </div>
               
               {/* Main Tier Progress Bar */}
               <div className="h-3 w-full bg-slate-200 rounded-full relative overflow-hidden mb-2">
                 <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-900 z-10 opacity-30" 
                    style={{ left: targetMarker }}
                    title={`Target: ${stat.targetPercentage}%`}
                 ></div>
                 <div 
                    className={`h-full rounded-full transition-all duration-1000 ${progressColor} relative`}
                    style={{ width }}
                 ></div>
               </div>

               {/* Expanded Department List */}
               {isExpanded && (
                 <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-1">
                    <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Department Breakdown</h5>
                    
                    {(!stat.departments || stat.departments.length === 0) ? (
                        <p className="text-xs text-slate-400 italic">No departments fall into this asset tier.</p>
                    ) : (
                        <div className="space-y-3">
                            {stat.departments.map(dept => (
                                <div key={dept.id} className="flex items-center gap-3">
                                    <div className="flex-grow min-w-0">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-xs font-bold text-slate-700 truncate">{dept.name}</span>
                                            <span className={`text-[10px] font-bold ${dept.percentage >= stat.targetPercentage ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                {dept.percentage}%
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full ${dept.percentage >= stat.targetPercentage ? 'bg-emerald-400' : 'bg-amber-400'}`}
                                                style={{ width: `${dept.percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 min-w-[60px]">
                                        <div className="text-[9px] text-slate-400 font-mono">
                                            {dept.inspectedAssets.toLocaleString()}/{dept.assets.toLocaleString()} aset
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                 </div>
               )}
             </div>
           );
        })}

        {(!tierStats || tierStats.length === 0) && (
           <div className="text-center py-6 text-slate-400 text-xs italic">
             No KPI tiers configured. Please contact admin.
           </div>
        )}
      </div>
    </div>
  );
};
