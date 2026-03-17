import React, { useMemo, useRef } from 'react';
import { CrossAuditPermission, Department, User, AuditPhase, KPITier, KPITierTarget, UserRole, Location, AuditSchedule, DepartmentMapping, AuditGroup } from '../types';
import { CrossAuditManagement } from './CrossAuditManagement';
import { AuditConstraints } from './AuditConstraints';
import { AuditPhasesSettings } from './AuditPhasesSettings';
import { KPISettings } from './KPISettings';
import { TierDistributionTable } from './TierDistributionTable';
import { DataManagementWorkflow } from './DataManagementWorkflow';
import { Zap, Sliders, Lock, Unlock, AlertCircle } from 'lucide-react';
import { PageHeader } from './PageHeader';

interface SystemSettingsProps {
  departments: Department[];
  users: User[];
  permissions: CrossAuditPermission[];
  phases: AuditPhase[];
  kpiTiers: KPITier[];
  kpiTierTargets: KPITierTarget[];
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
  onResetLocations: () => void;
  onResetOperationalData: () => void;
  isSystemLocked: boolean;
  onBulkAddLocs: (locs: Omit<Location, 'id'>[]) => void;
  onBulkAddDepts: (depts: Omit<Department, 'id'>[]) => void;
  onBulkActivateStaff: (entries: { name: string; email: string; department?: string; designation?: string; role?: string }[]) => void;
  maxAssetsPerDay: number;
  onUpdateMaxAssetsPerDay: (val: number) => void;
  onRebalanceSchedule: () => Promise<void>;
  schedules: AuditSchedule[];
  departmentMappings: DepartmentMapping[];
  onAddDepartmentMapping: (mapping: Omit<DepartmentMapping, 'id'>) => Promise<void>;
  onDeleteDepartmentMapping: (id: string) => Promise<void>;
  onSyncLocationMappings: () => Promise<void>;
  onUpsertLocations: (locs: Omit<Location, 'id'>[]) => Promise<void>;
  auditGroups: AuditGroup[];
  onAddAuditGroup: (group: Omit<AuditGroup, 'id'>) => Promise<void>;
  onUpdateAuditGroup: (id: string, updates: Partial<AuditGroup>) => Promise<void>;
  onDeleteAuditGroup: (id: string) => Promise<void>;
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
  onAddKPITier,
  onUpdateKPITier,
  onDeleteKPITier,
  onUpdateKPITierTarget,
  onResetLocations,
  onResetOperationalData,
  isSystemLocked,
  onBulkAddLocs,
  onBulkAddDepts,
  onBulkActivateStaff,
  maxAssetsPerDay,
  onUpdateMaxAssetsPerDay,
  onRebalanceSchedule,
  schedules,
  departmentMappings,
  onAddDepartmentMapping,
  onDeleteDepartmentMapping,
  onSyncLocationMappings,
  onUpsertLocations,
  auditGroups,
  onAddAuditGroup,
  onUpdateAuditGroup,
  onDeleteAuditGroup,
  kpiTierTargets
}) => {
  const isAdmin = userRoles.includes('Admin');

  const activePhase = useMemo(() => {
    const today = new Date();
    return phases.find(p => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return today >= start && today <= end;
    });
  }, [phases]);

  const handlePermissionChange = (auditorDept: string, targetDept: string, desiredStatus: boolean) => {
    const existingPerm = permissions.find(p => p.auditorDept === auditorDept && p.targetDept === targetDept);
    if (existingPerm) {
      if (existingPerm.isActive !== desiredStatus) {
        onTogglePermission(existingPerm.id, desiredStatus);
      }
    } else {
      if (desiredStatus) {
        onAddPermission(auditorDept, targetDept, false);
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
      <PageHeader
        title="System Configuration"
        icon={Sliders}
        activePhase={activePhase}
        description="Customize institutional audit rules and scheduling windows."
      />

      <AuditPhasesSettings
        phases={phases}
        isAdmin={isAdmin}
        onAdd={onAddPhase}
        onUpdate={onUpdatePhase}
        onDelete={onDeletePhase}
      />

      <KPISettings
        tiers={kpiTiers}
        phases={phases}
        tierTargets={kpiTierTargets}
        onAddTier={onAddKPITier}
        onUpdateTier={onUpdateKPITier}
        onDeleteTier={onDeleteKPITier}
        onUpdateTarget={onUpdateKPITierTarget}
      />

      {isAdmin && (
        <DataManagementWorkflow
          departments={departments}
          departmentMappings={departmentMappings}
          onBulkAddDepts={onBulkAddDepts}
          onBulkActivateStaff={onBulkActivateStaff}
          onAddDepartmentMapping={onAddDepartmentMapping}
          onDeleteDepartmentMapping={onDeleteDepartmentMapping}
          onSyncLocationMappings={onSyncLocationMappings}
          onUpsertLocations={onUpsertLocations}
        />
      )}

      {(phases?.length > 0 && kpiTiers?.length > 0) && (
        <div className="space-y-8">
          <TierDistributionTable
            departments={departments}
            kpiTiers={kpiTiers}
            phases={phases}
            schedules={schedules}
            maxAssetsPerDay={maxAssetsPerDay}
          />
          
          {isAdmin && (
            <div className="flex justify-center">
              <button
                onClick={onRebalanceSchedule}
                className="group relative px-8 py-4 bg-slate-900 text-white rounded-[24px] text-sm font-black uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-emerald-600/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative flex items-center gap-3">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  Rebalance Audit Schedule
                </div>
              </button>
            </div>
          )}

          <AuditConstraints
            maxAssetsPerDay={maxAssetsPerDay}
            onUpdateMaxAssetsPerDay={onUpdateMaxAssetsPerDay}
          />
        </div>
      )}

      <CrossAuditManagement
        departments={departments}
        users={users}
        permissions={permissions}
        onTogglePermission={handlePermissionChange}
        onRemovePermission={onRemovePermission}
        onUpdateDepartment={onUpdateDepartment}
        onBulkUpdateDepartments={onBulkUpdateDepartments}
        auditGroups={auditGroups}
        onAddAuditGroup={onAddAuditGroup}
        onUpdateAuditGroup={onUpdateAuditGroup}
        onDeleteAuditGroup={onDeleteAuditGroup}
      />

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

          <div className="flex flex-wrap gap-4 mt-6">
            <button
              onClick={onResetLocations}
              disabled={isSystemLocked}
              className={`px-6 py-3 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2 ${
                isSystemLocked
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed grayscale'
                : 'bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white'
              }`}
            >
              Reset Locations & Audits
            </button>
            <button
              onClick={onResetOperationalData}
              disabled={isSystemLocked}
              className={`px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2 ${
                isSystemLocked
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed grayscale shadow-none'
                : 'bg-red-600 text-white shadow-red-500/20 hover:bg-red-700'
              }`}
            >
              Reset Operational Data (Depts, Locs, Members)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
