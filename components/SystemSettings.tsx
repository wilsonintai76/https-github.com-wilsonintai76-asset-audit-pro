import React, { useMemo, useRef } from 'react';
import { CrossAuditPermission, Department, User, AuditPhase, KPITier, KPITierTarget, InstitutionKPITarget, UserRole, Location, AuditSchedule, DepartmentMapping, AuditGroup } from '../types';
import { useRBAC } from '../contexts/RBACContext';
import { CrossAuditManagement } from './CrossAuditManagement';
import { AuditPhasesSettings } from './AuditPhasesSettings';
import { KPISettings } from './KPISettings';
import { TierDistributionTable } from './TierDistributionTable';
import { DataManagementWorkflow } from './DataManagementWorkflow';
import { Zap, Sliders, Lock, Unlock, AlertCircle, Check, Eye, Calendar, UserCheck, Users, UserPlus, Edit, ShieldAlert, ShieldCheck, Network, X } from 'lucide-react';
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


  const PERMISSIONS_LIST = [
    { id: 'view:overview', label: 'Institutional Overview', category: 'General', actions: [{ id: 'view:overview', label: 'Overview Content', icon: Eye }] },
    { 
      id: 'inspection:schedule', 
      label: 'Inspection Schedule', 
      category: 'Inspection', 
      actions: [
        { id: 'view:schedule:all', label: 'View All Depts', icon: Eye }, 
        { id: 'view:schedule:own', label: 'View Own Dept', icon: Eye },
        { id: 'view:schedule:matrix', label: 'View Audit Matrix', icon: Eye, hint: 'Cross-Audit only' },
        { id: 'edit:audit:date', label: '📅 Set Date', icon: Calendar, hint: 'Scheduling' },
        { id: 'edit:audit:assign', label: '👤 Self-Assign', icon: UserCheck, hint: 'Inspecting' },
        { id: 'edit:audit:assign:others', label: '👥 Assign Others', icon: Users, hint: 'Management' },
        { id: 'edit:audit:auto_assign', label: '🤖 Auto-Assign', icon: Zap, hint: 'System' }
      ] 
    },
    { id: 'view:audit:assigned', label: 'Officer Hub', category: 'Inspection', actions: [{ id: 'view:audit:assigned', label: 'Access Officer Hub', icon: Eye, hint: 'Requires Cert' }] },
    { 
      id: 'view:users:group', 
      label: 'User Management', 
      category: 'Users', 
      actions: [
        { id: 'view:team:all', label: 'View All Members', icon: Eye },
        { id: 'view:team:own', label: 'View Dept Members', icon: Users },
        { id: 'edit:team', label: 'Add/Edit Team', icon: UserPlus }
      ] 
    },
    { id: 'manage:departments', label: 'Department Registry', category: 'Data', actions: [{ id: 'manage:departments', label: 'Manage Entries', icon: Edit }] },
    { id: 'manage:locations', label: 'Location Registry', category: 'Data', actions: [{ id: 'manage:locations', label: 'Manage Entries', icon: Edit }] },
    { id: 'view:admin:dashboard', label: 'Admin Hub', category: 'System', actions: [{ id: 'view:admin:dashboard', label: 'Access Admin Hub', icon: ShieldAlert }] },
    { id: 'manage:system', label: 'System Settings', category: 'System', actions: [{ id: 'manage:system', label: 'Admin Access', icon: Lock }] },
  ];

  const toggleMatrixPerm = async (permId: string, role: UserRole) => {
    // Safety: Don't allow removing 'manage:system' or 'view:admin:dashboard' from Admin
    if (role === 'Admin' && (permId === 'manage:system' || permId === 'view:admin:dashboard')) {
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

  const ROLES_MATRIX: { id: UserRole; label: string; icon: any; color: string }[] = [
    { id: 'Admin', label: 'Admin', icon: ShieldCheck, color: 'text-rose-600' },
    { id: 'Coordinator', label: 'Coordinator', icon: Network, color: 'text-indigo-600' },
    { id: 'Supervisor', label: 'Supervisor', icon: Eye, color: 'text-amber-600' },
    { id: 'Auditor', label: 'Officer', icon: UserCheck, color: 'text-emerald-600' },
    { id: 'Staff', label: 'Staff', icon: Users, color: 'text-slate-500' }
  ];

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
        <div className="bg-white rounded-[40px] p-8 md:p-12 border border-slate-200 shadow-xl animate-in fade-in slide-in-from-bottom-5 overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-indigo-600 rounded-[20px] flex items-center justify-center text-white shadow-2xl shadow-indigo-500/40">
                        <Lock className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Institutional RBAC Matrix</h3>
                        <p className="text-sm text-slate-500 font-medium">Full horizontal visibility and granular control across all roles.</p>
                    </div>
                </div>
            </div>

            <div className="relative overflow-x-auto border border-slate-100 rounded-[32px] bg-slate-50/30">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="py-6 px-8 text-[10px] font-black uppercase text-slate-400 tracking-widest w-1/3">Permissions & Actions</th>
                            {ROLES_MATRIX.map(role => (
                                <th key={role.id} className="py-6 px-4 text-center">
                                    <div className="flex flex-col items-center gap-2 group cursor-help transition-all hover:scale-110">
                                        <div className={`p-2 rounded-xl bg-white shadow-sm border border-slate-100 ${role.color}`}>
                                          <role.icon className="w-5 h-5" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{role.label}</span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {PERMISSIONS_LIST.map((feature, fIdx) => (
                            <React.Fragment key={feature.id}>
                                <tr className="bg-slate-50/50">
                                    <td colSpan={6} className="py-3 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 bg-indigo-50/30 border-y border-slate-100/50">
                                        {feature.label}
                                    </td>
                                </tr>
                                {feature.actions.map(action => (
                                    <tr key={action.id} className="hover:bg-white transition-colors group">
                                        <td className="py-5 px-8">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                                                    <action.icon className="w-4 h-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-800">{action.label}</span>
                                                    {action.hint && <span className="text-[9px] text-slate-400 font-medium">{action.hint}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        {ROLES_MATRIX.map(role => {
                                            const isChecked = action.id === 'edit:audit:assign' && role.id === 'Auditor' ? true : rbacMatrix[action.id]?.includes(role.id);
                                            const isSystemLocked = (role.id === 'Admin' && (action.id === 'manage:system' || action.id === 'view:admin:dashboard')) || (role.id === 'Auditor' && action.id === 'edit:audit:assign');
                                            const isForbidden = action.id === 'edit:audit:assign' && role.id !== 'Auditor';

                                            if (isForbidden) {
                                                return (
                                                    <td key={role.id} className="py-5 px-4 text-center">
                                                        <div className="flex justify-center">
                                                            <div className="w-5 h-5 rounded-full border border-slate-100 bg-slate-50 flex items-center justify-center opacity-20">
                                                                <X className="w-3 h-3 text-slate-300" />
                                                            </div>
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            return (
                                                <td key={role.id} className="py-5 px-4 text-center">
                                                    <div className="flex justify-center">
                                                        <button
                                                            disabled={isSystemLocked}
                                                            onClick={() => toggleMatrixPerm(action.id, role.id)}
                                                            className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                                                                isChecked ? 'bg-indigo-600' : 'bg-slate-200'
                                                            } ${isSystemLocked ? 'opacity-40 cursor-not-allowed' : 'hover:ring-4 hover:ring-indigo-50'}`}
                                                        >
                                                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${
                                                                isChecked ? 'translate-x-6' : 'translate-x-0'
                                                            }`} />
                                                        </button>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-indigo-50/50 rounded-2xl flex items-start gap-4 border border-indigo-100/50">
                    <ShieldCheck className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                      <span className="font-black text-indigo-700 uppercase tracking-widest mr-2 underline">Note:</span> 
                      Administrators have permanent access to core critical functions. Inspecting officer self-assignment is strictly limited to users with active institutional certificates.
                    </p>
                </div>
                <div className="p-6 bg-slate-50/50 rounded-2xl flex items-start gap-4 border border-slate-100">
                    <AlertCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                      Settings here are applied in real-time. Changes affect navigation visibility and action availability for all users within the specific role globally.
                    </p>
                </div>
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
