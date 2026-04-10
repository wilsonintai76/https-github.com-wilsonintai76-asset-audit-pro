import React, { useMemo, useRef } from 'react';
import { CrossAuditPermission, Department, User, AuditPhase, KPITier, KPITierTarget, InstitutionKPITarget, UserRole, Location, AuditSchedule, DepartmentMapping, AuditGroup } from '@shared/types';
import { useRBAC } from '../contexts/RBACContext';
import { CrossAuditManagement } from './CrossAuditManagement';
import { AuditPhasesSettings } from './AuditPhasesSettings';
import { KPISettings } from './KPISettings';
import { TierDistributionTable } from './TierDistributionTable';
import { suggestThresholds } from '../services/aiService';
import { DataManagementWorkflow } from './DataManagementWorkflow';
import { RBACMatrix } from './RBACMatrix';
import { Zap, Sliders, AlertCircle, Eye, Calendar, UserCheck, Users, UserPlus, Edit, ShieldAlert, ShieldCheck, Network, Lock, Unlock, RotateCcw, Building2, Trash2 } from 'lucide-react';
import { BackupButton } from './BackupButton';
import { PageHeader } from './PageHeader';
import { GroupBuilderTab } from './GroupBuilderTab';
import { AuditConstraints } from './AuditConstraints';

interface SystemSettingsProps {
  departments: Department[];
  users: User[];
  permissions: CrossAuditPermission[];
  phases: AuditPhase[];
  kpiTiers: KPITier[];
  kpiTierTargets: KPITierTarget[];
  institutionKPIs: InstitutionKPITarget[];
  userRoles: UserRole[];
  onAddPermission: (auditorDept: string, targetDept: string, isMutual: boolean) => Promise<void>;
  onRemovePermission: (id: string) => Promise<void>;
  onTogglePermission: (id: string, isActive: boolean) => void;
  onUpdateDepartment: (id: string, updates: Partial<Department>) => void;
  onBulkUpdateDepartments: (updates: { id: string, data: Partial<Department> }[]) => void;
  onAddPhase: (phase: Omit<AuditPhase, 'id'>) => void;
  onUpdatePhase: (id: string, updates: Partial<AuditPhase>) => void;
  onDeletePhase: (id: string) => void;
  onAddKPITier: (tier: Omit<KPITier, 'id'>) => void;
  onUpdateKPITier: (id: string, updates: Partial<KPITier>) => void;
  onDeleteKPITier: (id: string) => void;
  onUpdateKPITierTarget: (tierId: string, phaseId: string, percentage: number) => void;
  onUpdateInstitutionKPI: (phaseId: string, percentage: number) => void;
  onAutoCalculateTierTargets?: () => Promise<void>;
  onResetLocations: () => void;
  onResetOperationalData: () => void;
  onResetDepartments: () => void;
  onResetUsers: () => void;
  onResetPhases: () => void;
  onResetKPI: () => void;
  isSystemLocked: boolean;
  onBulkAddLocs: (locs: Omit<Location, 'id'>[]) => void;
  onBulkAddDepts: (depts: Omit<Department, 'id'>[]) => void;
  onBulkActivateStaff: (entries: { name: string; email: string; department?: string; designation?: string; role?: string }[]) => void;
  maxAssetsPerDay: number;
  onUpdateMaxAssetsPerDay: (val: number) => void;
  maxLocationsPerDay: number;
  onUpdateMaxLocationsPerDay: (val: number) => void;
  minAuditorsPerLocation: number;
  onUpdateMinAuditorsPerLocation: (val: number) => void;
  dailyInspectionCapacity: number;
  onUpdateDailyInspectionCapacity: (val: number) => void;
  standaloneThresholdAssets: number;
  onUpdateStandaloneThresholdAssets: (val: number) => void;
  onRebalanceSchedule: () => Promise<void>;
  schedules: AuditSchedule[];
  departmentMappings: DepartmentMapping[];
  onAddDepartmentMapping: (mapping: Omit<DepartmentMapping, 'id'>) => Promise<void>;
  onDeleteDepartmentMapping: (id: string) => Promise<void>;
  onSyncLocationMappings: () => Promise<void>;
  onUpsertLocations: (locs: Omit<Location, 'id'>[]) => Promise<void>;
  onSetDeptTotalsFromMapping: (totals: Record<string, number>) => Promise<void>;
  onUpdateUninspectedAssets: (updates: { id: string, uninspectedCount: number }[], deptExtras?: Record<string, number>) => Promise<void>;
  locations: Location[];
  auditGroups: AuditGroup[];
  onAddAuditGroup: (group: Omit<AuditGroup, 'id'>) => Promise<void>;
  onUpdateAuditGroup: (id: string, updates: Partial<AuditGroup>) => Promise<void>;
  onDeleteAuditGroup: (id: string) => Promise<void>;
  onBulkDeleteAuditGroups?: (ids: string[]) => Promise<void>;
  onAutoConsolidate: (threshold: number, excludedIds: string[], minAuditors: number, useAI: boolean) => Promise<void>;
  onRunStrategicPairing?: (payload: any) => Promise<{ pairings: any[] }>;
  onBulkAddPermissions: (auditorDept: string, targetDept: string, isMutual: boolean) => Promise<void>;
  onBulkRemovePermissions: (ids: string[]) => Promise<void>;
  pairingLocked?: boolean;
  pairingLockInfo?: { lockedAt: string; lockedBy: string; pairingCount: number; cycleYear: number } | null;
  onLockPairing?: (pairingCount: number) => Promise<void>;
  onUnlockPairing?: () => Promise<void>;
  onResetPairingData?: () => Promise<void>;
  showToast?: (message: string, type?: any) => void;
  feasibilityReport?: any;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({
  departments,
  users,
  permissions,
  phases,
  kpiTiers,
  userRoles,
  onAddPermission,
  onRemovePermission,
  onTogglePermission,
  onUpdateDepartment,
  onBulkUpdateDepartments,
  onAddPhase,
  onUpdatePhase,
  onDeletePhase,
  onResetPairingData,
  onAddKPITier,
  onUpdateKPITier,
  onDeleteKPITier,
  onUpdateKPITierTarget,
  onResetLocations,
  onResetOperationalData,
  onResetDepartments,
  onResetUsers,
  onResetPhases,
  onResetKPI,
  isSystemLocked,
  onBulkAddLocs,
  onBulkAddDepts,
  onBulkActivateStaff,
  maxAssetsPerDay,
  onUpdateMaxAssetsPerDay,
  maxLocationsPerDay,
  onUpdateMaxLocationsPerDay,
  minAuditorsPerLocation,
  onUpdateMinAuditorsPerLocation,
  dailyInspectionCapacity,
  onUpdateDailyInspectionCapacity,
  standaloneThresholdAssets,
  onUpdateStandaloneThresholdAssets,
  onRebalanceSchedule,
  schedules,
  departmentMappings,
  onAddDepartmentMapping,
  onDeleteDepartmentMapping,
  onSyncLocationMappings,
  onUpsertLocations,
  onSetDeptTotalsFromMapping,
  onUpdateUninspectedAssets,
  auditGroups,
  onAddAuditGroup,
  onUpdateAuditGroup,
  onDeleteAuditGroup,
  onBulkDeleteAuditGroups,
  onAutoConsolidate,
  onBulkAddPermissions,
  onBulkRemovePermissions,
  onRunStrategicPairing,
  pairingLocked,
  pairingLockInfo,
  onLockPairing,
  onUnlockPairing,
  kpiTierTargets,
  institutionKPIs,
  onUpdateInstitutionKPI,
  onAutoCalculateTierTargets,
  showToast,
  locations,
  feasibilityReport
}) => {
  const isAdmin = (userRoles || []).includes('Admin');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isSuggestingAI, setIsSuggestingAI] = React.useState(false);
  const [strictAuditorRule, setStrictAuditorRule] = React.useState(true);

  // GLOBAL SIMULATOR STATE (Lumped)
  const [isSimulatorActive, setIsSimulatorActive] = React.useState<boolean>(() => {
    return localStorage.getItem('cross_audit_simulator_active') === 'true';
  });
  const [draftConstraints, setDraftConstraints] = React.useState<{
    maxAssetsPerDay: number;
    maxLocationsPerDay: number;
    minAuditorsPerLocation: number;
    dailyInspectionCapacity: number;
    standaloneThresholdAssets: number;
  } | null>(null);

  const currentMaxAssets = draftConstraints?.maxAssetsPerDay ?? maxAssetsPerDay;
  const currentMaxLocations = draftConstraints?.maxLocationsPerDay ?? maxLocationsPerDay;
  const currentMinAuditors = draftConstraints?.minAuditorsPerLocation ?? (strictAuditorRule ? 2 : minAuditorsPerLocation);
  const currentDailyCapacity = draftConstraints?.dailyInspectionCapacity ?? dailyInspectionCapacity;
  const currentStandaloneThreshold = draftConstraints?.standaloneThresholdAssets ?? standaloneThresholdAssets;

  // Actual Resource Calculations
  const activeAuditorCount = React.useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return users.filter(u => u.status === 'Active' && u.certificationExpiry && u.certificationExpiry >= today).length;
  }, [users]);

  const totalInstitutionalAssets = React.useMemo(() => {
    return departments.reduce((sum, d) => sum + (typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0)), 0);
  }, [departments]);

  const handleUpdateDraftConstraints = (updates: Partial<typeof draftConstraints>) => {
    if (!isSimulatorActive) {
      if (updates.maxAssetsPerDay !== undefined) onUpdateMaxAssetsPerDay(updates.maxAssetsPerDay);
      if (updates.maxLocationsPerDay !== undefined) onUpdateMaxLocationsPerDay(updates.maxLocationsPerDay);
      if (updates.minAuditorsPerLocation !== undefined) onUpdateMinAuditorsPerLocation(updates.minAuditorsPerLocation);
      if (updates.dailyInspectionCapacity !== undefined) onUpdateDailyInspectionCapacity(updates.dailyInspectionCapacity);
      if (updates.standaloneThresholdAssets !== undefined) onUpdateStandaloneThresholdAssets(updates.standaloneThresholdAssets);
    } else {
      setDraftConstraints(prev => {
        const base = prev || { maxAssetsPerDay, maxLocationsPerDay, minAuditorsPerLocation, dailyInspectionCapacity, standaloneThresholdAssets };
        return { ...base, ...updates } as any;
      });
    }
  };

  const handleAIAutoOptimize = async () => {
    setIsSuggestingAI(true);
    try {
      // 1. Get AI suggested base threshold for grouping
      const result = await suggestThresholds(departments);
      
      // 2. Resource-based Capacity Math
      const teamCount = Math.floor(activeAuditorCount / 2); // Policy 2 minimum
      const WORK_DAYS_PER_MONTH = 20; 
      
      let optimizedCapacity = dailyInspectionCapacity;
      if (teamCount > 0 && totalInstitutionalAssets > 0) {
        // Ideal capacity per team to finish in 1 month (20 working days)
        optimizedCapacity = Math.ceil(totalInstitutionalAssets / (teamCount * WORK_DAYS_PER_MONTH));
        // Clamp to reasonable ranges (e.g., 50 to 1000)
        optimizedCapacity = Math.max(50, Math.min(1000, optimizedCapacity));
      }

      // 3. Apply to State
      handleUpdateDraftConstraints({ 
        standaloneThresholdAssets: result.assetThreshold || 1500,
        dailyInspectionCapacity: optimizedCapacity,
        minAuditorsPerLocation: 2, 
      });

      if (showToast) showToast('Strategy Optimized: Standalone BBI set to ' + (result.assetThreshold || 1500), 'success');
    } catch (err) {
      console.error('AI Auto-Optimize failed:', err);
      if (showToast) showToast('AI optimization encountered an error.', 'error');
    } finally {
      setIsSuggestingAI(false);
    }
  };

  const activePhase = React.useMemo(() => {
    const today = new Date();
    return phases.find(p => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return today >= start && today <= end;
    });
  }, [phases]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
      <PageHeader
        title="System Configuration"
        icon={Sliders}
        activePhase={activePhase}
        description="Customize institutional audit rules and scheduling windows."
      />

      {isAdmin && (
        <DataManagementWorkflow
          departments={departments}
          departmentMappings={departmentMappings}
          locations={locations}
          onBulkAddDepts={onBulkAddDepts}
          onBulkActivateStaff={onBulkActivateStaff}
          onAddDepartmentMapping={onAddDepartmentMapping}
          onDeleteDepartmentMapping={onDeleteDepartmentMapping}
          onSyncLocationMappings={onSyncLocationMappings}
          onUpsertLocations={onUpsertLocations}
          onSetDeptTotalsFromMapping={onSetDeptTotalsFromMapping}
          onUpdateUninspectedAssets={onUpdateUninspectedAssets}
        />
      )}

      <div className="animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-3 mb-4 px-2">
           <ShieldCheck className={`w-5 h-5 ${isSimulatorActive ? 'text-amber-500' : 'text-indigo-500'}`} />
           <h3 className="text-xl font-black text-slate-800 tracking-tight">Global Institutional Strategy</h3>
           {isSimulatorActive && (
             <span className="px-3 py-1 bg-amber-100 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest animate-pulse">Draft Mode</span>
           )}
        </div>
        <AuditConstraints
          maxAssetsPerDay={currentMaxAssets}
          onUpdateMaxAssetsPerDay={(v) => handleUpdateDraftConstraints({ maxAssetsPerDay: v })}
          maxLocationsPerDay={currentMaxLocations}
          onUpdateMaxLocationsPerDay={(v) => handleUpdateDraftConstraints({ maxLocationsPerDay: v })}
          minAuditorsPerLocation={currentMinAuditors}
          onUpdateMinAuditorsPerLocation={(v) => handleUpdateDraftConstraints({ minAuditorsPerLocation: v })}
          dailyInspectionCapacity={currentDailyCapacity}
          onUpdateDailyInspectionCapacity={(v) => handleUpdateDraftConstraints({ dailyInspectionCapacity: v })}
          standaloneThresholdAssets={currentStandaloneThreshold}
          onUpdateStandaloneThresholdAssets={(v) => handleUpdateDraftConstraints({ standaloneThresholdAssets: v })}
          onAutoOptimize={handleAIAutoOptimize}
          isOptimizing={isSuggestingAI}
          activeAuditors={activeAuditorCount}
          totalAssets={totalInstitutionalAssets}
          isSimulatorActive={isSimulatorActive}
        />
      </div>

      <div className="relative">
        <AuditPhasesSettings
          phases={phases}
          isAdmin={isAdmin}
          onAdd={onAddPhase}
          onUpdate={onUpdatePhase}
          onDelete={onDeletePhase}
        />
        {isAdmin && (
          <div className="flex justify-end mt-2 pr-2">
            <button
              onClick={onResetPhases}
              disabled={isSystemLocked}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                isSystemLocked
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-red-400 hover:text-red-600 hover:bg-red-50'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              Reset Phases
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <KPISettings
          tiers={kpiTiers}
          phases={phases}
          tierTargets={kpiTierTargets}
          institutionKPIs={institutionKPIs}
          departments={departments}
          onAddTier={onAddKPITier}
          onUpdateTier={onUpdateKPITier}
          onDeleteTier={onDeleteKPITier}
          onUpdateTarget={onUpdateKPITierTarget}
          onUpdateInstitutionKPI={onUpdateInstitutionKPI}
          onAutoCalculateTierTargets={onAutoCalculateTierTargets}
          onUpdateFeasibility={onRunStrategicPairing}
        />
        {isAdmin && (
          <div className="flex justify-end mt-2 pr-2">
            <button
              onClick={onResetKPI}
              disabled={isSystemLocked}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                isSystemLocked
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-red-400 hover:text-red-600 hover:bg-red-50'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              Reset KPI Tiers
            </button>
          </div>
        )}
      </div>

      {(phases?.length > 0 && kpiTiers?.length > 0) && (
        <div className="space-y-8">
          <TierDistributionTable
            departments={departments}
            kpiTiers={kpiTiers}
            kpiTierTargets={kpiTierTargets}
            phases={phases}
            schedules={schedules}
            locations={locations}
            maxAssetsPerDay={maxAssetsPerDay}
            maxLocationsPerDay={maxLocationsPerDay}
          />
          
          {isAdmin && (
            <div className="flex justify-center">
              <button
                onClick={onRebalanceSchedule}
                className="group relative px-8 py-4 bg-slate-900 text-white rounded-[24px] text-sm font-black uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all overflow-hidden"
              >
                <div className="absolute inset-0 bg-linear-to-r from-blue-600/20 to-emerald-600/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative flex items-center gap-3">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  Rebalance Inspection Schedule
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      <GroupBuilderTab
        departments={departments}
        auditGroups={auditGroups}
        onAddAuditGroup={onAddAuditGroup}
        onDeleteAuditGroup={onDeleteAuditGroup}
        onBulkDeleteAuditGroups={onBulkDeleteAuditGroups}
        onBulkUpdateDepartments={onBulkUpdateDepartments}
        onAutoConsolidate={onAutoConsolidate}
        isProcessing={isProcessing}
        setIsProcessing={setIsProcessing}
        strictAuditorRule={strictAuditorRule}
        setStrictAuditorRule={setStrictAuditorRule}
        maxAssetsPerDay={currentMaxAssets}
        standaloneThresholdAssets={currentStandaloneThreshold}
        maxLocationsPerDay={currentMaxLocations}
        minAuditorsPerLocation={currentMinAuditors}
        isSystemLocked={isSystemLocked}
        pairingLocked={pairingLocked}
        onSuggestThresholds={handleAIAutoOptimize}
        isSuggestingAI={isSuggestingAI}
      />

      <CrossAuditManagement
        departments={departments}
        users={users}
        permissions={permissions}
        onTogglePermission={onTogglePermission}
        onAddPermission={onAddPermission}
        onRemovePermission={onRemovePermission}
        onUpdateDepartment={onUpdateDepartment}
        onBulkUpdateDepartments={onBulkUpdateDepartments}
        auditGroups={auditGroups}
        onAddAuditGroup={onAddAuditGroup}
        onUpdateAuditGroup={onUpdateAuditGroup}
        onDeleteAuditGroup={onDeleteAuditGroup}
        onBulkDeleteAuditGroups={onBulkDeleteAuditGroups}
        onAutoConsolidate={onAutoConsolidate}
        onRunStrategicPairing={onRunStrategicPairing}
        onBulkAddPermissions={onBulkAddPermissions}
        onBulkRemovePermissions={onBulkRemovePermissions}
        feasibilityReport={feasibilityReport}
        pairingLocked={pairingLocked}
        pairingLockInfo={pairingLockInfo}
        onLockPairing={onLockPairing}
        onUnlockPairing={onUnlockPairing}
        phases={phases}
        institutionKPIs={institutionKPIs}
        maxAssetsPerDay={currentMaxAssets}
        maxLocationsPerDay={currentMaxLocations}
        minAuditorsPerLocation={currentMinAuditors}
        dailyInspectionCapacity={currentDailyCapacity}
        isSimulatorActive={isSimulatorActive}
        setIsSimulatorActive={setIsSimulatorActive}
        draftConstraints={draftConstraints}
        setDraftConstraints={setDraftConstraints}
        onUpdateMaxAssetsPerDay={onUpdateMaxAssetsPerDay}
        onUpdateMaxLocationsPerDay={onUpdateMaxLocationsPerDay}
        onUpdateMinAuditorsPerLocation={onUpdateMinAuditorsPerLocation}
        onUpdateDailyInspectionCapacity={onUpdateDailyInspectionCapacity}
        showToast={showToast}
      />

      {isAdmin && <RBACMatrix showToast={showToast} />}

      {isAdmin && <BackupButton />}

      {isAdmin && (
        <div className={`rounded-[32px] p-8 border-2 transition-all duration-500 ${
          isSystemLocked 
          ? 'bg-slate-50 border-slate-200 opacity-80' 
          : 'bg-red-50 border-red-100'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className={`text-xl font-bold ${isSystemLocked ? 'text-slate-900' : 'text-red-900'}`}>Danger Zone</h3>
              <p className={`text-sm ${isSystemLocked ? 'text-slate-500' : 'text-red-700'}`}>Irreversible actions for system administration and data cleanup.</p>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${
              isSystemLocked ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {isSystemLocked ? (
                <>
                  <Lock className="w-3 h-3" />
                  System Locked
                </>
              ) : (
                <>
                  <Unlock className="w-3 h-3" />
                  Reset Allowed
                </>
              )}
            </div>
          </div>

          {isSystemLocked && (
            <div className="bg-white/60 border border-slate-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-slate-400 mt-0.5" />
              <p className="text-xs font-medium text-slate-600 leading-relaxed">
                Reset features are disabled because some audit schedules are already active (Supervisor has set a date and an Auditor has assigned themselves). Please unassign the audits if you truly need to reset.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {/* Reset Departments */}
            <div className={`rounded-2xl border p-4 transition-all ${
              isSystemLocked ? 'border-slate-100 bg-slate-50' : 'border-red-100 bg-white hover:border-red-200'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isSystemLocked ? 'bg-slate-100 text-slate-300' : 'bg-red-50 text-red-500'
                }`}>
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${isSystemLocked ? 'text-slate-400' : 'text-slate-900'}`}>Reset Departments</h4>
                  <p className={`text-[10px] ${isSystemLocked ? 'text-slate-300' : 'text-slate-400'}`}>Clears depts, locs, mappings, schedules & groups (Users kept)</p>
                </div>
              </div>
              <button
                onClick={onResetDepartments}
                disabled={isSystemLocked}
                className={`w-full mt-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  isSystemLocked
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    : 'bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Departments
              </button>
            </div>

            {/* Reset Users */}
            <div className={`rounded-2xl border p-4 transition-all ${
              isSystemLocked ? 'border-slate-100 bg-slate-50' : 'border-red-100 bg-white hover:border-red-200'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isSystemLocked ? 'bg-slate-100 text-slate-300' : 'bg-red-50 text-red-500'
                }`}>
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${isSystemLocked ? 'text-slate-400' : 'text-slate-900'}`}>Reset Users</h4>
                  <p className={`text-[10px] ${isSystemLocked ? 'text-slate-300' : 'text-slate-400'}`}>Removes all users except you</p>
                </div>
              </div>
              <button
                onClick={onResetUsers}
                disabled={isSystemLocked}
                className={`w-full mt-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  isSystemLocked
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    : 'bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Users
              </button>
            </div>

            {/* Reset Locations & Audits */}
            <div className={`rounded-2xl border p-4 transition-all ${
              isSystemLocked ? 'border-slate-100 bg-slate-50' : 'border-red-100 bg-white hover:border-red-200'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isSystemLocked ? 'bg-slate-100 text-slate-300' : 'bg-red-50 text-red-500'
                }`}>
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${isSystemLocked ? 'text-slate-400' : 'text-slate-900'}`}>Reset Locations & Audits</h4>
                  <p className={`text-[10px] ${isSystemLocked ? 'text-slate-300' : 'text-slate-400'}`}>Clears locs & groups (Depts stay with 0 assets)</p>
                </div>
              </div>
              <button
                onClick={onResetLocations}
                disabled={isSystemLocked}
                className={`w-full mt-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  isSystemLocked
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    : 'bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Locations
              </button>
            </div>

            {/* Reset Pairings */}
            <div className={`rounded-2xl border p-4 transition-all ${
              isSystemLocked ? 'border-slate-100 bg-slate-50' : 'border-amber-100 bg-white hover:border-amber-200 shadow-sm'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isSystemLocked ? 'bg-slate-100 text-slate-300' : 'bg-amber-50 text-amber-500'
                }`}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${isSystemLocked ? 'text-slate-400' : 'text-slate-900'}`}>Reset Pairings</h4>
                  <p className={`text-[10px] ${isSystemLocked ? 'text-slate-300' : 'text-slate-400'}`}>Purges assigned pairs from database (Hard Reset)</p>
                </div>
              </div>
              <button
                onClick={onResetPairingData}
                disabled={isSystemLocked || !onResetPairingData}
                className={`w-full mt-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  isSystemLocked
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    : 'bg-white border-2 border-amber-200 text-amber-600 hover:bg-amber-600 hover:text-white shadow-xl shadow-amber-100/20'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5 italic" />
                Clear All Assignments
              </button>
            </div>

            {/* Full System Reset */}
            <div className={`rounded-2xl border p-4 transition-all ${
              isSystemLocked ? 'border-slate-100 bg-slate-50' : 'border-red-200 bg-red-50/50 hover:border-red-300'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isSystemLocked ? 'bg-slate-100 text-slate-300' : 'bg-red-100 text-red-600'
                }`}>
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${isSystemLocked ? 'text-slate-400' : 'text-red-900'}`}>Full System Reset</h4>
                  <p className={`text-[10px] ${isSystemLocked ? 'text-slate-300' : 'text-red-400'}`}>Wipes everything &amp; restarts clean</p>
                </div>
              </div>
              <button
                onClick={onResetOperationalData}
                disabled={isSystemLocked}
                className={`w-full mt-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  isSystemLocked
                    ? 'bg-slate-200 text-slate-300 cursor-not-allowed shadow-none'
                    : 'bg-red-600 text-white shadow-lg shadow-red-500/20 hover:bg-red-700'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
