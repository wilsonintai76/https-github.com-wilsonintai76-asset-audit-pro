
import React, { useState, useMemo } from 'react';
import { Department, CrossAuditPermission, User, AuditGroup } from '../types';
import { Wand2, UserPen, Zap, Boxes, Loader2, Layers, Network, Check, CheckCheck, RotateCcw, Link, Grid, List, ArrowRightLeft, ArrowLeftRight, ArrowRight, Ban, Users, Building2, Trash2, Link2Off, Plus, X, ShieldCheck, ChevronDown, ShieldOff } from 'lucide-react';
import { ActiveEntitiesList } from './ActiveEntitiesList';
import { ConfirmationModal } from './ConfirmationModal';
import { MatrixCard } from './MatrixCard';
import { InstitutionalConsolidationView } from './InstitutionalConsolidationView';
import { GroupBuilderTab } from './GroupBuilderTab';
import { AuditConstraints } from './AuditConstraints';

interface StrategicPair {
  target: { id: string; name: string; assets: number; auditors: number; members?: any[]; isJoint?: boolean };
  auditors: { id: string; name: string; assets: number; auditors: number; isJoint: boolean; members?: any[] }[];
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
  onAutoConsolidate?: (threshold: number, excludedIds: string[], minAuditors?: number) => Promise<void>;
  onBulkAddPermissions?: (perms: Omit<CrossAuditPermission, 'id'>[]) => Promise<void>;
  onBulkRemovePermissions?: (ids: string[]) => Promise<void>;
  phases?: any[];
  institutionKPIs?: any[];
  showToast?: (message: string, type?: any) => void;
  onUpdateMaxAssetsPerDay?: (value: number) => void;
  onUpdateMaxLocationsPerDay?: (value: number) => void;
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
  onAutoConsolidate,
  onBulkAddPermissions,
  onBulkRemovePermissions,
  phases = [],
  institutionKPIs = [],
  maxAssetsPerDay = 1000,
  maxLocationsPerDay = 5,
  showToast,
  onUpdateMaxAssetsPerDay,
  onUpdateMaxLocationsPerDay
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
  const [respectManualPairings, setRespectManualPairings] = useState<boolean>(true);
  
  // Manual Mode State
  const [manualAuditor, setManualAuditor] = useState('');
  const [manualTarget, setManualTarget] = useState('');
  const [isMutual, setIsMutual] = useState(false);
  const [overrideIsMutual, setOverrideIsMutual] = useState(false);

  // Workflow Control
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('grouping');
  const [simulateIdealStaffing, setSimulateIdealStaffing] = useState(false);
  
  // Pairing Strategy Mode
  const [pairingMode, setPairingMode] = useState<'assets' | 'assets_auditors'>('assets_auditors');

  // State for Auditor Strictness (Min 2 Auditors rule)
  const [strictAuditorRule, setStrictAuditorRule] = useState<boolean>(true);

  // Auto-pairing mutual toggle
  const [autoPairingMutual, setAutoPairingMutual] = useState<boolean>(false);

  // Tab mode
  const [managementMode, setManagementMode] = useState<ManagementMode>('auto');
  
  // Confirmation & State Control
  const [isApplied, setIsApplied] = useState(false);
  const [activeModal, setActiveModal] = useState<'apply' | 'reset' | null>(null);
  const [showConstraints, setShowConstraints] = useState(false);
  
  // Filtering for Pairings List
  const [auditorFilter, setAuditorFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');

  // 0. Compute Institutional Grand Total
  const overallTotalAssets = useMemo(() => {
    if (!departments) return 0;
    return departments.reduce((sum, d) => sum + (typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0)), 0);
  }, [departments]);

  // 1. Get Non-Exempted Departments
  const activeDepts = useMemo(() => {
    return departments.filter(d => !d.isExempted);
  }, [departments]);

  // Exempted departments (for informational banner)
  const exemptedDepts = useMemo(() => {
    return departments.filter(d => d.isExempted);
  }, [departments]);

  const entities = useMemo(() => {
    const groupedDepts: Record<string, Department[]> = {};
    
    activeDepts.forEach(dept => {
      const key = dept.auditGroupId || 'unassigned_' + dept.id;
      if (!groupedDepts[key]) groupedDepts[key] = [];
      groupedDepts[key].push(dept);
    });

    return Object.entries(groupedDepts).map(([groupId, depts]) => {
      const isUnassigned = groupId.startsWith('unassigned_');
      
      const totalAssets = depts.reduce((sum, d) => sum + (typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0)), 0);
      const totalAuditors = depts.reduce((sum, d) => sum + (d.auditorCount || 0), 0);
      
      const name = isUnassigned 
        ? depts[0].name 
        : auditGroups.find(g => g.id === groupId)?.name || 'Unknown Group';
      
      const constitutesGroup = !isUnassigned;
      
      return {
        name,
        assets: totalAssets,
        auditors: totalAuditors,
        memberCount: depts.length,
        isJoint: constitutesGroup,
        isGroup: constitutesGroup,
        isConsolidated: constitutesGroup,
        id: groupId,
        members: depts
      };
    }).sort((a, b) => b.assets - a.assets);
  }, [activeDepts, auditGroups]);

  // Group manual permissions by auditor for the table view
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, CrossAuditPermission[]> = {};
    permissions.forEach(p => {
      const auditorId = p.auditorDeptId;
      if (!groups[auditorId]) groups[auditorId] = [];
      groups[auditorId].push(p);
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
      setStrategicPlan([]);
      setWorkflowStep('grouping');
      setIsApplied(false);
      setIsSimulatorActive(false);
      setSimulatedPairings([]);

      const updates = departments
        .filter(d => d.auditGroupId)
        .map(d => ({ id: d.id, data: { auditGroupId: null } }));

      if (updates?.length > 0) {
        await onBulkUpdateDepartments(updates);
      }

      if (onBulkRemovePermissions && permissions.length > 0) {
        await onBulkRemovePermissions(permissions.map(p => p.id));
      }

    } catch (error) {
      console.error("Reset failed:", error);
      alert("Failed to fully reset system configuration.");
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
        await Promise.all(permissions.map(p => onRemovePermission(p.id)));
      }

      await new Promise(r => setTimeout(r, 1000));

      const newPerms: Omit<CrossAuditPermission, 'id'>[] = [];
      for (const pair of strategicPlan) {
        for (const auditor of pair.auditors) {
          if ((auditor as any).isVirtual) continue;
          newPerms.push({
            auditorDeptId: auditor.id,
            targetDeptId: pair.target.id,
            isActive: true,
            isMutual: false
          });
        }
      }

      if (newPerms.length > 0 && onBulkAddPermissions) {
        await onBulkAddPermissions(newPerms);
      }

      setIsApplied(true);
    } catch (e) {
      console.error(e);
      alert("Permission sync failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddManualPair = async () => {
    if (!manualAuditor || !manualTarget) return;
    if (manualAuditor === manualTarget) {
      alert("Conflict Detected: A unit cannot audit its own assets.");
      return;
    }
    
    setIsProcessing(true);
    try {
      await onAddPermission(manualAuditor, manualTarget, isMutual);
      if (isMutual) {
        const reverseExists = permissions.some(p => p.auditorDeptId === manualTarget && p.targetDeptId === manualAuditor);
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

  const handleGridToggle = async (auditorId: string, targetId: string) => {
    if (auditorId === targetId) return;
    const perm = permissions.find(p => p.auditorDeptId === auditorId && p.targetDeptId === targetId);
    if (perm) {
      if (onRemovePermission) await onRemovePermission(perm.id);
    } else {
      await onAddPermission(auditorId, targetId, false);
    }
  };

  const handleAnalyzeAndGroup = async () => {
    setIsProcessing(true);
    const standalones: typeof activeDepts = [];
    const pool: typeof activeDepts = [];
    
    activeDepts.forEach(d => {
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
    
    let currentGroup: typeof activeDepts = [];
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
    setIsProcessing(false);
    setWorkflowStep('pairing');
  };

  // --- SIMULATOR LOGIC ---
  const [simulatedPairings, setSimulatedPairings] = useState<Omit<CrossAuditPermission, 'id'>[]>([]);
  const [isSimulatorActive, setIsSimulatorActive] = useState(false);
  
  const targetKPIPercentage = useMemo(() => {
    if (!institutionKPIs || institutionKPIs.length === 0) return 30;
    return Math.max(...institutionKPIs.map(k => k.targetPercentage || 0));
  }, [institutionKPIs]);

  const projectedAssetsMet = useMemo(() => {
    const activeList = isSimulatorActive ? simulatedPairings : permissions;
    const auditedTargets = new Set(activeList.filter(p => p.isActive).map(p => p.targetDeptId));
    return Array.from(auditedTargets).reduce((sum, targetId) => {
       const entity = entities.find(e => e.id === targetId);
       return sum + (entity?.assets || 0);
    }, 0);
  }, [simulatedPairings, permissions, entities, isSimulatorActive]);

  const projectedKPIPercentage = overallTotalAssets > 0 ? (projectedAssetsMet / overallTotalAssets) * 100 : 0;
  const isKPIMet = projectedKPIPercentage >= targetKPIPercentage;

  const handleRunSimulator = () => {
    setIsProcessing(true);
    const minAuditorsRequired = strictAuditorRule ? 2 : 1;

    // 1. Targets = entities with assets, sorted by assets descending
    const targets = entities.filter(e => e.assets > 0).sort((a, b) => b.assets - a.assets);

    if (targets.length === 0) {
      showToast?.('No entities with assets found. Please ensure departments have assets assigned.', 'error');
      setIsProcessing(false);
      return;
    }

    const newStrategicPlan: StrategicPair[] = [];
    const usedTargetIds = new Set<string>();
    const newPairings: Omit<CrossAuditPermission, 'id'>[] = [];

    // Check if assets_auditors mode has any qualified auditors
    const hasQualifiedAuditors = entities.some(e => simulateIdealStaffing || e.auditors >= minAuditorsRequired);
    const effectiveMode = (pairingMode === 'assets_auditors' && !hasQualifiedAuditors) ? 'assets' : pairingMode;
    if (pairingMode === 'assets_auditors' && !hasQualifiedAuditors) {
      showToast?.('No departments meet the minimum auditor requirement. Falling back to Asset-Only pairing mode.', 'warning');
    }

    if (effectiveMode === 'assets') {
      const auditorPool = entities.filter(e => e.assets > 0 || simulateIdealStaffing);
      let poolIdx = 0;

      // Filter targets if respecting manual pairings
      const finalTargets = respectManualPairings 
        ? targets.filter(t => !permissions.some(p => p.isActive && p.targetDeptId === t.id))
        : targets;

      for (const target of finalTargets) {
        if (usedTargetIds.has(target.id!)) continue;
        let attempts = 0;
        let picked: typeof auditorPool[0] | null = null;
        while (attempts < auditorPool.length) {
          const candidate = auditorPool[poolIdx % auditorPool.length];
          poolIdx++;
          attempts++;
          if (candidate.id !== target.id) { picked = candidate; break; }
        }
        if (!picked) continue;

        const potentialMembers: any[] = simulateIdealStaffing && picked.auditors === 0
          ? [{ id: `virtual-${picked.id}-1`, name: `Virtual Auditor A (${picked.name})` }, { id: `virtual-${picked.id}-2`, name: `Virtual Auditor B (${picked.name})` }]
          : users.filter(u => picked!.members.map((m: any) => m.id).includes(u.departmentId) && u.status === 'Active' && (u.roles.includes('Supervisor') || u.roles.includes('Staff')));

        const auditorEntry = {
          name: picked.name, assets: picked.assets,
          auditors: simulateIdealStaffing ? Math.max(picked.auditors, picked.members.length * 2) : picked.auditors,
          isJoint: picked.isJoint, id: picked.id,
          members: potentialMembers.slice(0, 2),
          isVirtual: simulateIdealStaffing && picked.auditors === 0,
        };

        newStrategicPlan.push({
          target: { name: target.name, assets: target.assets, auditors: target.auditors, members: target.members, id: target.id } as any,
          auditors: [auditorEntry],
          totalAuditorsInGroup: auditorEntry.auditors,
          auditorSideAssets: auditorEntry.assets,
        });
        usedTargetIds.add(target.id!);
        newPairings.push({ auditorDeptId: picked.id!, targetDeptId: target.id!, isActive: true, isMutual: autoPairingMutual });
        if (autoPairingMutual) {
          newPairings.push({ auditorDeptId: target.id!, targetDeptId: picked.id!, isActive: true, isMutual: true });
        }
      }

    } else {
      const auditors = entities.filter(e => simulateIdealStaffing || e.auditors >= minAuditorsRequired);
      const capacityMap = new Map<string, number>();
      auditors.forEach(a => {
        capacityMap.set(a.id!, simulateIdealStaffing
          ? Math.max(2, a.members.length * 2)
          : (minAuditorsRequired === 2 ? Math.floor(a.auditors / 2) : a.auditors));
      });

      // Filter targets if respecting manual pairings
      const finalTargets = respectManualPairings 
        ? targets.filter(t => !permissions.some(p => p.isActive && p.targetDeptId === t.id))
        : targets;

      for (const target of finalTargets) {
        if (usedTargetIds.has(target.id!)) continue;
        const assets = target.assets || 0;
        const targetCapacity = Math.max(2, Math.ceil(assets / maxAssetsPerDay));
        let assignedCount = 0;
        const assignedAuditors: any[] = [];

        while (assignedCount < targetCapacity) {
          const availableAuditor = auditors
            .filter(a => a.id !== target.id && (capacityMap.get(a.id!) || 0) > 0 && !assignedAuditors.some(aa => aa.id === a.id))
            .sort((a, b) => (capacityMap.get(b.id!) || 0) - (capacityMap.get(a.id!) || 0))[0];
          if (!availableAuditor) break;

          const potentialMembers: any[] = simulateIdealStaffing && availableAuditor.auditors === 0
            ? [{ id: `virtual-${availableAuditor.id}-1`, name: `Virtual Auditor A (${availableAuditor.name})` }, { id: `virtual-${availableAuditor.id}-2`, name: `Virtual Auditor B (${availableAuditor.name})` }]
            : users.filter(u => availableAuditor.members.map((m: any) => m.id).includes(u.departmentId) && u.status === 'Active' && (u.roles.includes('Supervisor') || u.roles.includes('Staff')));

          assignedAuditors.push({
            name: availableAuditor.name, assets: availableAuditor.assets,
            auditors: simulateIdealStaffing ? Math.max(availableAuditor.auditors, availableAuditor.members.length * 2) : availableAuditor.auditors,
            isJoint: availableAuditor.isJoint, id: availableAuditor.id,
            members: potentialMembers.slice(0, 2),
            isVirtual: simulateIdealStaffing && availableAuditor.auditors === 0,
          });
          const currentCap = capacityMap.get(availableAuditor.id!) || 0;
          capacityMap.set(availableAuditor.id!, currentCap - 1);
          assignedCount += (simulateIdealStaffing ? Math.max(availableAuditor.auditors, 2) : availableAuditor.auditors);
        }

        if (assignedAuditors.length > 0) {
          newStrategicPlan.push({
            target: { name: target.name, assets: target.assets, auditors: target.auditors, members: target.members, id: target.id } as any,
            auditors: assignedAuditors,
            totalAuditorsInGroup: assignedAuditors.reduce((sum, a) => sum + a.auditors, 0),
            auditorSideAssets: assignedAuditors.reduce((sum, a) => sum + a.assets, 0),
          });
          usedTargetIds.add(target.id!);
          assignedAuditors.forEach(auditor => {
            newPairings.push({ auditorDeptId: auditor.id, targetDeptId: target.id!, isActive: true, isMutual: autoPairingMutual });
            if (autoPairingMutual) {
              newPairings.push({ auditorDeptId: target.id!, targetDeptId: auditor.id, isActive: true, isMutual: true });
            }
          });
        }
      }
    }

    if (newStrategicPlan.length === 0) {
      showToast?.('No pairings could be generated. Try enabling "Simulate Ideal Inspecting Staff" or switch to "By Total Assets" mode.', 'error');
      setIsProcessing(false);
      return;
    }

    setStrategicPlan(newStrategicPlan);
    setSimulatedPairings(newPairings);
    setIsSimulatorActive(true);
    setIsApplied(false);
    setIsProcessing(false);
  };

  const handleAddOverride = async () => {
    if (!manualAuditor || !manualTarget) return;
    if (manualAuditor === manualTarget) {
      alert("Conflict Detected: A unit cannot audit its own assets.");
      return;
    }

    // Resolve entity IDs to department IDs (groups must be expanded)
    const auditorEntity = entities.find(e => e.id === manualAuditor);
    const targetEntity = entities.find(e => e.id === manualTarget);

    if (!auditorEntity || !targetEntity) return;

    const auditorDeptIds: string[] = auditorEntity.isConsolidated
      ? auditorEntity.members.map((m: any) => m.id)
      : [auditorEntity.id!];

    const targetDeptIds: string[] = targetEntity.isConsolidated
      ? targetEntity.members.map((m: any) => m.id)
      : [targetEntity.id!];

    if (isSimulatorActive) {
      const newPairs = auditorDeptIds.flatMap(audId =>
        targetDeptIds.map(tgtId => ({ auditorDeptId: audId, targetDeptId: tgtId, isActive: true, isMutual: overrideIsMutual }))
      );
      const updated = [...simulatedPairings, ...newPairs];
      if (overrideIsMutual) {
        const reverse = targetDeptIds.flatMap(tgtId =>
          auditorDeptIds.map(audId => ({ auditorDeptId: tgtId, targetDeptId: audId, isActive: true, isMutual: true }))
        );
        updated.push(...reverse);
      }
      setSimulatedPairings(updated);
    } else {
      if (onAddPermission) {
        setIsProcessing(true);
        try {
          const pairs = auditorDeptIds.flatMap(audId =>
            targetDeptIds.map(tgtId => ({ auditorDeptId: audId, targetDeptId: tgtId }))
          );
          for (const p of pairs) {
            await onAddPermission(p.auditorDeptId, p.targetDeptId, overrideIsMutual);
            if (overrideIsMutual) {
              await onAddPermission(p.targetDeptId, p.auditorDeptId, true);
            }
          }
        } catch (e) {
          console.error("Failed to add permission:", e);
          alert("Failed to save pairing. Please try again.");
        } finally {
          setIsProcessing(false);
        }
      }
    }

    setManualAuditor('');
    setManualTarget('');
    setOverrideIsMutual(false);
  };

  const handleRemoveSimulatedPair = (idx: number) => {
    const updated = [...simulatedPairings];
    updated.splice(idx, 1);
    setSimulatedPairings(updated);
  };

  const handleCommitSimulation = async () => {
    if (!onBulkAddPermissions || simulatedPairings.length === 0) return;
    setIsProcessing(true);
    try {
      const expandedPairings: Omit<CrossAuditPermission, 'id'>[] = [];
      
      for (const pair of simulatedPairings) {
        const auditorEntity = entities.find(e => e.id === pair.auditorDeptId);
        const targetEntity = entities.find(e => e.id === pair.targetDeptId);
        
        if (!auditorEntity || !targetEntity) continue;
        
        for (const auditorDept of auditorEntity.members) {
          for (const targetDept of targetEntity.members) {
             expandedPairings.push({
               auditorDeptId: auditorDept.id,
               targetDeptId: targetDept.id,
               isActive: true,
               isMutual: false
             });
          }
        }
      }

      if (expandedPairings.length === 0) {
        alert("Expansion failed. No valid pairings generated.");
        return;
      }

      if (onBulkRemovePermissions && permissions.length > 0) {
          await onBulkRemovePermissions(permissions.map(p => p.id));
      }
      
      await onBulkAddPermissions(expandedPairings);
      setIsSimulatorActive(false);
      setSimulatedPairings([]);
      showToast?.(`Successfully committed ${expandedPairings.length} departmental links.`);
    } catch (e) {
      alert("Failed to commit simulated pairings.");
    } finally {
      setIsProcessing(false);
    }
  };

  const activePairingList = isSimulatorActive ? simulatedPairings : (permissions as any[]);

  const entityPermissions = useMemo(() => {
    if (isSimulatorActive) {
      return simulatedPairings.map((p, idx) => ({
        auditorEntityId: p.auditorDeptId,
        targetEntityId: p.targetDeptId,
        isMutual: p.isMutual,
        rawPermIds: [] as string[],
        simIdx: idx,
      }));
    }
    const map = new Map<string, { auditorEntityId: string; targetEntityId: string; isMutual: boolean; rawPermIds: string[] }>();
    (permissions as any[]).forEach(p => {
      const auditorEntity = entities.find(e => e.id === p.auditorDeptId || (e.members && e.members.some((m: any) => m.id === p.auditorDeptId)));
      const targetEntity = entities.find(e => e.id === p.targetDeptId || (e.members && e.members.some((m: any) => m.id === p.targetDeptId)));
      if (!auditorEntity || !targetEntity) return;
      const key = `${auditorEntity.id}-${targetEntity.id}`;
      if (map.has(key)) {
        map.get(key)!.rawPermIds.push(p.id);
      } else {
        map.set(key, {
            auditorEntityId: auditorEntity.id!,
            targetEntityId: targetEntity.id!,
            isMutual: p.isMutual,
            rawPermIds: [p.id],
        });
      }
    });
    return Array.from(map.values());
  }, [isSimulatorActive, simulatedPairings, permissions, entities]);

  const filteredEntityPermissions = useMemo(() => {
    return entityPermissions.filter(ep => {
      const auditorEntity = entities.find(e => e.id === ep.auditorEntityId);
      const targetEntity = entities.find(e => e.id === ep.targetEntityId);
      const auditorMatch = !auditorFilter ||
        auditorEntity?.name.toLowerCase().includes(auditorFilter.toLowerCase()) ||
        auditorEntity?.members?.some((m: any) => m.abbr?.toLowerCase().includes(auditorFilter.toLowerCase()));
      const targetMatch = !targetFilter ||
        targetEntity?.name.toLowerCase().includes(targetFilter.toLowerCase()) ||
        targetEntity?.members?.some((m: any) => m.abbr?.toLowerCase().includes(targetFilter.toLowerCase()));
      return auditorMatch && targetMatch;
    });
  }, [entityPermissions, auditorFilter, targetFilter, entities]);

  // Always-live permissions for Manual tab (ignores simulator state)
  const liveEntityPermissions = useMemo(() => {
    const map = new Map<string, { auditorEntityId: string; targetEntityId: string; isMutual: boolean; rawPermIds: string[] }>();
    (permissions as any[]).forEach(p => {
      const auditorEntity = entities.find(e => e.id === p.auditorDeptId || (e.members && e.members.some((m: any) => m.id === p.auditorDeptId)));
      const targetEntity = entities.find(e => e.id === p.targetDeptId || (e.members && e.members.some((m: any) => m.id === p.targetDeptId)));
      if (!auditorEntity || !targetEntity) return;
      const key = `${auditorEntity.id}-${targetEntity.id}`;
      if (map.has(key)) { map.get(key)!.rawPermIds.push(p.id); }
      else { map.set(key, { auditorEntityId: auditorEntity.id!, targetEntityId: targetEntity.id!, isMutual: p.isMutual, rawPermIds: [p.id] }); }
    });
    return Array.from(map.values()).filter(ep => {
      const auditorEntity = entities.find(e => e.id === ep.auditorEntityId);
      const targetEntity = entities.find(e => e.id === ep.targetEntityId);
      const auditorMatch = !auditorFilter || auditorEntity?.name.toLowerCase().includes(auditorFilter.toLowerCase()) || auditorEntity?.members?.some((m: any) => m.abbr?.toLowerCase().includes(auditorFilter.toLowerCase()));
      const targetMatch = !targetFilter || targetEntity?.name.toLowerCase().includes(targetFilter.toLowerCase()) || targetEntity?.members?.some((m: any) => m.abbr?.toLowerCase().includes(targetFilter.toLowerCase()));
      return auditorMatch && targetMatch;
    });
  }, [permissions, entities, auditorFilter, targetFilter]);

  return (
    <>
      <div className="bg-white rounded-[40px] border-2 border-slate-200 shadow-sm relative overflow-hidden">
        {isSimulatorActive && managementMode === 'auto' && (
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 animate-pulse" />
        )}

        {/* ── HEADER ── */}
        <div className="px-8 md:px-12 pt-8 md:pt-12">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Movable Asset Inspection Management</h2>
              <p className="text-slate-500 font-medium">Configure institutional consolidation and generate anti-bias pairing strategies.</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setShowConstraints(!showConstraints)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all ${
                  showConstraints ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ShieldCheck className={`w-4 h-4 ${showConstraints ? 'animate-pulse' : ''}`} />
                Limits
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showConstraints ? 'rotate-180' : ''}`} />
              </button>
              <button
                onClick={handleResetClick}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-red-100 bg-red-50 text-red-500 text-xs font-bold hover:bg-red-100 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>

          {showConstraints && onUpdateMaxAssetsPerDay && onUpdateMaxLocationsPerDay && (
            <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
              <AuditConstraints
                maxAssetsPerDay={maxAssetsPerDay}
                onUpdateMaxAssetsPerDay={onUpdateMaxAssetsPerDay}
                maxLocationsPerDay={maxLocationsPerDay}
                onUpdateMaxLocationsPerDay={onUpdateMaxLocationsPerDay}
              />
            </div>
          )}

          {/* ── TAB SWITCHER ── */}
          <div className="flex bg-slate-100 rounded-2xl p-1 gap-1 mb-8 max-w-xs">
            <button
              onClick={() => setManagementMode('auto')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                managementMode === 'auto' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" /> Auto
            </button>
            <button
              onClick={() => setManagementMode('manual')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                managementMode === 'manual' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <UserPen className="w-3.5 h-3.5" /> Manual
            </button>
          </div>
        </div>

        {/* ── AUTO TAB ── */}
        {managementMode === 'auto' && (
          <div className="px-8 md:px-12 pb-8 md:pb-12">
            <div className="flex flex-col lg:flex-row gap-10">
              {/* Left: Settings Panel */}
              <div className="lg:w-1/3">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-colors ${isSimulatorActive ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                  <Zap className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">Pairing Simulator</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">Generate efficient audit assignments automatically. Review generated pairings and refine before locking.</p>

                {/* Strategy toggle */}
                <div className="mb-5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pairing Strategy</p>
                  <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-1 gap-1">
                    <button onClick={() => setPairingMode('assets')} className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${pairingMode === 'assets' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}>By Total Assets</button>
                    <button onClick={() => setPairingMode('assets_auditors')} className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${pairingMode === 'assets_auditors' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}>Assets + Auditors</button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    {pairingMode === 'assets' ? 'Pairs targets by asset volume only — no auditor-count gating.' : 'Requires auditor capacity. Entities assigned by asset size and available officers.'}
                  </p>
                </div>

                {/* Option toggles */}
                {[
                  { icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />, label: 'Respect Manual Pairings', desc: 'Skip units already manually assigned', checked: respectManualPairings, onChange: () => setRespectManualPairings(!respectManualPairings), color: 'peer-checked:bg-indigo-600' },
                  { icon: <Users className="w-4 h-4 text-indigo-500" />, label: 'Simulate Ideal Staff', desc: 'Bypass officer shortage for planning', checked: simulateIdealStaffing, onChange: () => setSimulateIdealStaffing(!simulateIdealStaffing), color: 'peer-checked:bg-indigo-600' },
                  { icon: <ArrowLeftRight className="w-4 h-4 text-violet-500" />, label: 'Mutual Pairing (Vice Versa)', desc: 'A audits B and B audits A', checked: autoPairingMutual, onChange: () => setAutoPairingMutual(!autoPairingMutual), color: 'peer-checked:bg-violet-500' },
                ].map((t, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">{t.icon}<span className="text-xs font-black text-slate-800 uppercase tracking-tight">{t.label}</span></div>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">{t.desc}</p>
                      </div>
                      <div className="relative inline-flex items-center ml-4">
                        <input type="checkbox" className="sr-only peer" checked={t.checked} onChange={t.onChange} />
                        <div className={`w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${t.color}`}></div>
                      </div>
                    </label>
                  </div>
                ))}

                {exemptedDepts.length > 0 && (
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Ban className="w-3.5 h-3.5 text-rose-400" />
                      <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Excluded from Cross-Audit</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {exemptedDepts.map(d => (
                        <span key={d.id} className="px-2 py-1 bg-white border border-rose-200 text-rose-500 rounded-lg text-[9px] font-black uppercase tracking-wider">{d.name}</span>
                      ))}
                    </div>
                    <p className="text-[9px] text-rose-400 mt-2">These departments are excluded. Manage in Department Settings.</p>
                  </div>
                )}

                {/* CTA buttons */}
                {isSimulatorActive ? (
                  <div className="space-y-3">
                    <button onClick={handleCommitSimulation} disabled={isProcessing} className="w-full px-6 py-4 bg-slate-900 hover:bg-black text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCheck className="w-5 h-5" />}
                      Lock In Pairings
                    </button>
                    <button onClick={() => setIsSimulatorActive(false)} disabled={isProcessing} className="w-full px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all">
                      Cancel Simulation
                    </button>
                  </div>
                ) : (
                  <button onClick={handleRunSimulator} disabled={isProcessing} className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3 active:scale-95 transition-all">
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                    Run Auto-Pairing
                  </button>
                )}
              </div>

              {/* Right: KPI + Results */}
              <div className="lg:w-2/3 flex flex-col gap-6">
                {/* KPI bar */}
                <div className="bg-slate-50 rounded-[28px] p-7 border border-slate-100">
                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Projected KPI Achievement (Asset Inspection)</h4>
                      <div className="text-3xl font-black text-slate-800 tracking-tighter mt-1">
                        {projectedKPIPercentage.toFixed(1)}% <span className="text-lg text-slate-400 font-bold">/ {targetKPIPercentage}%</span>
                      </div>
                    </div>
                    <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${isKPIMet ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                      {isKPIMet ? 'KPI Secured' : 'KPI Missed'}
                    </div>
                  </div>
                  <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden relative">
                    <div className={`h-full transition-all duration-1000 ${isKPIMet ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, projectedKPIPercentage)}%` }} />
                    <div className="absolute top-0 bottom-0 w-1 bg-slate-900 z-10" style={{ left: `${targetKPIPercentage}%` }} />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 mt-2 text-right">{projectedAssetsMet.toLocaleString()} / {overallTotalAssets.toLocaleString()} Total Movable Assets Inspected</p>
                </div>

                {/* Refinement form — only when simulator is active */}
                {isSimulatorActive && (
                  <div className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm">
                    <h4 className="text-[10px] font-black uppercase text-amber-500 tracking-widest mb-4 flex items-center gap-2">
                      <UserPen className="w-3.5 h-3.5" /> Refine / Add Override
                    </h4>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <select className="flex-1 min-w-0 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none" value={manualAuditor} onChange={(e) => setManualAuditor(e.target.value)}>
                          <option value="">Select Inspecting Entity</option>
                          {[...entities].sort((a, b) => b.assets - a.assets).map(e => (
                            <option key={e.id} value={e.id}>{e.isConsolidated ? '📦 [GROUP] ' : '🏢 [UNIT] '}{e.name} — {e.assets.toLocaleString()} Assets</option>
                          ))}
                        </select>
                        <select className="flex-1 min-w-0 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none" value={manualTarget} onChange={(e) => setManualTarget(e.target.value)}>
                          <option value="">Select Target</option>
                          {[...entities].sort((a, b) => b.assets - a.assets).map(e => (
                            <option key={e.id} value={e.id}>{e.isConsolidated ? '📦 [GROUP] ' : '🏢 [UNIT] '}{e.name} — {e.assets.toLocaleString()} Assets</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer px-2 flex-1">
                          <div className="relative inline-flex items-center">
                            <input type="checkbox" className="sr-only peer" checked={overrideIsMutual} onChange={() => setOverrideIsMutual(!overrideIsMutual)} />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mutual</span>
                        </label>
                        <button onClick={handleAddOverride} disabled={!manualAuditor || !manualTarget} className="px-6 py-3 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-100 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
                          <Plus className="w-4 h-4" /> Add Override
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pairings table */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      {isSimulatorActive ? 'Simulated Assignments (Draft)' : 'Active Database Assignments'}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <input type="text" placeholder="Filter inspecting..." className="pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none w-44" value={auditorFilter} onChange={(e) => setAuditorFilter(e.target.value)} />
                        <Network className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                      </div>
                      <div className="relative">
                        <input type="text" placeholder="Filter target..." className="pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none w-40" value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)} />
                        <Layers className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                      </div>
                      {(auditorFilter || targetFilter) && (
                        <button onClick={() => { setAuditorFilter(''); setTargetFilter(''); }} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-colors"><RotateCcw className="w-3 h-3" /></button>
                      )}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-sm">
                    <div className="max-h-[520px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/80 border-b border-slate-100 sticky top-0 z-10 backdrop-blur-md">
                          <tr>
                            <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Inspecting Entity</th>
                            <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Dir.</th>
                            <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Target Entity</th>
                            <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredEntityPermissions.length === 0 ? (
                            <tr><td colSpan={4} className="py-12 text-center text-slate-400 font-medium text-sm">{isSimulatorActive ? 'Run Auto-Pairing to generate pairings.' : 'No active pairings.'}</td></tr>
                          ) : filteredEntityPermissions.map((ep, idx) => {
                            const targetEntity = entities.find(e => e.id === ep.targetEntityId);
                            const auditorEntity = entities.find(e => e.id === ep.auditorEntityId);
                            return (
                              <tr key={`auto-${ep.auditorEntityId}-${ep.targetEntityId}`} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">{auditorEntity?.isConsolidated ? <Boxes className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}</div>
                                    <div>
                                      <p className="font-bold text-sm text-slate-900">{auditorEntity?.name || ep.auditorEntityId}</p>
                                      <div className="flex flex-wrap gap-1 mt-0.5">{auditorEntity?.members?.map((m: any) => (<span key={m.id} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded text-[8px] font-bold uppercase">{m.abbr}</span>))}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-center">
                                  <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-400">{ep.isMutual ? <ArrowRightLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}</div>
                                </td>
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">{targetEntity?.isConsolidated ? <Boxes className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}</div>
                                    <div>
                                      <p className="font-bold text-sm text-slate-900">{targetEntity?.name || ep.targetEntityId}</p>
                                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{targetEntity?.assets?.toLocaleString() || 0} Assets</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  {isSimulatorActive ? (
                                    <button onClick={() => handleRemoveSimulatedPair(idx)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><X className="w-4 h-4" /></button>
                                  ) : (
                                    <button onClick={() => onBulkRemovePermissions && ep.rawPermIds?.length > 0 && onBulkRemovePermissions(ep.rawPermIds)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MANUAL TAB ── */}
        {managementMode === 'manual' && (
          <div className="px-8 md:px-12 pb-8 md:pb-12">
            {/* Add pair form */}
            <div className="bg-slate-50 rounded-[28px] p-7 border border-slate-100 mb-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0"><Plus className="w-4 h-4" /></div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Add Pairing</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Changes apply immediately to the database — no lock step needed.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mb-3">
                <select className="flex-1 min-w-0 px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-slate-500/20 outline-none" value={manualAuditor} onChange={(e) => setManualAuditor(e.target.value)}>
                  <option value="">Select Inspecting Entity</option>
                  {[...entities].sort((a, b) => b.assets - a.assets).map(e => (
                    <option key={e.id} value={e.id}>{e.isConsolidated ? '📦 [GROUP] ' : '🏢 [UNIT] '}{e.name} — {e.assets.toLocaleString()} Assets</option>
                  ))}
                </select>
                <select className="flex-1 min-w-0 px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-slate-500/20 outline-none" value={manualTarget} onChange={(e) => setManualTarget(e.target.value)}>
                  <option value="">Select Target Entity</option>
                  {[...entities].sort((a, b) => b.assets - a.assets).map(e => (
                    <option key={e.id} value={e.id}>{e.isConsolidated ? '📦 [GROUP] ' : '🏢 [UNIT] '}{e.name} — {e.assets.toLocaleString()} Assets</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                  <div className="relative inline-flex items-center">
                    <input type="checkbox" className="sr-only peer" checked={isMutual} onChange={() => setIsMutual(!isMutual)} />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-500"></div>
                  </div>
                  <ArrowLeftRight className={`w-3.5 h-3.5 transition-colors ${isMutual ? 'text-violet-500' : 'text-slate-400'}`} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mutual (Vice Versa)</span>
                </label>
                <button onClick={handleAddManualPair} disabled={!manualAuditor || !manualTarget || isProcessing} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
                  {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add Pairing
                </button>
              </div>
            </div>

            {/* Live pairings table */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Active Pairings ({permissions.length})</h4>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <input type="text" placeholder="Filter inspecting..." className="pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold focus:ring-2 focus:ring-slate-500/20 outline-none w-48" value={auditorFilter} onChange={(e) => setAuditorFilter(e.target.value)} />
                  <Network className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                </div>
                <div className="relative">
                  <input type="text" placeholder="Filter target..." className="pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold focus:ring-2 focus:ring-slate-500/20 outline-none w-40" value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)} />
                  <Layers className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                </div>
                {(auditorFilter || targetFilter) && (
                  <button onClick={() => { setAuditorFilter(''); setTargetFilter(''); }} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-colors"><RotateCcw className="w-3 h-3" /></button>
                )}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-sm">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/80 border-b border-slate-100 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Inspecting Entity</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Dir.</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Target Entity</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {liveEntityPermissions.length === 0 ? (
                      <tr><td colSpan={4} className="py-12 text-center text-slate-400 font-medium text-sm">No pairings yet. Add one above.</td></tr>
                    ) : liveEntityPermissions.map((ep) => {
                      const targetEntity = entities.find(e => e.id === ep.targetEntityId);
                      const auditorEntity = entities.find(e => e.id === ep.auditorEntityId);
                      return (
                        <tr key={`manual-${ep.auditorEntityId}-${ep.targetEntityId}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">{auditorEntity?.isConsolidated ? <Boxes className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}</div>
                              <div>
                                <p className="font-bold text-sm text-slate-900">{auditorEntity?.name || ep.auditorEntityId}</p>
                                <div className="flex flex-wrap gap-1 mt-0.5">{auditorEntity?.members?.map((m: any) => (<span key={m.id} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded text-[8px] font-bold uppercase">{m.abbr}</span>))}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-400">{ep.isMutual ? <ArrowRightLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">{targetEntity?.isConsolidated ? <Boxes className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}</div>
                              <div>
                                <p className="font-bold text-sm text-slate-900">{targetEntity?.name || ep.targetEntityId}</p>
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{targetEntity?.assets?.toLocaleString() || 0} Assets</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button onClick={() => onBulkRemovePermissions && ep.rawPermIds?.length > 0 && onBulkRemovePermissions(ep.rawPermIds)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={activeModal === 'apply'}
        title="Apply Strategic Matrix?"
        message="This will overwrite existing permissions."
        confirmLabel="Apply Now"
        cancelLabel="Cancel"
        onConfirm={executeApply}
        onCancel={() => setActiveModal(null)}
        variant="info"
      />

      <ConfirmationModal
        isOpen={activeModal === 'reset'}
        title="Clear Configurations?"
        message="This will dissolve all groups and clear permissions."
        confirmLabel="Reset Everything"
        cancelLabel="Cancel"
        onConfirm={executeReset}
        onCancel={() => setActiveModal(null)}
        variant="warning"
      />
    </>
  );
};
