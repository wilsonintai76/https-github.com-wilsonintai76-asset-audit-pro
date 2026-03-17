import React, { useState, useMemo, useCallback } from 'react';
import { Department, AuditGroup } from '../types';
import { Boxes, Check, ArrowRight, Loader2, Zap, Trash2, Plus } from 'lucide-react';

interface GroupBuilderTabProps {
  departments: Department[];
  auditGroups: AuditGroup[];
  onAddAuditGroup?: (group: Omit<AuditGroup, 'id'>) => Promise<AuditGroup | null>;
  onDeleteAuditGroup?: (id: string) => Promise<void>;
  onBulkUpdateDepartments: (updates: { id: string, data: Partial<Department> }[]) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

export const GroupBuilderTab: React.FC<GroupBuilderTabProps> = ({
  departments,
  auditGroups,
  onAddAuditGroup,
  onDeleteAuditGroup,
  onBulkUpdateDepartments,
  isProcessing,
  setIsProcessing
}) => {
  const [builderTab, setBuilderTab] = useState<1 | 2 | 3>(1);
  const [newGroupName, setNewGroupName] = useState('');
  const [builderSelectedDepts, setBuilderSelectedDepts] = useState<string[]>([]);

  const generateNextGroupName = useCallback(() => {
    // Only check actual Registry groups since strings in departments are now legacy/unreliable
    const existingNames = new Set(auditGroups.map(g => g.name));

    // Simple A, B, C... pattern
    for (let i = 0; i < 26; i++) {
      const name = `Group ${String.fromCharCode(65 + i)}`;
      if (!existingNames.has(name)) return name;
    }
    
    // Fallback if A-Z are taken
    return `Group ${auditGroups.length + 1}`;
  }, [auditGroups, departments]);

  // Auto-generate name on mount or when tab changes back to 1 if empty
  React.useEffect(() => {
    if (builderTab === 1 && !newGroupName) {
        setNewGroupName(generateNextGroupName());
    }
  }, [builderTab, newGroupName, generateNextGroupName]);

  const handleStartGroupBuilder = () => {
    setNewGroupName(generateNextGroupName());
    setBuilderSelectedDepts([]);
    setBuilderTab(1);
  };

  const accumulatedAssets = useMemo(() => {
    return builderSelectedDepts.reduce((sum, id) => {
      const dept = departments.find(d => d.id === id);
      const safeAssets = typeof dept?.totalAssets === 'string' ? parseInt(dept.totalAssets) : (dept?.totalAssets || 0);
      return sum + safeAssets;
    }, 0);
  }, [builderSelectedDepts, departments]);

  const handleSaveBatchGroup = async (shouldOpenNext: boolean = false) => {
    if (!newGroupName.trim() || builderSelectedDepts.length === 0) return;
    setIsProcessing(true);
    try {
      if (onAddAuditGroup) {
        const createdGroup = await onAddAuditGroup({ name: newGroupName.trim() });
        
        if (createdGroup) {
          const updates = builderSelectedDepts.map(id => ({
            id,
            data: { auditGroupId: createdGroup.id }
          }));
          await onBulkUpdateDepartments(updates);
        }
        
        setBuilderSelectedDepts([]);
        if (shouldOpenNext) {
          // Calculate next name immediately
          const taken = new Set([
            ...auditGroups.map(g => g.name),
            newGroupName.trim() // Include the one we just made
          ]);
          
          let nextName = '';
          for (let i = 0; i < 26; i++) {
            const n = `Group ${String.fromCharCode(65 + i)}`;
            if (!taken.has(n)) {
              nextName = n;
              break;
            }
          }
          setNewGroupName(nextName || `Group ${auditGroups.length + 2}`);
          setBuilderTab(1); // Go back to create tab for the new group
        } else {
          setBuilderTab(3); // Go to registry to view final state
        }
      }
    } catch (e) {
      alert("Failed to save group.");
    } finally {
      setIsProcessing(false);
    }
  };

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
              <p className="text-slate-500 text-sm leading-relaxed">
                Manually group departments into logical clusters before pairing them for cross-audits.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setBuilderTab(1)}
                className={`flex items-center justify-between w-full px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${builderTab === 1 ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10 scale-105' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                <span className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span> Create Group</span>
                {newGroupName && builderTab !== 1 && <Check className="w-4 h-4 text-emerald-500" />}
              </button>
              
              <button 
                onClick={() => setBuilderTab(2)}
                disabled={!newGroupName.trim()}
                className={`flex items-center justify-between w-full px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed ${builderTab === 2 ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20 scale-105' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                <span className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span> Pick Departments</span>
                {builderSelectedDepts.length > 0 && builderTab !== 2 && <Check className="w-4 h-4 text-emerald-500" />}
              </button>

              <button 
                onClick={() => setBuilderTab(3)}
                className={`flex items-center justify-between w-full px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${builderTab === 3 ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20 scale-105' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                <span className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px]">3</span> Group Registry</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{auditGroups.length}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Active Tab Content */}
          <div className="lg:w-2/3 bg-slate-50 rounded-[32px] p-8 md:p-10 border border-slate-100 relative overflow-hidden">
             
             {builderTab === 1 && (
               <div className="animate-in slide-in-from-right-8 duration-300">
                 <h4 className="text-lg font-black text-slate-900 mb-6">Create New Group</h4>
                 <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-widest">Group Identity</label>
                    <div className="relative">
                      <input 
                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-4 text-lg font-bold text-slate-500 outline-none shadow-inner opacity-80 cursor-not-allowed"
                        value={newGroupName}
                        disabled
                        readOnly
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-blue-100 text-blue-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg">
                        Auto-Generated
                      </div>
                    </div>
                 </div>
                 <div className="mt-8">
                   <button 
                     onClick={() => setBuilderTab(2)}
                     disabled={!newGroupName.trim()}
                     className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 disabled:opacity-30 flex items-center gap-2 active:scale-95"
                   >
                     Continue to Departments <ArrowRight className="w-4 h-4" />
                   </button>
                 </div>
               </div>
             )}

             {builderTab === 2 && (
               <div className="animate-in slide-in-from-right-8 duration-300 flex flex-col h-[500px]">
                 <div className="flex items-center justify-between mb-6 shrink-0">
                    <div>
                      <h4 className="text-lg font-black text-slate-900">Assign to {newGroupName}</h4>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Select departments to include</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Accumulated Assets</p>
                       <p className="text-xl font-black text-blue-600">{accumulatedAssets.toLocaleString()}</p>
                    </div>
                 </div>

                 <div className="flex-1 overflow-y-auto space-y-2 pr-4 scrollbar-thin scrollbar-thumb-slate-200 mb-6">
                    {departments.map(dept => {
                      const isChecked = builderSelectedDepts.includes(dept.id);
                      const currentGroupName = dept.auditGroupId 
                        ? auditGroups.find(g => g.id === dept.auditGroupId)?.name 
                        : (dept.auditGroup || null);

                      return (
                        <label 
                          key={dept.id} 
                          className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                            isChecked 
                              ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-sm' 
                              : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox"
                                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-0 focus:ring-offset-0"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setBuilderSelectedDepts(builderSelectedDepts.filter(id => id !== dept.id));
                                  } else {
                                    setBuilderSelectedDepts([...builderSelectedDepts, dept.id]);
                                  }
                                }}
                              />
                              <span className="text-sm font-bold">{dept.name}</span>
                            </div>
                            {currentGroupName && !isChecked && (
                              <div className="ml-8 mt-1.5">
                                <span className="text-[10px] font-black uppercase tracking-tighter text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                  Currently in {currentGroupName}
                                </span>
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-mono font-bold text-slate-400">{(dept.totalAssets || 0).toLocaleString()}</span>
                        </label>
                      );
                    })}
                 </div>

                 <div className="shrink-0 grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
                    <button 
                      onClick={() => handleSaveBatchGroup(false)}
                      disabled={isProcessing || !newGroupName || builderSelectedDepts.length === 0}
                      className="h-14 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border-2 border-slate-200 transition-all active:scale-95"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Finalize & View Registry
                    </button>
                    <button 
                      onClick={() => handleSaveBatchGroup(true)}
                      disabled={isProcessing || !newGroupName || builderSelectedDepts.length === 0}
                      className="h-14 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 transition-all active:scale-95"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-yellow-300 fill-current" />}
                      Finalize & Next Group
                    </button>
                 </div>
               </div>
             )}

             {builderTab === 3 && (
               <div className="animate-in slide-in-from-right-8 duration-300">
                 <h4 className="text-lg font-black text-slate-900 mb-6">Group Registry</h4>
                 
                 {auditGroups.length === 0 ? (
                   <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 border-dashed">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                         <Boxes className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-sm font-bold text-slate-500">No groups created yet.</p>
                   </div>
                 ) : (
                   <div className="space-y-4">
                     {auditGroups.map(g => (
                       <div key={g.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group/card transition-all hover:shadow-md">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-black">
                               {g.name.charAt(g.name.length - 1)}
                            </div>
                            <div>
                               <h5 className="font-bold text-slate-900">{g.name}</h5>
                               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                  {departments.filter(d => d.auditGroup === g.name || d.auditGroupId === g.id).length} Units Assigned
                               </p>
                            </div>
                         </div>
                         <button 
                           onClick={() => {
                             if (confirm(`Delete group "${g.name}"? This will unassign all departments in this group.`) && onDeleteAuditGroup) {
                               onDeleteAuditGroup(g.id);
                             }
                           }}
                           className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors opacity-0 group-hover/card:opacity-100"
                           title="Delete Group"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                     ))}
                     
                     <div className="pt-6">
                        <button 
                           onClick={handleStartGroupBuilder}
                           className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                        >
                           <Plus className="w-4 h-4" /> Start Another Group
                        </button>
                     </div>
                   </div>
                 )}
               </div>
             )}
          </div>
        </div>
      </div>
  );
};
