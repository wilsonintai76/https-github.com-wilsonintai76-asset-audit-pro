
import React, { useState, useMemo } from 'react';
import { Department, CrossAuditPermission, User, AuditGroup } from '../types';
import { Wand2, UserPen, Zap, Boxes, Loader2, Layers, Network, Check, CheckCheck, RotateCcw, Link, Grid, List, ArrowRightLeft, ArrowRight, Ban, Users, Building2, Trash2, Link2Off, Plus, X, ShieldCheck, ChevronDown } from 'lucide-react';
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
  
  // Manual Mode State
  const [manualAuditor, setManualAuditor] = useState('');
  const [manualTarget, setManualTarget] = useState('');
  const [isMutual, setIsMutual] = useState(false);
  const [overrideIsMutual, setOverrideIsMutual] = useState(false);

  // Workflow Control
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('grouping');
  const [simulateIdealStaffing, setSimulateIdealStaffing] = useState(false);
  
  // State for Auditor Strictness (Min 2 Auditors rule)
  const [strictAuditorRule, setStrictAuditorRule] = useState<boolean>(true);
  
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

  const entities = useMemo(() => {
    const map = new Map<string, { name: string, assets: number, auditors: number, memberCount: number, members: any[], id?: string }>(); 

    activeDepts.forEach(d => {
      // Use the normalized auditGroupId to identify the group.
      // If none, it is a standalone department.
      const group = d.auditGroupId ? auditGroups.find(g => g.id === d.auditGroupId) : null;
      
      const entityName = group ? group.name : d.name;
      const entityId = group ? group.id : d.id;
      
      const current = map.get(entityId) || { name: entityName, assets: 0, auditors: 0, memberCount: 0, members: [], id: entityId };
      const safeAssets = typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0);

      map.set(entityId, { 
        name: entityName,
        assets: current.assets + safeAssets,
        auditors: current.auditors + (d.auditorCount || 0),
        memberCount: current.memberCount + 1,
        members: [...current.members, d],
        id: entityId
      });
    });

    return Array.from(map.values()).map(stats => {
      // It is a group if it contains multiple departments OR it explicitly maps to an audit group ID
      const constitutesGroup = stats.memberCount > 1 || auditGroups.some(g => g.id === stats.id);
      return { 
        ...stats, 
        isJoint: constitutesGroup,
        isGroup: constitutesGroup,
        isConsolidated: constitutesGroup
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
      // 1. Clear local calculation state
      setStrategicPlan([]);
      setWorkflowStep('grouping');
      setIsApplied(false);
      setIsSimulatorActive(false);
      setSimulatedPairings([]);

      // 2. Clear Department Groups (Database)
      const updates = departments
        .filter(d => d.auditGroupId)
        .map(d => ({ id: d.id, data: { auditGroupId: null } }));

      if (updates?.length > 0) {
        await onBulkUpdateDepartments(updates);
      }

      // 3. Clear ALL Existing Permissions (Database - Manual & Auto)
      if (onBulkRemovePermissions && permissions.length > 0) {
        await onBulkRemovePermissions(permissions.map(p => p.id));
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
        // Use Promise.all to ensure all deletions finish before proceeding
        await Promise.all(permissions.map(p => onRemovePermission(p.id)));
      }

      // Brief delay to ensure database consistency
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
    if (auditorId === targetId) return; // Prevent self-audit
    
    const perm = permissions.find(p => p.auditorDeptId === auditorId && p.targetDeptId === targetId);
    
    if (perm) {
      // Toggle off (remove)
      if (onRemovePermission) await onRemovePermission(perm.id);
    } else {
      // Toggle on (add)
      await onAddPermission(auditorId, targetId, false);
    }
  };

  // --- LOGIC ---

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
    
    // Also, if we auto-created "Group A", "Group B", etc. and they don't exist in audit_groups table,
    // we should probably add them. But since this is "Optimization Engine" (old logic), 
    // it uses strings. The user specifically asked for MANUAL groups too.
    // I'll leave the string-based auto-grouping as a fallback "Optimized Group" display,
    // while encouraging the Registry for permanent manual groups.
    
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

  const targetKPIAssets = overallTotalAssets * (targetKPIPercentage / 100);

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
    
    // 1. Get targets (Entities with assets)
    const targets = entities.filter(e => e.assets > 0).sort((a, b) => b.assets - a.assets);
    
    // 2. Get available auditors
    const auditors = entities.filter(e => {
        if (simulateIdealStaffing) return true; // Everyone can audit in ideal mode
        return e.auditors >= minAuditorsRequired;
    });
    
    const capacityMap = new Map<string, number>();
    auditors.forEach(a => {
        if (simulateIdealStaffing) {
            // In ideal mode, scale capacity by members (2 auditors per department)
            capacityMap.set(a.id!, Math.max(2, a.members.length * 2));
        } else {
            const capacity = minAuditorsRequired === 2 ? Math.floor(a.auditors / 2) : a.auditors;
            capacityMap.set(a.id!, capacity);
        }
    });

    const newStrategicPlan: StrategicPair[] = [];
    const usedTargetIds = new Set<string>();

    for (const target of targets) {
      if (usedTargetIds.has(target.id!)) continue;

      const assets = target.assets || 0;
      const targetCapacity = Math.max(2, Math.ceil(assets / maxAssetsPerDay));
      let assignedCount = 0;
      const assignedAuditors: any[] = [];

      // Loop to fill target capacity
      while (assignedCount < targetCapacity) {
        // Find best available auditor (that isn't this target AND hasn't been assigned to this target yet)
        const availableAuditor = auditors
          .filter(a => a.id !== target.id && (capacityMap.get(a.id!) || 0) > 0 && !assignedAuditors.some(aa => aa.id === a.id))
          .sort((a, b) => (capacityMap.get(b.id!) || 0) - (capacityMap.get(a.id!) || 0))[0];

        if (!availableAuditor) break;

        // Calculate recommended individual auditors
        let potentialMembers: any[] = [];
        
        if (simulateIdealStaffing && availableAuditor.auditors === 0) {
            // Generate virtual placeholders if real staff are missing
            potentialMembers = [
                { id: `virtual-${availableAuditor.id}-1`, name: `Virtual Auditor A (${availableAuditor.name})` },
                { id: `virtual-${availableAuditor.id}-2`, name: `Virtual Auditor B (${availableAuditor.name})` }
            ];
        } else {
            const auditorDeptIds = availableAuditor.members.map(m => m.id);
            potentialMembers = users.filter(u => 
                auditorDeptIds.includes(u.activeDeptId || u.departmentId) && 
                u.status === 'Active' &&
                (u.roles.includes('Supervisor') || u.roles.includes('Staff'))
            );
        }

        assignedAuditors.push({ 
          name: availableAuditor.name,
          assets: availableAuditor.assets,
          auditors: simulateIdealStaffing ? Math.max(availableAuditor.auditors, availableAuditor.members.length * 2) : availableAuditor.auditors,
          isJoint: availableAuditor.isJoint,
          id: availableAuditor.id,
          members: potentialMembers.slice(0, 2),
          isVirtual: simulateIdealStaffing && availableAuditor.auditors === 0
        });

        // Update capacities
        const currentCap = capacityMap.get(availableAuditor.id!) || 0;
        capacityMap.set(availableAuditor.id!, currentCap - 1);
        assignedCount += (simulateIdealStaffing ? Math.max(availableAuditor.auditors, 2) : availableAuditor.auditors);
      }

      if (assignedAuditors.length > 0) {
        newStrategicPlan.push({
          target: { 
            name: target.name,
            assets: target.assets,
            auditors: target.auditors,
            members: target.members,
            id: target.id
          } as any,
          auditors: assignedAuditors,
          totalAuditorsInGroup: assignedAuditors.reduce((sum, a) => sum + a.auditors, 0),
          auditorSideAssets: assignedAuditors.reduce((sum, a) => sum + a.assets, 0)
        });
        usedTargetIds.add(target.id!);
      }
    }

    // Map ALL auditors from the plan to the flat pairings list
    const newPairings: Omit<CrossAuditPermission, 'id'>[] = [];
    newStrategicPlan.forEach(p => {
        p.auditors.forEach(auditor => {
            newPairings.push({
                auditorDeptId: auditor.id,
                targetDeptId: p.target.id,
                isActive: true,
                isMutual: false
            });
        });
    });

    setStrategicPlan(newStrategicPlan);
    setSimulatedPairings(newPairings);
    setIsSimulatorActive(true);
    setIsApplied(false);
    setIsProcessing(false);
  };

  const handleAddOverride = () => {
    if (!manualAuditor || !manualTarget) return;
    if (manualAuditor === manualTarget) {
      alert("Conflict Detected: A unit cannot audit its own assets.");
      return;
    }
    
    const newPair = { auditorDeptId: manualAuditor, targetDeptId: manualTarget, isActive: true, isMutual: overrideIsMutual };
    
    if (isSimulatorActive) {
      const updated = [...simulatedPairings, newPair];
      if (overrideIsMutual) updated.push({ auditorDeptId: manualTarget, targetDeptId: manualAuditor, isActive: true, isMutual: true });
      setSimulatedPairings(updated);
    } else {
      if (onAddPermission) onAddPermission(manualAuditor, manualTarget, overrideIsMutual);
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
      // EXPANSION LOGIC: Map Entity-to-Entity pairings into Department-to-Department permissions
      const expandedPairings: Omit<CrossAuditPermission, 'id'>[] = [];
      
      for (const pair of simulatedPairings) {
        // Find the entities for these IDs
        const auditorEntity = entities.find(e => e.id === pair.auditorDeptId);
        const targetEntity = entities.find(e => e.id === pair.targetDeptId);
        
        if (!auditorEntity || !targetEntity) continue;
        
        // Expand: Each department in the auditing entity audits each department in the target entity.
        // This ensures the database's FK constraints (References departments.id) are met.
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

      // If we are committing the simulation, we clear old permissions first
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

  const filteredPairingList = useMemo(() => {
    return activePairingList.filter(perm => {
        const targetEntity = entities.find(e => e.id === perm.targetDeptId || (e.members && e.members.some(m => m.id === perm.targetDeptId)));
        const auditorEntity = entities.find(e => e.id === perm.auditorDeptId || (e.members && e.members.some(m => m.id === perm.auditorDeptId)));
        
        const auditorMatch = !auditorFilter || 
            auditorEntity?.name.toLowerCase().includes(auditorFilter.toLowerCase()) ||
            auditorEntity?.members.some(m => m.abbr.toLowerCase().includes(auditorFilter.toLowerCase()));
            
        const targetMatch = !targetFilter ||
            targetEntity?.name.toLowerCase().includes(targetFilter.toLowerCase()) ||
            targetEntity?.members.some(m => m.abbr.toLowerCase().includes(targetFilter.toLowerCase()));
            
        return auditorMatch && targetMatch;
    });
  }, [activePairingList, auditorFilter, targetFilter, entities]);

  return (
    <div className="space-y-8">

      {/* 3-TAB GROUP BUILDER COMPONENT */}
      <GroupBuilderTab 
        departments={departments}
        auditGroups={auditGroups}
        onAddAuditGroup={onAddAuditGroup}
        onDeleteAuditGroup={onDeleteAuditGroup}
        onBulkUpdateDepartments={onBulkUpdateDepartments}
        onAutoConsolidate={onAutoConsolidate}
        isProcessing={isProcessing}
        setIsProcessing={setIsProcessing}
        strictAuditorRule={strictAuditorRule}
        setStrictAuditorRule={setStrictAuditorRule}
        maxAssetsPerDay={maxAssetsPerDay}
        maxLocationsPerDay={maxLocationsPerDay}
      />
          
      {/* Simulator Mode Header */}
      <div className="bg-white rounded-[40px] border-2 border-slate-200 p-8 md:p-12 shadow-sm relative overflow-hidden">
         {isSimulatorActive && (
             <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 animate-pulse"></div>
         )}
         
         <div className="flex flex-col lg:flex-row gap-12">
          {/* Left Column: Controls */}
          <div className="lg:w-1/3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Movable Asset Inspection Management</h2>
                <p className="text-slate-500 font-medium">Configure institutional consolidation and generate anti-bias pairing strategies.</p>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowConstraints(!showConstraints)}
                  className={`flex items-center gap-3 px-6 py-3 rounded-2xl border text-sm font-bold transition-all ${
                    showConstraints 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ShieldCheck className={`w-4 h-4 ${showConstraints ? 'animate-pulse' : ''}`} />
                  Institutional Limits
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showConstraints ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {showConstraints && onUpdateMaxAssetsPerDay && onUpdateMaxLocationsPerDay && (
              <div className="mb-12 animate-in fade-in slide-in-from-top-4 duration-300">
                <AuditConstraints 
                  maxAssetsPerDay={maxAssetsPerDay}
                  onUpdateMaxAssetsPerDay={onUpdateMaxAssetsPerDay}
                  maxLocationsPerDay={maxLocationsPerDay}
                  onUpdateMaxLocationsPerDay={onUpdateMaxLocationsPerDay}
                />
              </div>
            )}
            
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-6 transition-colors ${isSimulatorActive ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
              <Zap className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-4">Pairing Simulator</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Generate the most efficient audit assignments automatically. The engine matches auditing entities to high-asset targets until your Institutional KPI is mathematically secured.
            </p>
            
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-8">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Simulate Ideal Inspecting Staff</span>
                  </div>
                  <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-tighter">Bypass real inspecting officer shortages for strategic planning</p>
                </div>
                <div className="relative inline-flex items-center ml-4">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={simulateIdealStaffing}
                    onChange={() => setSimulateIdealStaffing(!simulateIdealStaffing)}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </div>
              </label>
            </div>

            {isSimulatorActive ? (
                <div className="space-y-3">
                    <button 
                      onClick={handleCommitSimulation}
                      disabled={isProcessing}
                      className="w-full px-6 py-4 bg-slate-900 hover:bg-black text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                    >
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCheck className="w-5 h-5" />}
                      Lock In Pairings
                    </button>
                    <button 
                      onClick={() => setIsSimulatorActive(false)}
                      disabled={isProcessing}
                      className="w-full px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all"
                    >
                      Cancel Simulation
                    </button>
                </div>
            ) : (
                <button 
                  onClick={handleRunSimulator}
                  disabled={isProcessing}
                  className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                  Run Auto-Pairing
                </button>
            )}
          </div>

          {/* Right Column: Projection Dashboard & Refinements */}
          <div className="lg:w-2/3 w-full bg-slate-50 rounded-[32px] p-8 border border-slate-100 relative">
             <div className="mb-8">
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
                 
                 {/* Progress Bar */}
                 <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden flex relative">
                     <div 
                         className={`h-full transition-all duration-1000 ${isKPIMet ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                         style={{ width: `${Math.min(100, projectedKPIPercentage)}%` }}
                     ></div>
                     
                     {/* Target Marker */}
                     <div 
                         className="absolute top-0 bottom-0 w-1 bg-slate-900 z-10"
                         style={{ left: `${targetKPIPercentage}%` }}
                     ></div>
                 </div>
                 <p className="text-[10px] font-bold text-slate-400 mt-2 text-right">{projectedAssetsMet.toLocaleString()} / {overallTotalAssets.toLocaleString()} Total Movable Assets Inspected</p>
             </div>

             {/* Manual Overrides */}
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                 <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Manual Override / Refinement</h4>
                 <div className="flex flex-col sm:flex-row gap-4">
                     <select 
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold shadow-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        value={manualAuditor}
                        onChange={(e) => setManualAuditor(e.target.value)}
                     >
                        <option value="">Select Inspecting Entity</option>
                        {entities.filter(e => simulateIdealStaffing || e.auditors >= 1).map(e => <option key={e.id} value={e.id}>{e.name} ({e.auditors} Officers)</option>)}
                     </select>
                     
                     <select 
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold shadow-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        value={manualTarget}
                        onChange={(e) => setManualTarget(e.target.value)}
                     >
                        <option value="">Select Target</option>
                        {entities.filter(e => e.assets > 0).map(e => <option key={e.id} value={e.id}>{e.name} ({e.assets} Movable Assets)</option>)}
                     </select>
                     
                     <label className="flex items-center gap-2 cursor-pointer group px-2">
                        <div className="relative inline-flex items-center">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={overrideIsMutual}
                            onChange={() => setOverrideIsMutual(!overrideIsMutual)}
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mutual</span>
                     </label>

                     <button 
                         onClick={handleAddOverride}
                         disabled={!manualAuditor || !manualTarget}
                         className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors disabled:opacity-50 flex items-center gap-2"
                     >
                         <Plus className="w-4 h-4" /> Add
                     </button>
                 </div>
             </div>
          </div>
         </div>
         
         <div className="mt-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 px-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isSimulatorActive ? 'Simulated Assignments (Draft)' : 'Active Database Assignments'}</h4>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative group min-w-[200px]">
                        <input 
                            type="text"
                            placeholder="Filter Inspecting Entity..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold shadow-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            value={auditorFilter}
                            onChange={(e) => setAuditorFilter(e.target.value)}
                        />
                        <Network className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="relative group min-w-[200px]">
                        <input 
                            type="text"
                            placeholder="Filter Target Entity..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold shadow-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            value={targetFilter}
                            onChange={(e) => setTargetFilter(e.target.value)}
                        />
                        <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    </div>
                    {(auditorFilter || targetFilter) && (
                        <button 
                            onClick={() => { setAuditorFilter(''); setTargetFilter(''); }}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-colors"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
                 <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                     <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/80 border-b border-slate-100 sticky top-0 z-10 backdrop-blur-md">
                           <tr>
                              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest bg-slate-50/80">Inspecting Entity</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center bg-slate-50/80">Direction</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest bg-slate-50/80">Target Entity (Movable Assets)</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right bg-slate-50/80">Action</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {filteredPairingList.length === 0 ? (
                               <tr>
                                   <td colSpan={4} className="py-12 text-center text-slate-400 font-medium text-sm">
                                       {activePairingList.length === 0 ? 'No pairings generated. Run Simulator or add manual overrides.' : 'No pairings match your search filters.'}
                                   </td>
                               </tr>
                           ) : (
                                filteredPairingList.map((perm, idx) => {
                                    const targetEntity = entities.find(e => e.id === perm.targetDeptId || (e.members && e.members.some(m => m.id === perm.targetDeptId)));
                                    const auditorEntity = entities.find(e => e.id === perm.auditorDeptId || (e.members && e.members.some(m => m.id === perm.auditorDeptId)));
                                    const planPair = isSimulatorActive ? strategicPlan.find(p => p.target.id === perm.targetDeptId) : null;
                                    const planAuditor = planPair?.auditors.find(a => a.id === perm.auditorDeptId);
                                    
                                    return (
                                        <tr key={isSimulatorActive ? idx : (perm as any).id} className="hover:bg-white transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                                                        <Users className="w-4 h-4" />
                                                    </div>
                                                     <div>
                                                        <p className="font-bold text-sm text-slate-900">{auditorEntity?.name || perm.auditorDeptId}</p>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {auditorEntity?.members?.map((m: any) => (
                                                                <span key={m.id} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded text-[8px] font-bold uppercase tracking-wider">
                                                                    {m.abbr}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                                                            {isSimulatorActive && planAuditor ? planAuditor.auditors : (auditorEntity?.auditors || 0)} Total Inspecting Officers
                                                            {planAuditor?.isVirtual && (
                                                                <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded text-[8px]">
                                                                    <Zap className="w-2 h-2" /> VIRTUAL STRATEGIC
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-400">
                                                    {perm.isMutual ? <ArrowRightLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg border border-amber-100 group w-fit mb-3">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                                                    <span className="text-[10px] font-black uppercase tracking-tight">
                                                        Target Capacity: {(() => {
                                                            const assets = targetEntity?.assets || 0;
                                                            return Math.max(2, Math.ceil(assets / maxAssetsPerDay));
                                                        })()} Inspecting Officers
                                                    </span>
                                                </div>

                                               <div className="flex items-center gap-3">
                                                   <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                                                       <Building2 className="w-4 h-4" />
                                                   </div>
                                                   <div>
                                                       <p className="font-bold text-sm text-slate-900">{targetEntity?.name || perm.targetDeptId}</p>
                                                       <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{targetEntity?.assets?.toLocaleString() || 0} Movable Assets</p>
                                                   </div>
                                               </div>
                                           </td>
                                           <td className="px-6 py-4 text-right">
                                               {isSimulatorActive ? (
                                                   <button onClick={() => handleRemoveSimulatedPair(idx)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                                       <X className="w-5 h-5" />
                                                   </button>
                                               ) : (
                                                   <button onClick={() => onRemovePermission && onRemovePermission((perm as any).id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                                       <Trash2 className="w-5 h-5" />
                                                   </button>
                                               )}
                                           </td>
                                       </tr>
                                   );
                                })
                           )}
                        </tbody>
                     </table>
                     <div className="h-4 bg-slate-50/50 border-t border-slate-100"></div>
                 </div>
            </div>
         </div>
      </div>

       {/* ENTITIES LIST */}
       <ActiveEntitiesList 
        entities={entities}
        selectedEntity={selectedAuditor}
        onSelect={setSelectedAuditor}
        megaTargetThreshold={megaTargetThreshold}
        minAuditors={strictAuditorRule ? 2 : 1}
        overallTotal={overallTotalAssets}
        threshold={assetThreshold}
        strictAuditorRule={strictAuditorRule}
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
