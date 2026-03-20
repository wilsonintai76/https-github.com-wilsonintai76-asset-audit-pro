
import React from 'react';
import { Department, AuditGroup } from '../types';

interface InstitutionalConsolidationViewProps {
  departments: Department[];
  auditGroups: AuditGroup[];
  title?: string;
  subtitle?: string;
  isDark?: boolean;
}

export const InstitutionalConsolidationView: React.FC<InstitutionalConsolidationViewProps> = ({
  departments,
  auditGroups,
  title = "Institutional Consolidation View",
  subtitle = "Departmental grouping and asset accumulation summary.",
  isDark = false
}) => {
  // Group departments by their audit group
  const groupedData = React.useMemo(() => {
    const groups = auditGroups.map(group => {
      const groupDepts = departments.filter(d => d.auditGroupId === group.id || d.auditGroup === group.name);
      const subTotal = groupDepts.reduce((sum, d) => sum + (typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0)), 0);
      return {
        ...group,
        departments: groupDepts,
        subTotal
      };
    });

    // Also include departments not in any group
    const unassignedDepts = departments.filter(d => !d.auditGroupId && !d.auditGroup);
    
    return {
      groups,
      unassignedDepts
    };
  }, [departments, auditGroups]);

  return (
    <div className={`space-y-8 ${isDark ? 'text-white' : ''}`}>
      <div>
        <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</p>
      </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {groupedData.groups.map((group, idx) => (
        <div 
          key={group.id} 
          className={`group flex flex-col border-2 border-slate-900 rounded-[28px] overflow-hidden ${
            isDark ? 'bg-slate-800' : 'bg-white'
          } shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[12px_12px_0px_0px_rgba(15,23,42,1)] transition-all duration-300`}
        >
          {/* Card Header: Group Identity */}
          <div className="p-6 border-b-2 border-slate-900 bg-yellow-400 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900/60 leading-none mb-1">Audit Unit</span>
              <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">{group.name}</h4>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-inner">
              {idx + 1}
            </div>
          </div>

          {/* Card Body: Assets Focus */}
          <div className="p-6 flex-1 flex flex-col space-y-4">
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest mb-1">Consolidated Assets</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-black text-slate-900 tracking-tighter">
                  {group.subTotal.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase">Total Units</span>
              </div>
            </div>

            {/* Members List */}
            <div className={`rounded-2xl p-4 border-2 border-slate-100 ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Member Departments</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[9px] font-bold">{group.departments.length}</span>
              </div>
              
              <div className="space-y-2">
                {group.departments.map(dept => (
                  <div key={dept.id} className="flex justify-between items-center gap-4">
                    <span className="text-xs font-bold text-slate-700 truncate">{dept.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                       <span className="text-[9px] font-mono text-slate-400">Assets:</span>
                       <span className="text-[10px] font-black text-slate-900">
                         {(typeof dept.totalAssets === 'string' ? parseInt(dept.totalAssets) : (dept.totalAssets || 0)).toLocaleString()}
                       </span>
                    </div>
                  </div>
                ))}
                {group.departments.length === 0 && (
                  <div className="text-center py-4 text-[11px] text-slate-400 italic">No units assigned</div>
                )}
              </div>
            </div>
          </div>

          {/* Card Footer: Summary Stats */}
          <div className="bg-slate-900 p-4 flex justify-between items-center">
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Consolidation</span>
             </div>
             <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-bold text-slate-500 uppercase">Coverage</span>
                  <span className="text-xs font-black text-white italic">HIGH</span>
                </div>
             </div>
          </div>
        </div>
      ))}

      {/* Unassigned Section Treated as a Subtle Card */}
      {groupedData.unassignedDepts.length > 0 && (
        <div className="flex flex-col border-2 border-dashed border-slate-300 rounded-[28px] overflow-hidden bg-slate-50/50 p-6 opacity-60 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center font-black text-slate-400">?</div>
            <div>
              <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest">Unassigned Units</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Awaiting Consolidation</p>
            </div>
          </div>
          
          <div className="space-y-3">
            {groupedData.unassignedDepts.map(dept => (
              <div key={dept.id} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-xs font-bold text-slate-600 truncate">{dept.name}</span>
                <span className="text-[10px] font-black text-slate-900">
                  {(typeof dept.totalAssets === 'string' ? parseInt(dept.totalAssets) : (dept.totalAssets || 0)).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </div>
  );
};
