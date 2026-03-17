
import React, { useState, useMemo } from 'react';
import { Department, CrossAuditPermission, User, AuditGroup } from '../types';
import { Wand2, UserPen, Zap, Boxes, Loader2, Layers, Network, Check, CheckCheck, RotateCcw, Link, Grid, List, ArrowRightLeft, ArrowRight, Ban, Users, Building2, Trash2, Link2Off, Plus, X } from 'lucide-react';
import { ActiveEntitiesList } from './ActiveEntitiesList';
import { ConfirmationModal } from './ConfirmationModal';
import { MatrixCard } from './MatrixCard';
import { InstitutionalConsolidationView } from './InstitutionalConsolidationView';
import { GroupBuilderTab } from './GroupBuilderTab';
interface StrategicPair {
  target: { name: string; assets: number; auditors: number; members?: any[]; isJoint?: boolean };
  auditors: { name: string; assets: number; auditors: number; isJoint: boolean; members?: any[] }[];
  totalAuditorsInGroup: number;
  auditorSideAssets: number;
}

type WorkflowStep = 'grouping' | 'pairing' | 'results';
type ManagementMode = 'auto' | 'manual';
type ManualViewMode = 'list' | 'grid';

interface CrossAuditManagementProps {
  departments: Department[];
  users: User[];
  permissions: CrossAuditPermission[];
  onTogglePermission: (auditorDept: string, targetDept: string, isActive: boolean) => void;
  onAddPermission: (auditorDept: string, targetDept: string, isMutual: boolean) => Promise<void>;
  onRemovePermission?: (id: string) => Promise<void>;
  onUpdateDepartment: (id: string, updates: Partial<Department>) => void;
  onBulkUpdateDepartments: (updates: { id: string, data: Partial<Department> }[]) => void;
  auditGroups?: AuditGroup[];
  onAddAuditGroup?: (group: Omit<AuditGroup, 'id'>) => Promise<void>;
  onUpdateAuditGroup?: (id: string, updates: Partial<AuditGroup>) => Promise<void>;
  onDeleteAuditGroup?: (id: string) => Promise<void>;
}

export const CrossAuditManagement: React.FC<CrossAuditManagementProps> = ({ 
  departments, 
  users,
  permissions, 
  onTogglePermission,
  onAddPermission,
  onRemovePermission,
  onUpdateDepartment,
  onBulkUpdateDepartments,
  auditGroups = [],
  onAddAuditGroup,
  onUpdateAuditGroup,
  onDeleteAuditGroup
}) => {
  // --- STATE ---
  const [manualViewMode, setManualViewMode] = useState<ManualViewMode>('grid');
  const [assetThreshold, setAssetThreshold] = useState<number>(500);
  const [minAuditors, setMinAuditors] = useState<number>(2);
  const [megaTargetThreshold, setMegaTargetThreshold] = useState<number>(3000);
  const [burdenCapacity, setBurdenCapacity] = useState<number>(1000); 

  const [strategicPlan, setStrategicPlan] = useState<StrategicPair[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAuditor, setSelectedAuditor] = useState<string>('');
  
  // Manual Mode State
  const [manualAuditor, setManualAuditor] = useState('');
  const [manualTarget, setManualTarget] = useState('');
  const [isMutual, setIsMutual] = useState(false);

  // Workflow Control
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('grouping');
  
  // Confirmation & State Control
  const [isApplied, setIsApplied] = useState(false);
  const [activeModal, setActiveModal] = useState<'apply' | 'reset' | null>(null);

  // 1. Compute Stats for Each Department
  const deptStats = useMemo(() => {
    return departments.map(dept => {
      const auditorCount = users.filter(u => 
        u.department === dept.name && 
        (u.roles.includes('Staff') || u.roles.includes('Supervisor') || u.roles.includes('Coordinator') || u.roles.includes('Admin')) &&
        u.status === 'Active'
      ).length || 0;

      return {
        ...dept,
        auditorCount
      };
    });
  }, [departments, users]);

  // 2. Compute "Audit Entities" (Merged Groups + Standalone)
  const entities = useMemo(() => {
    const map = new Map<string, { name: string, assets: number, auditors: number, memberCount: number, members: any[], id?: string }>(); 

    deptStats.forEach(d => {
      // Use the normalized auditGroupId to identify the group.
      // If none, it is a standalone department.
      const group = d.auditGroupId ? auditGroups.find(g => g.id === d.auditGroupId) : null;
      
      const entityName = group ? group.name : d.name;
      const entityId = group ? group.id : `dept_${d.id}`;
      
      const current = map.get(entityId) || { name: entityName, assets: 0, auditors: 0, memberCount: 0, members: [], id: entityId };
      const safeAssets = typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0);

      map.set(entityId, { 
        name: entityName,
        assets: current.assets + safeAssets,
        auditors: current.auditors + d.auditorCount,
        memberCount: current.memberCount + 1,
        members: [...current.members, d],
        id: entityId
      });
    });

    return Array.from(map.values()).map(stats => {
      // It is a group if it contains multiple members OR it maps to an official Registry group
      const constitutesGroup = stats.memberCount > 1 || auditGroups.some(g => g.id === stats.id);
      return { 
        ...stats, 
        isJoint: constitutesGroup,
        isGroup: constitutesGroup 
      };
    });
  }, [deptStats, auditGroups]);

  // Group manual permissions by auditor for the table view
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, CrossAuditPermission[]> = {};
    permissions.forEach(p => {
      if (!groups[p.auditorDept]) groups[p.auditorDept] = [];
      groups[p.auditorDept].push(p);
    });
    return groups;
  }, [permissions]);

  React.useEffect(() => {
    if (!selectedAuditor && entities?.length > 0) {
      setSelectedAuditor(entities[0].name);
    }
  }, [entities, selectedAuditor]);

  const handleResetClick = () => {
    setActiveModal('reset');
  };

  const executeReset = async () => {
    setActiveModal(null);
    setIsProcessing(true);

    try {
      // 1. Clear local calculation state
      setStrategicPlan([]);
      setWorkflowStep('grouping');
      setIsApplied(false);

      // 2. Clear Department Groups (Database)
      const updates = departments
        .filter(d => d.auditGroupId)
        .map(d => ({ id: d.id, data: { auditGroupId: null } }));

      if (updates?.length > 0) {
        await onBulkUpdateDepartments(updates);
      }

      // 3. Clear ALL Existing Permissions (Database - Manual & Auto)
      if (onRemovePermission && permissions.length > 0) {
        const idsToRemove = permissions.map(p => p.id);
        // Execute sequentially to ensure data integrity
        for (const id of idsToRemove) {
          await onRemovePermission(id);
        }
      }

    } catch (error) {
      console.error("Reset failed:", error);
      alert("Failed to fully reset system configuration. Please check your connection.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyClick = () => {
    if (isApplied) return;
    setActiveModal('apply');
  };

  const executeApply = async () => {
    setActiveModal(null);
    setIsProcessing(true);

    try {
      if (onRemovePermission && permissions.length > 0) {
        const idsToRemove = permissions.map(p => p.id);
        for (const id of idsToRemove) {
          await onRemovePermission(id);
        }
      }

      await new Promise(r => setTimeout(r, 500));

      for (const pair of strategicPlan) {
        for (const auditor of pair.auditors) {
          await onAddPermission(auditor.name, pair.target.name, false);
        }
      }

      setIsApplied(true);
    } catch (e) {
      console.error(e);
      alert("Permission sync failed. Check connection.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddManualPair = async () => {
    if (!manualAuditor || !manualTarget) return;
    if (manualAuditor === manualTarget) {
      alert("Conflict Detected: A unit cannot audit its own assets. Please select a different pairing.");
      return;
    }
    
    setIsProcessing(true);
    try {
      await onAddPermission(manualAuditor, manualTarget, isMutual);
      if (isMutual) {
        // Also check if reverse already exists
        const reverseExists = permissions.some(p => p.auditorDept === manualTarget && p.targetDept === manualAuditor);
        if (!reverseExists) {
            await onAddPermission(manualTarget, manualAuditor, isMutual);
        }
      }
      setManualAuditor('');
      setManualTarget('');
    } catch (e) {
      alert("Failed to save pairing.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGridToggle = async (auditorName: string, targetName: string) => {
    if (auditorName === targetName) return; // Prevent self-audit
    
    const perm = permissions.find(p => p.auditorDept === auditorName && p.targetDept === targetName);
    
    if (perm) {
      // Toggle off (remove)
      if (onRemovePermission) await onRemovePermission(perm.id);
    } else {
      // Toggle on (add)
      await onAddPermission(auditorName, targetName, false);
    }
  };

  // --- LOGIC ---

  const handleAnalyzeAndGroup = async () => {
    setIsProcessing(true);
    const standalones: typeof deptStats = [];
    const pool: typeof deptStats = [];
    
    deptStats.forEach(d => {
        const safeAssets = typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0);
        if (safeAssets >= assetThreshold && d.auditorCount >= minAuditors) {
            standalones.push(d);
        } else {
            pool.push(d);
        }
    });

    const updates: { id: string, data: Partial<Department> }[] = [];
    standalones.forEach(d => updates.push({ id: d.id, data: { auditGroupId: null } }));

    pool.sort((a, b) => {
        const assetsA = typeof a.totalAssets === 'string' ? parseInt(a.totalAssets) : (a.totalAssets || 0);
        const assetsB = typeof b.totalAssets === 'string' ? parseInt(b.totalAssets) : (b.totalAssets || 0);
        return assetsA - assetsB;
    });
    
    let currentGroup: typeof deptStats = [];
    let currentAssets = 0;
    let currentAuditors = 0;
    let groupIndex = 1;

    pool.forEach(d => {
        const safeAssets = typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0);
        currentGroup.push(d);
        currentAssets += safeAssets;
        currentAuditors += d.auditorCount;

        if (currentAssets >= assetThreshold && currentAuditors >= minAuditors) {
             const groupName = `Group ${String.fromCharCode(64 + groupIndex)}`;
             const group = auditGroups.find(g => g.name === groupName);
             currentGroup.forEach(m => updates.push({ id: m.id, data: { auditGroupId: group ? group.id : null } }));
             currentGroup = [];
             currentAssets = 0;
             currentAuditors = 0;
             groupIndex++;
        }
    });
    if (currentGroup?.length > 0) {
        const targetName = groupIndex > 1 
            ? `Group ${String.fromCharCode(64 + groupIndex - 1)}`
            : `Group A`;
        const group = auditGroups.find(g => g.name === targetName);
        currentGroup.forEach(m => updates.push({ id: m.id, data: { auditGroupId: group ? group.id : null } }));
    }

    await onBulkUpdateDepartments(updates);
    
    // Also, if we auto-created "Group A", "Group B", etc. and they don't exist in audit_groups table,
    // we should probably add them. But since this is "Optimization Engine" (old logic), 
    // it uses strings. The user specifically asked for MANUAL groups too.
    // I'll leave the string-based auto-grouping as a fallback "Optimized Group" display,
    // while encouraging the Registry for permanent manual groups.
    
    setIsProcessing(false);
    setWorkflowStep('pairing');
  };

  const generateStrategicPlan = async () => {
    setIsProcessing(true);
    setIsApplied(false);
    
    await new Promise(r => setTimeout(r, 500));

    const validAuditorEntities = entities.filter(e => e.auditors >= minAuditors);
    const allTargets = [...entities].sort((a, b) => b.assets - a.assets);

    const workloadMap = new Map<string, { used: number, max: number }>();
    validAuditorEntities.forEach(e => {
        workloadMap.set(e.name, { used: 0, max: Math.max(1, Math.floor(e.auditors / minAuditors)) });
    });

    const plan: StrategicPair[] = [];
    const handledTargets = new Set<string>();

    allTargets.forEach(target => {
        if (target.assets < megaTargetThreshold) return;

        const teamsNeeded = Math.max(2, Math.ceil(target.assets / burdenCapacity));
        
        const candidates = validAuditorEntities
            .filter(e => e.name !== target.name)
            .sort((a, b) => {
                const aLoad = workloadMap.get(a.name)!;
                const bLoad = workloadMap.get(b.name)!;
                return (aLoad.used / aLoad.max) - (bLoad.used / bLoad.max);
            });

        const assigned: typeof validAuditorEntities = [];
        for (const cand of candidates) {
            if (assigned?.length >= teamsNeeded) break;
            const stats = workloadMap.get(cand.name)!;
            if (stats.used < stats.max || !assigned || assigned.length === 0) {
                assigned.push(cand);
                stats.used++;
            }
        }

        if (assigned?.length > 0) {
            plan.push({
                target,
                auditors: assigned,
                totalAuditorsInGroup: assigned.reduce((s, a) => s + a.auditors, 0),
                auditorSideAssets: assigned.reduce((s, a) => s + a.assets, 0)
            });
            handledTargets.add(target.name);
        }
    });

    allTargets.forEach(target => {
        if (handledTargets.has(target.name)) return;

        const partner = validAuditorEntities
            .filter(e => e.name !== target.name)
            .sort((a, b) => {
                const aLoad = workloadMap.get(a.name)!;
                const bLoad = workloadMap.get(b.name)!;
                return (aLoad.used / aLoad.max) - (bLoad.used / bLoad.max);
            })[0];

        if (partner) {
            workloadMap.get(partner.name)!.used++;
            plan.push({
                target,
                auditors: [partner],
                totalAuditorsInGroup: partner.auditors,
                auditorSideAssets: partner.assets
            });
            handledTargets.add(target.name);
        }
    });

    setStrategicPlan(plan);
    setWorkflowStep('results');
    setIsProcessing(false);
  };

  return (
    <div className="space-y-8">

      {/* 3-TAB GROUP BUILDER COMPONENT */}
      <GroupBuilderTab 
        departments={departments}
        auditGroups={auditGroups}
        onAddAuditGroup={onAddAuditGroup}
        onDeleteAuditGroup={onDeleteAuditGroup}
        onBulkUpdateDepartments={onBulkUpdateDepartments}
        isProcessing={isProcessing}
        setIsProcessing={setIsProcessing}
      />
          
      {/* Manual Mode Header */}
          <div className="bg-white rounded-[40px] border-2 border-slate-200 p-8 md:p-12 shadow-sm">
             <div className="flex flex-col lg:flex-row gap-12 items-center">
              <div className="lg:w-1/3">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl mb-6">
                  <Link className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-4">Manual Rules Matrix</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                  Directly configure audit relationships. Use the Grid view for a visual overview or List view for detailed management.
                </p>
                
                <div className="flex gap-2">
                   <button 
                     onClick={() => setManualViewMode('grid')}
                     className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${manualViewMode === 'grid' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                   >
                     <Grid className="w-4 h-4 mr-2 inline-block" />Grid View
                   </button>
                   <button 
                     onClick={() => setManualViewMode('list')}
                     className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${manualViewMode === 'list' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                   >
                     <List className="w-4 h-4 mr-2 inline-block" />List View
                   </button>
                </div>
              </div>

              {manualViewMode === 'list' && (
                <div className="lg:w-2/3 w-full bg-slate-50 rounded-[32px] p-8 border border-slate-100 animate-in fade-in">
                  <div className="grid sm:grid-cols-2 gap-8 relative">
                     {/* Connection Line Visual */}
                     <div className="hidden sm:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
                        <div className="w-12 h-12 bg-white rounded-full border border-slate-200 flex items-center justify-center shadow-sm">
                          {isMutual ? <ArrowRightLeft className="w-5 h-5 text-blue-500" /> : <ArrowRight className="w-5 h-5 text-blue-500" />}
                        </div>
                     </div>

                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block px-2">Auditing Unit</label>
                       <select 
                          className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 outline-none appearance-none cursor-pointer"
                          value={manualAuditor}
                          onChange={(e) => setManualAuditor(e.target.value)}
                       >
                         <option value="">Select Auditor</option>
                         {entities.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
                       </select>
                     </div>

                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block px-2">Target Unit</label>
                       <select 
                          className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 outline-none appearance-none cursor-pointer"
                          value={manualTarget}
                          onChange={(e) => setManualTarget(e.target.value)}
                       >
                         <option value="">Select Target</option>
                         {entities.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
                       </select>
                     </div>
                  </div>

                  <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 border-t border-slate-200">
                     <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative inline-flex items-center">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={isMutual}
                            onChange={() => setIsMutual(!isMutual)}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </div>
                        <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Apply Mutual Reciprocity</span>
                     </label>

                     <button 
                       onClick={handleAddManualPair}
                       disabled={!manualAuditor || !manualTarget || isProcessing}
                       className="w-full sm:w-auto px-10 py-4 bg-blue-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
                     >
                       {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2 inline-block" /> : <Link className="w-4 h-4 mr-2 inline-block" />}
                       Authorize Pairing
                     </button>
                  </div>
                </div>
              )}
             </div>
          </div>

          {manualViewMode === 'grid' && (
             <div className="animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between mb-4 px-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Rules Matrix Grid</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Rows = Auditors, Columns = Targets</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden p-4">
                   <div className="overflow-x-auto">
                      <table className="w-full text-center">
                         <thead>
                            <tr>
                               <th className="p-3 text-left min-w-[150px] text-[10px] font-black uppercase text-slate-400 tracking-widest bg-slate-50/50 rounded-tl-xl">
                                  Auditor \ Target
                               </th>
                               {entities.map(target => (
                                  <th key={target.name} className="p-3 min-w-[100px] text-[10px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap bg-slate-50/50 first:rounded-tl-xl last:rounded-tr-xl">
                                     {target.name}
                                  </th>
                               ))}
                            </tr>
                         </thead>
                         <tbody>
                            {entities.map(auditor => (
                               <tr key={auditor.name} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 last:border-0">
                                  <td className="p-3 text-left font-bold text-xs text-slate-700 bg-slate-50/20 border-r border-slate-100">
                                     {auditor.name}
                                  </td>
                                  {entities.map(target => {
                                     const isSelf = auditor.name === target.name;
                                     const hasPerm = permissions.some(p => p.auditorDept === auditor.name && p.targetDept === target.name && p.isActive);
                                     
                                     return (
                                        <td key={`${auditor.name}-${target.name}`} className="p-2">
                                           {isSelf ? (
                                              <div className="w-8 h-8 mx-auto rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 cursor-not-allowed" title="Self-audit restricted">
                                                 <Ban className="w-4 h-4" />
                                              </div>
                                           ) : (
                                              <button
                                                 onClick={() => handleGridToggle(auditor.name, target.name)}
                                                 className={`w-8 h-8 mx-auto rounded-lg flex items-center justify-center transition-all active:scale-95 ${hasPerm ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600' : 'bg-white border border-slate-200 text-slate-300 hover:border-blue-300 hover:text-blue-400'}`}
                                                 title={hasPerm ? `Allowed: ${auditor.name} -> ${target.name}` : `Denied: ${auditor.name} -> ${target.name}`}
                                              >
                                                 {hasPerm ? <Check className="w-4 h-4" /> : <Check className="w-4 h-4 opacity-20" />}
                                              </button>
                                           )}
                                        </td>
                                     );
                                  })}
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
             </div>
          )}

          {manualViewMode === 'list' && (
            <div className="mt-8 animate-in fade-in">
               <div className="flex items-center justify-between mb-6 px-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Detailed Registry</h4>
                  <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                     Showing {permissions?.length || 0} Active Links
                  </div>
               </div>
               
               <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[700px]">
                       <thead className="bg-slate-50/50 border-b border-slate-100">
                          <tr>
                             <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Auditing Department (Unit)</th>
                             <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Relationship Logic</th>
                             <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Target Department (Unit)</th>
                             <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {!groupedPermissions || Object.keys(groupedPermissions).length === 0 ? (
                            <tr>
                               <td colSpan={4} className="py-16 text-center">
                                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-200">
                                     <Link2Off className="w-8 h-8" />
                                  </div>
                                  <p className="text-sm font-bold text-slate-400 italic">No manual pairings currently active.</p>
                               </td>
                            </tr>
                          ) : (
                            Object.entries(groupedPermissions).map(([auditorDept, perms]) => (
                               <React.Fragment key={auditorDept}>
                                  {/* Explicitly casting perms to any[] to avoid 'unknown' type error on .map */}
                                  {(perms as any[]).map((perm, pIdx) => (
                                     <tr key={perm.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-5">
                                           {pIdx === 0 ? (
                                              <div className="flex items-center gap-3">
                                                 <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-black border border-blue-100">
                                                    {auditorDept.substring(0, 2).toUpperCase()}
                                                 </div>
                                                 <span className="text-sm font-black text-slate-900 tracking-tight">{auditorDept}</span>
                                              </div>
                                           ) : (
                                              <div className="pl-12 text-[10px] font-bold text-slate-300 uppercase tracking-widest">Cont. Group</div>
                                           )}
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                           <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border ${perm.isMutual ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                              {perm.isMutual ? <ArrowRightLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                                              {perm.isMutual ? 'Mutual' : 'One-Way'}
                                           </div>
                                        </td>
                                        <td className="px-8 py-5">
                                           <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                              <Building2 className="w-3 h-3 opacity-30" />
                                              {perm.targetDept}
                                           </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                           <button 
                                              onClick={() => onRemovePermission && onRemovePermission(perm.id)}
                                              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-95"
                                              title="Sever Relationship Link"
                                           >
                                              <Trash2 className="w-4 h-4" />
                                           </button>
                                        </td>
                                     </tr>
                                  ))}
                               </React.Fragment>
                            ))
                          )}
                       </tbody>
                    </table>
                 </div>
               </div>
            </div>
          )}

      {/* ENTITIES LIST */}
      <ActiveEntitiesList 
        entities={entities.filter(e => !e.isGroup)}
        selectedEntity={selectedAuditor}
        onSelect={setSelectedAuditor}
        megaTargetThreshold={megaTargetThreshold}
        minAuditors={minAuditors}
      />

      <ConfirmationModal
        isOpen={activeModal === 'apply'}
        title="Apply Strategic Matrix?"
        message="This will overwrite existing cross-departmental permissions to enforce anti-self-audit rules. JKE will audit other departments, but never JKE itself."
        confirmLabel="Apply Now"
        cancelLabel="Cancel"
        onConfirm={executeApply}
        onCancel={() => setActiveModal(null)}
        variant="info"
      />

      <ConfirmationModal
        isOpen={activeModal === 'reset'}
        title="Clear Configurations?"
        message="This will dissolve all consolidated groups, clear the current matrix results, AND remove all active manual/auto permissions. This action cannot be undone."
        confirmLabel="Reset Everything"
        cancelLabel="Cancel"
        onConfirm={executeReset}
        onCancel={() => setActiveModal(null)}
        variant="warning"
      />
    </div>
  );
};
