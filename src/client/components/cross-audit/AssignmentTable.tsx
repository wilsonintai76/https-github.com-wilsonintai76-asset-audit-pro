import React from 'react';
import { ArrowRightLeft, ArrowRight, X, Trash2 } from 'lucide-react';

interface AssignmentTableProps {
  filteredPermissions: any[];
  entities: any[];
  isSimulatorActive: boolean;
  auditorFilter: string;
  setAuditorFilter: (v: string) => void;
  targetFilter: string;
  setTargetFilter: (v: string) => void;
  onToggleMutual: (p: any) => void;
  onUpdateTarget: (p: any, newTgtId: string) => void;
  onDeleteRow: (p: any) => void;
  onBulkRemove: (ids: string[]) => void;
}

export const AssignmentTable: React.FC<AssignmentTableProps> = ({
  filteredPermissions,
  entities,
  isSimulatorActive,
  auditorFilter,
  setAuditorFilter,
  targetFilter,
  setTargetFilter,
  onToggleMutual,
  onUpdateTarget,
  onDeleteRow,
  onBulkRemove
}) => {
  return (
    <div>
       <div className="flex items-center justify-between mb-6">
          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isSimulatorActive ? 'Simulated Assignments (Draft)' : 'Current Assignment Links'}</h4>
          <div className="flex gap-2">
             <input type="text" placeholder="Auditor..." className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none w-32" value={auditorFilter} onChange={(e) => setAuditorFilter(e.target.value)} />
             <input type="text" placeholder="Target..." className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none w-32" value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)} />
          </div>
       </div>

       <div className="bg-white border border-slate-200 rounded-[24px] overflow-hidden">
          <table className="w-full text-left border-collapse">
             <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                   <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Inspecting Entity</th>
                   <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Flow</th>
                   <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Target Entity</th>
                   <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Action</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                {filteredPermissions.length === 0 ? (
                  <tr><td colSpan={4} className="py-16 text-center text-slate-400 text-xs font-medium italic">No assignments generated. Click "Run Auto-Pairing" to begin.</td></tr>
                ) : filteredPermissions.map((p, idx) => {
                  const aud = entities.find(e => e.id === p.auditorEntityId);
                  const tgt = entities.find(e => e.id === p.targetEntityId);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-all group">
                      <td className="px-6 py-4">
                         <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-800">{aud?.name || 'Unknown'}</span>
                           {aud && <span className="text-[10px] font-bold text-indigo-400">{aud.auditors} Staff Registered</span>}
                         </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {isSimulatorActive ? (
                             <button 
                              onClick={() => onToggleMutual(p)}
                              className={`inline-flex p-1.5 rounded-lg transition-all ${p.isMutual ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                              title={p.isMutual ? 'Switch to Directed' : 'Switch to Mutual'}
                             >
                               {p.isMutual ? <ArrowRightLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                             </button>
                           ) : (
                             <div className="inline-flex p-1.5 bg-slate-100 rounded-lg text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-500 transition-all">
                               {p.isMutual ? <ArrowRightLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                             </div>
                           )}
                           {aud && tgt && (
                             <span className={`text-[8px] font-black uppercase ${((tgt.assets || 1) / (aud.auditors || 1)) < 250 ? 'text-emerald-500' : 'text-amber-500'}`}>
                               {((tgt.assets || 1) / (aud.auditors || 1)) < 250 ? 'Balanced' : 'High Load'}
                             </span>
                           )}
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex flex-col">
                            {isSimulatorActive ? (
                              <select 
                                value={p.targetEntityId} 
                                onChange={(e) => onUpdateTarget(p, e.target.value)}
                                className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                              >
                                {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                              </select>
                            ) : (
                              <span className="text-sm font-black text-slate-800">{tgt?.name || 'Unknown'}</span>
                            )}
                           {tgt && <span className="text-[10px] font-bold text-emerald-500">{tgt.assets?.toLocaleString()} Total Assets</span>}
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         {isSimulatorActive ? (
                           <button 
                            onClick={() => onDeleteRow(p)} 
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                           >
                             <X className="w-4 h-4" />
                           </button>
                         ) : (
                           <button onClick={() => onBulkRemove(p.rawPermIds)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                         )}
                      </td>
                    </tr>
                  )
                })}
             </tbody>
          </table>
       </div>
    </div>
  );
};
