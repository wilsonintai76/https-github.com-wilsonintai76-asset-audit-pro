
import React, { useState, useMemo } from 'react';
import { Department, CrossAuditPermission, User } from '../types';
import { Wand2, UserPen, Zap, Boxes, Loader2, Layers, Network, Check, CheckCheck, RotateCcw, Link, Grid, List, ArrowRightLeft, ArrowRight, Ban, Users, Building2, Trash2, Link2Off } from 'lucide-react';
import { ActiveEntitiesList } from './ActiveEntitiesList';
import { ConfirmationModal } from './ConfirmationModal';
import { MatrixCard } from './MatrixCard';

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
}

export const CrossAuditManagement: React.FC<CrossAuditManagementProps> = ({ 
  departments, 
  users,
  permissions, 
  onTogglePermission,
  onAddPermission,
  onRemovePermission,
  onUpdateDepartment,
  onBulkUpdateDepartments
}) => {
  // --- STATE ---
  const [mgmtMode, setMgmtMode] = useState<ManagementMode>('auto');
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

  // Internal Audit option
  type InternalAuditMode = 'off' | 'all' | 'specific';
  const [internalAuditMode, setInternalAuditMode] = useState<InternalAuditMode>('off');
  const [internalAuditDepts, setInternalAuditDepts] = useState<Set<string>>(new Set());
  const [showInternalPanel, setShowInternalPanel] = useState(false);

  const canSelfAudit = (entityName: string): boolean => {
    if (internalAuditMode === 'off') return false;
    if (internalAuditMode === 'all') return true;
    return internalAuditDepts.has(entityName);
  };

  // Minimum auditors required specifically for internal (self) audit
  const MIN_SELF_AUDIT_AUDITORS = 3;

  const toggleInternalDept = (name: string) => {
    setInternalAuditDepts(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  // 1. Compute Stats for Each Department
  const deptStats = useMemo(() => {
    return departments.map(dept => {
      const auditorCount = users.filter(u => 
        u.departmentId === dept.id && 
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
    const map = new Map<string, { assets: number, auditors: number, memberCount: number, members: any[] }>(); 

    deptStats.forEach(d => {
      const entityName = d.auditGroup || d.name;
      const current = map.get(entityName) || { assets: 0, auditors: 0, memberCount: 0, members: [] };
      const safeAssets = typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0);

      map.set(entityName, { 
        assets: current.assets + safeAssets,
        auditors: current.auditors + d.auditorCount,
        memberCount: current.memberCount + 1,
        members: [...current.members, d]
      });
    });

    return Array.from(map.entries()).map(([name, stats]) => ({ name, ...stats, isJoint: stats.memberCount > 1 }));
  }, [deptStats]);

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
        .filter(d => d.auditGroup)
        .map(d => ({ id: d.id, data: { auditGroup: "" } }));

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
    if (manualAuditor === manualTarget && !canSelfAudit(manualAuditor)) {
      alert("Conflict Detected: This unit is not permitted to audit its own assets. Enable Internal Audit (All or select this department) to allow self-audit.");
      return;
    }
    // Warn if self-auditing dept has insufficient staff (min 3 for internal audit)
    if (manualAuditor === manualTarget) {
      const selfEntity = entities.find(e => e.name === manualAuditor);
      if (selfEntity && selfEntity.auditors < MIN_SELF_AUDIT_AUDITORS) {
        alert(`Warning: "${manualAuditor}" has only ${selfEntity.auditors} active staff. Internal audit requires at least 3 auditors from within the department.`);
        return;
      }
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
    if (auditorName === targetName && !canSelfAudit(auditorName)) return; // Prevent self-audit unless internal audit enabled
    
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
    const getAssets = (d: typeof deptStats[0]) =>
      typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0);

    // Split into small pool (individual assets < threshold) and large pool (>= threshold)
    const smallPool = [...deptStats]
      .filter(d => getAssets(d) < assetThreshold)
      .sort((a, b) => getAssets(a) - getAssets(b));

    const largePool = [...deptStats]
      .filter(d => getAssets(d) >= assetThreshold)
      .sort((a, b) => getAssets(a) - getAssets(b));

    const updates: { id: string, data: Partial<Department> }[] = [];
    let groupIndex = 1;

    // Generic accumulator: form groups by summing assets until target is reached
    const accumulate = (pool: typeof deptStats, target: number) => {
      let bucket: typeof deptStats = [];
      let bucketAssets = 0;
      let bucketAuditors = 0;

      pool.forEach(d => {
        bucket.push(d);
        bucketAssets += getAssets(d);
        bucketAuditors += d.auditorCount;

        if (bucketAssets >= target && bucketAuditors >= minAuditors) {
          const name = `Group ${String.fromCharCode(64 + groupIndex)}`;
          bucket.forEach(m => updates.push({ id: m.id, data: { auditGroup: name } }));
          bucket = [];
          bucketAssets = 0;
          bucketAuditors = 0;
          groupIndex++;
        }
      });

      // Remaining depts that never reached target → append to last group
      if (bucket.length > 0) {
        const name = groupIndex > 1
          ? `Group ${String.fromCharCode(64 + groupIndex - 1)}`
          : `Group ${String.fromCharCode(64 + groupIndex++)}`;
        bucket.forEach(m => updates.push({ id: m.id, data: { auditGroup: name } }));
      }
    };

    // Small depts → groups capped at assetThreshold
    accumulate(smallPool, assetThreshold);
    // Large depts → groups capped at megaTargetThreshold (pairs/trios of similar-sized depts)
    accumulate(largePool, megaTargetThreshold);

    await onBulkUpdateDepartments(updates);
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

        // Try to find a cross-dept partner with available capacity first
        const partner = validAuditorEntities
            .filter(e => e.name !== target.name)
            .sort((a, b) => {
                const aLoad = workloadMap.get(a.name)!;
                const bLoad = workloadMap.get(b.name)!;
                return (aLoad.used / aLoad.max) - (bLoad.used / bLoad.max);
            })
            .find(e => {
                const load = workloadMap.get(e.name)!;
                return load.used < load.max;
            });

        if (partner) {
            workloadMap.get(partner.name)!.used++;
            plan.push({
                target,
                auditors: [partner],
                totalAuditorsInGroup: partner.auditors,
                auditorSideAssets: partner.assets
            });
            handledTargets.add(target.name);
        } else if (canSelfAudit(target.name)) {
            // No cross-dept partner available — fall back to internal (self) audit
            // Requires at least 3 auditors from within the department
            const selfEntity = entities.find(e => e.name === target.name);
            if (selfEntity && selfEntity.auditors >= MIN_SELF_AUDIT_AUDITORS) {
                plan.push({
                    target,
                    auditors: [{ ...selfEntity, isJoint: false }],
                    totalAuditorsInGroup: selfEntity.auditors,
                    auditorSideAssets: selfEntity.assets
                });
                handledTargets.add(target.name);
            }
        }
    });

    // When internal audit is on, add self-pairs for any still-unhandled entities
    // Final pass: self-pair any still-unhandled entity that is allowed internal audit
    allTargets.forEach(target => {
        if (handledTargets.has(target.name)) return;
        if (!canSelfAudit(target.name)) return;
        const selfEntity = entities.find(e => e.name === target.name);
        if (selfEntity && selfEntity.auditors >= MIN_SELF_AUDIT_AUDITORS) {
            plan.push({
                target,
                auditors: [{ ...selfEntity, isJoint: false }],
                totalAuditorsInGroup: selfEntity.auditors,
                auditorSideAssets: selfEntity.assets
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
      {/* MODE SELECTOR + INTERNAL AUDIT TOGGLE */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setMgmtMode('auto')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mgmtMode === 'auto' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Wand2 className="w-4 h-4" />
            Optimization Engine
          </button>
          <button 
            onClick={() => setMgmtMode('manual')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mgmtMode === 'manual' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <UserPen className="w-4 h-4" />
            Manual Matrix
          </button>
        </div>

        {/* Internal Audit Toggle */}
        <div className="flex flex-col gap-2">
          <div className="flex bg-white border border-slate-200 rounded-2xl shadow-sm p-1 gap-1">
            {(['off', 'all', 'specific'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => { setInternalAuditMode(mode); setShowInternalPanel(mode === 'specific'); }}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  internalAuditMode === mode
                    ? mode === 'off' ? 'bg-slate-900 text-white' : 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                {mode === 'off' ? 'Cross-Dept Only' : mode === 'all' ? 'Internal: All' : 'Internal: Specific'}
              </button>
            ))}
          </div>
          {internalAuditMode !== 'off' && (
            <p className="text-[10px] text-center text-indigo-500 font-bold">
              {internalAuditMode === 'all'
                ? 'All departments may audit themselves'
                : internalAuditDepts.size === 0
                  ? 'No departments selected yet — click to choose'
                  : `${internalAuditDepts.size} department${internalAuditDepts.size > 1 ? 's' : ''} may self-audit`
              }
            </p>
          )}
        </div>
      </div>

      {/* Specific dept selector panel */}
      {internalAuditMode === 'specific' && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-5 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-black text-indigo-700 uppercase tracking-widest">Select Departments Allowed to Self-Audit</h4>
            <div className="flex gap-2">
              <button onClick={() => setInternalAuditDepts(new Set(entities.filter(e => e.auditors >= MIN_SELF_AUDIT_AUDITORS).map(e => e.name)))} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 px-3 py-1 bg-white border border-indigo-200 rounded-lg transition-colors">Select Eligible</button>
              <button onClick={() => setInternalAuditDepts(new Set())} className="text-[10px] font-bold text-slate-500 hover:text-slate-700 px-3 py-1 bg-white border border-slate-200 rounded-lg transition-colors">Clear</button>
            </div>
          </div>
          <p className="text-[10px] text-indigo-400 mb-4">Only departments with at least 3 active staff can perform internal audits. Departments below this threshold are disabled.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {entities.map(e => {
              const selected = internalAuditDepts.has(e.name);
              const hasAuditors = e.auditors >= MIN_SELF_AUDIT_AUDITORS;
              return (
                <button
                  key={e.name}
                  onClick={() => hasAuditors && toggleInternalDept(e.name)}
                  disabled={!hasAuditors}
                  title={!hasAuditors ? `${e.name} has ${e.auditors} active staff — needs at least ${MIN_SELF_AUDIT_AUDITORS} to self-audit` : undefined}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-left transition-all border ${
                    !hasAuditors
                      ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed'
                      : selected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${
                    !hasAuditors ? 'border-slate-200 bg-slate-200'
                    : selected ? 'bg-white/30 border-white/50' : 'border-slate-300'
                  }`}>
                    {selected && hasAuditors && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate">{e.name}</span>
                    <span className={`text-[9px] font-normal ${
                      !hasAuditors ? 'text-slate-300' : selected ? 'text-indigo-200' : 'text-slate-400'
                    }`}>
                      {e.auditors} auditor{e.auditors !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mgmtMode === 'auto' ? (
        <>
          {/* AUTO CONTROL PANEL */}
          <div className="bg-slate-900 rounded-[32px] p-6 md:p-10 text-white shadow-2xl relative overflow-hidden animate-in fade-in duration-500">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none"></div>

            <div className="relative z-10 grid grid-cols-1 xl:grid-cols-2 gap-12">
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg flex items-center justify-center text-2xl">
                      <Zap className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h3 className="text-3xl font-black tracking-tight leading-none text-white">Bulk Pairing</h3>
                        <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mt-1.5">Strict Conflict-of-Interest Logic</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-md">
                    Automated reciprocity logic. Ensures all teams consist of at least {minAuditors} qualified auditors{internalAuditMode !== 'off' ? ` (${MIN_SELF_AUDIT_AUDITORS} for self-audit)` : ''} and no unit audits itself.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <div className={`p-4 rounded-2xl border transition-all ${
                        internalAuditMode !== 'off'
                          ? 'bg-indigo-500/10 border-indigo-500/20'
                          : 'bg-white/5 border-white/5'
                      }`}>
                        <div className={`text-[10px] font-bold uppercase mb-1 flex items-center gap-2 ${
                          internalAuditMode !== 'off' ? 'text-indigo-400' : 'text-rose-400'
                        }`}>
                          {internalAuditMode !== 'off'
                            ? <><Building2 className="w-3 h-3" /> Internal Audit {internalAuditMode === 'all' ? '(All)' : `(${internalAuditDepts.size} depts)`}</>
                            : <><Ban className="w-3 h-3" /> Anti-Self Audit</>
                          }
                        </div>
                        <p className="text-xs text-slate-400 font-medium">
                          {internalAuditMode !== 'off' ? 'Self-audit fallback enabled' : 'No entity audits own assets'}
                        </p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <div className="text-[10px] font-bold text-emerald-400 uppercase mb-1 flex items-center gap-2">
                            <Users className="w-3 h-3" /> Staffing
                        </div>
                        <p className="text-xs text-slate-400 font-medium">Min {internalAuditMode !== 'off' ? MIN_SELF_AUDIT_AUDITORS : minAuditors} Auditors per team{internalAuditMode !== 'off' ? <span className="text-amber-400 ml-1">(self-audit: {MIN_SELF_AUDIT_AUDITORS})</span> : null}</p>
                      </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className={`transition-all duration-500 ${workflowStep === 'grouping' ? 'opacity-100' : 'opacity-50 grayscale'}`}>
                      <div className="bg-white/5 p-6 rounded-3xl border border-white/10 relative group hover:border-white/20 transition-all">
                          <div className="absolute top-4 right-4 text-slate-500 text-[10px] font-black uppercase tracking-widest bg-white/5 px-2 py-1 rounded">Step 1</div>
                          <h4 className="text-lg font-bold text-white mb-4">Unit Consolidation</h4>
                          
                          <div className="mb-4">
                            <div className="w-full">
                                <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase">Small Group Threshold (Assets)</label>
                                <p className="text-[9px] text-slate-500 mb-2">Departments with fewer assets than this are bundled together until their combined total reaches this value.</p>
                                <div className="flex items-center gap-3 bg-black/20 rounded-xl px-4 py-3 border border-white/10">
                                  <Boxes className="w-4 h-4 text-blue-500" />
                                  <input 
                                      type="number" 
                                      value={assetThreshold} 
                                      onChange={(e) => setAssetThreshold(parseInt(e.target.value) || 0)} 
                                      className="bg-transparent border-none text-white font-bold text-sm w-full focus:ring-0 p-0"
                                      disabled={workflowStep !== 'grouping'} 
                                  />
                                </div>
                            </div>
                          </div>
                          
                          {workflowStep === 'grouping' ? (
                            <button 
                                onClick={handleAnalyzeAndGroup} 
                                disabled={isProcessing}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-sm font-black uppercase tracking-wider transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                                {isProcessing ? 'Grouping...' : 'Consolidate Units'}
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                                <Check className="w-4 h-4" /> Consolidation Complete
                            </div>
                          )}
                      </div>
                  </div>

                  {workflowStep !== 'grouping' && (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <div className="bg-white/5 p-6 rounded-3xl border border-white/10 relative group hover:border-white/20 transition-all">
                              <div className="absolute top-4 right-4 text-slate-500 text-[10px] font-black uppercase tracking-widest bg-white/5 px-2 py-1 rounded">Step 2</div>
                              <h4 className="text-lg font-bold text-white mb-4">Strategic Pairing</h4>
                                                            <div className="flex gap-4 items-end mb-4">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase">Large Group Threshold</label>
                                    <p className="text-[9px] text-slate-500 mb-1.5">Large depts (≥ small threshold) pair together until this total is reached.</p>
                                    <div className="flex items-center gap-2 bg-black/20 rounded-xl px-3 py-2 border border-white/10">
                                      <Zap className="w-3 h-3 text-amber-500" />
                                      <input 
                                          type="number" 
                                          value={megaTargetThreshold} 
                                          onChange={(e) => setMegaTargetThreshold(parseInt(e.target.value) || 0)} 
                                          className="bg-transparent border-none text-white font-bold text-sm w-full focus:ring-0 p-0"
                                          disabled={workflowStep === 'results'}
                                      />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase">Min Auditors</label>
                                    <div className="flex items-center gap-2 bg-black/20 rounded-xl px-3 py-2 border border-white/10">
                                      <Users className="w-3 h-3 text-purple-500" />
                                      <input 
                                          type="number" 
                                          value={minAuditors} 
                                          onChange={(e) => setMinAuditors(parseInt(e.target.value) || 0)} 
                                          className="bg-transparent border-none text-white font-bold text-sm w-full focus:ring-0 p-0"
                                          disabled={workflowStep === 'results'}
                                      />
                                    </div>
                                </div>
                              </div>
                              
                              {workflowStep === 'pairing' ? (
                                <button 
                                    onClick={generateStrategicPlan} 
                                    disabled={isProcessing}
                                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl text-sm font-black uppercase tracking-wider transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
                                    {isProcessing ? 'CALCULATING...' : 'GENERATE MATRIX'}
                                </button>
                              ) : (
                                <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                                    <Check className="w-4 h-4" /> Strategic Plan Ready
                                </div>
                              )}
                          </div>
                      </div>
                  )}
                </div>
            </div>
          </div>

          {/* RESULTS VIEW */}
          {workflowStep === 'results' && strategicPlan?.length > 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Final Pairing Matrix</h3>
                    <p className="text-sm text-slate-500">Distributed workloads ensuring no auditor audits their own department.</p>
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                    <button 
                        onClick={handleApplyClick}
                        disabled={isProcessing || isApplied}
                        className={`flex-1 md:flex-none px-6 py-3 text-white font-bold rounded-xl text-xs uppercase transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${
                          isApplied 
                            ? 'bg-emerald-600 shadow-emerald-600/20' 
                            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                        }`}
                    >
                        {isApplied ? <CheckCheck className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        {isApplied ? 'Permissions Active' : 'Apply Matrix'}
                    </button>
                    <button 
                        onClick={handleResetClick}
                        disabled={isProcessing || isApplied}
                        className="flex-1 md:flex-none px-6 py-3 bg-slate-100 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs uppercase hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-30"
                    >
                        <RotateCcw className="w-4 h-4 mr-2 inline-block" />Reset
                    </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {strategicPlan.map((pair, idx) => (
                    <MatrixCard key={idx} pair={pair} index={idx} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
          
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
                                           {isSelf && !canSelfAudit(auditor.name) ? (
                                              <div className="w-8 h-8 mx-auto rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 cursor-not-allowed" title="Self-audit restricted — enable Internal Audit toggle to allow">
                                                 <Ban className="w-4 h-4" />
                                              </div>
                                           ) : isSelf ? (
                                              <button
                                                 onClick={() => handleGridToggle(auditor.name, target.name)}
                                                 className={`w-8 h-8 mx-auto rounded-lg flex items-center justify-center transition-all active:scale-95 border-2 border-dashed ${
                                                   hasPerm
                                                     ? 'bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-500/20 hover:bg-indigo-600'
                                                     : 'bg-indigo-50 border-indigo-200 text-indigo-300 hover:border-indigo-400 hover:text-indigo-500'
                                                 }`}
                                                 title={hasPerm ? `Internal: ${auditor.name} audits itself` : `Allow internal audit: ${auditor.name}`}
                                              >
                                                 <Building2 className="w-3.5 h-3.5" />
                                              </button>
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
        </div>
      )}

      {/* ENTITIES LIST */}
      <ActiveEntitiesList 
        entities={entities}
        selectedEntity={selectedAuditor}
        onSelect={setSelectedAuditor}
        megaTargetThreshold={megaTargetThreshold}
        minAuditors={minAuditors}
      />

      <ConfirmationModal
        isOpen={activeModal === 'apply'}
        title="Apply Strategic Matrix?"
        message={internalAuditMode !== 'off'
          ? `This will overwrite existing permissions. ${
              internalAuditMode === 'all'
                ? 'All departments may be assigned as self-auditors as fallback.'
                : `${internalAuditDepts.size} selected department(s) may self-audit as fallback.`
            }`
          : "This will overwrite existing cross-departmental permissions. No unit will be permitted to audit its own assets."
        }
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
