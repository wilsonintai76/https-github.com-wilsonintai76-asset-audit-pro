import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Department, CrossAuditPermission, User, AuditGroup } from '@shared/types';
import { RotateCcw, Building2, ClipboardCheck, Calendar } from 'lucide-react';
import { PrintButton } from './PrintButton';
import { printCrossAuditAssignments, printStrategicInspectionPlanApproval, generateStrategicInspectionPlanHTML } from '../lib/printUtils';
import { StrategicMemo } from './StrategicMemo';
import { AuditConstraints } from './AuditConstraints';
import { ConfirmationModal } from './ConfirmationModal';

// Sub-components
import { HistoricalRecords } from './cross-audit/HistoricalRecords';
import { StrategyControls } from './cross-audit/StrategyControls';
import { FeasibilityAnalysis } from './cross-audit/FeasibilityAnalysis';
import { ManualPairingSection } from './cross-audit/ManualPairingSection';
import { AssignmentTable } from './cross-audit/AssignmentTable';

interface StrategicPair {
  target: { id: string; name: string; assets: number; auditors: number; members?: any[]; isJoint?: boolean };
  auditors: { id: string; name: string; assets: number; auditors: number; isJoint: boolean; members?: any[] }[];
  totalAuditorsInGroup: number;
  auditorSideAssets: number;
  isSwarm?: boolean;
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
    mathematicalAnalysis?: any;
    thematicAnalysis?: any;
  } | null;
  isSimulatorActive: boolean;
  setIsSimulatorActive: (v: boolean) => void;
  draftConstraints: any;
  setDraftConstraints: (v: any) => void;
  currentUser?: User | null;
  kpiTiers?: any[];
  kpiTierTargets?: any[];
  locations?: any[];
  schedules?: any[];
  onRebalanceSchedule?: () => Promise<void>;
  onResetOnlyPermissions?: () => Promise<void>;
  pairingAssetMargin?: number;
  pairingAuditorMargin?: number;
  onUpdatePairingMargins?: (assets: number, auditors: number) => void;
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
  onDeleteAuditGroup,
  onBulkDeleteAuditGroups,
  onAutoConsolidate,
  onRunStrategicPairing,
  feasibilityReport,
  onBulkAddPermissions,
  onBulkRemovePermissions,
  pairingLocked,
  pairingLockInfo,
  onLockPairing,
  onUnlockPairing,
  phases,
  institutionKPIs,
  maxAssetsPerDay = 1000,
  maxLocationsPerDay = 5,
  minAuditorsPerLocation = 2,
  dailyInspectionCapacity = 150,
  isSimulatorActive,
  setIsSimulatorActive,
  draftConstraints,
  setDraftConstraints,
  showToast,
  onUpdateMaxAssetsPerDay,
  onUpdateMaxLocationsPerDay,
  onUpdateMinAuditorsPerLocation,
  onUpdateDailyInspectionCapacity,
  kpiTiers = [],
  kpiTierTargets = [],
  locations = [],
  schedules = [],
  onRebalanceSchedule,
  onResetOnlyPermissions,
  currentUser,
  pairingAssetMargin = 500,
  pairingAuditorMargin = 3,
  onUpdatePairingMargins
}) => {
  const [strategicPlan, setStrategicPlan] = useState<StrategicPair[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [archives, setArchives] = useState<any[]>([]);
  const [showArchives, setShowArchives] = useState(false);
  const [showMemo, setShowMemo] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [activeModal, setActiveModal] = useState<'reset' | null>(null);
  const [auditorFilter, setAuditorFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');

  const SIMULATOR_ACTIVE_KEY = 'cross_audit_simulator_active';
  const SIMULATOR_PAIRINGS_KEY = 'cross_audit_simulator_pairings';

  const [manualAuditorId, setManualAuditorId] = useState('');
  const [manualTargetId, setManualTargetId] = useState('');
  const [manualIsMutual, setManualIsMutual] = useState(true);

  const [pairingStrategy, setPairingStrategy] = useState<'mutual' | 'asymmetric' | 'hybrid'>(() => {
    return (localStorage.getItem('cross_audit_grouping_strategy') as any) || 'hybrid';
  });

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

  const handleRebalance = async () => {
    if (!onRebalanceSchedule) return;
    setIsRebalancing(true);
    try { await onRebalanceSchedule(); } finally { setIsRebalancing(false); }
  };

  useEffect(() => {
    if (showArchives) {
      fetch('/api/media/archives/list')
        .then(res => res.json())
        .then(data => setArchives(data))
        .catch(err => console.error('Failed to fetch archives:', err));
    }
  }, [showArchives]);

  const handleArchiveStrategicMemo = async () => {
    setIsArchiving(true);
    try {
      const html = generateStrategicInspectionPlanHTML(
        "SMK St. Thomas",
        new Date().getFullYear(),
        globalStats,
        feasibilityReport,
        entities,
        entityPermissions.map(p => ({
          auditorEntityId: p.auditorEntityId,
          targetEntityId: p.targetEntityId,
          isMutual: p.isMutual
        })),
        { approver: "Principal / Director", supporter: currentUser?.name || "Administrator" },
        auditGroups,
        departments,
        phases || [],
        kpiTiers,
        kpiTierTargets,
        locations
      );

      const res = await fetch('/api/media/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html,
          metadata: {
            type: 'Strategic Memo',
            year: new Date().getFullYear(),
            projectedKPI: projectedKPIPercentage.toFixed(1)
          }
        })
      });

      if (!res.ok) throw new Error('Failed to archive');
      showToast?.('Strategic Memo archived successfully to R2.');
    } catch (err) {
      console.error(err);
      showToast?.('Failed to archive memo.', 'error');
    } finally { setIsArchiving(false); }
  };

  const activeDepts = useMemo(() => departments.filter(d => !d.isExempted && !d.isSystemExempted), [departments]);
  const exemptedDepts = useMemo(() => departments.filter(d => d.isExempted || d.isSystemExempted), [departments]);

  const entities = useMemo(() => {
    const groupedDepts: Record<string, Department[]> = {};
    const getStats = (deptId: string) => {
      const today = new Date().toISOString().split('T')[0];
      const deptUsers = users.filter(u => u.departmentId === deptId);
      const auditors = deptUsers.filter(u => u.status === 'Active' && u.certificationExpiry && u.certificationExpiry >= today).length;
      const locs = (departments.find(d => d.id === deptId) as any)?.locationCount || 0;
      return { auditors, locs };
    };

    activeDepts.forEach(dept => {
      const key = dept.auditGroupId || 'unassigned_' + dept.id;
      if (!groupedDepts[key]) groupedDepts[key] = [];
      const stats = getStats(dept.id);
      groupedDepts[key].push({ ...dept, auditorCount: stats.auditors, locationCount: stats.locs });
    });

    return Object.entries(groupedDepts).map(([groupId, depts]) => {
      const isActuallyUnassigned = groupId.startsWith('unassigned_');
      const totalAssets = depts.reduce((sum, d) => sum + (typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0)), 0);
      const totalAuditors = depts.reduce((sum, d) => sum + (d.auditorCount || 0), 0);
      const totalLocations = depts.reduce((sum, d: any) => sum + (d.locationCount || 0), 0);
      const groupRecord = auditGroups.find(g => g.id === groupId);
      const name = groupRecord?.name ?? depts[0].name;
      const bbi = (totalAssets * 0.5) + (totalLocations * 100) + (totalAuditors * 300);

      return { name, assets: totalAssets, auditors: totalAuditors, locations: totalLocations, bbi: Math.round(bbi), memberCount: depts.length, isJoint: !isActuallyUnassigned, isGroup: true, id: groupId, members: depts };
    }).sort((a, b) => b.bbi - a.bbi);
  }, [activeDepts, auditGroups, users, departments]);

  const overallTotalAssets = useMemo(() => departments.reduce((sum, d) => sum + (typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0)), 0), [departments]);
  const globalStats = useMemo(() => ({ totalInstitutionAssets: overallTotalAssets, targetPercentage: 100, totalAuditors: entities.reduce((sum, e) => sum + (e.auditors || 0), 0), totalLocations: entities.reduce((sum, e) => sum + (e.locations || 0), 0) }), [overallTotalAssets, entities]);

  useEffect(() => { localStorage.setItem(SIMULATOR_ACTIVE_KEY, isSimulatorActive ? 'true' : 'false'); }, [isSimulatorActive]);
  useEffect(() => { localStorage.setItem(SIMULATOR_PAIRINGS_KEY, JSON.stringify(simulatedPairings)); }, [simulatedPairings]);
  useEffect(() => { localStorage.setItem('cross_audit_pairing_mode', pairingMode); }, [pairingMode]);
  useEffect(() => { localStorage.setItem('cross_audit_simulate_staff', simulateIdealStaffing ? 'true' : 'false'); }, [simulateIdealStaffing]);
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
      if (onResetOnlyPermissions) { await onResetOnlyPermissions(); } 
      else if (onBulkRemovePermissions && permissions.length > 0) { await onBulkRemovePermissions(permissions.map(p => p.id)); }
      await onUnlockPairing?.();
      showToast?.('Assignments reset. Institutional structures preserved.');
    } catch (error) { showToast?.('Reset failed.', 'error'); } 
    finally { setIsProcessing(false); }
  };

  const handleRunSimulator = () => {
    setIsProcessing(true);
    if (!draftConstraints) { setDraftConstraints({ maxAssetsPerDay, maxLocationsPerDay, minAuditorsPerLocation, pairingLocked, pairingAssetMargin, pairingAuditorMargin } as any); }
    const workloadPool = entities.filter(e => e.bbi > 0).sort((a, b) => b.assets - a.assets);
    const auditorPool = entities.filter(e => e.bbi > 0 && (simulateIdealStaffing || e.auditors >= 2));
    if (workloadPool.length === 0) { showToast?.('No entities found.', 'error'); setIsProcessing(false); return; }

    const newStrategicPlan: StrategicPair[] = [];
    const usedTargetIds = new Set<string>();
    const usedAuditorIds = new Set<string>();
    const newPairings: Omit<CrossAuditPermission, 'id'>[] = [];
    const candidates = [...auditorPool].sort((a,b) => b.assets - a.assets);

    if (pairingStrategy === 'mutual' || pairingStrategy === 'hybrid') {
      const isMutualMode = pairingStrategy === 'mutual';
      for (let i = 0; i < candidates.length - 1; i++) {
        const a = candidates[i];
        if (usedTargetIds.has(a.id!)) continue;
        
        // Match both Assets AND Auditor count within respective margins
        const bIdx = candidates.findIndex((e, idx) => 
          idx > i && 
          !usedTargetIds.has(e.id!) && 
          Math.abs(e.assets - a.assets) <= pairingAssetMargin &&
          Math.abs(e.auditors - a.auditors) <= pairingAuditorMargin
        );
        
        if (bIdx !== -1) {
          const b = candidates[bIdx];
          newPairings.push({ auditorGroupId: a.id!, targetGroupId: b.id!, isActive: true, isMutual: true } as any);
          newPairings.push({ auditorGroupId: b.id!, targetGroupId: a.id!, isActive: true, isMutual: true } as any);
          usedTargetIds.add(a.id!); usedTargetIds.add(b.id!); usedAuditorIds.add(a.id!); usedAuditorIds.add(b.id!);
        }
      }
    }

    // GAP FILLING (Only for Asymmetric or Hybrid strategies)
    if (pairingStrategy !== 'mutual') {
      const remainingTargets = workloadPool.filter(e => !usedTargetIds.has(e.id!));
      const availableGroups = auditorPool.filter(e => !usedAuditorIds.has(e.id!) && (simulateIdealStaffing || e.auditors >= 2));
      
      for (const target of remainingTargets) {
        const cand = availableGroups.find(g => g.id !== target.id && !usedAuditorIds.has(g.id!));
        if (cand) {
          newPairings.push({ auditorGroupId: cand.id!, targetGroupId: target.id!, isActive: true, isMutual: false } as any);
          usedAuditorIds.add(cand.id!); usedTargetIds.add(target.id!);
        }
      }
    }

    setSimulatedPairings(newPairings);
    setIsSimulatorActive(true);
    setIsProcessing(false);
  };

  const handleManualAddPairing = () => {
    if (!manualAuditorId || !manualTargetId) return;
    if (manualAuditorId === manualTargetId) {
      showToast?.('An entity cannot audit itself.', 'error');
      return;
    }

    // COLLISION GUARD: Ensure entities aren't already assigned in the draft
    const isAuditorBusy = simulatedPairings.some(p => (p.auditorGroupId || (p as any).auditorDeptId) === manualAuditorId || (p.targetGroupId || (p as any).targetDeptId) === manualAuditorId);
    const isTargetBusy = simulatedPairings.some(p => (p.auditorGroupId || (p as any).auditorDeptId) === manualTargetId || (p.targetGroupId || (p as any).targetDeptId) === manualTargetId);

    if (isAuditorBusy || isTargetBusy) {
      showToast?.('One or both groups are already assigned. Delete their existing links first to maintain 1:1 parity.', 'error');
      return;
    }

    setSimulatedPairings(prev => {
      const up = [...prev];
      if (manualIsMutual) {
        up.push({ auditorGroupId: manualAuditorId, targetGroupId: manualTargetId, isActive: true, isMutual: true } as any);
        up.push({ auditorGroupId: manualTargetId, targetGroupId: manualAuditorId, isActive: true, isMutual: true } as any);
      } else {
        up.push({ auditorGroupId: manualAuditorId, targetGroupId: manualTargetId, isActive: true, isMutual: false } as any);
      }
      return up;
    });

    setManualAuditorId(''); setManualTargetId('');
    showToast?.('Link added.');
  };

  const handleCommitSimulation = async () => {
    if (!onBulkAddPermissions || simulatedPairings.length === 0) return;
    setIsProcessing(true);
    try {
      if (onResetOnlyPermissions) { await onResetOnlyPermissions(); }
      
      // ATOMIC RELATIONSHIP DEDUPLICATION
      // We group by sorted pair to find all intended relationships.
      const relationshipMap = new Map<string, any>();
      
      simulatedPairings.forEach(p => {
        const audId = p.auditorGroupId || (p as any).auditorDeptId;
        const tgtId = p.targetGroupId || (p as any).targetDeptId;
        if (!audId || !tgtId) return;

        // Group by sorted pair to detect Mutual vs Directed
        const groupKey = [audId, tgtId].sort().join('<=>');
        if (!relationshipMap.has(groupKey)) {
          relationshipMap.set(groupKey, { id1: audId, id2: tgtId, directions: new Set<string>(), isMutual: p.isMutual });
        }
        relationshipMap.get(groupKey).directions.add(`${audId}->${tgtId}`);
        // If ANY record in this pair says mutual, the relationship is mutual
        if (p.isMutual) relationshipMap.get(groupKey).isMutual = true;
      });

      const finalPairings: any[] = [];
      const committedIds = new Set<string>();
      let hasConflict = false;

      // Group by mutual first to prioritize them, then directed
      const sortedKeys = Array.from(relationshipMap.keys()).sort((a, b) => {
        const relA = relationshipMap.get(a);
        const relB = relationshipMap.get(b);
        if (relA.isMutual && !relB.isMutual) return -1;
        if (!relA.isMutual && relB.isMutual) return 1;
        return 0;
      });

      sortedKeys.forEach((key) => {
        const rel = relationshipMap.get(key);
        if (rel.isMutual) {
          if (committedIds.has(rel.id1) || committedIds.has(rel.id2)) {
            hasConflict = true;
            return;
          }
          finalPairings.push({ auditorGroupId: rel.id1, targetGroupId: rel.id2, isActive: true, isMutual: true });
          committedIds.add(rel.id1);
          committedIds.add(rel.id2);
        } else {
          rel.directions.forEach((dir: string) => {
            const [a, t] = dir.split('->');
            if (committedIds.has(a) || committedIds.has(t)) {
              hasConflict = true;
              return;
            }
            finalPairings.push({ auditorGroupId: a, targetGroupId: t, isActive: true, isMutual: false });
            committedIds.add(a);
            committedIds.add(t);
          });
        }
      });

      if (hasConflict) {
        showToast?.('Conflict Resolution: Some overlapping assignments were dropped for 1:1 integrity.', 'info');
      }

      await onBulkAddPermissions(finalPairings);
      
      if (draftConstraints) {
        onUpdateMaxAssetsPerDay?.(draftConstraints.maxAssetsPerDay);
        onUpdateMaxLocationsPerDay?.(draftConstraints.maxLocationsPerDay);
        onUpdateMinAuditorsPerLocation?.(draftConstraints.minAuditorsPerLocation);
      }
      setIsSimulatorActive(false); setSimulatedPairings([]); setDraftConstraints(null);
      await onLockPairing?.(finalPairings.length);
      showToast?.('Strategic pairings committed successfully with atomic deduplication.');
    } catch (e) { 
      console.error("Commit error:", e);
      showToast?.('Commit failed.', 'error'); 
    } finally { setIsProcessing(false); }
  };

  const activePairingsForStats = useMemo(() => isSimulatorActive ? simulatedPairings : permissions.filter(p => p.isActive).map(p => ({ targetDeptId: p.targetDeptId || p.targetGroupId })), [isSimulatorActive, simulatedPairings, permissions]);
  const projectedAssetsMet = useMemo(() => {
    const auditedTargets = new Set<string>();
    
    if (isSimulatorActive) {
      // Simulation: current logic handles them as A->B and B->A records (separate directions)
      simulatedPairings.forEach(p => {
        const tgtId = p.targetGroupId || (p as any).targetDeptId;
        if (tgtId) auditedTargets.add(tgtId);
      });
    } else {
      // Committed: handles single-record mutual pairs
      permissions.filter(p => p.isActive).forEach(p => {
        const audId = p.auditorGroupId || p.auditorDeptId;
        const tgtId = p.targetGroupId || p.targetDeptId;
        if (tgtId) auditedTargets.add(tgtId);
        // If it's mutual, the auditor's department is ALSO covered (by the target)
        if (p.isMutual && audId) auditedTargets.add(audId);
      });
    }

    return Array.from(auditedTargets).reduce((sum, tid) => {
      const ent = entities.find(e => e.id === tid);
      return sum + (ent?.assets || 0);
    }, 0);
  }, [isSimulatorActive, simulatedPairings, permissions, entities]);

  const projectedKPIPercentage = overallTotalAssets === 0 ? 0 : (projectedAssetsMet / overallTotalAssets) * 100;

  const entityPermissions = useMemo(() => {
    const map = new Map<string, any>();
    const sourceData = isSimulatorActive ? simulatedPairings : permissions;
    
    // RELATIONSHIP-CENTRIC DEDUPLICATION
    // We group every pair of entities into exactly one row.
    sourceData.forEach((p) => {
      const audId = p.auditorGroupId || (p as any).auditorDeptId;
      const tgtId = p.targetGroupId || (p as any).targetDeptId;
      if (!audId || !tgtId) return;

      const sortedKey = [audId, tgtId].sort().join('<=>');
      
      if (!map.has(sortedKey)) { 
        map.set(sortedKey, { 
          auditorEntityId: audId, 
          targetEntityId: tgtId, 
          isMutual: p.isMutual, 
          rawPermIds: [],
          directions: new Set<string>()
        }); 
      }
      
      const record = map.get(sortedKey);
      record.directions.add(`${audId}->${tgtId}`);
      if (p.id) record.rawPermIds.push(p.id);
      
      // Deduce mutuality: either explicitly flagged, OR both directions exist
      if (p.isMutual) record.isMutual = true;
    });

    // Final pass to ensure icons match the presence of reciprocals OR the isMutual flag
    const results: any[] = [];
    const renderedIds = new Set<string>();

    Array.from(map.values()).forEach(r => {
      const hasReciprocal = r.directions.has(`${r.auditorEntityId}->${r.targetEntityId}`) && 
                            r.directions.has(`${r.targetEntityId}->${r.auditorEntityId}`);
      
      const isMutual = r.isMutual || hasReciprocal;

      // STRICT 1:1 VIEW ENFORCEMENT
      // If either group in this pairing has already appeared in another row (as auditor or target),
      // we SKIP this row to keep the UI clean and respect parity.
      if (renderedIds.has(r.auditorEntityId) || renderedIds.has(r.targetEntityId)) {
        return;
      }

      results.push({
        ...r,
        isMutual
      });

      renderedIds.add(r.auditorEntityId);
      renderedIds.add(r.targetEntityId);
    });

    return results;
  }, [isSimulatorActive, simulatedPairings, permissions]);

  const filteredPermissions = entityPermissions.filter(p => {
    const aud = entities.find(e => e.id === p.auditorEntityId);
    const tgt = entities.find(e => e.id === p.targetEntityId);
    return (!auditorFilter || aud?.name.toLowerCase().includes(auditorFilter.toLowerCase())) && (!targetFilter || tgt?.name.toLowerCase().includes(targetFilter.toLowerCase()));
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
          <button onClick={() => setShowMemo(true)} className="px-4 py-2.5 rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" /> Strategic Memo
          </button>
          <button onClick={() => setShowArchives(!showArchives)} className={`px-4 py-2.5 rounded-2xl border border-slate-100 text-xs font-bold transition-all flex items-center gap-2 ${showArchives ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
            <Calendar className="w-4 h-4" /> Historical Records
          </button>
          <button onClick={() => setActiveModal('reset')} className="px-4 py-2.5 rounded-2xl border border-red-100 bg-red-50 text-red-500 text-xs font-bold hover:bg-red-100 transition-all flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Reset Cycle
          </button>
        </div>
      </div>

      {showArchives && <HistoricalRecords archives={archives} onClose={() => setShowArchives(false)} />}

      <div className="flex flex-col lg:flex-row gap-12">
        <StrategyControls 
          pairingStrategy={pairingStrategy} setPairingStrategy={setPairingStrategy}
          pairingMode={pairingMode} setPairingMode={setPairingMode}
          dailyInspectionCapacity={dailyInspectionCapacity} onUpdateDailyInspectionCapacity={onUpdateDailyInspectionCapacity}
          maxAssetsPerDay={maxAssetsPerDay} onUpdateMaxAssetsPerDay={onUpdateMaxAssetsPerDay}
          maxLocationsPerDay={maxLocationsPerDay} onUpdateMaxLocationsPerDay={onUpdateMaxLocationsPerDay}
          minAuditorsPerLocation={minAuditorsPerLocation} onUpdateMinAuditorsPerLocation={onUpdateMinAuditorsPerLocation}
          simulateIdealStaffing={simulateIdealStaffing} setSimulateIdealStaffing={setSimulateIdealStaffing}
          isSimulatorActive={isSimulatorActive} setIsSimulatorActive={setIsSimulatorActive}
          isProcessing={isProcessing} handleRunSimulator={handleRunSimulator}
          handleCommitSimulation={handleCommitSimulation} pairingLocked={pairingLocked}
          exemptedDepts={exemptedDepts} onCancelDraft={() => { setIsSimulatorActive(false); setSimulatedPairings([]); }}
          pairingAssetMargin={pairingAssetMargin}
          pairingAuditorMargin={pairingAuditorMargin}
          onUpdatePairingMargins={onUpdatePairingMargins}
        />

        <div className="lg:w-2/3 space-y-8">
           <FeasibilityAnalysis 
            projectedKPIPercentage={projectedKPIPercentage} 
            projectedAssetsMet={projectedAssetsMet} 
            overallTotalAssets={overallTotalAssets} 
            feasibilityReport={feasibilityReport} 
           />

           {isSimulatorActive && (
             <ManualPairingSection 
               manualAuditorId={manualAuditorId} setManualAuditorId={setManualAuditorId}
               manualTargetId={manualTargetId} setManualTargetId={setManualTargetId}
               manualIsMutual={manualIsMutual} setManualIsMutual={setManualIsMutual}
               entities={entities} onLinkEntities={handleManualAddPairing}
               simulatedPairings={simulatedPairings}
             />
           )}

           <AssignmentTable 
             filteredPermissions={filteredPermissions} entities={entities}
             isSimulatorActive={isSimulatorActive}
             auditorFilter={auditorFilter} setAuditorFilter={setAuditorFilter}
             targetFilter={targetFilter} setTargetFilter={setTargetFilter}
             onToggleMutual={(p) => {
                 const audId = p.auditorEntityId; 
                 const tgtId = p.targetEntityId; 
                 const willBeMutual = !p.isMutual;

                 if (willBeMutual) {
                   // COLLISION GUARD: To become mutual, both must be free of secondary links
                   const audIsBusyElsewhere = simulatedPairings.some(item => {
                     const itemAudId = item.auditorGroupId || (item as any).auditorDeptId;
                     const itemTgtId = item.targetGroupId || (item as any).targetDeptId;
                     return (itemAudId === audId && itemTgtId !== tgtId) || (itemTgtId === audId && itemAudId !== tgtId);
                   });
                   const tgtIsBusyElsewhere = simulatedPairings.some(item => {
                     const itemAudId = item.auditorGroupId || (item as any).auditorDeptId;
                     const itemTgtId = item.targetGroupId || (item as any).targetDeptId;
                     return (itemAudId === tgtId && itemTgtId !== audId) || (itemTgtId === tgtId && itemAudId !== audId);
                   });

                   if (audIsBusyElsewhere || tgtIsBusyElsewhere) {
                     showToast?.('Cannot toggle Mutual: One or both entities have other active pairings.', 'error');
                     return;
                   }
                 }

                 setSimulatedPairings(prev => {
                  let up = [...prev];
                  if (willBeMutual) {
                    // Turn ON: Update primary and ensure reciprocal
                    up = up.map(item => {
                      const itemAudId = item.auditorGroupId || (item as any).auditorDeptId;
                      const itemTgtId = item.targetGroupId || (item as any).targetDeptId;
                      if (itemAudId === audId && itemTgtId === tgtId) return { ...item, isMutual: true };
                      return item;
                    });
                    // check if reciprocal exists (maybe it was directed?)
                    const hasReciprocal = up.some(item => (item.auditorGroupId || (item as any).auditorDeptId) === tgtId && (item.targetGroupId || (item as any).targetDeptId) === audId);
                    if (!hasReciprocal) {
                      up.push({ auditorGroupId: tgtId, targetGroupId: audId, isActive: true, isMutual: true } as any);
                    } else {
                      up = up.map(item => {
                         if ((item.auditorGroupId || (item as any).auditorDeptId) === tgtId && (item.targetGroupId || (item as any).targetDeptId) === audId) return { ...item, isMutual: true };
                         return item;
                      });
                    }
                  } else {
                    // Turn OFF: Update primary and delete reciprocal
                    up = up.map(item => {
                      const itemAudId = item.auditorGroupId || (item as any).auditorDeptId;
                      const itemTgtId = item.targetGroupId || (item as any).targetDeptId;
                      if (itemAudId === audId && itemTgtId === tgtId) return { ...item, isMutual: false };
                      return item;
                    });
                    up = up.filter(item => {
                       const itemAudId = item.auditorGroupId || (item as any).auditorDeptId;
                       const itemTgtId = item.targetGroupId || (item as any).targetDeptId;
                       return !(itemAudId === tgtId && itemTgtId === audId && item.isMutual);
                    });
                  }
                  return up;
                });
             }}
             onUpdateTarget={(p, newTgtId) => {
                 const audId = p.auditorEntityId;
                 const oldTgtId = p.targetEntityId;
                 
                 // COLLISION GUARD: New target must not be already busy in ANY role
                 const isNewTargetBusy = simulatedPairings.some(item => {
                    const itemAudId = item.auditorGroupId || (item as any).auditorDeptId;
                    const itemTgtId = item.targetGroupId || (item as any).targetDeptId;
                    return itemAudId === newTgtId || itemTgtId === newTgtId;
                 });

                 if (isNewTargetBusy && newTgtId !== audId) {
                   showToast?.('Selected target already has an assignment.', 'error');
                   return;
                 }

                 setSimulatedPairings(prev => {
                  // SHIFT: Update the primary link and break mutuality
                  let up = prev.map(item => {
                    const itemAudId = item.auditorGroupId || (item as any).auditorDeptId;
                    const itemTgtId = item.targetGroupId || (item as any).targetDeptId;
                    if (itemAudId === audId && itemTgtId === oldTgtId) {
                      return { ...item, targetGroupId: newTgtId, targetDeptId: newTgtId, isMutual: false };
                    }
                    return item;
                  });

                  // RECIPROCAL CLEANUP: If the old relationship was mutual, 
                  // the old reciprocal (oldTgtId -> audId) must be removed or demoted.
                  if (p.isMutual) {
                    up = up.filter(item => {
                       const itemAudId = item.auditorGroupId || (item as any).auditorDeptId;
                       const itemTgtId = item.targetGroupId || (item as any).targetDeptId;
                       return !(itemAudId === oldTgtId && itemTgtId === audId);
                    });
                  }
                  return up;
                });
             }}
             onDeleteRow={(p) => {
                const audId = p.auditorEntityId; 
                const tgtId = p.targetEntityId;
                setSimulatedPairings(prev => {
                  return prev.filter(item => {
                    const itemAudId = item.auditorGroupId || (item as any).auditorDeptId;
                    const itemTgtId = item.targetGroupId || (item as any).targetDeptId;
                    // Delete both directions for a mutual pair
                    if (p.isMutual) {
                      return !((itemAudId === audId && itemTgtId === tgtId) || (itemAudId === tgtId && itemTgtId === audId));
                    }
                    // Delete specific direction for asymmetrical
                    return !(itemAudId === audId && itemTgtId === tgtId);
                  });
                });
             }}
             onBulkRemove={(ids) => onBulkRemovePermissions && onBulkRemovePermissions(ids)}
           />
        </div>
      </div>

      <ConfirmationModal isOpen={activeModal === 'reset'} title="Reset Audit Pairings?" message="This will clear all current inspection assignments and unlock the strategic strategy, but your institutional groups will remain intact." confirmLabel="Reset Pairings" onConfirm={executeReset} onCancel={() => setActiveModal(null)} variant="warning" />
      <StrategicMemo isOpen={showMemo} onClose={() => setShowMemo(false)} onPrint={() => { printStrategicInspectionPlanApproval("POLITEKNIK KUCHING SARAWAK", new Date().getFullYear(), globalStats, feasibilityReport, entities, entityPermissions.map(p => ({ auditorEntityId: p.auditorEntityId, targetEntityId: p.targetEntityId, isMutual: p.isMutual })), { approver: "Principal / Director", supporter: currentUser?.name || "Administrator" }, auditGroups, departments, phases || [], kpiTiers, kpiTierTargets, locations, schedules, maxAssetsPerDay, maxLocationsPerDay); }} onArchive={handleArchiveStrategicMemo} isArchiving={isArchiving} institutionName="POLITEKNIK KUCHING SARAWAK" year={new Date().getFullYear()} globalStats={globalStats} feasibility={feasibilityReport} entities={entities} entityPermissions={entityPermissions.map(p => ({ auditorEntityId: p.auditorEntityId, targetEntityId: p.targetEntityId, isMutual: p.isMutual }))} signatures={{ approver: "Principal / Director", supporter: currentUser?.name || "Administrator" }} auditGroups={auditGroups} departments={departments} phases={phases || []} kpiTiers={kpiTiers} kpiTierTargets={kpiTierTargets} locations={locations} schedules={schedules} maxAssetsPerDay={maxAssetsPerDay} maxLocationsPerDay={maxLocationsPerDay} onRebalance={handleRebalance} isRebalancing={isRebalancing} />
    </div>
  );
};
