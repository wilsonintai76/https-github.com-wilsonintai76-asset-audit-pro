import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Department, CrossAuditPermission, User, AuditGroup } from '@shared/types';
import { Wand2, Zap, Boxes, Loader2, Layers, Network, CheckCheck, RotateCcw, Link, ArrowRightLeft, ArrowRight, Ban, Users, Building2, Trash2, X, ShieldCheck, ChevronDown, Lock, Calendar, Sparkles } from 'lucide-react';
import { PrintButton } from './PrintButton';
import { printCrossAuditAssignments, printStrategicInspectionPlanApproval } from '../lib/printUtils';
import { suggestThresholds } from '../services/aiService';
import { AuditConstraints } from './AuditConstraints';
import { ConfirmationModal } from './ConfirmationModal';

interface StrategicPair {
  target: { id: string; name: string; assets: number; auditors: number; members?: any[]; isJoint?: boolean };
  auditors: { id: string; name: string; assets: number; auditors: number; isJoint: boolean; members?: any[] }[];
  totalAuditorsInGroup: number;
  auditorSideAssets: number;
}

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
  onBulkDeleteAuditGroups?: (ids: string[]) => Promise<void>;
  onAutoConsolidate?: (threshold: number, excludedIds: string[], minAuditors?: number) => Promise<void>;
  onBulkAddPermissions?: (perms: Omit<CrossAuditPermission, 'id'>[]) => Promise<void>;
  onBulkRemovePermissions?: (ids: string[]) => Promise<void>;
  phases?: any[];
  institutionKPIs?: any[];
  showToast?: (message: string, type?: any) => void;
  maxAssetsPerDay?: number;
  maxLocationsPerDay?: number;
  onUpdateMaxAssetsPerDay?: (value: number) => void;
  onUpdateMaxLocationsPerDay?: (value: number) => void;
  minAuditorsPerLocation?: number;
  onUpdateMinAuditorsPerLocation?: (value: number) => void;
  dailyInspectionCapacity?: number;
  onUpdateDailyInspectionCapacity?: (value: number) => void;
  pairingLocked?: boolean;
  pairingLockInfo?: { lockedAt: string; lockedBy: string; pairingCount: number; cycleYear: number } | null;
  onLockPairing?: (pairingCount: number) => Promise<void>;
  onUnlockPairing?: () => Promise<void>;
  onRunStrategicPairing?: (payload: any) => Promise<{ pairings: any[] }>;
  feasibilityReport?: {
    score: number;
    riskLevel: string;
    bottlenecks: string[];
    recommendations: string[];
  } | null;
  isSimulatorActive: boolean;
  setIsSimulatorActive: (v: boolean) => void;
  draftConstraints: any;
  setDraftConstraints: (v: any) => void;
}

export const CrossAuditManagement: React.FC<CrossAuditManagementProps> = ({ 
  departments, 
  users,
  permissions, 
  onRemovePermission,
  onBulkUpdateDepartments,
  auditGroups = [],
  onDeleteAuditGroup,
  onBulkDeleteAuditGroups,
  onBulkAddPermissions,
  onBulkRemovePermissions,
  maxAssetsPerDay = 1000,
  maxLocationsPerDay = 5,
  minAuditorsPerLocation: minAuditorsPerLocationProp = 2,
  dailyInspectionCapacity: dailyInspectionCapacityProp = 150,
  showToast,
  onUpdateMaxAssetsPerDay,
  onUpdateMaxLocationsPerDay,
  onUpdateMinAuditorsPerLocation,
  onUpdateDailyInspectionCapacity,
  onUnlockPairing,
  onRunStrategicPairing,
  feasibilityReport,
  isSimulatorActive,
  setIsSimulatorActive,
  draftConstraints,
  setDraftConstraints
}) => {
  const [strategicPlan, setStrategicPlan] = useState<StrategicPair[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeModal, setActiveModal] = useState<'reset' | null>(null);
  const [showConstraints, setShowConstraints] = useState(false);
  const [auditorFilter, setAuditorFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');

  const SIMULATOR_ACTIVE_KEY = 'cross_audit_simulator_active';
  const SIMULATOR_PAIRINGS_KEY = 'cross_audit_simulator_pairings';

  const [pairingStrategy, setPairingStrategy] = useState<'mutual' | 'asymmetric'>(() => {
    return (localStorage.getItem('cross_audit_grouping_strategy') as any) || 'asymmetric';
  });
  const [useAI, setUseAI] = useState<boolean>(() => localStorage.getItem('cross_audit_use_ai') === 'true');

  const kpiBarRef = useRef<HTMLDivElement>(null);

  const [simulatedPairings, setSimulatedPairings] = useState<Omit<CrossAuditPermission, 'id'>[]>(() => {
    try {
      const stored = localStorage.getItem(SIMULATOR_PAIRINGS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [simulateIdealStaffing, setSimulateIdealStaffing] = useState<boolean>(() => {
    return localStorage.getItem('cross_audit_simulate_staff') === 'true';
  });
  const [pairingMode, setPairingMode] = useState<'assets' | 'assets_auditors'>(() => {
    const s = localStorage.getItem('cross_audit_pairing_mode');
    return (s === 'assets' || s === 'assets_auditors') ? s : 'assets_auditors';
  });
  const [strictAuditorRule, setStrictAuditorRule] = useState<boolean>(true);
  const [autoPairingMutual, setAutoPairingMutual] = useState<boolean>(() => {
    return localStorage.getItem('cross_audit_mutual') === 'true';
  });

  // Effective constraint constants (checks if we are in draft mode)
  const currentMaxAssets = draftConstraints?.maxAssetsPerDay ?? maxAssetsPerDay;
  const currentMaxLocations = draftConstraints?.maxLocationsPerDay ?? maxLocationsPerDay;
  const currentMinAuditors = draftConstraints?.minAuditorsPerLocation ?? (strictAuditorRule ? 2 : minAuditorsPerLocation);
  const currentDailyCapacity = draftConstraints?.dailyInspectionCapacity ?? dailyInspectionCapacity;

  const overallTotalAssets = useMemo(() => {
    return departments.reduce((sum, d) => sum + (typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0)), 0);
  }, [departments]);

  const activeDepts = useMemo(() => departments.filter(d => !d.isExempted && !d.isSystemExempted), [departments]);
  const exemptedDepts = useMemo(() => departments.filter(d => d.isExempted || d.isSystemExempted), [departments]);

  const entities = useMemo(() => {
    const groupedDepts: Record<string, Department[]> = {};
    const getAuditorCount = (deptId: string) => {
      const today = new Date().toISOString().split('T')[0];
      return users.filter(u => u.departmentId === deptId && u.status === 'Active' && u.certificationExpiry && u.certificationExpiry >= today).length;
    };

    activeDepts.forEach(dept => {
      const groupExists = dept.auditGroupId && auditGroups.some(g => g.id === dept.auditGroupId);
      const key = groupExists ? dept.auditGroupId! : 'unassigned_' + dept.id;
      if (!groupedDepts[key]) groupedDepts[key] = [];
      groupedDepts[key].push({ ...dept, auditorCount: getAuditorCount(dept.id) });
    });

    return Object.entries(groupedDepts).map(([groupId, depts]) => {
      const isUnassigned = groupId.startsWith('unassigned_');
      const totalAssets = depts.reduce((sum, d) => sum + (typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0)), 0);
      const totalAuditors = depts.reduce((sum, d) => sum + (d.auditorCount || 0), 0);
      const name = isUnassigned ? depts[0].name : auditGroups.find(g => g.id === groupId)?.name ?? depts[0].name;
      const constitutesGroup = !isUnassigned;
      return { name, assets: totalAssets, auditors: totalAuditors, memberCount: depts.length, isJoint: constitutesGroup, isGroup: constitutesGroup, id: groupId, members: depts };
    }).sort((a, b) => b.assets - a.assets);
  }, [activeDepts, auditGroups, users]);

  useEffect(() => { localStorage.setItem(SIMULATOR_ACTIVE_KEY, isSimulatorActive ? 'true' : 'false'); }, [isSimulatorActive]);
  useEffect(() => { localStorage.setItem(SIMULATOR_PAIRINGS_KEY, JSON.stringify(simulatedPairings)); }, [simulatedPairings]);
  useEffect(() => { localStorage.setItem('cross_audit_pairing_mode', pairingMode); }, [pairingMode]);
  useEffect(() => { localStorage.setItem('cross_audit_simulate_staff', simulateIdealStaffing ? 'true' : 'false'); }, [simulateIdealStaffing]);
  useEffect(() => { localStorage.setItem('cross_audit_mutual', autoPairingMutual ? 'true' : 'false'); }, [autoPairingMutual]);
  useEffect(() => { localStorage.setItem('cross_audit_grouping_strategy', pairingStrategy); }, [pairingStrategy]);

  const executeReset = async () => {
    setActiveModal(null);
    setIsProcessing(true);
    try {
      setStrategicPlan([]);
      setIsSimulatorActive(false);
      setSimulatedPairings([]);
      localStorage.removeItem(SIMULATOR_ACTIVE_KEY);
      localStorage.removeItem(SIMULATOR_PAIRINGS_KEY);
      setDraftConstraints(null);

      const updates = departments.filter(d => d.auditGroupId).map(d => ({ id: d.id, data: { auditGroupId: null } }));
      if (updates.length > 0) await onBulkUpdateDepartments(updates);

      if (onBulkDeleteAuditGroups && auditGroups.length > 0) {
        await onBulkDeleteAuditGroups(auditGroups.map(g => g.id));
      } else if (onDeleteAuditGroup && auditGroups.length > 0) {
        for (const group of auditGroups) await onDeleteAuditGroup(group.id);
      }

      if (onBulkRemovePermissions && permissions.length > 0) {
        await onBulkRemovePermissions(permissions.map(p => p.id));
      }
      await onUnlockPairing?.();
      showToast?.('System configuration reset successfully.');
    } catch (error) {
      console.error("Reset failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunSimulator = () => {
    setIsProcessing(true);
    
    // Use effective constraints (draft if active, else global)
    if (!draftConstraints) {
      setDraftConstraints({
        maxAssetsPerDay,
        maxLocationsPerDay,
        minAuditorsPerLocation: minAuditorsPerLocationProp,
        dailyInspectionCapacity: dailyInspectionCapacityProp
      });
    }

    const minAuditorsRequired = currentMinAuditors;
    const targets = entities.filter(e => e.assets > 0).sort((a, b) => b.assets - a.assets);
    if (targets.length === 0) {
      showToast?.('No entities with assets found.', 'error');
      setIsProcessing(false);
      return;
    }

    const newStrategicPlan: StrategicPair[] = [];
    const usedTargetIds = new Set<string>();
    const newPairings: Omit<CrossAuditPermission, 'id'>[] = [];
    const effectivePairingMode = pairingStrategy === 'mutual' ? 'strict_mutual' : pairingMode;

    if (effectivePairingMode === 'strict_mutual') {
      const pool = entities.filter(e => e.assets > 0 && (simulateIdealStaffing || e.auditors >= minAuditorsRequired));
      const sorted = [...pool].sort((a, b) => b.assets - a.assets);
      const cycle3: typeof sorted = [];
      if (sorted.length % 2 !== 0 && sorted.length >= 3) {
        cycle3.push(sorted.pop()!, sorted.pop()!, sorted.pop()!);
      }

      while (sorted.length >= 2) {
        const a = sorted.shift()!;
        const b = sorted.shift()!;
        const createEntry = (aud: any, tgt: any) => ({
          target: { name: tgt.name, assets: tgt.assets, auditors: tgt.auditors, id: tgt.id } as any,
          auditors: [{ name: aud.name, assets: aud.assets, auditors: simulateIdealStaffing ? Math.max(aud.auditors, 2) : aud.auditors, id: aud.id, isJoint: aud.isJoint }],
          totalAuditorsInGroup: simulateIdealStaffing ? Math.max(aud.auditors, 2) : aud.auditors,
          auditorSideAssets: aud.assets
        });
        newStrategicPlan.push(createEntry(a, b));
        newStrategicPlan.push(createEntry(b, a));
        newPairings.push({ auditorDeptId: a.id!, targetDeptId: b.id!, isActive: true, isMutual: true } as any);
        newPairings.push({ auditorDeptId: b.id!, targetDeptId: a.id!, isActive: true, isMutual: true } as any);
      }

      if (cycle3.length === 3) {
        const [a, b, c] = cycle3;
        [[a, b], [b, c], [c, a]].forEach(([aud, tgt]) => {
          newStrategicPlan.push({ target: tgt as any, auditors: [aud as any], totalAuditorsInGroup: aud.auditors, auditorSideAssets: aud.assets });
          newPairings.push({ auditorDeptId: aud.id!, targetDeptId: tgt.id!, isActive: true, isMutual: false } as any);
        });
      }
    } else {
      const auditorPool = entities.filter(e => simulateIdealStaffing || e.auditors >= minAuditorsRequired);
      const capacityMap = new Map<string, number>();
      
      // Track available "slots" per unit based on their own size and currentDailyCapacity
      auditorPool.forEach(a => {
        const slots = simulateIdealStaffing ? 99 : Math.max(1, Math.floor(a.auditors / minAuditorsRequired));
        capacityMap.set(a.id!, slots);
      });

      let poolIdx = 0;
      for (const target of targets) {
        if (usedTargetIds.has(target.id!)) continue;

        // Calculate how many units we need for this target based on its asset volume
        const unitsNeeded = Math.ceil(target.assets / currentMaxAssets);
        const assignedAuditors: any[] = [];
        
        let attempts = 0;
        const totalPotentialAuditors = auditorPool.length;

        while (assignedAuditors.length < unitsNeeded && attempts < totalPotentialAuditors) {
          const candidate = auditorPool[poolIdx % totalPotentialAuditors];
          poolIdx++;
          attempts++;

          if (candidate.id !== target.id && (capacityMap.get(candidate.id!) || 0) > 0) {
            assignedAuditors.push({
              ...candidate,
              auditors: simulateIdealStaffing ? Math.max(candidate.auditors, currentMinAuditors) : candidate.auditors
            });
            capacityMap.set(candidate.id!, (capacityMap.get(candidate.id!) || 0) - 1);
          }
        }

        if (assignedAuditors.length > 0) {
          newStrategicPlan.push({
            target: target as any,
            auditors: assignedAuditors,
            totalAuditorsInGroup: assignedAuditors.reduce((sum, a) => sum + a.auditors, 0),
            auditorSideAssets: assignedAuditors.reduce((sum, a) => sum + a.assets, 0)
          });

          assignedAuditors.forEach(aud => {
            newPairings.push({ 
              auditorDeptId: aud.id!, 
              targetDeptId: target.id!, 
              isActive: true, 
              isMutual: autoPairingMutual 
            } as any);
          });
          
          usedTargetIds.add(target.id!);
        }
      }
    }

    setStrategicPlan(newStrategicPlan);
    setSimulatedPairings(newPairings);
    setIsSimulatorActive(true);
    setIsProcessing(false);
  };

  const handleCommitSimulation = async () => {
    if (!onBulkAddPermissions || simulatedPairings.length === 0) return;
    setIsProcessing(true);
    try {
      const expandedPairings: Omit<CrossAuditPermission, 'id'>[] = [];
      for (const pair of simulatedPairings) {
        const audEntity = entities.find(e => e.id === pair.auditorDeptId);
        const tgtEntity = entities.find(e => e.id === pair.targetDeptId);
        if (!audEntity || !tgtEntity) continue;
        for (const audD of audEntity.members) {
          for (const tgtD of tgtEntity.members) {
            expandedPairings.push({ auditorDeptId: audD.id, targetDeptId: tgtD.id, isActive: true, isMutual: pair.isMutual });
          }
        }
      }
      if (onBulkRemovePermissions && permissions.length > 0) await onBulkRemovePermissions(permissions.map(p => p.id));
      await onBulkAddPermissions(expandedPairings);

      // PERSIST CONSTRAINTS (Locking them in)
      if (draftConstraints) {
        onUpdateMaxAssetsPerDay?.(draftConstraints.maxAssetsPerDay);
        onUpdateMaxLocationsPerDay?.(draftConstraints.maxLocationsPerDay);
        onUpdateMinAuditorsPerLocation?.(draftConstraints.minAuditorsPerLocation);
        onUpdateDailyInspectionCapacity?.(draftConstraints.dailyInspectionCapacity);
      }

      setIsSimulatorActive(false);
      setSimulatedPairings([]);
      setDraftConstraints(null);
      localStorage.removeItem(SIMULATOR_ACTIVE_KEY);
      localStorage.removeItem(SIMULATOR_PAIRINGS_KEY);
      await onLockPairing?.(expandedPairings.length);
      showToast?.('Assignments and constraints committed and locked.');
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const activePairingsForStats = useMemo(() => {
    if (isSimulatorActive) return simulatedPairings;
    return permissions.filter(p => p.isActive).map(p => ({ auditorDeptId: p.auditorDeptId, targetDeptId: p.targetDeptId }));
  }, [isSimulatorActive, simulatedPairings, permissions]);

  const projectedAssetsMet = useMemo(() => {
    const auditedTargets = new Set(activePairingsForStats.map(p => p.targetDeptId));
    return Array.from(auditedTargets).reduce((sum, tid) => {
      const dept = departments.find(d => d.id === tid);
      return sum + (typeof dept?.totalAssets === 'string' ? parseInt(dept.totalAssets) : (dept?.totalAssets || 0));
    }, 0);
  }, [activePairingsForStats, departments]);

  const projectedKPIPercentage = overallTotalAssets === 0 ? 0 : (projectedAssetsMet / overallTotalAssets) * 100;
  const targetKPIPercentage = 100; // Standard for institutional audits

  const entityPermissions = useMemo(() => {
    if (isSimulatorActive) {
      return simulatedPairings.map((p, idx) => ({ auditorEntityId: p.auditorDeptId, targetEntityId: p.targetDeptId, isMutual: p.isMutual, simIdx: idx }));
    }
    const map = new Map<string, any>();
    permissions.forEach(p => {
      const audE = entities.find(e => e.id === p.auditorDeptId || e.members.some(m => m.id === p.auditorDeptId));
      const tgtE = entities.find(e => e.id === p.targetDeptId || e.members.some(m => m.id === p.targetDeptId));
      if (!audE || !tgtE) return;
      const key = `${audE.id}-${tgtE.id}`;
      if (!map.has(key)) map.set(key, { auditorEntityId: audE.id, targetEntityId: tgtE.id, isMutual: p.isMutual, rawPermIds: [] });
      map.get(key).rawPermIds.push(p.id);
    });
    return Array.from(map.values());
  }, [isSimulatorActive, simulatedPairings, permissions, entities]);

  const filteredPermissions = entityPermissions.filter(p => {
    const aud = entities.find(e => e.id === p.auditorEntityId);
    const tgt = entities.find(e => e.id === p.targetEntityId);
    return (!auditorFilter || aud?.name.toLowerCase().includes(auditorFilter.toLowerCase())) &&
           (!targetFilter || tgt?.name.toLowerCase().includes(targetFilter.toLowerCase()));
  });

  return (
    <div className="bg-white rounded-[40px] border-2 border-slate-200 shadow-sm relative overflow-hidden p-8 md:p-12">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-12">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Institutional Cross-Audit Management</h2>
          <p className="text-slate-500 font-medium">Simulator-driven strategy for movable asset inspections.</p>
        </div>
        <div className="flex items-center gap-3">
          <PrintButton onClick={() => printCrossAuditAssignments(entityPermissions, entities)} label="Print Plan" />
          <button onClick={() => setActiveModal('reset')} className="px-4 py-2.5 rounded-2xl border border-red-100 bg-red-50 text-red-500 text-xs font-bold hover:bg-red-100 transition-all flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Reset Cycle
          </button>
        </div>
      </div>


      <div className="flex flex-col lg:flex-row gap-12">
        {/* Left: Settings */}
        <div className="lg:w-1/3 space-y-8">
           <div className={`p-8 rounded-[32px] border-2 transition-all ${isSimulatorActive ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-6">
                <Zap className={`w-6 h-6 ${isSimulatorActive ? 'text-amber-500' : 'text-indigo-500'}`} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Assignment Strategy</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-8">All audit relationships are generated programmatically to ensure separation of duties and fairness.</p>

              <div className="space-y-6">
                 <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Pairing Logic</p>
                    <div className="flex bg-white/50 p-1 rounded-xl border border-slate-200 gap-1">
                       <button onClick={() => setPairingMode('assets')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${pairingMode === 'assets' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Assets</button>
                       <button onClick={() => setPairingMode('assets_auditors')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${pairingMode === 'assets_auditors' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Capacity</button>
                    </div>
                 </div>

                 <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Institutional Flow</p>
                    <div className="flex bg-white/50 p-1 rounded-xl border border-slate-200 gap-1">
                       <button onClick={() => setPairingStrategy('asymmetric')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${pairingStrategy === 'asymmetric' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Asymmetric (→)</button>
                       <button onClick={() => setPairingStrategy('mutual')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${pairingStrategy === 'mutual' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Mutual (⇄)</button>
                    </div>
                 </div>

                 <div className="pt-4 space-y-3">
                    <label className="flex items-center justify-between cursor-pointer group">
                       <span className="text-[10px] font-black uppercase text-slate-500">Ideal Staffing Simulation</span>
                       <input type="checkbox" className="sr-only peer" checked={simulateIdealStaffing} onChange={() => setSimulateIdealStaffing(!simulateIdealStaffing)} />
                       <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                 </div>

                 {isSimulatorActive ? (
                   <div className="pt-6 space-y-3">
                      <button onClick={handleCommitSimulation} disabled={isProcessing} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-black transition-all">
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                        Commit & Lock
                      </button>
                      <button onClick={() => { setIsSimulatorActive(false); setSimulatedPairings([]); }} className="w-full py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all">
                        Cancel Draft
                      </button>
                   </div>
                 ) : (
                   <button onClick={handleRunSimulator} disabled={isProcessing || pairingLocked} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50">
                     {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                     {pairingLocked ? 'Pairing Locked' : 'Run Auto-Pairing'}
                   </button>
                 )}
              </div>
           </div>

           {exemptedDepts.length > 0 && (
             <div className="p-6 rounded-[28px] border border-rose-100 bg-rose-50/50">
               <div className="flex items-center gap-2 mb-4">
                 <Ban className="w-4 h-4 text-rose-400" />
                 <span className="text-[10px] font-black uppercase text-rose-500">Exempted Departments</span>
               </div>
               <div className="flex flex-wrap gap-2">
                 {exemptedDepts.map(d => <span key={d.id} className="px-2 py-1 bg-white border border-rose-100 rounded-lg text-[9px] font-black uppercase text-rose-400">{d.name}</span>)}
               </div>
             </div>
           )}
        </div>

        {/* Right: Results Dashboard */}
        <div className="lg:w-2/3 space-y-8">
           <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10"><Sparkles className="w-24 h-24" /></div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Institutional Target Achievement</p>
              <div className="text-5xl font-black italic tracking-tighter mb-6">{projectedKPIPercentage.toFixed(1)}%</div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${projectedKPIPercentage}%` }} />
              </div>
              <p className="text-[10px] font-medium text-slate-500 mt-4">Projected Coverage: {projectedAssetsMet.toLocaleString()} / {overallTotalAssets.toLocaleString()} Movable Assets.</p>
           </div>

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
                                <span className="text-sm font-black text-slate-800">{aud?.name || 'Unknown'}</span>
                             </td>
                             <td className="px-6 py-4 text-center">
                                <div className="inline-flex p-1.5 bg-slate-100 rounded-lg text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-500 transition-all">{p.isMutual ? <ArrowRightLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}</div>
                             </td>
                             <td className="px-6 py-4">
                                <span className="text-sm font-black text-slate-800">{tgt?.name || 'Unknown'}</span>
                             </td>
                             <td className="px-6 py-4 text-right">
                                {isSimulatorActive ? (
                                  <button onClick={() => { const up = [...simulatedPairings]; up.splice(p.simIdx, 1); setSimulatedPairings(up); }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><X className="w-4 h-4" /></button>
                                ) : (
                                  <button onClick={() => onBulkRemovePermissions && onBulkRemovePermissions(p.rawPermIds)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                )}
                             </td>
                           </tr>
                         )
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={activeModal === 'reset'}
        title="Reset Entire Cycle?"
        message="This will dissolve all groups and clear all current inspection assignments. This action cannot be undone."
        confirmLabel="Reset Everything"
        onConfirm={executeReset}
        onCancel={() => setActiveModal(null)}
        variant="warning"
      />
    </div>
  );
};
