import React, { useState, useMemo } from 'react';
import { Department, AuditGroup } from '../types';
import { Boxes, Check, Loader2, Sparkles, Trash2, Pencil, Users } from 'lucide-react';

const THRESHOLD_STORAGE_KEY = 'group_builder_threshold';

function loadThreshold(): number {
  return parseInt(localStorage.getItem(THRESHOLD_STORAGE_KEY) || '1000', 10);
}
function saveThreshold(t: number) {
  localStorage.setItem(THRESHOLD_STORAGE_KEY, String(t));
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
}

export const GroupBuilderTab: React.FC<GroupBuilderTabProps> = ({
  departments,
  auditGroups,
  onAutoConsolidate,
  onDeleteAuditGroup,
  onBulkUpdateDepartments,
  isProcessing,
  setIsProcessing
}) => {
  const [builderTab, setBuilderTab] = useState<1 | 2>(1);
  const [threshold, setThreshold] = useState<number>(() => loadThreshold());
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

  const handleRunAutoConsolidate = async () => {
    if (!onAutoConsolidate) return;
    setIsProcessing(true);
    try {
      await onAutoConsolidate(threshold, []);
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

               <div className="space-y-4 mb-10">
                  <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-widest">Asset Threshold per Group</label>
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
               </div>

               <button 
                 onClick={handleRunAutoConsolidate}
                 disabled={isProcessing || !onAutoConsolidate}
                 className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-[24px] text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
               >
                 {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                 Run Auto-Consolidation Now
               </button>
             </div>
           )}

           {builderTab === 2 && !editingGroupId && (
             <div className="animate-in slide-in-from-right-8 duration-300">
               <h4 className="text-xl font-black text-slate-900 mb-6">Review & Refine Groups</h4>
               
               {auditGroups.length === 0 ? (
                 <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 border-dashed">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                       <Check className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-sm font-bold text-slate-500 mb-2">No groups created yet.</p>
                    <p className="text-xs text-slate-400">Run the auto-generator to populate this list.</p>
                 </div>
               ) : (
                 <div className="space-y-4">
                   {auditGroups.sort((a,b) => a.name.localeCompare(b.name)).map(g => (
                     <div key={g.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between group transition-all hover:shadow-md hover:border-indigo-200 cursor-pointer" onClick={() => setEditingGroupId(g.id)}>
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-black text-lg">
                             {g.name.split(' ').pop()?.charAt(0) || 'G'}
                          </div>
                          <div>
                             <h5 className="font-black text-slate-900">{g.name}</h5>
                             <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {departments.filter(d => d.auditGroup === g.name || d.auditGroupId === g.id).length} Units Assigned
                             </p>
                          </div>
                       </div>
                       <div className="flex items-center gap-2">
                         <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">Click to Edit</span>
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             if (confirm(`Delete group "${g.name}"?`) && onDeleteAuditGroup) {
                               onDeleteAuditGroup(g.id);
                             }
                           }}
                           className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors opacity-0 group-hover:opacity-100 hover:scale-110"
                           title="Delete Group"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                     </div>
                   ))}
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
                        <span className="text-xs font-mono font-bold text-slate-400">{(dept.totalAssets || 0).toLocaleString()} <Boxes className="inline w-3 h-3"/></span>
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
