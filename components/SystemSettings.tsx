
import React, { useMemo, useRef } from 'react';
import Papa from 'papaparse';
import { CrossAuditPermission, Department, User, AuditPhase, KPITier, UserRole, Location, AuditSchedule, DepartmentMapping } from '../types';
import { CrossAuditManagement } from './CrossAuditManagement';
import { AuditConstraints } from './AuditConstraints';
import { AuditPhasesSettings } from './AuditPhasesSettings';
import { KPISettings } from './KPISettings';
import { TierDistributionTable } from './TierDistributionTable';
import { Zap, Sliders, ArrowRight, FileSpreadsheet, UserCheck, Lock, Unlock, AlertCircle } from 'lucide-react';

interface SystemSettingsProps {
  departments: Department[];
  users: User[];
  permissions: CrossAuditPermission[];
  phases: AuditPhase[];
  kpiTiers: KPITier[];
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
  onResetLocations: () => void;
  onResetOperationalData: () => void;
  isSystemLocked: boolean;
  onBulkAddLocs: (locs: Omit<Location, 'id'>[]) => void;
  onBulkActivateStaff: (entries: { name: string; staffId: string; email: string; pin?: string }[]) => void;
  maxAssetsPerDay: number;
  onUpdateMaxAssetsPerDay: (val: number) => void;
  onRebalanceSchedule: () => Promise<void>;
  schedules: AuditSchedule[];
  departmentMappings: DepartmentMapping[];
  onAddDepartmentMapping: (mapping: Omit<DepartmentMapping, 'id'>) => Promise<void>;
  onDeleteDepartmentMapping: (id: string) => Promise<void>;
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
  onResetLocations,
  onResetOperationalData,
  isSystemLocked,
  onBulkAddLocs,
  onBulkActivateStaff,
  maxAssetsPerDay,
  onUpdateMaxAssetsPerDay,
  onRebalanceSchedule,
  schedules,
  departmentMappings,
  onAddDepartmentMapping,
  onDeleteDepartmentMapping
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const staffFileInputRef = useRef<HTMLInputElement>(null);
  
  // Mapping Form State
  const [newMappingSource, setNewMappingSource] = React.useState('');
  const [newMappingTargetId, setNewMappingTargetId] = React.useState('');

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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const newLocs: Omit<Location, 'id'>[] = [];
        let skippedCount = 0;

        // Check if this is a raw asset list (contains 'Lokasi Terkini' and 'Label')
        const firstRow = results.data[0] as any;
        const isRawAssetList = firstRow && (
          'Lokasi Terkini' in firstRow || 'lokasi terkini' in firstRow ||
          'LOKASI TERKINI' in firstRow || 'Location' in firstRow || 'location' in firstRow
        );

        if (isRawAssetList) {
          // Aggregation Mode
          const locMap: Record<string, { departmentId: string, supervisorId: string, totalAssets: number }> = {};

          results.data.forEach((row: any) => {
            const locName = row['Lokasi Terkini'] || row['lokasi terkini'] || row['LOKASI TERKINI'] || row['Location'] || row['location'];
            const deptName = row['Bahagian'] || row['bahagian'] || row['BAHAGIAN'] || row['Department'] || row['department'];
            const supervisor = row['Pegawai Penempatan'] || row['pegawai penempatan'] || row['PEGAWAI PENEMPATAN'] || row['Supervisor'] || row['supervisor'];
            const label = row['Label'] || row['label'] || row['LABEL'] || row['Asset'] || row['asset'];

            if (locName && deptName) {
              const key = `${locName}|${deptName}`;
              if (!locMap[key]) {
                locMap[key] = { departmentId: deptName, supervisorId: supervisor || '', totalAssets: 0 };
              }
              if (supervisor) {
                locMap[key].supervisorId = supervisor;
              }
              if (label) {
                locMap[key].totalAssets += 1;
              }
            }
          });

          Object.entries(locMap).forEach(([key, data]) => {
            const [name, dept] = key.split('|');
            
            // Check mapping
            const cleanDeptName = dept.trim().toUpperCase();
            const mapping = departmentMappings.find(m => m.sourceName.toUpperCase() === cleanDeptName);
            const finalDeptId = mapping ? mapping.targetDepartmentId : dept;

            // Only add if department matches (or admin)
            if (isAdmin) {
              newLocs.push({
                name: name,
                abbr: name.substring(0, 3).toUpperCase(),
                departmentId: finalDeptId,
                building: '', // Not in raw data
                level: '',    // Not in raw data
                supervisorId: data.supervisorId,
                contact: '',  // Not in raw data
                description: 'Imported from Asset List',
                totalAssets: data.totalAssets
              });
            }
          });

        } else {
          // Standard Import Mode
          results.data.forEach((row: any) => {
            // Map CSV columns to Location fields
            // Expected columns: Name, Abbr, Department, Building, Level, Supervisor, Contact, Description
            const name = row['Name'] || row['name'] || row['Location'];
            const abbr = row['Abbr'] || row['abbr'] || row['Code'] || name?.substring(0, 3).toUpperCase();
            const department = row['Department'] || row['department'] || row['Dept'] || '';
            const building = row['Building'] || row['building'] || row['Block'] || '';
            const level = row['Level'] || row['level'] || row['Floor'] || '';
            const pic = row['Supervisor'] || row['supervisor'] || row['PIC'] || row['InCharge'] || '';
            const contact = row['Contact'] || row['contact'] || row['Phone'] || '';
            const description = row['Description'] || row['description'] || '';
            const totalAssets = parseInt(row['Total Assets'] || row['total assets'] || row['TotalAssets'] || '0', 10) || 0;

            if (name && department && isAdmin) {
              // Check mapping
              const cleanDeptName = department.trim().toUpperCase();
              const mapping = departmentMappings.find(m => m.sourceName.toUpperCase() === cleanDeptName);
              const finalDeptId = mapping ? mapping.targetDepartmentId : department;

              newLocs.push({
                name,
                abbr,
                departmentId: finalDeptId,
                building,
                level,
                supervisorId: pic,
                contact,
                description,
                totalAssets
              });
            } else {
              skippedCount++;
            }
          });
        }

        if (newLocs?.length > 0) {
          onBulkAddLocs(newLocs);
          alert(`Successfully imported ${newLocs.length} locations${isRawAssetList ? ' (aggregated from raw asset list)' : ''}.`);
        } else {
          alert("No valid locations found in CSV. Ensure 'Name' and 'Department' columns exist.");
        }
      },
      error: (error: any) => { console.error(error); alert('Failed to parse CSV.'); }
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    const headers = ['Name', 'Abbr', 'Department', 'Building', 'Level', 'Supervisor Name', 'Contact', 'Description', 'Total Assets'];
    const sample = ['Main Chemistry Lab', 'MCL-01', 'Biological Sciences', 'Science Block A', 'FIRST FLOOR', 'Dr. Supervisor Name', 'x1234', 'Main lab for chemistry', '150'];
    const csvContent = [headers.join(','), sample.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'location_import_template.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleStaffFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const entries: { name: string; staffId: string; email: string; pin?: string }[] = [];
        results.data.forEach((row: any) => {
          const name = (row['Name'] || row['name'] || '').trim();
          const staffId = (row['StaffID'] || row['Staff ID'] || row['staff_id'] || '').trim();
          const email = (row['Email'] || row['email'] || '').trim();
          const pin = (row['PIN'] || row['pin'] || '').trim();
          if (name && staffId) entries.push({ name, staffId, email, pin: pin || undefined });
        });
        if (entries.length > 0) {
          onBulkActivateStaff(entries);
        } else {
          alert("No valid entries found. Ensure 'Name' and 'StaffID' columns exist.");
        }
      },
      error: () => alert('Failed to parse CSV.')
    });
    if (staffFileInputRef.current) staffFileInputRef.current.value = '';
  };

  const handleDownloadStaffTemplate = () => {
    const headers = ['Name', 'StaffID', 'Email', 'PIN'];
    const sample = ['SHAHRIZAL BIN SHABUDDIN', '1001', 'shahrizal@example.com', '1234'];
    const csvContent = [headers.join(','), sample.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'staff_activation_template.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
      {/* GLOBAL ACTIVE PHASE HEADER */}
      <div className={`p-8 rounded-[40px] border-2 transition-all duration-500 overflow-hidden relative ${activePhase
          ? 'bg-slate-900 border-emerald-500/50 text-white'
          : 'bg-white border-slate-200 text-slate-900'
        }`}>
        {activePhase && (
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
        )}

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center text-2xl shadow-inner ${activePhase
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}>
              {activePhase ? <Zap className="w-8 h-8" /> : <Sliders className="w-8 h-8" />}
            </div>
            <div>
              <h2 className={`text-2xl font-black tracking-tight leading-none ${activePhase ? 'text-white' : 'text-slate-900'}`}>
                System Configuration
              </h2>
              <div className="flex items-center gap-2 mt-2">
                {activePhase ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest">
                      Active Phase: {activePhase.name}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-500 text-sm font-medium">
                    Customize institutional audit rules and scheduling windows.
                  </p>
                )}
              </div>
            </div>
          </div>

          {activePhase && (
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter mb-1">Window Progress</span>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs font-bold font-mono text-emerald-400">{activePhase.startDate} <ArrowRight className="inline-block w-3 h-3 mx-1 opacity-40" /> {activePhase.endDate}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

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
        onAddTier={onAddKPITier}
        onUpdateTier={onUpdateKPITier}
        onDeleteTier={onDeleteKPITier}
      />

      {phases?.length > 0 && kpiTiers?.length > 0 && (
        <TierDistributionTable
          departments={departments}
          kpiTiers={kpiTiers}
          phases={phases}
          schedules={schedules}
        />
      )}

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

      <CrossAuditManagement
        departments={departments}
        users={users}
        permissions={permissions}
        onTogglePermission={handlePermissionChange}
        onAddPermission={onAddPermission}
        onRemovePermission={onRemovePermission}
        onUpdateDepartment={onUpdateDepartment}
        onBulkUpdateDepartments={onBulkUpdateDepartments}
      />

      <AuditConstraints
        maxAssetsPerDay={maxAssetsPerDay}
        onUpdateMaxAssetsPerDay={onUpdateMaxAssetsPerDay}
      />

      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-2">Data Management</h3>
          <p className="text-sm text-slate-500 mb-6">Import locations and departments from CSV files.</p>

          <div className="flex flex-wrap gap-4">
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
            <input type="file" ref={staffFileInputRef} className="hidden" accept=".csv" onChange={handleStaffFileUpload} />
            <button
              onClick={handleDownloadTemplate}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all"
            >
              Location Template
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Import Locations CSV
            </button>
            <button
              onClick={handleDownloadStaffTemplate}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all"
            >
              Staff Activation Template
            </button>
            <button
              onClick={() => staffFileInputRef.current?.click()}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
            >
              <UserCheck className="w-4 h-4" />
              Activate Staff CSV
            </button>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm mt-8">
          <div className="flex items-center gap-3 mb-2">
            <Sliders className="w-5 h-5 text-indigo-500" />
            <h3 className="text-xl font-bold text-slate-900">Department Mapping Rules</h3>
          </div>
          <p className="text-sm text-slate-500 mb-6">Create rules to map raw department names from uploaded asset lists to official system departments. This is useful for consolidated units (e.g., mapping various units to "Unit Khidmat Pengurusan").</p>

          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <input
              type="text"
              placeholder="Source Name in CSV (e.g., UNIT PENTADBIRAN)"
              className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium w-full md:w-1/3 outline-none focus:ring-2 focus:ring-blue-500/20"
              value={newMappingSource}
              onChange={e => setNewMappingSource(e.target.value)}
            />
            <div className="flex items-center text-slate-400 justify-center">
              <ArrowRight className="w-5 h-5" />
            </div>
            <select
              className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium w-full md:w-1/3 outline-none focus:ring-2 focus:ring-blue-500/20"
              value={newMappingTargetId}
              onChange={e => setNewMappingTargetId(e.target.value)}
            >
              <option value="">Select Official Department</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!newMappingSource.trim() || !newMappingTargetId) {
                  alert("Please provide both source name and target department.");
                  return;
                }
                const isDuplicate = departmentMappings.some(m => m.sourceName.toUpperCase() === newMappingSource.trim().toUpperCase());
                if (isDuplicate) {
                  alert("A mapping for this source name already exists.");
                  return;
                }
                onAddDepartmentMapping({
                  sourceName: newMappingSource.trim(),
                  targetDepartmentId: newMappingTargetId
                });
                setNewMappingSource('');
                setNewMappingTargetId('');
              }}
              disabled={!newMappingSource.trim() || !newMappingTargetId}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              Add Rule
            </button>
          </div>

          {departmentMappings.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="py-3 px-4 font-bold text-xs text-slate-500 uppercase tracking-wider border-b">Raw Source Name (CSV)</th>
                    <th className="py-3 px-4 font-bold text-xs text-slate-500 uppercase tracking-wider border-b">Maps To (Official Dept)</th>
                    <th className="py-3 px-4 font-bold text-xs text-slate-500 uppercase tracking-wider border-b w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {departmentMappings.map(mapping => {
                    const targetDept = departments.find(d => d.id === mapping.targetDepartmentId);
                    return (
                      <tr key={mapping.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-sm font-bold text-slate-900">{mapping.sourceName}</td>
                        <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-600">
                          {targetDept ? targetDept.name : <span className="text-red-500 italic">Unknown Dept</span>}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <button
                            onClick={() => {
                              if (confirm(`Remove mapping for "${mapping.sourceName}"?`)) {
                                onDeleteDepartmentMapping(mapping.id);
                              }
                            }}
                            className="text-xs font-bold text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <p className="text-sm text-slate-500 font-medium">No mapping rules defined.</p>
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
              isSystemLocked ? 'bg-slate-200 text-slate-600' : 'bg- emerald-100 text-emerald-700'
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
