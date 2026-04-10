import React, { useState, useMemo, useEffect } from 'react';
import { Department, AuditGroup } from '@shared/types';
import { Boxes, Loader2, Sparkles, Trash2, Users, RotateCcw, Lock, AlertTriangle } from 'lucide-react';
import { PrintButton } from './PrintButton';
import { printUnitConsolidation } from '../lib/printUtils';


interface GroupBuilderTabProps {
  departments: Department[];
  auditGroups: AuditGroup[];
  onAutoConsolidate?: (threshold: number, excludedIds: string[], minAuditors: number, useAI: boolean) => Promise<void>;
  onAddAuditGroup?: (group: Omit<AuditGroup, 'id'>) => Promise<AuditGroup | null>;
  onDeleteAuditGroup?: (id: string) => Promise<void>;
  onBulkDeleteAuditGroups?: (ids: string[]) => Promise<void>;
  onBulkUpdateDepartments: (updates: { id: string, data: Partial<Department> }[]) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  strictAuditorRule: boolean;
  setStrictAuditorRule: (val: boolean) => void;
  maxAssetsPerDay: number;
  maxLocationsPerDay?: number;
  minAuditorsPerLocation?: number;
  isSystemLocked?: boolean;
  pairingLocked?: boolean;
}

export const GroupBuilderTab: React.FC<GroupBuilderTabProps> = ({
  departments,
  auditGroups,
  onAutoConsolidate,
  onDeleteAuditGroup,
  onBulkDeleteAuditGroups,
  onBulkUpdateDepartments,
  isProcessing,
  setIsProcessing,
  strictAuditorRule,
  setStrictAuditorRule,
  maxAssetsPerDay,
  minAuditorsPerLocation = 2,
  isSystemLocked = false,
  pairingLocked = false,
}) => {
  const [builderTab, setBuilderTab] = useState<1 | 2>(() => auditGroups.length > 0 ? 2 : 1);
  const [useAI, setUseAI] = useState<boolean>(() => localStorage.getItem('group_builder_use_ai') === 'true');

  // Auto-switch to Unit Inventory whenever groups become non-empty
  useEffect(() => {
    if (auditGroups.length > 0 && builderTab === 1) {
      setBuilderTab(2);
    }
  }, [auditGroups.length, builderTab]);

  const groupsInitialized = auditGroups.length > 0;

  const { initLocked, initLockReason } = useMemo(() => {
    if (pairingLocked) {
      return { initLocked: true, initLockReason: 'Audit pairing has been committed and is locked. Reset the configuration first.' };
    }
    if (isSystemLocked) {
      return { initLocked: true, initLockReason: 'System is locked due to active audit assignments.' };
    }
    return { initLocked: false, initLockReason: '' };
  }, [pairingLocked, isSystemLocked]);


  const handleRunAutoConsolidate = async () => {
    if (!onAutoConsolidate) return;
    setIsProcessing(true);
    try {
      // The server handles the logic of large standalone units based on the threshold.
      // We only pass the global maxAssetsPerDay as the target threshold.
      const threshold = maxAssetsPerDay;
      const minAuditors = minAuditorsPerLocation;
      
      // Pass empty array for excludedIds to let server logic prevail by default
      await onAutoConsolidate(threshold, [], minAuditors, useAI);
      setBuilderTab(2);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetAllGroups = async () => {
    if (auditGroups.length === 0) return;
    if (!confirm('Reset all audit groups? This will unassign all departments.')) return;

    setIsProcessing(true);
    try {
      const deptsWithGroup = departments.filter(d => d.auditGroupId);
      if (deptsWithGroup.length > 0) {
        const updates = deptsWithGroup.map(d => ({
          id: d.id,
          data: { auditGroupId: null }
        }));
        await onBulkUpdateDepartments(updates);
      }

      if (onBulkDeleteAuditGroups && auditGroups.length > 0) {
        await onBulkDeleteAuditGroups(auditGroups.map(g => g.id));
      } else if (onDeleteAuditGroup && auditGroups.length > 0) {
        for (const group of auditGroups) {
          await onDeleteAuditGroup(group.id);
        }
      }
      setBuilderTab(1);
    } catch (e) {
      console.error('Reset all groups failed:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const entities = useMemo(() => {
    const groupedDepts: Record<string, Department[]> = {};
    departments.filter(d => !d.isExempted).forEach(dept => {
      const groupExists = dept.auditGroupId && auditGroups.some(g => g.id === dept.auditGroupId);
      const key = groupExists ? dept.auditGroupId! : 'unassigned_' + dept.id;
      if (!groupedDepts[key]) groupedDepts[key] = [];
      groupedDepts[key].push(dept);
    });

    return Object.entries(groupedDepts).map(([groupId, depts]) => {
      const isUnassigned = groupId.startsWith('unassigned_');
      const totalAssets = depts.reduce((sum, d) => sum + (typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0)), 0);
      const totalAuditors = depts.reduce((sum, d) => sum + (d.auditorCount || 0), 0);
      const name = isUnassigned ? depts[0].name : auditGroups.find(g => g.id === groupId)?.name ?? depts[0].name;
      const isStandaloneExempt = isUnassigned && totalAssets >= maxAssetsPerDay;

      const constitutesGroup = !isUnassigned;

      return { name, assets: totalAssets, auditors: totalAuditors, memberCount: depts.length, isJoint: constitutesGroup, isGroup: constitutesGroup, id: groupId, members: depts };
    }).sort((a, b) => b.assets - a.assets);
  }, [departments, auditGroups, maxAssetsPerDay]);

  const grandTotalAssets = useMemo(() => {
    return departments.reduce((sum, d) => sum + (typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0)), 0);
  }, [departments]);

  const consolidationPrintData = useMemo(() => {
    let total = 0;
    const groups = auditGroups.map(group => {
      const groupDepts = departments.filter(d => d.auditGroupId === group.id || d.auditGroup === group.name);
      let subTotal = 0;
      let subAuditors = 0;
      groupDepts.forEach(d => {
        const val = typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0);
        total += val;
        subTotal += val;
        subAuditors += d.auditorCount || 0;
      });
      return { ...group, departments: groupDepts, subTotal, subAuditors };
    });
    const unassignedDepts = departments.filter(d => !d.auditGroupId && !d.auditGroup);
    unassignedDepts.forEach(d => {
      total += typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0);
    });
    return { groupedData: { groups, unassignedDepts }, overallTotal: total };
  }, [departments, auditGroups]);

  return (
    <div className="bg-slate-50/50 rounded-[40px] border-2 border-slate-100 p-8 md:p-12 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-14">
        <div className="lg:w-1/4 xl:w-1/5 space-y-8">
          <div>
            <div className="w-16 h-16 bg-white border border-slate-100 text-indigo-500 rounded-3xl flex items-center justify-center shadow-sm mb-8">
              <Boxes className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-4">Unit Consolidation</h3>
            <p className="text-slate-500 text-xs font-medium leading-relaxed mb-6">
              Automated institutional audit landscape grouping.
            </p>
            <PrintButton
              onClick={() => printUnitConsolidation(consolidationPrintData.groupedData, consolidationPrintData.overallTotal)}
              label="Print"
              title="Print Unit Consolidation"
            />
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={() => { if (!groupsInitialized && !initLocked) { setBuilderTab(1); } }}
              disabled={groupsInitialized || initLocked}
              className={`group flex items-center justify-between w-full px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                builderTab === 1
                  ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/10'
                  : groupsInitialized || initLocked
                    ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
                    : 'bg-white text-slate-500 border border-slate-100 hover:border-indigo-100'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className={`w-7 h-7 rounded-lg ${builderTab === 1 ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'} flex items-center justify-center text-[10px]`}>1</span>
                <span>Strategy Design</span>
              </div>
              {groupsInitialized || initLocked ? <Lock className="w-3 h-3 text-slate-300" /> : <Sparkles className="w-3.5 h-3.5" />}
            </button>
            
            <button 
              onClick={() => setBuilderTab(2)}
              className={`group flex items-center justify-between w-full px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${builderTab === 2 ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/10' : 'bg-white text-slate-500 border border-slate-100 hover:border-indigo-100'}`}
            >
              <div className="flex items-center gap-4">
                <span className={`w-7 h-7 rounded-lg ${builderTab === 2 ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'} flex items-center justify-center text-[10px]`}>2</span>
                <span>Unit Inventory</span>
              </div>
              <div className={`px-2 py-0.5 rounded-lg font-black text-[9px] ${builderTab === 2 ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {entities.length}
              </div>
            </button>
          </div>
        </div>

        <div className="lg:w-3/4 xl:w-4/5 bg-white rounded-[44px] p-8 md:p-10 border border-slate-100 shadow-sm relative overflow-hidden flex flex-col h-175 max-h-[85vh]">
           {builderTab === 1 && (
             <div className="animate-in slide-in-from-right-8 duration-300">
               {groupsInitialized && (
                 <div className="mb-6 mx-2 flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
                   <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                   <div>
                     <p className="text-[11px] font-black text-emerald-800 uppercase tracking-widest mb-0.5">Groups Configured</p>
                     <p className="text-[10px] text-emerald-700 leading-relaxed">{auditGroups.length} active groups. Reset to modify strategy.</p>
                   </div>
                 </div>
               )}
               <h4 className="text-xl font-black text-slate-900 tracking-tight leading-tight mb-2 px-2">Auto-Generate Groups</h4>
                <div className="flex items-center justify-between mb-8 px-2 mt-4">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => { setUseAI(!useAI); localStorage.setItem('group_builder_use_ai', (!useAI).toString()); }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${useAI ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Thematic Mode {useAI ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 px-2">
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                       <label className="text-[10px] font-black text-slate-400 block uppercase tracking-widest">Target Threshold</label>
                       <label className="flex items-center gap-2 cursor-pointer">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Strict Rule</span>
                         <input type="checkbox" className="sr-only peer" checked={strictAuditorRule} onChange={() => setStrictAuditorRule(!strictAuditorRule)} />
                         <div className="w-8 h-4 bg-slate-100 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:inset-s-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-full relative"></div>
                       </label>
                     </div>
                     <div className="flex items-center gap-4 bg-slate-50 p-6 border border-slate-100 rounded-[28px] opacity-60">
                       <Boxes className="w-7 h-7 text-indigo-400" />
                       <div className="flex flex-col">
                         <span className="text-3xl font-black text-slate-800 tabular-nums italic">{maxAssetsPerDay.toLocaleString()}</span>
                         <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Inherited from Global Strategy</span>
                       </div>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <label className="text-[10px] font-black text-amber-500 block uppercase tracking-widest">Min Auditor Safety</label>
                     <div className="flex items-center gap-4 bg-amber-50/30 p-6 border border-amber-100 rounded-[28px] opacity-60">
                       <Users className="w-7 h-7 text-amber-500" />
                       <div className="flex flex-col">
                         <span className="text-3xl font-black text-slate-800 tabular-nums italic">{minAuditorsPerLocation}</span>
                         <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Institutional Minimum</span>
                       </div>
                     </div>
                  </div>
               </div>

                <div className="mb-8 px-2">
                  <div className="p-6 bg-indigo-50/50 border border-indigo-100 rounded-[28px] flex items-start gap-4">
                    <AlertTriangle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-[11px] font-black text-indigo-900 uppercase tracking-widest">Consolidation Rules</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                        <p className="text-[10px] text-indigo-700 font-medium">• Standalone: Assets ≥ {maxAssetsPerDay.toLocaleString()} or Locations ≥ 15</p>
                        <p className="text-[10px] text-indigo-700 font-medium">• Combined: Units below threshold will form groups of ~1,000 burden units</p>
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleRunAutoConsolidate}
                  disabled={isProcessing || !onAutoConsolidate || initLocked}
                  className={`mx-2 w-[calc(100%-1rem)] py-5 rounded-[24px] text-xs font-black uppercase tracking-widest flex items-center justify-center gap-4 transition-all ${initLocked ? 'bg-slate-200 text-slate-400' : 'bg-slate-900 text-white'}`}
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 text-indigo-400" />}
                  {initLocked ? 'Locked — Audit In Progress' : 'Initialize Consolidation'}
                </button>
             </div>
           )}

           {builderTab === 2 && (
             <div className="animate-in slide-in-from-right-8 duration-300 flex flex-col flex-1 h-full min-h-0">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 pb-8 border-b border-slate-100 shrink-0">
                  <div className="space-y-2">
                    <h4 className="text-3xl font-black text-slate-900 tracking-tighter leading-[0.9]">Active Entities</h4>
                    <p className="text-xs font-medium text-slate-400">Review institutional groups and standalone units.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-900 px-8 py-5 rounded-[28px] shadow-2xl flex flex-col items-center min-w-45 border border-slate-700">
                       <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest mb-1">Institutional Total</span>
                       <span className="text-3xl font-mono font-black text-white italic tracking-tighter">{grandTotalAssets.toLocaleString()}</span>
                    </div>
                    {auditGroups.length > 0 && (
                      <button
                        onClick={handleResetAllGroups}
                        disabled={isProcessing || initLocked}
                        className="w-12 h-12 bg-white border-2 border-rose-200 text-rose-400 hover:bg-rose-50 rounded-xl transition-all flex items-center justify-center"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                    <button onClick={() => window.location.reload()} className="w-12 h-12 bg-white border-2 border-slate-100 text-slate-300 hover:text-indigo-600 rounded-xl transition-all flex items-center justify-center">
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </div>
               </div>
               
               <div className="flex-1 min-h-0 overflow-hidden">
                  <div className="flex gap-6 overflow-x-auto pb-10 pt-4 px-2 custom-scrollbar snap-x snap-mandatory h-full">
                    {entities.map((e, idx) => (
                      <div 
                        key={e.id} 
                        className="bg-white p-8 rounded-[36px] border-2 border-slate-100 shadow-sm flex flex-col min-w-75 w-75 snap-center relative shrink-0 text-left overflow-hidden h-fit mb-4"
                      >
                         <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500/10"></div>
                         <div className="flex justify-between items-start mb-8">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">Rank #{idx + 1}</span>
                            {e.isConsolidated ? (
                              <div className="px-2.5 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-lg text-[8px] font-black uppercase">Group</div>
                            ) : (
                              <div className="px-2.5 py-1 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg text-[8px] font-black uppercase">Standalone</div>
                            )}
                         </div>
                         <h5 className="font-black text-lg text-slate-900 mb-6 tracking-tight line-clamp-2 h-11">{e.name}</h5>
                         <div className="flex flex-wrap gap-2 mb-8 grow content-start min-h-16">
                            {e.members.map(m => (
                              <span key={m.id} className="px-3 py-1 bg-slate-50 text-slate-500 border border-slate-200/50 rounded-xl text-[8px] font-bold uppercase">{m.abbr}</span>
                            ))}
                         </div>
                         <div className="mt-auto pt-6 border-t border-slate-100 grid grid-cols-2 gap-4 shrink-0">
                            <div className="flex flex-col gap-1">
                               <span className="text-[8px] font-black uppercase text-slate-400">Assets</span>
                               <span className="text-xl font-black text-slate-800 tabular-nums italic">{e.assets.toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                               <span className="text-[8px] font-black uppercase text-slate-400">Auditors</span>
                               <div className="text-xl font-black tabular-nums text-slate-800 flex items-center gap-1.5">{e.auditors}<Users className="w-3.5 h-3.5 opacity-20" /></div>
                            </div>
                         </div>
                      </div>
                    ))}
                  </div>
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
