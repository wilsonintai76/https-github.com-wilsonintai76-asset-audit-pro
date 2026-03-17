
import React, { useMemo } from 'react';
import { Department, KPITier, AuditPhase, AuditSchedule } from '../types';
import { Boxes, Layers, CheckCircle2, AlertCircle } from 'lucide-react';

interface TierDistributionTableProps {
  departments: Department[];
  kpiTiers: KPITier[];
  phases: AuditPhase[];
  schedules: AuditSchedule[];
}

export const TierDistributionTable: React.FC<TierDistributionTableProps> = ({ 
  departments, 
  kpiTiers, 
  phases,
  schedules 
}) => {
  const sortedPhases = useMemo(() => [...phases].sort((a, b) => a.startDate.localeCompare(b.startDate)), [phases]);
  const sortedTiers = useMemo(() => [...kpiTiers].sort((a, b) => a.minAssets - b.minAssets), [kpiTiers]);

  const tableData = useMemo(() => {
    return departments.map(dept => {
      const tier = sortedTiers.find(t => (dept.totalAssets || 0) >= t.minAssets && (dept.totalAssets || 0) <= t.maxAssets);
      const deptAudits = schedules.filter(s => s.departmentId === dept.id);
      
      const phaseStatus = sortedPhases.map(phase => {
        const hasAudit = deptAudits.some(a => a.phaseId === phase.id);
        const isRequired = (dept.totalAssets || 0) > 0 ? (tier ? (tier.targets[phase.id] || 0) > 0 : false) : false;
        const isCompleted = deptAudits.some(a => a.phaseId === phase.id && a.status === 'Completed');
        
        return {
          phaseId: phase.id,
          hasAudit,
          isRequired,
          isCompleted
        };
      });

      const isFullyScheduled = phaseStatus.every(p => !p.isRequired || p.hasAudit);
      
      return {
        ...dept,
        tierName: tier?.name || 'Unassigned',
        phaseStatus,
        isFullyScheduled
      };
    }).sort((a, b) => (b.totalAssets || 0) - (a.totalAssets || 0));
  }, [departments, sortedTiers, sortedPhases, schedules]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Tier Distribution & Scheduling</h3>
          <p className="text-xs text-slate-500 mt-1">Status of audits across required phases per department tier.</p>
        </div>
        <div className="flex gap-4">
           <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Audit Scheduled</span>
           </div>
           <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-slate-200"></div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Not Required</span>
           </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Department</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Assets / Tier</th>
              {sortedPhases.map(phase => (
                <th key={phase.id} className="px-4 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">
                  {phase.name}
                </th>
              ))}
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {tableData.map(row => (
              <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900 text-sm">{row.name}</div>
                  <div className="text-[10px] text-slate-400 font-medium">{row.abbr}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Boxes className="w-3 h-3 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">{(row.totalAssets || 0).toLocaleString()}</span>
                  </div>
                  <div className="inline-flex px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase rounded border border-blue-100 tracking-tighter">
                    {row.tierName}
                  </div>
                </td>
                {row.phaseStatus.map((ps, idx) => (
                  <td key={idx} className="px-4 py-4 text-center">
                    {ps.isRequired ? (
                      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border-2 transition-all ${
                        ps.isCompleted 
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                          : ps.hasAudit 
                          ? 'bg-blue-50 border-blue-200 text-blue-600' 
                          : 'bg-rose-50 border-rose-100 text-rose-400 border-dashed'
                      }`}>
                        {ps.isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 mx-auto opacity-30"></div>
                    )}
                  </td>
                ))}
                <td className="px-6 py-4 text-right">
                  {row.isFullyScheduled ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase">
                      <CheckCircle2 className="w-3 h-3" /> Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-600 uppercase">
                      <AlertCircle className="w-3 h-3" /> Incomplete
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
