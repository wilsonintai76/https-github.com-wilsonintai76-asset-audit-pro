
import React, { useMemo, useRef } from 'react';
import Papa from 'papaparse';
import { CrossAuditPermission, Department, User, AuditPhase, KPITier, UserRole, Location, AuditSchedule } from '../types';
import { CrossAuditManagement } from './CrossAuditManagement';
import { AuditConstraints } from './AuditConstraints';
import { AuditPhasesSettings } from './AuditPhasesSettings';
import { KPISettings } from './KPISettings';
import { TierDistributionTable } from './TierDistributionTable';
import { Zap, Sliders, ArrowRight, FileSpreadsheet } from 'lucide-react';

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
  onClearAllLocations: () => void;
  onClearAllDepartments: () => void;
  onBulkAddLocs: (locs: Omit<Location, 'id'>[]) => void;
  maxAssetsPerDay: number;
  onUpdateMaxAssetsPerDay: (val: number) => void;
  onRebalanceSchedule: () => Promise<void>;
  schedules: AuditSchedule[];
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
  onClearAllLocations,
  onClearAllDepartments,
  onBulkAddLocs,
  maxAssetsPerDay,
  onUpdateMaxAssetsPerDay,
  onRebalanceSchedule,
  schedules
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
            // Only add if department matches (or admin)
            if (isAdmin) {
               newLocs.push({
                name: name,
                abbr: name.substring(0, 3).toUpperCase(),
                departmentId: data.departmentId,
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
              newLocs.push({ 
                name, 
                abbr, 
                departmentId: department, 
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
    const headers = ['Name', 'Abbr', 'Department', 'Building', 'Level', 'Supervisor', 'Contact', 'Description', 'Total Assets'];
    const sample = ['Main Chemistry Lab', 'MCL-01', 'Biological Sciences', 'Science Block A', 'FIRST FLOOR', 'Dr. Supervisor', 'x1234', 'Main lab for chemistry', '150'];
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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
      {/* GLOBAL ACTIVE PHASE HEADER */}
      <div className={`p-8 rounded-[40px] border-2 shadow-2xl transition-all duration-500 overflow-hidden relative ${
        activePhase 
          ? 'bg-slate-900 border-emerald-500/50 text-white' 
          : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {activePhase && (
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
        )}
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center text-2xl shadow-inner ${
              activePhase 
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
            <button 
              onClick={handleDownloadTemplate} 
              className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all"
              title="Download CSV Template"
            >
              Download Template
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Import CSV
            </button>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="bg-red-50 border border-red-100 rounded-[32px] p-8">
          <h3 className="text-xl font-bold text-red-900 mb-2">Danger Zone</h3>
          <p className="text-sm text-red-700 mb-6">Irreversible actions for system administration.</p>
          
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={onClearAllLocations}
              className="px-6 py-3 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-bold shadow-sm hover:bg-red-600 hover:text-white transition-all"
            >
              Clear All Locations
            </button>
            <button 
              onClick={onClearAllDepartments}
              className="px-6 py-3 bg-red-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 hover:bg-red-700 transition-all"
            >
              Clear All Departments & Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
