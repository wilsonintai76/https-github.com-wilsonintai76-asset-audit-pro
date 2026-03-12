
import React, { useMemo, useRef } from 'react';
import Papa from 'papaparse';
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';
import { CrossAuditPermission, Department, User, AuditPhase, KPITier, UserRole, Location, AuditSchedule, DepartmentMapping } from '../types';
import { CrossAuditManagement } from './CrossAuditManagement';
import { AuditConstraints } from './AuditConstraints';
import { AuditPhasesSettings } from './AuditPhasesSettings';
import { KPISettings } from './KPISettings';
import { TierDistributionTable } from './TierDistributionTable';
import { Zap, Sliders, ArrowRight, FileSpreadsheet, UserCheck, Lock, Unlock, AlertCircle, Upload, ChevronDown, RefreshCw, CheckCircle } from 'lucide-react';

const ASSET_BUILTIN_MAP: Record<string, string> = {
  // Merged into SPPA departments
  'unit kamsis':                                         'unit pengurusan kolej kediaman',
  'pejabat pengarah':                                    'unit khidmat pengurusan',
  'pejabat timbalan pengarah akademik':                  'unit khidmat pengurusan',
  'pejabat timbalan pengarah sokongan akademik':         'unit khidmat pengurusan',
  'unit pentadbiran':                                    'unit khidmat pengurusan',
  'unit perolehan dan bekalan':                          'unit khidmat pengurusan',
  'unit perakaunan dan bayaran':                         'unit khidmat pengurusan',
  'unit pengurusan aset':                                'unit khidmat pengurusan',
  // Name normalisation (& ↔ ko-kurikulum / dan)
  'jabatan sukan & kokurikulum':                         'jabatan sukan ko-kurikulum dan kebudayaan',
  'unit pengurusan kualiti':                             'unit jaminan kualiti',
  'unit psikologi & kerjaya':                            'unit pengurusan psikologi',
  'unit latihan & pendidikan lanjutan':                  'unit latihan dan pendidikan lanjutan',
  'unit cisec':                                          'corporate, industrial services & employability centre',
  'unit perhubungan & latihan industri':                 'unit perhubungan dan latihan industri',
  'unit pembangunan instruksional & multimedia':         'unit pembangunan instruksional dan multimedia',
  'unit pembangunan & senggaraan':                       'unit pembangunan dan senggaraan',
  'unit r&d':                                            'unit penyelidikan, inovasi dan komersialan',
  // Fallback aliases for renamed departments
  'pejabat tp sokongan akademik':                        'pejabat tp sokongan akademik',
  'pejabat tp akademik':                                 'pejabat tp akademik',
};

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
  onBulkAddDepts: (depts: Omit<Department, 'id'>[]) => void;
  onBulkActivateStaff: (entries: { name: string; staffId: string; email: string; department?: string; designation?: string; role?: string; pin?: string }[]) => void;
  maxAssetsPerDay: number;
  onUpdateMaxAssetsPerDay: (val: number) => void;
  onRebalanceSchedule: () => Promise<void>;
  schedules: AuditSchedule[];
  departmentMappings: DepartmentMapping[];
  onAddDepartmentMapping: (mapping: Omit<DepartmentMapping, 'id'>) => Promise<void>;
  onDeleteDepartmentMapping: (id: string) => Promise<void>;
  onSyncLocationMappings: () => Promise<void>;
  onUpsertLocations: (locs: Omit<Location, 'id'>[]) => Promise<void>;
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
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const staffFileInputRef = useRef<HTMLInputElement>(null);
  const deptFileInputRef = useRef<HTMLInputElement>(null);
  const assetSyncRef = useRef<HTMLInputElement>(null);
  
  // Mapping Form State
  const [newMappingSource, setNewMappingSource] = React.useState('');
  const [newMappingTargetId, setNewMappingTargetId] = React.useState('');
  const [csvSourceNames, setCsvSourceNames] = React.useState<string[]>([]);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isAssetSyncing, setIsAssetSyncing] = React.useState(false);
  const [assetSyncStatus, setAssetSyncStatus] = React.useState<{ type: 'success' | 'error' | 'warn'; message: string; detail?: string } | null>(null);
  const csvMappingRef = useRef<HTMLInputElement>(null);

  const handleAssetSync = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      setAssetSyncStatus({ type: 'error', message: 'Please upload a .csv or .xlsx file.' });
      if (assetSyncRef.current) assetSyncRef.current.value = '';
      return;
    }
    setIsAssetSyncing(true);
    setAssetSyncStatus(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const buffer = ev.target?.result as ArrayBuffer;
        const wb = xlsxRead(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: string[][] = xlsxUtils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];
        if (rows.length < 2) throw new Error('File appears empty.');
        const header = rows[0].map(h => String(h).toLowerCase().trim());
        const labelCol = header.findIndex(h => h === 'label' || h.includes('label'));
        const bahagianCol = header.findIndex(h => h.includes('bahagian') || h === 'department');
        const lokasiCol = header.findIndex(h => h.includes('lokasi') || h.includes('location'));
        if (labelCol === -1 || bahagianCol === -1)
          throw new Error(`Could not find Label/Bahagian columns. Headers found: ${rows[0].slice(0, 6).join(', ')}`);
        const seenLabels = new Set<string>();
        const bahagianCounts: Record<string, number> = {};
        // key: "lokasiName|||bahagianName" → asset count at that location
        const locationCounts: Record<string, number> = {};
        for (const row of rows.slice(1)) {
          const label = String(row[labelCol] || '').trim();
          const bahagian = String(row[bahagianCol] || '').trim();
          if (!label || !bahagian) continue;
          if (seenLabels.has(label)) continue;
          seenLabels.add(label);
          bahagianCounts[bahagian] = (bahagianCounts[bahagian] || 0) + 1;
          if (lokasiCol !== -1) {
            const lokasi = String(row[lokasiCol] || '').trim();
            if (lokasi) locationCounts[`${lokasi}|||${bahagian}`] = (locationCounts[`${lokasi}|||${bahagian}`] || 0) + 1;
          }
        }
        // Build dept lookup
        const deptByNorm: Record<string, string> = {};
        for (const d of departments) deptByNorm[d.name.trim().toLowerCase()] = d.id;

        // Helper: map a Bahagian name to a dept UUID using 4-layer matching
        const resolveBahagian = (bahagian: string): string | undefined => {
          const bLow = bahagian.toLowerCase().trim();
          const appMap = departmentMappings.find(m => m.sourceName.trim().toLowerCase() === bLow);
          if (appMap) return appMap.targetDepartmentId;
          if (deptByNorm[bLow]) return deptByNorm[bLow];
          const sppaName = ASSET_BUILTIN_MAP[bLow];
          if (sppaName) {
            const id = deptByNorm[sppaName] || Object.entries(deptByNorm).find(([n]) => n.includes(sppaName.slice(0, 15)))?.[1];
            if (id) return id;
          }
          const bNorm = bLow.replace(/\s*&\s*/g, ' dan ').replace(/\s+/g, ' ');
          return Object.entries(deptByNorm).find(([n]) => n.replace(/\s*&\s*/g, ' dan ').replace(/\s+/g, ' ') === bNorm)?.[1];
        };

        // Dept totals
        const deptTotals: Record<string, number> = {};
        const unmatched: string[] = [];
        for (const [bahagian, count] of Object.entries(bahagianCounts)) {
          const deptId = resolveBahagian(bahagian);
          if (deptId) { deptTotals[deptId] = (deptTotals[deptId] || 0) + count; }
          else unmatched.push(`${bahagian} (${count})`);
        }
        if (Object.keys(deptTotals).length === 0) {
          setAssetSyncStatus({ type: 'error', message: 'No departments matched.', detail: `Unmatched: ${unmatched.slice(0, 5).join('; ')}` });
          return;
        }
        await onBulkUpdateDepartments(Object.entries(deptTotals).map(([id, total]) => ({ id, data: { totalAssets: total } })));

        // Location objects — one per unique "Lokasi Terkini + Bahagian" pair
        const locationObjects: Omit<Location, 'id'>[] = [];
        for (const [locKey, count] of Object.entries(locationCounts)) {
          const sep = locKey.indexOf('|||');
          const lokasiName = locKey.slice(0, sep);
          const bahagian = locKey.slice(sep + 3);
          const deptId = resolveBahagian(bahagian);
          if (!deptId) continue;
          locationObjects.push({
            name: lokasiName,
            abbr: lokasiName.split(/\s+/).map((w: string) => w[0] || '').join('').toUpperCase().slice(0, 6),
            departmentId: deptId,
            building: '',
            description: '',
            supervisorId: '',
            contact: '',
            totalAssets: count,
          });
        }
        if (locationObjects.length > 0) await onUpsertLocations(locationObjects);

        const total = Object.values(deptTotals).reduce((a, b) => a + b, 0);
        const unmatchedAssets = unmatched.reduce((s, u) => { const m = u.match(/\((\d+)\)$/); return s + (m ? +m[1] : 0); }, 0);
        setAssetSyncStatus({
          type: unmatched.length > 0 ? 'warn' : 'success',
          message: `Synced ${Object.keys(deptTotals).length} departments — ${total.toLocaleString()} assets${locationObjects.length > 0 ? `, ${locationObjects.length} locations` : ''}`,
          detail: unmatched.length > 0 ? `${unmatched.length} unmatched Bahagian (${unmatchedAssets} assets): ${unmatched.slice(0, 5).join('; ')}${unmatched.length > 5 ? '...' : ''}` : undefined
        });
      } catch (err: any) {
        setAssetSyncStatus({ type: 'error', message: err.message || 'Failed to parse file' });
      } finally {
        setIsAssetSyncing(false);
        if (assetSyncRef.current) assetSyncRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

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

  const handleDeptFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const firstRow = results.data[0] as any;
        if (!firstRow) { alert('CSV is empty.'); return; }

        // Reject if this looks like a location or asset CSV (wrong file uploaded)
        const colKeys = Object.keys(firstRow).map(k => k.toLowerCase().trim());
        const isAssetOrLocationCsv =
          colKeys.some(k => ['lokasi terkini', 'location', 'name', 'building', 'level', 'label', 'asset', 'no siri'].includes(k));
        if (isAssetOrLocationCsv) {
          alert('This looks like a Location or Asset CSV, not a Department CSV.\n\nA Department CSV should only have columns: ABBR and DEPARTMENT.\n\nPlease download the Department Template and use the correct file.');
          if (deptFileInputRef.current) deptFileInputRef.current.value = '';
          return;
        }

        const newDepts: Omit<Department, 'id'>[] = [];
        results.data.forEach((row: any) => {
          const name = (row['DEPARTMENT'] || row['Department'] || row['department'] || row['JABATAN'] || row['Jabatan'] || row['jabatan'] || row['NAME'] || row['Name'] || '').trim();
          const abbr = (row['ABBR'] || row['Abbr'] || row['abbr'] || row['ABBREVIATION'] || row['SHORT'] || '').trim();
          if (name) {
            newDepts.push({
              name,
              abbr: abbr || name.substring(0, 4).toUpperCase(),
              headOfDeptId: null,
              description: '',
              auditGroup: 'Group A',
            });
          }
        });
        if (newDepts.length > 0) {
          onBulkAddDepts(newDepts);
        } else {
          alert('No valid departments found. Ensure CSV has a DEPARTMENT (or JABATAN) column.\n\nDownload the Department Template for the correct format.');
        }
      },
      error: () => alert('Failed to parse CSV.'),
    });
    if (deptFileInputRef.current) deptFileInputRef.current.value = '';
  };

  const handleDownloadDeptTemplate = () => {
    const csv = ['ABBR,DEPARTMENT', 'JKA,JABATAN KEJURUTERAAN AWAM', 'JKE,JABATAN KEJURUTERAAN ELEKTRIK'].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'department_import_template.csv';
    link.click();
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
        const entries: { name: string; staffId: string; email: string; department?: string; designation?: string; role?: string; pin?: string }[] = [];
        results.data.forEach((row: any) => {
          const name = (row['Name'] || row['name'] || row['NAME'] || '').trim();
          const staffId = (row['Staff ID'] || row['StaffID'] || row['staff_id'] || row['STAFF ID'] || '').trim();
          const email = (row['Email'] || row['email'] || row['EMAIL'] || '').trim();
          const department = (row['department'] || row['Department'] || row['DEPARTMENT'] || '').trim();
          const designation = (row['Designation'] || row['designation'] || row['DESIGNATION'] || '').trim();
          const role = (row['Role'] || row['role'] || row['ROLE'] || '').trim();
          const pin = (row['PIN'] || row['pin'] || '').trim();
          if (name || staffId) entries.push({ name, staffId, email, department: department || undefined, designation: designation || undefined, role: role || undefined, pin: pin || undefined });
        });
        if (entries.length > 0) {
          onBulkActivateStaff(entries);
        } else {
          alert("No valid entries found. Ensure 'Staff ID' and 'Name' columns exist.");
        }
      },
      error: () => alert('Failed to parse CSV.')
    });
    if (staffFileInputRef.current) staffFileInputRef.current.value = '';
  };

  const handleDownloadStaffTemplate = () => {
    const headers = ['Staff ID', 'Name', 'department', 'Designation', 'Role'];
    const sample = ['1001', 'SHAHRIZAL BIN SHABUDDIN', 'JABATAN KEJURUTERAAN AWAM', 'Head Of Department', 'Staff'];
    const csvContent = [headers.join(','), sample.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'staff_import_template.csv');
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
          maxAssetsPerDay={maxAssetsPerDay}
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
          <p className="text-sm text-slate-500 mb-6">Follow the steps below in order: set up departments first, then staff, then import locations.</p>

          <div className="space-y-6">
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
            <input type="file" ref={staffFileInputRef} className="hidden" accept=".csv" onChange={handleStaffFileUpload} />
            <input type="file" ref={deptFileInputRef} className="hidden" accept=".csv" onChange={handleDeptFileUpload} />

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Step 1 — Departments</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleDownloadDeptTemplate}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all"
                >
                  Department Template
                </button>
                <button
                  onClick={() => deptFileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Import Departments CSV
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Step 2 — Staff</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleDownloadStaffTemplate}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all"
                >
                  Staff Template
                </button>
                <button
                  onClick={() => staffFileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all flex items-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  Import Staff CSV
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Step 3 — Locations</p>
              <p className="text-xs text-slate-400 mb-3">Set up mapping rules below before importing if your CSV uses different department names.</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleDownloadTemplate}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all"
                >
                  Location Template
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Import Locations CSV
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Step 4 — Sync Asset Counts</p>
              <p className="text-xs text-slate-400 mb-3">Upload the asset register Excel file (.xlsx) to automatically update the total asset count for each department. Duplicates are removed by label automatically.</p>
              <div className="flex flex-wrap gap-3 items-center">
                <button
                  onClick={() => assetSyncRef.current?.click()}
                  disabled={isAssetSyncing}
                  className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-violet-500/20 hover:bg-violet-700 transition-all flex items-center gap-2 disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${isAssetSyncing ? 'animate-spin' : ''}`} />
                  {isAssetSyncing ? 'Syncing...' : 'Sync Asset Counts'}
                </button>
                <input ref={assetSyncRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleAssetSync} />
                {assetSyncStatus && (
                  <div className={`flex items-start gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border flex-1 ${assetSyncStatus.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : assetSyncStatus.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {assetSyncStatus.type === 'success' ? <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                    <div>
                      <div>{assetSyncStatus.message}</div>
                      {assetSyncStatus.detail && <div className="opacity-70 mt-0.5">{assetSyncStatus.detail}</div>}
                    </div>
                    <button onClick={() => setAssetSyncStatus(null)} className="ml-auto opacity-50 hover:opacity-100">✕</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <Sliders className="w-5 h-5 text-indigo-500" />
              <h3 className="text-xl font-bold text-slate-900">Department Mapping Rules</h3>
            </div>
            <button
              onClick={async () => {
                setIsSyncing(true);
                await onSyncLocationMappings();
                setIsSyncing(false);
              }}
              disabled={isSyncing || departmentMappings.length === 0}
              title="Re-apply all mapping rules to existing locations that still carry a raw source department name"
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Locations'}
            </button>
          </div>
          <p className="text-sm text-slate-500 mb-4">Create rules to map raw department names from uploaded asset lists to official system departments. This is useful for consolidated units (e.g., mapping various units to "Unit Khidmat Pengurusan").</p>
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 space-y-1.5">
            <p className="font-black uppercase tracking-widest text-amber-600 mb-1">How it works</p>
            <p>① Add mapping rules here (source raw name → official department).</p>
            <p>② Then import your Location CSV — rules apply <span className="font-bold">automatically</span> during upload.</p>
            <p>③ <span className="font-bold">Sync Locations</span> is a <span className="font-bold">repair tool</span> — use it only if locations were already imported <span className="italic">before</span> the rules existed and still carry the wrong department.</p>
          </div>

          {/* Optional: upload asset CSV to pre-load additional source names not yet in the system */}
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black uppercase text-indigo-500 tracking-widest mb-1">Step 1 — Upload Your Asset CSV</p>
              <p className="text-xs text-slate-500">Upload your asset/location CSV to extract all raw department names. These will populate the Source dropdown so you can map them to official departments.</p>
              {csvSourceNames.length > 0 && (
                <p className="text-xs font-bold text-indigo-700 mt-1">✓ {csvSourceNames.length} department name{csvSourceNames.length !== 1 ? 's' : ''} found — pick one in the Source dropdown below.</p>
              )}
            </div>
            <input
              ref={csvMappingRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                Papa.parse(file, {
                  header: true,
                  skipEmptyLines: true,
                  complete: (results) => {
                    const rows = results.data as Record<string, string>[];
                    const deptKey = Object.keys(rows[0] || {}).find(k =>
                      /department|jabatan|dept|bahagian/i.test(k)
                    );
                    if (!deptKey) {
                      alert('Could not find a department column in the CSV. Expected a column named "Department", "Jabatan", "Bahagian", or "Dept".');
                      return;
                    }
                    const names = Array.from(new Set(
                      rows.map(r => (r[deptKey] || '').trim().toUpperCase()).filter(Boolean)
                    )).sort();
                    setCsvSourceNames(names);
                  }
                });
                e.target.value = '';
              }}
            />
            <button
              onClick={() => csvMappingRef.current?.click()}
              className="px-5 py-2.5 bg-white border border-indigo-200 text-indigo-700 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-100 transition-all active:scale-95 shrink-0"
            >
              <Upload className="w-4 h-4" />
              Upload Asset CSV
            </button>
          </div>

          {/* Add Rule row */}
          <div className="flex flex-col md:flex-row gap-4 mb-8 items-center">
            <div className="relative w-full md:w-1/3">
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none"
                value={newMappingSource}
                onChange={e => setNewMappingSource(e.target.value)}
              >
                <option value="">{csvSourceNames.length === 0 ? '← Upload Asset CSV first' : 'Pick raw dept name from CSV'}</option>
                {csvSourceNames
                  .filter(n => !departmentMappings.some(m => m.sourceName.toUpperCase() === n.toUpperCase()))
                  .map(n => <option key={n} value={n}>{n}</option>)
                }
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>
            <div className="flex items-center text-slate-400 justify-center">
              <ArrowRight className="w-5 h-5" />
            </div>
            <div className="relative w-full md:w-1/3">
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none"
                value={newMappingTargetId}
                onChange={e => setNewMappingTargetId(e.target.value)}
              >
                <option value="">Select Official Department</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>
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
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all disabled:opacity-50 shrink-0"
            >
              Add Rule
            </button>
          </div>

          {departmentMappings.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="py-3 px-4 font-bold text-xs text-slate-500 uppercase tracking-wider border-b">Raw Source Name</th>
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

          {/* Next step reminder */}
          {departmentMappings.length > 0 && (
            <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-xs text-emerald-800">
              <span className="text-lg leading-none">✓</span>
              <div>
                <p className="font-black uppercase tracking-widest text-emerald-700 mb-0.5">Mapping rules saved</p>
                <p>You're ready. Go to <span className="font-bold">Data Management → Step 3 — Locations</span> above and click <span className="font-bold">Import Locations CSV</span>. The mapping rules will apply automatically.</p>
              </div>
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
