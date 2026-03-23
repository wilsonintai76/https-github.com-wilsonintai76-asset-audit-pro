import React, { useMemo, useRef } from 'react';
import { CrossAuditPermission, Department, User, AuditPhase, KPITier, KPITierTarget, InstitutionKPITarget, UserRole, Location, AuditSchedule, DepartmentMapping, AuditGroup } from '../types';
import { useRBAC } from '../contexts/RBACContext';
import { CrossAuditManagement } from './CrossAuditManagement';
import { AuditPhasesSettings } from './AuditPhasesSettings';
import { KPISettings } from './KPISettings';
import { TierDistributionTable } from './TierDistributionTable';
import { DataManagementWorkflow } from './DataManagementWorkflow';
import { Zap, Sliders, Lock, Unlock, AlertCircle, Check, Eye, Calendar, UserCheck, Users, UserPlus, Edit } from 'lucide-react';
import { PageHeader } from './PageHeader';

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
  onResetLocations: () => void;
  onResetOperationalData: () => void;
  isSystemLocked: boolean;
  onBulkAddLocs: (locs: Omit<Location, 'id'>[]) => void;
  onBulkAddDepts: (depts: Omit<Department, 'id'>[]) => void;
  onBulkActivateStaff: (entries: { name: string; email: string; department?: string; designation?: string; role?: string }[]) => void;
  maxAssetsPerDay: number;
  onUpdateMaxAssetsPerDay: (val: number) => void;
  maxLocationsPerDay: number;
  onUpdateMaxLocationsPerDay: (val: number) => void;
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
  onAutoConsolidate: (threshold: number, excludedIds: string[]) => Promise<void>;
  onBulkAddPermissions: (auditorDept: string, targetDept: string, isMutual: boolean) => Promise<void>;
  onBulkRemovePermissions: (ids: string[]) => Promise<void>;
  showToast?: (message: string, type?: any) => void;
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
  maxLocationsPerDay,
  onUpdateMaxLocationsPerDay,
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
  onAutoConsolidate,
  onBulkAddPermissions,
  onBulkRemovePermissions,
  kpiTierTargets,
  institutionKPIs,
  onUpdateInstitutionKPI,
  showToast
}) => {
  const { rbacMatrix, updateRBAC } = useRBAC();
  const isAdmin = (userRoles || []).includes('Admin');

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

  const [activeRole, setActiveRole] = React.useState<UserRole>('Admin');

  const PERMISSIONS_LIST = [
    { id: 'view:overview', label: 'Institutional Overview', category: 'General', actions: [{ id: 'view:overview', label: 'Overview Content', icon: Eye }] },
    { id: 'view:schedule', label: 'Inspection Schedule Access', category: 'Inspection', actions: [{ id: 'view:schedule:all', label: 'View All Depts', icon: Eye }, { id: 'view:schedule:own', label: 'View Own Dept', icon: Eye }] },
    { 
      id: 'edit:schedule', 
      label: 'Inspection Planning & Self-Assign', 
      category: 'Inspection', 
      actions: [
        { id: 'edit:audit:date', label: '📅 Set Date', icon: Calendar, hint: 'Scheduling' },
        { id: 'edit:audit:assign', label: '👤 Self-Assign', icon: UserCheck, hint: 'Inspecting' }
      ] 
    },
    { id: 'view:audit:assigned', label: 'Inspecting Officer Dashboard', category: 'Inspection', actions: [{ id: 'view:audit:assigned', label: 'Access Dashboard', icon: Eye, hint: 'Requires Cert' }] },
    { 
      id: 'view:team:group', 
      label: 'Team Management', 
      category: 'Team', 
      actions: [
        { id: 'view:team:all', label: 'View All', icon: Eye },
        { id: 'view:team:own', label: 'View Own', icon: Users },
        { id: 'edit:team', label: 'Add/Edit', icon: UserPlus }
      ] 
    },
    { id: 'manage:departments', label: 'Department Registry', category: 'Data', actions: [{ id: 'manage:departments', label: 'Manage Entries', icon: Edit }] },
    { id: 'manage:locations', label: 'Location Registry', category: 'Data', actions: [{ id: 'manage:locations', label: 'Manage Entries', icon: Edit }] },
    { id: 'manage:system', label: 'System Settings', category: 'System', actions: [{ id: 'manage:system', label: 'Admin Access', icon: Lock }] },
  ];

  const toggleMatrixPerm = async (permId: string, role: UserRole) => {
    // Safety: Don't allow removing 'manage:system' from Admin
    if (role === 'Admin' && permId === 'manage:system' && rbacMatrix[permId]?.includes('Admin')) {
        return;
    }

    const currentRoles = rbacMatrix[permId] || [];
    let newRoles: UserRole[] = [];
    
    if (currentRoles.includes(role)) {
      // Prevent removing 'edit:audit:assign' from Auditor
      if (role === 'Auditor' && permId === 'edit:audit:assign') {
        return;
      }
      
      // Validation for Inspection Schedule view toggling
      if (permId === 'view:schedule:all' || permId === 'view:schedule:own') {
        const otherId = permId === 'view:schedule:all' ? 'view:schedule:own' : 'view:schedule:all';
        const otherRoles = rbacMatrix[otherId] || [];
        if (!otherRoles.includes(role)) {
            // Both views would be disabled, which is not allowed
            if (showToast) showToast("At least one schedule view must be active for this role.", "warning");
            return;
        }
      }

      newRoles = currentRoles.filter(r => r !== role);
    } else {
      // Prevent adding 'edit:audit:assign' to any role except Auditor
      if (role !== 'Auditor' && permId === 'edit:audit:assign') {
        return;
      }
      newRoles = [...currentRoles, role];
    }

    updateRBAC({
      ...rbacMatrix,
      [permId]: newRoles
    });
  };

  const ALL_ROLES: UserRole[] = ['Admin', 'Coordinator', 'Supervisor', 'Auditor', 'Staff'];

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
          onBulkAddDepts={onBulkAddDepts}
          onBulkActivateStaff={onBulkActivateStaff}
          onAddDepartmentMapping={onAddDepartmentMapping}
          onDeleteDepartmentMapping={onDeleteDepartmentMapping}
          onSyncLocationMappings={onSyncLocationMappings}
          onUpsertLocations={onUpsertLocations}
        />
      )}

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
        institutionKPIs={institutionKPIs}
        departments={departments}
        onAddTier={onAddKPITier}
        onUpdateTier={onUpdateKPITier}
        onDeleteTier={onDeleteKPITier}
        onUpdateTarget={onUpdateKPITierTarget}
        onUpdateInstitutionKPI={onUpdateInstitutionKPI}
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
        onAutoConsolidate={onAutoConsolidate}
        onBulkAddPermissions={onBulkAddPermissions}
        onBulkRemovePermissions={onBulkRemovePermissions}
        phases={phases}
        institutionKPIs={institutionKPIs}
        maxAssetsPerDay={maxAssetsPerDay}
        maxLocationsPerDay={maxLocationsPerDay}
        onUpdateMaxAssetsPerDay={onUpdateMaxAssetsPerDay}
        onUpdateMaxLocationsPerDay={onUpdateMaxLocationsPerDay}
        showToast={showToast}
      />

      {isAdmin && rbacMatrix && (
        <div className="bg-white rounded-[40px] p-8 md:p-12 border border-slate-200 shadow-xl animate-in fade-in slide-in-from-bottom-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-indigo-600 rounded-[20px] flex items-center justify-center text-white shadow-2xl shadow-indigo-500/40">
                        <Lock className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Robust RBAC Matrix</h3>
                        <p className="text-sm text-slate-500 font-medium">Tab-based granular access control for institutional security.</p>
                    </div>
                </div>
            </div>

            {/* Role Tabs */}
            <div className="flex flex-wrap gap-2 mb-10 p-1.5 bg-slate-100/80 rounded-2xl w-fit">
              {ALL_ROLES.map(role => (
                <button
                  key={role}
                  onClick={() => setActiveRole(role)}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    activeRole === role 
                    ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                  }`}
                >
                  {role === 'Staff' ? 'Staff (Guest)' : role === 'Auditor' ? 'Accredited Inspecting Officer' : role}
                </button>
              ))}
            </div>

            <div className="overflow-hidden border border-slate-100 rounded-[32px] bg-slate-50/30">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="py-6 px-8 text-[10px] font-black uppercase text-slate-400 tracking-widest w-1/3">Feature / View</th>
                            <th className="py-6 px-8 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Robust Access Control / Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {PERMISSIONS_LIST.map(feature => (
                            <tr key={feature.id} className="hover:bg-white transition-colors group">
                                <td className="py-6 px-8">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-bold text-slate-800">{feature.label}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">{feature.category}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-6 px-8">
                                    <div className="flex flex-wrap items-center justify-center gap-4">
                                        {feature.actions.map(action => {
                                          const isChecked = action.id === 'edit:audit:assign' && activeRole === 'Auditor' ? true : rbacMatrix[action.id]?.includes(activeRole);
                                          const isSystemLocked = (activeRole === 'Admin' && action.id === 'manage:system') || (activeRole === 'Auditor' && action.id === 'edit:audit:assign');
                                          const isPermissionDisabled = action.id === 'edit:audit:assign' && activeRole !== 'Auditor';
                                          const Icon = action.icon;
                                          
                                          if (isPermissionDisabled) return null;

                                          return (
                                            <button
                                              key={action.id}
                                              disabled={isSystemLocked}
                                              onClick={() => toggleMatrixPerm(action.id, activeRole)}
                                              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                                                isChecked
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20 active:scale-95'
                                                : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 active:scale-95'
                                              } ${isSystemLocked ? 'opacity-50 cursor-not-allowed border-indigo-100 bg-indigo-50 text-indigo-300 shadow-none' : ''}`}
                                            >
                                              <Icon className="w-4 h-4" />
                                              {action.label}
                                              {action.hint && <span className={`text-[8px] opacity-60 font-medium normal-case ${isChecked ? 'text-indigo-100' : 'text-slate-400'}`}>({action.hint})</span>}
                                            </button>
                                          );
                                        })}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-8 p-5 bg-indigo-50/50 rounded-2xl flex items-start gap-4 border border-indigo-100/50">
                <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                  <span className="font-black text-indigo-700 uppercase tracking-widest mr-2 underline">Institutional Note:</span> 
                  Permissions applied to <span className="font-bold text-slate-900">{activeRole === 'Staff' ? 'Staff (Guest)' : activeRole === 'Auditor' ? 'Accredited Inspecting Officer' : activeRole}</span> are strictly enforced. Inspecting officer self-assignment REQUIRES an active institutional certificate, even if the permission is enabled here. Other roles like Supervisors or Coordinators can manage dates and assignments without certified status for administrative oversight.
                </p>
            </div>
        </div>
      )}

      {(phases?.length > 0 && kpiTiers?.length > 0) && (
        <div className="space-y-8">
          <TierDistributionTable
            departments={departments}
            kpiTiers={kpiTiers}
            phases={phases}
            schedules={schedules}
            maxAssetsPerDay={maxAssetsPerDay}
            maxLocationsPerDay={maxLocationsPerDay}
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
                  Rebalance Inspection Schedule
                </div>
              </button>
            </div>
          )}
        </div>
      )}

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
