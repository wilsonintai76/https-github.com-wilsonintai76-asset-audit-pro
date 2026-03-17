
import React, { useMemo, useState } from 'react';
import { AuditPhase, KPITier, Department, AuditSchedule } from '../types';
import { ChevronDown } from 'lucide-react';

interface KPIStatsWidgetProps {
  phases: AuditPhase[];
  kpiTiers: KPITier[];
  departments: Department[];
  schedules: AuditSchedule[];
}

export const KPIStatsWidget: React.FC<KPIStatsWidgetProps> = ({ phases, kpiTiers, departments, schedules }) => {
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

  // 2. Compute Stats per Tier
  const tierStats = useMemo(() => {
    if (!activePhase || !kpiTiers || kpiTiers.length === 0) return [];

    return kpiTiers.map(tier => {
      // Find departments in this tier based on asset count range
      const deptsInTier = departments.filter(d => 
        (d.totalAssets >= tier.minAssets) && (d.totalAssets <= tier.maxAssets)
      );
      
      const targetPercentage = activePhase ? (tier.targets[activePhase.id] || 0) : 0;

      // Calculate details for each department
      const deptDetails = deptsInTier.map(d => {
        const deptSchedules = schedules.filter(s => s.departmentId === d.id);
        const total = deptSchedules?.length || 0;
        const completed = deptSchedules?.filter(s => s.status === 'Completed').length || 0;
        const isZeroAsset = (d.totalAssets || 0) === 0;
        const percentage = isZeroAsset ? 100 : (total > 0 ? Math.round((completed / total) * 100) : 0);
        
        return {
          id: d.id,
          name: d.name,
          assets: d.totalAssets,
          totalAudits: total,
          completedAudits: completed,
          percentage,
          status: (isZeroAsset || percentage >= targetPercentage) ? 'On Track' : 'At Risk'
        };
      }).sort((a, b) => a.percentage - b.percentage); // Sort by lowest completion first (prioritize risk)

      // Aggregate for the Tier Level
      const totalScheduled = deptDetails.reduce((acc, d) => acc + d.totalAudits, 0);
      const totalCompleted = deptDetails.reduce((acc, d) => acc + d.completedAudits, 0);
      const actualPercentage = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;
      
      return {
        ...tier,
        departments: deptDetails,
        deptCount: deptsInTier?.length || 0,
        actualPercentage,
        targetPercentage,
        status: actualPercentage >= targetPercentage ? 'On Track' : 'At Risk'
      };
    }).sort((a,b) => a.minAssets - b.minAssets);
  }, [kpiTiers, departments, schedules, activePhase]);

  const toggleExpand = (id: string) => {
    setExpandedTierId(prev => prev === id ? null : id);
  };

  if (!activePhase) return null;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Phase Completion KPI</h3>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">
            Current Focus: {activePhase.name}
          </p>
        </div>
        <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Phase Ends</p>
            <p className="text-sm font-bold text-slate-700">{activePhase.endDate}</p>
        </div>
      </div>

      <div className="space-y-6">
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
                     {stat.minAssets} - {stat.maxAssets > 1000000 ? '∞' : stat.maxAssets} Assets • {stat.deptCount} Departments
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
                                            {dept.assets.toLocaleString()} Asts
                                        </div>
                                        <div className="text-[9px] text-slate-400">
                                            {dept.completedAudits}/{dept.totalAudits}
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
