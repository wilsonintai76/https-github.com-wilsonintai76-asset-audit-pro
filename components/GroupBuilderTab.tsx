import React, { useState, useMemo } from 'react';
import { Department, AuditGroup } from '../types';
import { Boxes, Check, Loader2, Sparkles, Trash2, Pencil, Users } from 'lucide-react';

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
  onAutoConsolidate?: (threshold: number, excludedIds: string[]) => Promise<void>;
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
      alert("Failed to update department grouping.");
    } finally {
      setIsProcessing(false);
    }
  };

  const editingGroupObj = auditGroups.find(g => g.id === editingGroupId);

  return (
    <div className="bg-white rounded-[40px] border-2 border-slate-200 p-8 md:p-12 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        {/* Left Column: Context & Tabs */}
        <div className="lg:w-1/3 space-y-8">
          <div>
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl mb-6">
              <Boxes className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-4">Unit Consolidation</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Automatically group smaller departments into mega-units based on accumulated assets before pairing them for cross-audits.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button 
              onClick={() => { setBuilderTab(1); setEditingGroupId(null); }}
              className={`flex items-center justify-between w-full px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${builderTab === 1 && !editingGroupId ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10 scale-105' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
            >
              <span className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span> Auto Generate</span>
            </button>
            
            <button 
              onClick={() => { setBuilderTab(2); setEditingGroupId(null); }}
              className={`flex items-center justify-between w-full px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${builderTab === 2 && !editingGroupId ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10 scale-105' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
            >
              <span className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span> Review & Refine</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{auditGroups.length}</span>
            </button>

            {editingGroupId && (
              <button 
                className={`flex items-center justify-between w-full px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 scale-105`}
              >
                <span className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px]"><Pencil className="w-3 h-3"/></span> Editing {editingGroupObj?.name}</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Active Tab Content */}
        <div className="lg:w-2/3 bg-slate-50 rounded-[32px] p-8 md:p-10 border border-slate-100 relative overflow-hidden">
           
           {builderTab === 1 && !editingGroupId && (
             <div className="animate-in slide-in-from-right-8 duration-300">
               <h4 className="text-xl font-black text-slate-900 mb-6">Auto-Generate Groups</h4>
               <p className="text-sm font-medium text-slate-500 mb-8 max-w-lg">
                 Set an asset threshold. The system will bundle standalone departments together until they exceed this threshold, naming them Group A, Group B, etc.
               </p>

               <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-widest">Asset Threshold per Group</label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Min 2 Auditors Rule</span>
                      <div className="relative inline-flex items-center">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={strictAuditorRule}
                          onChange={() => setStrictAuditorRule(!strictAuditorRule)}
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                      </div>
                    </label>
                  </div>
                  <div className="flex items-center gap-4 bg-white p-4 border border-slate-200 rounded-2xl shadow-sm">
                    <Boxes className="w-6 h-6 text-indigo-400" />
                    <input 
                      type="number"
                      min={100}
                      step={100}
                      className="w-full text-2xl font-black text-slate-700 outline-none"
                      value={threshold}
                      onChange={e => handleThresholdChange(parseInt(e.target.value) || 1000)}
                    />
                  </div>
                  {!strictAuditorRule && (
                    <p className="text-[10px] text-amber-600 font-bold bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 italic">
                      Notice: Strict auditor rule is disabled. Single-auditor units can be standalone.
                    </p>
                  )}
               </div>

               <div className="space-y-4 mb-10">
                  <label className="text-[10px] font-bold text-amber-500 block uppercase tracking-widest">Mega-Department Cutoff (Bypass Grouping)</label>
                  <div className="flex items-center gap-4 bg-white p-4 border border-amber-200 rounded-2xl shadow-sm">
                    <Sparkles className="w-6 h-6 text-amber-500" />
                    <input 
                      type="number"
                      min={authThreshold => Math.max(100, threshold + 100)}
                      step={100}
                      className="w-full text-2xl font-black text-slate-700 outline-none placeholder:text-slate-300"
                      value={megaThreshold}
                      onChange={e => handleMegaThresholdChange(parseInt(e.target.value) || 3000)}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold leading-relaxed px-2">Departments with assets above this limit will remain standalone and participate in cross-audits independently.</p>
               </div>

               <button 
                 onClick={handleRunAutoConsolidate}
                 disabled={isProcessing || !onAutoConsolidate}
                 className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-[24px] text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
               >
                 {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                 {auditGroups.some(g => g.name.startsWith('Group ')) ? 'Reset & Re-Group' : 'Run Auto-Consolidate'}
               </button>
               
               {auditGroups.some(g => g.name.startsWith('Group ')) && (
                  <p className="text-center text-[11px] font-bold text-amber-600 mt-4 bg-amber-50 rounded-xl py-2 px-4 shadow-sm border border-amber-100">
                    ⚠️ Running this again will safely reset your existing "Group X" combinations before recalculating.
                  </p>
               )}
             </div>
           )}

           {builderTab === 2 && !editingGroupId && (
             <div className="animate-in slide-in-from-right-8 duration-300">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 pb-6 border-b border-slate-100">
                  <div>
                    <h4 className="text-2xl font-black text-slate-900 leading-tight">Review & Refine Groups</h4>
                    <p className="text-sm font-medium text-slate-500 mt-1">Institutional strategy for asset consolidation and auditor distribution.</p>
                  </div>
                  
                  {(() => {
                     const consolidatedDepts = departments.filter(d => d.auditGroupId);
                     const grandTotalAssets = consolidatedDepts.reduce((sum, d) => sum + (d.totalAssets || 0), 0);
                     return (
                       <div className="bg-slate-900 px-8 py-4 rounded-[28px] border border-slate-700 shadow-2xl flex flex-col items-center min-w-[200px]">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 opacity-80">Institutional Grand Total</span>
                          <span className="text-3xl font-mono font-black text-white leading-none tabular-nums tracking-tighter italic">{grandTotalAssets.toLocaleString()}</span>
                       </div>
                     );
                  })()}

                  <div className="hidden lg:flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Configuration Active</span>
                  </div>
               </div>
               
               {auditGroups.length === 0 ? (
                 <div className="text-center py-20 bg-white rounded-[40px] border-2 border-slate-100 border-dashed group hover:border-indigo-200 transition-all cursor-pointer" onClick={() => setBuilderTab(1)}>
                    <div className="w-20 h-20 bg-indigo-50 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                       <Boxes className="w-10 h-10" />
                    </div>
                    <h5 className="text-xl font-black text-slate-900 mb-2">No Groups Created Yet</h5>
                    <p className="text-sm font-medium text-slate-500 mb-8 max-w-xs mx-auto leading-relaxed">
                      Run the auto-consolidator to bundle departments and reach the audit threshold.
                    </p>
                    <button className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all">
                      Go to Step 1
                    </button>
                 </div>
               ) : (
                 <div className="relative">
                   <div className="flex gap-4 overflow-x-auto pb-8 pt-2 custom-scrollbar snap-x snap-mandatory">
                     {[...auditGroups].sort((a,b) => {
                        const deptsA = departments.filter(d => d.auditGroupId === a.id);
                        const assetsA = deptsA.reduce((sum, d) => sum + (d.totalAssets || 0), 0);
                        const deptsB = departments.filter(d => d.auditGroupId === b.id);
                        const assetsB = deptsB.reduce((sum, d) => sum + (d.totalAssets || 0), 0);
                        return assetsB - assetsA;
                     }).map((g, idx) => {
                        const groupDepts = departments.filter(d => d.auditGroupId === g.id);
                        const groupTotalAssets = groupDepts.reduce((sum, d) => sum + (d.totalAssets || 0), 0);
                        const groupTotalAuditors = groupDepts.reduce((sum, d) => sum + (d.auditorCount || 0), 0);
                        const recAuditors = Math.max(2, Math.ceil(groupTotalAssets / maxAssetsPerDay), Math.ceil(groupDepts.length / maxLocationsPerDay));

                        return (
                          <div 
                            key={g.id} 
                            className="bg-white p-6 rounded-[36px] border-2 border-slate-100 shadow-sm flex flex-col min-w-[280px] w-[280px] transition-all hover:bg-slate-50 hover:border-indigo-300 hover:shadow-xl hover:-translate-y-1 snap-center group cursor-pointer relative"
                            onClick={() => setEditingGroupId(g.id)}
                          >
                            <div className="flex justify-between items-start mb-6">
                               <div className="flex flex-col">
                                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Rank #{idx + 1}</span>
                                 <div className="px-2 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest w-fit">
                                   Consolidated Unit
                                 </div>
                               </div>
                               <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Dissolve group "${g.name}"?`) && onDeleteAuditGroup) {
                                      onDeleteAuditGroup(g.id);
                                    }
                                  }}
                                  className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                  title="Dissolve Group"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <h5 className="font-black text-xl text-slate-900 mb-4 truncate pr-4">{g.name}</h5>
                            
                            <div className="flex flex-wrap gap-1.5 mb-8 h-12 overflow-hidden content-start">
                               {groupDepts.map(d => (
                                 <span key={d.id} className="px-2 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                                   {d.abbr}
                                 </span>
                               ))}
                            </div>

                            <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
                               <div className="flex flex-col">
                                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 opacity-70">Total Assets</span>
                                  <div className="flex items-center gap-1.5 text-base font-black text-emerald-600 italic">
                                     <Boxes className="w-4 h-4" />
                                     {groupTotalAssets.toLocaleString()}
                                  </div>
                               </div>
                               <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 opacity-70 text-right">Officers</span>
                                  <div className="flex items-center gap-1.5 text-base font-black text-slate-700">
                                     <Users className={`w-4 h-4 ${groupTotalAuditors < recAuditors ? 'text-amber-500' : 'text-slate-400'}`} />
                                     <span className={groupTotalAuditors < recAuditors ? 'text-amber-600 underline underline-offset-4 decoration-amber-300' : ''}>
                                       {groupTotalAuditors}
                                     </span>
                                  </div>
                                  {groupTotalAuditors < recAuditors && (
                                    <span className="text-[8px] font-black text-amber-500 mt-1 uppercase tracking-tighter">Rec: {recAuditors}</span>
                                  )}
                               </div>
                            </div>

                            <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 rounded-[36px] transition-opacity pointer-events-none border-2 border-indigo-500/20"></div>
                          </div>
                        );
                     })}
                   </div>
                   
                   {/* Horizontal Gradient Indicators */}
                   <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-50 to-transparent pointer-events-none"></div>
                   <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none"></div>
                 </div>
               )}
             </div>
           )}

           {editingGroupId && editingGroupObj && (
              <div className="animate-in slide-in-from-right-8 duration-300 flex flex-col h-[500px]">
                <div className="flex items-center justify-between mb-6 shrink-0">
                  <div>
                    <h4 className="text-xl font-black text-slate-900">Refining {editingGroupObj.name}</h4>
                    <p className="text-xs font-bold text-slate-500 mt-1">Check to include, uncheck to remove.</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-4 scrollbar-thin scrollbar-thumb-slate-200 mb-6">
                  {departments.map(dept => {
                    const isChecked = editingGroupDepts.includes(dept.id);
                    const isAssignedElsewhere = dept.auditGroupId && dept.auditGroupId !== editingGroupId;
                    const otherGroupName = isAssignedElsewhere ? auditGroups.find(g => g.id === dept.auditGroupId)?.name : null;

                    return (
                      <label 
                        key={dept.id} 
                        className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                          isChecked 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-sm' 
                            : isAssignedElsewhere
                              ? 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-3">
                            <input 
                              type="checkbox"
                              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-0 focus:ring-offset-0 transition-all"
                              checked={isChecked}
                              onChange={() => handleToggleDeptInGroup(dept.id, isChecked)}
                              disabled={isProcessing}
                            />
                            <span className="text-sm font-bold">{dept.name}</span>
                          </div>
                          {isAssignedElsewhere && !isChecked && (
                            <div className="ml-8 mt-1.5">
                              <span className="text-[10px] font-black uppercase tracking-tighter text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                Currently in {otherGroupName}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-mono font-bold text-slate-400">{(dept.totalAssets || 0).toLocaleString()} <Boxes className="inline w-3 h-3"/></span>
                          {!strictAuditorRule && (dept.auditorCount || 0) < Math.max(2, Math.ceil((dept.totalAssets || 0) / threshold) * 2) && (
                            <span className="text-[10px] font-bold text-amber-500 italic">
                              Rec: {Math.max(2, Math.ceil((dept.totalAssets || 0) / threshold) * 2)} Auditors
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>

                <button 
                  onClick={() => setEditingGroupId(null)}
                  className="w-full shrink-0 h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center transition-all active:scale-95 shadow-xl shadow-slate-900/10"
                >
                  Done Editing
                </button>
              </div>
           )}

        </div>
      </div>
    </div>
  );
};
