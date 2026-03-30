import React, { useState, useMemo } from 'react';
import { Department, AuditGroup } from '../types';
import { Boxes, Check, Loader2, Sparkles, Trash2, Pencil, Users, RotateCcw } from 'lucide-react';

const THRESHOLD_STORAGE_KEY = 'group_builder_threshold';
const MEGA_THRESHOLD_STORAGE_KEY = 'group_builder_mega_threshold';

function loadThreshold(): number {
  return parseInt(localStorage.getItem(THRESHOLD_STORAGE_KEY) || '1000', 10);
}
function saveThreshold(t: number) {
  localStorage.setItem(THRESHOLD_STORAGE_KEY, String(t));
}
function loadMegaThreshold(): number {
  return parseInt(localStorage.getItem(MEGA_THRESHOLD_STORAGE_KEY) || '3000', 10);
}
function saveMegaThreshold(t: number) {
  localStorage.setItem(MEGA_THRESHOLD_STORAGE_KEY, String(t));
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
  const [megaThreshold, setMegaThreshold] = useState<number>(() => loadMegaThreshold());
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

  const handleMegaThresholdChange = (val: number) => {
    setMegaThreshold(val);
    saveMegaThreshold(val);
  };

  const handleRunAutoConsolidate = async () => {
    if (!onAutoConsolidate) return;
    setIsProcessing(true);
    try {
      const megaExcludedIds = departments
        .filter(d => (d.totalAssets || 0) >= megaThreshold)
        .map(d => d.id);
        
      const minAuditors = strictAuditorRule ? 2 : 1;
      await onAutoConsolidate(threshold, megaExcludedIds, minAuditors);
      setBuilderTab(2); // Automatically jump to review tab when finished
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

  // --- UNIFIED ENTITIES LOGIC (Synced with Overview Hub) ---
  const entities = useMemo(() => {
    const map = new Map<string, { 
      name: string, 
      assets: number, 
      auditors: number, 
      memberCount: number, 
      members: Department[], 
      id?: string,
      isConsolidated: boolean 
    }>(); 

    // Only process non-exempted departments
    const activeDepts = departments.filter(d => !d.isExempted);

    activeDepts.forEach(d => {
      const group = d.auditGroupId ? auditGroups.find(g => g.id === d.auditGroupId) : null;
      
      // Determine the canonical ID and name for this entity
      const entityId = group ? group.id : d.id;
      
      // Group Naming Priority:
      // 1. If part of a multi-department group, use Group Name.
      // 2. If it's a standalone group or no group, use Department Full Name.
      const current = map.get(entityId) || { name: '', assets: 0, auditors: 0, memberCount: 0, members: [], id: entityId, isConsolidated: false };
      
      const safeAssets = typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0);

      map.set(entityId, { 
        name: '', // Will finalize after members are gathered
        assets: current.assets + safeAssets,
        auditors: current.auditors + (d.auditorCount || 0),
        memberCount: current.memberCount + 1,
        members: [...current.members, d],
        id: entityId,
        isConsolidated: !!group
      });
    });

    return Array.from(map.values()).map(stats => {
      const group = auditGroups.find(g => g.id === stats.id);
      
      // Naming Logic: Priority to Department Full Name for single-member entities
      const finalName = (stats.memberCount === 1) 
        ? stats.members[0].name 
        : (group ? group.name : stats.members[0].name);

      return { 
        ...stats, 
        name: finalName,
        isGroup: stats.memberCount > 1,
        isConsolidated: stats.memberCount > 1 || !!group
      };
    }).sort((a, b) => b.assets - a.assets);
  }, [departments, auditGroups]);

  const grandTotalAssets = useMemo(() => {
    return entities.reduce((sum, e) => sum + e.assets, 0);
  }, [entities]);

  return (
    <div className="bg-slate-50/50 rounded-[40px] border-2 border-slate-100 p-8 md:p-12 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-14">
        {/* Left Column */}
        <div className="lg:w-1/3 xl:w-1/4 space-y-10">
          <div>
            <div className="w-16 h-16 bg-white border border-slate-100 text-indigo-500 rounded-3xl flex items-center justify-center shadow-sm mb-8">
              <Boxes className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-4">Unit Consolidation</h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
              Manage the institutional audit landscape by grouping departments or reviewing standalone entities.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <button 
              onClick={() => { setBuilderTab(1); setEditingGroupId(null); }}
              className={`flex items-center justify-between w-full px-6 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${builderTab === 1 && !editingGroupId ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/10' : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-4">
                <span className={`w-6 h-6 rounded-lg ${builderTab === 1 ? 'bg-indigo-500 text-white' : 'bg-slate-100'} flex items-center justify-center text-[10px]`}>1</span>
                <span>Auto Generate</span>
              </div>
            </button>
            
            <button 
              onClick={() => { setBuilderTab(2); setEditingGroupId(null); }}
              className={`flex items-center justify-between w-full px-6 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${builderTab === 2 && !editingGroupId ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/10' : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-4">
                <span className={`w-6 h-6 rounded-lg ${builderTab === 2 ? 'bg-indigo-500 text-white' : 'bg-slate-100'} flex items-center justify-center text-[10px]`}>2</span>
                <span>Review & Refine</span>
              </div>
              <span className={`text-[10px] ${builderTab === 2 ? 'bg-white/20' : 'bg-slate-100'} px-2.5 py-1 rounded-lg font-black`}>{entities.length}</span>
            </button>

            {editingGroupId && (
              <button 
                className={`flex items-center justify-between w-full px-6 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all bg-indigo-600 text-white shadow-2xl shadow-indigo-600/20`}
              >
                <div className="flex items-center gap-4">
                  <span className={`w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-[10px]`}>
                    <Pencil className="w-3 h-3"/>
                  </span>
                  <span>Refining {editingGroupObj?.name || entities.find(e => e.id === editingGroupId)?.name}</span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:w-2/3 xl:w-3/4 bg-white rounded-[44px] p-10 md:p-14 border border-slate-100 shadow-sm relative overflow-hidden flex flex-col min-h-[600px]">
           
           {builderTab === 1 && !editingGroupId && (
             <div className="animate-in slide-in-from-right-8 duration-300">
               <h4 className="text-2xl font-black text-slate-900 tracking-tight leading-tight mb-4">Auto-Generate Groups</h4>
               <p className="text-sm font-medium text-slate-500 mb-10 max-w-lg">
                 Set an asset threshold. The system will bundle standalone departments together until they exceed this threshold.
               </p>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
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
                     <label className="text-[10px] font-black text-amber-500 block uppercase tracking-widest">Standalone Cutoff</label>
                     <div className="flex items-center gap-4 bg-amber-50/30 p-6 border border-amber-100 rounded-[28px] focus-within:border-amber-300 transition-all">
                       <Sparkles className="w-7 h-7 text-amber-500" />
                       <input 
                         type="number"
                         min={100}
                         step={100}
                         className="w-full text-3xl font-black text-slate-800 outline-none bg-transparent tabular-nums"
                         value={megaThreshold}
                         onChange={e => handleMegaThresholdChange(parseInt(e.target.value) || 3000)}
                       />
                     </div>
                  </div>
               </div>

               <button 
                 onClick={handleRunAutoConsolidate}
                 disabled={isProcessing || !onAutoConsolidate}
                 className="w-full py-6 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-[28px] text-sm font-black uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-2xl shadow-slate-900/10 active:scale-95 group"
               >
                 {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6 text-indigo-400 group-hover:scale-125 transition-transform" />}
                 Initialize Consolidation
               </button>
             </div>
           )}

           {builderTab === 2 && !editingGroupId && (
             <div className="animate-in slide-in-from-right-8 duration-300 flex flex-col flex-1 h-full">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12 pb-12 border-b border-slate-100">
                  <div className="space-y-3">
                    <h4 className="text-4xl font-black text-slate-900 tracking-tighter leading-[0.9]">
                      Active Entities<br/>
                      <span className="text-slate-400 font-medium text-2xl tracking-normal">(Ranked by Assets)</span>
                    </h4>
                    <div className="flex items-center gap-6">
                       <p className="text-sm font-medium text-slate-400">Live visualization of audit entities and resource strength.</p>
                       <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Updates</span>
                       </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-900 px-10 py-6 rounded-[36px] shadow-2xl flex flex-col items-center min-w-[220px] relative overflow-hidden border border-slate-700">
                       <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-2">Institutional Grand Total</span>
                       <span className="text-4xl font-mono font-black text-white px-2 italic tracking-tighter">{grandTotalAssets.toLocaleString()}</span>
                    </div>
                    
                    <button 
                      onClick={() => window.location.reload()} 
                      className="w-14 h-14 bg-white border-2 border-slate-100 text-slate-300 hover:text-indigo-600 hover:border-indigo-100 hover:bg-slate-50 rounded-2xl transition-all shadow-sm flex items-center justify-center active:scale-90"
                    >
                      <RotateCcw className="w-6 h-6" />
                    </button>
                  </div>
               </div>
               
               <div className="flex-1 min-h-0">
                  {entities.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50/50 rounded-[40px] border-2 border-slate-100 border-dashed group cursor-pointer">
                      <Boxes className="w-12 h-12 text-slate-200 mb-6" />
                      <h5 className="text-xl font-bold text-slate-400">No active entities available.</h5>
                    </div>
                  ) : (
                    <div className="flex gap-6 overflow-x-auto pb-10 pt-4 px-2 custom-scrollbar snap-x snap-mandatory">
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
                             className="bg-white p-10 rounded-[44px] border-2 border-slate-100 shadow-sm flex flex-col min-w-[340px] w-[340px] transition-all hover:border-indigo-200 hover:shadow-2xl hover:bg-slate-50/50 snap-center group relative shrink-0 text-left"
                             onClick={() => setEditingGroupId(e.id || null)}
                           >
                             <div className="flex justify-between items-start mb-10 shrink-0">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Rank #{idx + 1}</span>
                                {e.isConsolidated && (
                                  <div className="px-3.5 py-1.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest italic">
                                    Consolidated Unit
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
                                     className="absolute top-8 right-8 w-10 h-10 rounded-2xl bg-white text-slate-200 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-sm border border-slate-100"
                                   >
                                     <Trash2 className="w-4 h-4" />
                                   </button>
                                )}
                             </div>

                             <h5 className="font-black text-xl text-slate-900 mb-8 tracking-tight shrink-0 h-14 line-clamp-2">{e.name}</h5>
                             
                             <div className="flex flex-wrap gap-2.5 mb-10 grow content-start min-h-[4.5rem]">
                                {e.members.map(m => (
                                  <span key={m.id} className="px-3.5 py-2 bg-slate-100/50 text-slate-600 border border-slate-100 rounded-2xl text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                                    {m.abbr}
                                  </span>
                                ))}
                             </div>

                             <div className="mt-auto pt-10 border-t border-slate-100 flex items-center justify-between shrink-0">
                                <div className="flex flex-col gap-1.5">
                                   <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Assets</span>
                                   <span className="text-2xl font-black text-slate-800 tabular-nums tracking-tighter italic">{e.assets.toLocaleString()}</span>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                   <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Auditors</span>
                                   <div className="flex flex-col items-end">
                                      <div className={`text-2xl font-black tabular-nums transition-colors tracking-tighter ${e.auditors < recAuditors ? 'text-amber-500 underline underline-offset-8 decoration-amber-200' : 'text-slate-800'}`}>
                                        {e.auditors}
                                      </div>
                                      {e.auditors < recAuditors && (
                                        <span className="text-[9px] font-black text-amber-500 mt-2 bg-amber-50 px-2.5 py-1 rounded-lg uppercase tracking-widest border border-amber-100">Rec: {recAuditors}</span>
                                      )}
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
              <div className="animate-in slide-in-from-right-8 duration-300 flex flex-col h-full flex-1">
                {(() => {
                  const currentEntity = entities.find(e => e.id === editingGroupId);
                  if (!currentEntity) return null;

                  return (
                    <>
                      <div className="flex items-center justify-between mb-10 shrink-0">
                        <div>
                          <h4 className="text-2xl font-black text-slate-900 tracking-tight">Refining {currentEntity.name}</h4>
                          <p className="text-sm font-medium text-slate-400 mt-1">Include / exclude departments from this entity.</p>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-3 pr-6 pb-6 custom-scrollbar">
                        {departments.map(dept => {
                          const isChecked = currentEntity.members.some(m => m.id === dept.id);
                          const isAssignedElsewhere = dept.auditGroupId && dept.auditGroupId !== editingGroupId;
                          const otherGroupName = isAssignedElsewhere ? auditGroups.find(g => g.id === dept.auditGroupId)?.name : null;

                          return (
                            <label 
                              key={dept.id} 
                              className={`flex items-center justify-between p-6 rounded-[32px] border-2 transition-all cursor-pointer ${
                                isChecked 
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-600/10 scale-[1.02]' 
                                  : isAssignedElsewhere
                                    ? 'bg-slate-50 border-slate-100 text-slate-300 opacity-50 grayscale'
                                    : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-100 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center gap-4">
                                  <input 
                                    type="checkbox"
                                    className="w-6 h-6 rounded-lg border-slate-200 text-emerald-500 focus:ring-0 focus:ring-offset-0 transition-all cursor-pointer"
                                    checked={isChecked}
                                    onChange={() => handleToggleDeptInGroup(dept.id, isChecked)}
                                    disabled={isProcessing}
                                  />
                                  <div className="flex flex-col">
                                     <span className="text-base font-black tracking-tight">{dept.name}</span>
                                     <span className={`text-[10px] font-black uppercase tracking-widest ${isChecked ? 'text-indigo-200' : 'text-slate-400'}`}>{dept.abbr}</span>
                                  </div>
                                </div>
                                {isAssignedElsewhere && !isChecked && (
                                  <div className="ml-10 mt-3">
                                    <span className="text-[10px] font-black uppercase tracking-tighter text-amber-500 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
                                      Assigned elsewhere
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className={`text-lg font-mono font-black ${isChecked ? 'text-white' : 'text-slate-900'} italic`}>{(dept.totalAssets || 0).toLocaleString()}</span>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${isChecked ? 'text-indigo-200' : 'text-slate-400'}`}>Assets <Boxes className="inline w-2.5 h-2.5 ml-1"/></span>
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      <div className="pt-8 mt-auto shrink-0 border-t border-slate-100">
                        <button 
                          onClick={() => setEditingGroupId(null)}
                          className="w-full h-16 bg-slate-900 hover:bg-slate-800 text-white rounded-[28px] text-xs font-black uppercase tracking-widest flex items-center justify-center transition-all animate-in fade-in"
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
