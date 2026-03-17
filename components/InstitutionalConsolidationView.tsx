
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groupedData.groups.map((group, idx) => (
          <div key={group.id} className={`flex border-2 border-slate-900 rounded-lg overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm hover:shadow-md transition-shadow`}>
            {/* Group Label Side */}
            <div className={`w-24 ${isDark ? 'bg-slate-700' : 'bg-white'} border-r-2 border-slate-900 flex items-center justify-center`}>
              <span className={`text-6xl font-black ${isDark ? 'text-blue-400' : 'text-slate-900'}`}>{group.name.replace('Group ', '')}</span>
            </div>

            {/* Table side */}
            <div className="flex-1 flex flex-col">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-yellow-400 border-b-2 border-slate-900">
                    <th className="px-3 py-2 font-black text-slate-900 border-r-2 border-slate-900 uppercase">Department</th>
                    <th className="px-3 py-2 font-black text-slate-900 text-right uppercase">Total Asset</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-200'}`}>
                  {group.departments.map(dept => (
                    <tr key={dept.id}>
                      <td className={`px-3 py-2 font-bold border-r-2 border-slate-900 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{dept.name}</td>
                      <td className={`px-3 py-2 font-mono text-right ${isDark ? 'text-white' : 'text-slate-900'}`}>{(typeof dept.totalAssets === 'string' ? parseInt(dept.totalAssets) : (dept.totalAssets || 0)).toLocaleString()}</td>
                    </tr>
                  ))}
                  {group.departments.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-8 text-center text-slate-400 italic">No units assigned</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className={`${isDark ? 'bg-slate-900' : 'bg-slate-100'} border-t-2 border-slate-900`}>
                    <td className={`px-3 py-2 font-black uppercase border-r-2 border-slate-900 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>Sub Total</td>
                    <td className={`px-3 py-2 font-black text-right text-sm ${isDark ? 'text-blue-300' : 'text-slate-900'}`}>{group.subTotal.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}

        {groupedData.unassignedDepts.length > 0 && (
          <div className="flex border-2 border-dashed border-slate-300 rounded-lg overflow-hidden bg-slate-50 text-slate-400">
            <div className="w-24 border-r-2 border-dashed border-slate-300 flex items-center justify-center opacity-50">
               <span className="text-4xl font-black italic">?</span>
            </div>
            <div className="flex-1 flex flex-col">
               <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-200 border-b-2 border-dashed border-slate-300">
                    <th className="px-3 py-2 font-black text-slate-500 border-r-2 border-dashed border-slate-300 uppercase">Department</th>
                    <th className="px-3 py-2 font-black text-slate-500 text-right uppercase">Total Asset</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedData.unassignedDepts.map(dept => (
                    <tr key={dept.id} className="border-b border-dashed border-slate-200">
                      <td className="px-3 py-2 font-bold border-r-2 border-dashed border-slate-300">{dept.name}</td>
                      <td className="px-3 py-2 font-mono text-right">{(typeof dept.totalAssets === 'string' ? parseInt(dept.totalAssets) : (dept.totalAssets || 0)).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
