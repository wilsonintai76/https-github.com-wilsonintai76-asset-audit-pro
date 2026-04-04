import React, { useState, useMemo } from 'react';
import { Department, AuditGroup } from '../types';
import { Boxes, Check, Loader2, Sparkles, Trash2, Pencil, Users, RotateCcw } from 'lucide-react';

const THRESHOLD_STORAGE_KEY = 'group_builder_threshold';
const STANDALONE_CUTOFF_KEY = 'group_builder_standalone_cutoff';

function loadThreshold(): number {
  return parseInt(localStorage.getItem(THRESHOLD_STORAGE_KEY) || '1000', 10);
}
function saveThreshold(t: number) {
  localStorage.setItem(THRESHOLD_STORAGE_KEY, String(t));
}
function loadStandaloneCutoff(): number {
  return parseInt(localStorage.getItem(STANDALONE_CUTOFF_KEY) || '300', 10);
}
function saveStandaloneCutoff(t: number) {
  localStorage.setItem(STANDALONE_CUTOFF_KEY, String(t));
}

interface GroupBuilderTabProps {
  departments: Department[];
  auditGroups: AuditGroup[];
  onAutoConsolidate?: (threshold: number, excludedIds: string[], minAuditors: number) => Promise<void>;
  onAddAuditGroup?: (group: Omit<AuditGroup, 'id'>) => Promise<AuditGroup | null>;
  onDeleteAuditGroup?: (id: string) => Promise<void>;
  onBulkUpdateDepartments: (updates: { id: string, data: Partial<Department> }[]) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  strictAuditorRule: boolean;
  setStrictAuditorRule: (val: boolean) => void;
  maxAssetsPerDay?: number;
  maxLocationsPerDay?: number;
}

export const GroupBuilderTab: React.FC<GroupBuilderTabProps> = ({
  departments,
  auditGroups,
  onAutoConsolidate,
  onDeleteAuditGroup,
  onBulkUpdateDepartments,
  isProcessing,
  setIsProcessing,
  strictAuditorRule,
  setStrictAuditorRule,
  maxAssetsPerDay = 1000,
  maxLocationsPerDay = 5
}) => {
  const [builderTab, setBuilderTab] = useState<1 | 2>(1);
  const [threshold, setThreshold] = useState<number>(() => loadThreshold());
  const [standaloneCutoff, setStandaloneCutoff] = useState<number>(() => loadStandaloneCutoff());
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // Derive which departments are currently locked into the editing group
  const editingGroupDepts = useMemo(() => {
    if (!editingGroupId) return [];
    return departments.filter(d => d.auditGroupId === editingGroupId).map(d => d.id);
  }, [departments, editingGroupId]);

  const handleThresholdChange = (val: number) => {
    setThreshold(val);
    saveThreshold(val);
  };

  const handleStandaloneCutoffChange = (val: number) => {
    setStandaloneCutoff(val);
    saveStandaloneCutoff(val);
  };

  const handleRunAutoConsolidate = async () => {
    if (!onAutoConsolidate) return;
    setIsProcessing(true);
    try {
      // Departments ABOVE the standalone cutoff are exempt — they're large enough to self-audit
      const standaloneExemptIds = departments
        .filter(d => (d.totalAssets || 0) >= standaloneCutoff)
        .map(d => d.id);

      const minAuditors = strictAuditorRule ? 2 : 1;
      await onAutoConsolidate(threshold, standaloneExemptIds, minAuditors);
      setBuilderTab(2);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleDeptInGroup = async (deptId: string, currentlyInGroup: boolean) => {
    if (!editingGroupId) return;
    setIsProcessing(true);
    try {
      await onBulkUpdateDepartments([{
        id: deptId,
        data: { auditGroupId: currentlyInGroup ? null : editingGroupId }
      }]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const editingGroupObj = auditGroups.find(g => g.id === editingGroupId);

  const entities = useMemo(() => {
    const groupedDepts: Record<string, Department[]> = {};

    // Show all non-exempted departments in groups
    // Standalone-exempt (small) departments appear as their own solo entity
    departments.filter(d => !d.isExempted).forEach(dept => {
      const key = dept.auditGroupId || 'unassigned_' + dept.id;
      if (!groupedDepts[key]) groupedDepts[key] = [];
      groupedDepts[key].push(dept);
    });

    const result = Object.entries(groupedDepts).map(([groupId, depts]) => {
      const isUnassigned = groupId.startsWith('unassigned_');
      const totalAssets = depts.reduce((sum, d) => sum + (typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0)), 0);
      const totalAuditors = depts.reduce((sum, d) => sum + (d.auditorCount || 0), 0);
      const name = isUnassigned
        ? depts[0].name
        : auditGroups.find(g => g.id === groupId)?.name || 'Unknown Group';
      const isStandaloneExempt = isUnassigned && totalAssets >= standaloneCutoff;

      return {
        name,
        assets: totalAssets,
        auditors: totalAuditors,
        memberCount: depts.length,
        isJoint: !isUnassigned,
        isConsolidated: !isUnassigned,
        isStandaloneExempt,
        id: groupId,
        members: depts,
        isGroup: depts.length > 1
      };
    }).sort((a, b) => b.assets - a.assets);

    return result;
  }, [departments, auditGroups, standaloneCutoff]);

  const grandTotalAssets = useMemo(() => {
    return entities.reduce((sum, e) => sum + e.assets, 0);
  }, [entities]);

  return (
    <div className="bg-slate-50/50 rounded-[40px] border-2 border-slate-100 p-8 md:p-12 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-14">
        {/* Left Column - Slimmer Sidebar */}
        <div className="lg:w-1/4 xl:w-1/5 space-y-8">
          <div>
            <div className="w-16 h-16 bg-white border border-slate-100 text-indigo-500 rounded-3xl flex items-center justify-center shadow-sm mb-8">
              <Boxes className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-4">Unit Consolidation</h3>
            <p className="text-slate-500 text-xs font-medium leading-relaxed mb-8">
              Manage the institutional audit landscape by grouping departments or reviewing standalone entities.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={() => { setBuilderTab(1); setEditingGroupId(null); }}
              className={`group flex items-center justify-between w-full px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${builderTab === 1 && !editingGroupId ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/10' : 'bg-white text-slate-500 border border-slate-100 hover:border-indigo-100'}`}
            >
              <div className="flex items-center gap-4">
                <span className={`w-7 h-7 rounded-lg ${builderTab === 1 ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'} flex items-center justify-center text-[10px] transition-colors`}>1</span>
                <span>Strategy Design</span>
              </div>
              <Sparkles className={`w-3.5 h-3.5 transition-all ${builderTab === 1 ? 'text-indigo-400 scale-110' : 'text-slate-200 group-hover:text-indigo-300'}`} />
            </button>
            
            <button 
              onClick={() => { setBuilderTab(2); setEditingGroupId(null); }}
              className={`group flex items-center justify-between w-full px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${builderTab === 2 && !editingGroupId ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/10' : 'bg-white text-slate-500 border border-slate-100 hover:border-indigo-100'}`}
            >
              <div className="flex items-center gap-4">
                <span className={`w-7 h-7 rounded-lg ${builderTab === 2 ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'} flex items-center justify-center text-[10px] transition-colors`}>2</span>
                <span>Unit Inventory</span>
              </div>
              <div className={`px-2 py-0.5 rounded-lg font-black text-[9px] transition-colors ${builderTab === 2 ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'}`}>
                {entities.length}
              </div>
            </button>

            {editingGroupId && (
              <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                <div className="bg-indigo-600 text-white rounded-2xl p-5 shadow-2xl shadow-indigo-600/20 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-125 transition-transform">
                    <Pencil className="w-10 h-10" />
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-200 mb-2">Refining</p>
                  <h4 className="text-xs font-black tracking-tight line-clamp-2">
                    {editingGroupObj?.name || entities.find(e => e.id === editingGroupId)?.name}
                  </h4>
                  <button 
                    onClick={() => setEditingGroupId(null)}
                    className="mt-4 w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                  >
                    Finish Revision
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Containerized with scrolling */}
        <div className="lg:w-3/4 xl:w-4/5 bg-white rounded-[44px] p-8 md:p-10 border border-slate-100 shadow-sm relative overflow-hidden flex flex-col h-[700px] max-h-[85vh]">
           
           {builderTab === 1 && !editingGroupId && (
             <div className="animate-in slide-in-from-right-8 duration-300">
               <h4 className="text-xl font-black text-slate-900 tracking-tight leading-tight mb-2 px-2">Auto-Generate Groups</h4>
               <p className="text-xs font-medium text-slate-500 mb-8 max-w-lg px-2">
                 Set an asset threshold. The system will bundle standalone departments together until they exceed this threshold.
               </p>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 px-2">
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                       <label className="text-[10px] font-black text-slate-400 block uppercase tracking-widest">Asset Threshold</label>
                       <label className="flex items-center gap-2 cursor-pointer group">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Strict Rule</span>
                         <input 
                           type="checkbox" 
                           className="sr-only peer" 
                           checked={strictAuditorRule}
                           onChange={() => setStrictAuditorRule(!strictAuditorRule)}
                         />
                         <div className="w-8 h-4 bg-slate-100 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-full relative"></div>
                       </label>
                     </div>
                     <div className="flex items-center gap-4 bg-slate-50 p-6 border border-slate-100 rounded-[28px] focus-within:border-indigo-300 transition-all">
                       <Boxes className="w-7 h-7 text-indigo-400" />
                       <input 
                         type="number"
                         min={100}
                         step={100}
                         className="w-full text-3xl font-black text-slate-800 outline-none bg-transparent tabular-nums"
                         value={threshold}
                         onChange={e => handleThresholdChange(parseInt(e.target.value) || 1000)}
                       />
                     </div>
                  </div>

                  <div className="space-y-4">
                     <label className="text-[10px] font-black text-amber-500 block uppercase tracking-widest">Large Dept Exemption Cutoff</label>
                     <p className="text-[10px] text-slate-400 leading-relaxed -mt-2">
                       Departments <strong>at or above</strong> this asset count are considered standalone — exempt from group forming as they can self-audit.
                     </p>
                     <div className="flex items-center gap-4 bg-amber-50/30 p-6 border border-amber-100 rounded-[28px] focus-within:border-amber-300 transition-all">
                       <Sparkles className="w-7 h-7 text-amber-500" />
                       <input 
                         type="number"
                         min={0}
                         step={100}
                         className="w-full text-3xl font-black text-slate-800 outline-none bg-transparent tabular-nums"
                         value={standaloneCutoff}
                         onChange={e => handleStandaloneCutoffChange(parseInt(e.target.value) || 0)}
                       />
                     </div>
                  </div>
               </div>

               <button 
                 onClick={handleRunAutoConsolidate}
                 disabled={isProcessing || !onAutoConsolidate}
                 className="mx-2 w-[calc(100%-1rem)] py-5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-[24px] text-xs font-black uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-2xl shadow-slate-900/10 active:scale-95 group"
               >
                 {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 text-indigo-400 group-hover:scale-125 transition-transform" />}
                 Initialize Consolidation
               </button>
             </div>
           )}

           {builderTab === 2 && !editingGroupId && (
             <div className="animate-in slide-in-from-right-8 duration-300 flex flex-col flex-1 h-full min-h-0">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 pb-8 border-b border-slate-100 flex-shrink-0">
                  <div className="space-y-2">
                    <h4 className="text-3xl font-black text-slate-900 tracking-tighter leading-[0.9]">
                      Active Entities<br/>
                      <span className="text-slate-400 font-medium text-xl tracking-normal">(Ranked by Assets)</span>
                    </h4>
                    <div className="flex items-center gap-4">
                       <p className="text-xs font-medium text-slate-400">Live visualization of audit strength.</p>
                       <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Updates</span>
                       </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-900 px-8 py-5 rounded-[28px] shadow-2xl flex flex-col items-center min-w-[180px] relative overflow-hidden border border-slate-700">
                       <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest mb-1">Institutional Total</span>
                       <span className="text-3xl font-mono font-black text-white px-2 italic tracking-tighter">{grandTotalAssets.toLocaleString()}</span>
                    </div>
                    
                    <button 
                      onClick={() => window.location.reload()} 
                      className="w-12 h-12 bg-white border-2 border-slate-100 text-slate-300 hover:text-indigo-600 hover:border-indigo-100 hover:bg-slate-50 rounded-xl transition-all shadow-sm flex items-center justify-center active:scale-90"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </div>
               </div>
               
               <div className="flex-1 min-h-0 overflow-hidden">
                  {entities.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50/50 rounded-[40px] border-2 border-slate-100 border-dashed group cursor-pointer">
                      <Boxes className="w-10 h-10 text-slate-200 mb-4" />
                      <h5 className="text-lg font-bold text-slate-400">No active entities available.</h5>
                    </div>
                  ) : (
                    <div className="flex gap-6 overflow-x-auto pb-10 pt-4 px-2 custom-scrollbar snap-x snap-mandatory h-full">
                      {entities.map((e, idx) => {
                         const effectiveMaxAssets = maxAssetsPerDay || 1000;
                         const effectiveMaxLocations = maxLocationsPerDay || 5;
                         const recAuditors = Math.max(2, 
                           Math.ceil(e.assets / effectiveMaxAssets), 
                           Math.ceil(e.memberCount / effectiveMaxLocations)
                         );

                         return (
                           <button 
                             key={e.id} 
                             className="bg-white p-8 rounded-[36px] border-2 border-slate-100 shadow-sm flex flex-col min-w-[300px] w-[300px] transition-all hover:border-indigo-200 hover:shadow-2xl hover:bg-slate-50/50 snap-center group relative shrink-0 text-left overflow-hidden h-fit mb-4"
                             onClick={() => setEditingGroupId(e.id || null)}
                           >
                             {/* Asset Power Meter (Vertical) */}
                             <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-50 overflow-hidden">
                                <div 
                                  className="absolute bottom-0 left-0 right-0 bg-indigo-500/20 group-hover:bg-indigo-500 transition-all duration-700"
                                  style={{ height: `${Math.min(100, (e.assets / (grandTotalAssets / entities.length || 1)) * 50)}%` }}
                                ></div>
                             </div>

                             <div className="flex justify-between items-start mb-8 shrink-0">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">Rank #{idx + 1}</span>
                                  <div className="flex gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Active System ID</span>
                                  </div>
                                </div>
                                {e.isConsolidated && (
                                  <div className="px-2.5 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest italic flex items-center gap-1.5 translate-x-1">
                                    <Boxes className="w-2.5 h-2.5" />
                                    Group
                                  </div>
                                )}
                                {!e.isConsolidated && e.isStandaloneExempt && (
                                  <div className="px-2.5 py-1 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg text-[8px] font-black uppercase tracking-widest italic flex items-center gap-1.5">
                                    Standalone
                                  </div>
                                )}
                                {e.isGroup && onDeleteAuditGroup && (
                                  <button 
                                     onClick={(e_stop) => {
                                       e_stop.stopPropagation();
                                       if (confirm(`Dissolve entity "${e.name}"?`) && onDeleteAuditGroup && e.id) {
                                         onDeleteAuditGroup(e.id);
                                       }
                                     }}
                                     className="absolute top-8 right-8 w-9 h-9 rounded-xl bg-white text-slate-200 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-sm border border-slate-100 scale-90"
                                   >
                                     <Trash2 className="w-4 h-4" />
                                   </button>
                                )}
                             </div>

                             <h5 className="font-black text-lg text-slate-900 mb-6 tracking-tight shrink-0 h-11 line-clamp-2 pr-4">{e.name}</h5>
                             
                             <div className="flex flex-wrap gap-2 mb-8 grow content-start min-h-[4rem]">
                                {e.members.map(m => (
                                  <span key={m.id} className="px-3 py-1 bg-slate-50 text-slate-500 border border-slate-200/50 rounded-xl text-[8px] font-bold uppercase tracking-wider transition-all group-hover:bg-white group-hover:border-indigo-100">
                                    {m.abbr}
                                  </span>
                                ))}
                             </div>

                             <div className="mt-auto pt-6 border-t border-slate-100 grid grid-cols-2 gap-4 shrink-0">
                                <div className="flex flex-col gap-1">
                                   <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Assets</span>
                                   <span className="text-xl font-black text-slate-800 tabular-nums tracking-tighter italic">
                                     {e.assets.toLocaleString()}
                                   </span>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                   <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Officers</span>
                                   <div className="flex flex-col items-end">
                                      <div className={`text-xl font-black tabular-nums transition-colors tracking-tighter flex items-center gap-1.5 ${e.auditors < recAuditors ? 'text-amber-500' : 'text-slate-800'}`}>
                                        {e.auditors}
                                        <Users className="w-3.5 h-3.5 opacity-20" />
                                      </div>
                                   </div>
                                </div>
                             </div>
                           </button>
                         );
                      })}
                    </div>
                  )}
               </div>
             </div>
           )}

           {editingGroupId && (
              <div className="animate-in slide-in-from-right-8 duration-300 flex flex-col h-full flex-1 min-h-0">
                {(() => {
                  const currentEntity = entities.find(e => e.id === editingGroupId);
                  if (!currentEntity) return null;

                  return (
                    <>
                      <div className="flex items-center justify-between mb-8 shrink-0">
                        <div>
                          <h4 className="text-2xl font-black text-slate-900 tracking-tight">Refining {currentEntity.name}</h4>
                          <p className="text-xs font-medium text-slate-400 mt-1">Include / exclude departments from this entity.</p>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-2.5 pr-4 pb-6 custom-scrollbar min-h-0">
                        {departments.map(dept => {
                          const isChecked = currentEntity.members.some(m => m.id === dept.id);
                          const isAssignedElsewhere = dept.auditGroupId && dept.auditGroupId !== editingGroupId;
                          const otherGroupName = isAssignedElsewhere ? auditGroups.find(g => g.id === dept.auditGroupId)?.name : null;

                          return (
                            <label 
                              key={dept.id} 
                              className={`flex items-center justify-between p-5 rounded-[28px] border-2 transition-all cursor-pointer ${
                                isChecked 
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-600/10 scale-[1.01]' 
                                  : isAssignedElsewhere
                                    ? 'bg-slate-50 border-slate-100 text-slate-300 opacity-50 grayscale'
                                    : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-100 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center gap-4">
                                  <input 
                                    type="checkbox"
                                    className="w-5 h-5 rounded-lg border-slate-200 text-emerald-500 focus:ring-0 focus:ring-offset-0 transition-all cursor-pointer"
                                    checked={isChecked}
                                    onChange={() => handleToggleDeptInGroup(dept.id, isChecked)}
                                    disabled={isProcessing}
                                  />
                                  <div className="flex flex-col">
                                     <span className="text-sm font-black tracking-tight">{dept.name}</span>
                                     <span className={`text-[9px] font-black uppercase tracking-widest ${isChecked ? 'text-indigo-200' : 'text-slate-400'}`}>{dept.abbr}</span>
                                  </div>
                                </div>
                                {isAssignedElsewhere && !isChecked && (
                                  <div className="ml-9 mt-2">
                                    <span className="text-[8px] font-black uppercase tracking-tighter text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                                      Assigned elsewhere
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className={`text-base font-mono font-black ${isChecked ? 'text-white' : 'text-slate-900'} italic`}>{(dept.totalAssets || 0).toLocaleString()}</span>
                                <span className={`text-[8px] font-black uppercase tracking-widest ${isChecked ? 'text-indigo-200' : 'text-slate-400'}`}>Assets <Boxes className="inline w-2 h-2 ml-1"/></span>
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      <div className="pt-6 mt-auto shrink-0 border-t border-slate-100">
                        <button 
                          onClick={() => setEditingGroupId(null)}
                          className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-[24px] text-xs font-black uppercase tracking-widest flex items-center justify-center transition-all animate-in fade-in"
                        >
                          Finish Revision
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
           )}

        </div>
      </div>
    </div>
  );
};
