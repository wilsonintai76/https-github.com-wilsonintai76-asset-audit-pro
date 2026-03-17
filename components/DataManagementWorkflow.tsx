
import React, { useRef } from 'react';
import Papa from 'papaparse';
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';
import { Department, Location, DepartmentMapping } from '../types';
import { MappingRules } from './MappingRules';
import { FileSpreadsheet, UserCheck, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

const ASSET_BUILTIN_MAP: Record<string, string> = {
  'unit kamsis':                                         'unit pengurusan kolej kediaman',
  'pejabat pengarah':                                    'unit khidmat pengurusan',
  'pejabat timbalan pengarah akademik':                  'unit khidmat pengurusan',
  'pejabat timbalan pengarah sokongan akademik':         'unit khidmat pengurusan',
  'unit pentadbiran':                                    'unit khidmat pengurusan',
  'unit perolehan dan bekalan':                          'unit khidmat pengurusan',
  'unit perakaunan dan bayaran':                         'unit khidmat pengurusan',
  'unit pengurusan aset':                                'unit khidmat pengurusan',
  'jabatan sukan & kokurikulum':                         'jabatan sukan ko-kurikulum dan kebudayaan',
  'unit pengurusan kualiti':                             'unit jaminan kualiti',
  'unit psikologi & kerjaya':                            'unit pengurusan psikologi',
  'unit latihan & pendidikan lanjutan':                  'unit latihan dan pendidikan lanjutan',
  'unit cisec':                                          'corporate, industrial services & employability centre',
  'unit perhubungan & latihan industri':                 'unit perhubungan dan latihan industri',
  'unit pembangunan instruksional & multimedia':         'unit pembangunan instruksional dan multimedia',
  'unit pembangunan & senggaraan':                       'unit pembangunan dan senggaraan',
  'unit r&d':                                            'unit penyelidikan, inovasi dan komersialan',
  'pejabat tp sokongan akademik':                        'pejabat tp sokongan akademik',
  'pejabat tp akademik':                                 'pejabat tp akademik',
};

interface DataManagementWorkflowProps {
  departments: Department[];
  departmentMappings: DepartmentMapping[];
  onBulkAddDepts: (depts: Omit<Department, 'id'>[]) => void;
  onBulkActivateStaff: (entries: { name: string; email: string; department?: string; designation?: string; role?: string }[]) => void;
  onAddDepartmentMapping: (mapping: Omit<DepartmentMapping, 'id'>) => Promise<void>;
  onDeleteDepartmentMapping: (id: string) => Promise<void>;
  onSyncLocationMappings: () => Promise<void>;
  onUpsertLocations: (locs: Omit<Location, 'id'>[]) => Promise<void>;
}

export const DataManagementWorkflow: React.FC<DataManagementWorkflowProps> = ({
  departments,
  departmentMappings,
  onBulkAddDepts,
  onBulkActivateStaff,
  onAddDepartmentMapping,
  onDeleteDepartmentMapping,
  onSyncLocationMappings,
  onUpsertLocations,
}) => {
  const staffFileInputRef = useRef<HTMLInputElement>(null);
  const deptFileInputRef = useRef<HTMLInputElement>(null);
  const assetSyncRef = useRef<HTMLInputElement>(null);
  const bulkMappingRef = useRef<HTMLInputElement>(null);

  const [isAssetSyncing, setIsAssetSyncing] = React.useState(false);
  const [assetSyncStatus, setAssetSyncStatus] = React.useState<{
    type: 'success' | 'error' | 'warn';
    message: string;
    detail?: string;
  } | null>(null);

  // ────────────────────────────────────────────────────────────
  // Step 1: Department CSV
  // ────────────────────────────────────────────────────────────
  const handleDownloadDeptTemplate = () => {
    const csv = ['ABBR,DEPARTMENT', 'JKA,JABATAN KEJURUTERAAN AWAM', 'JKE,JABATAN KEJURUTERAAN ELEKTRIK'].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'department_import_template.csv';
    link.click();
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
        const colKeys = Object.keys(firstRow).map(k => k.toLowerCase().trim());
        const isAssetOrLocationCsv = colKeys.some(k =>
          ['lokasi terkini', 'location', 'name', 'building', 'level', 'label', 'asset', 'no siri'].includes(k)
        );
        if (isAssetOrLocationCsv) {
          alert('This looks like a Location or Asset CSV, not a Department CSV.\n\nA Department CSV should only have columns: ABBR and DEPARTMENT.');
          if (deptFileInputRef.current) deptFileInputRef.current.value = '';
          return;
        }
        const newDepts: Omit<Department, 'id'>[] = [];
        results.data.forEach((row: any) => {
          const name = (row['DEPARTMENT'] || row['Department'] || row['department'] || row['JABATAN'] || row['Jabatan'] || row['NAME'] || row['Name'] || '').trim();
          const abbr = (row['ABBR'] || row['Abbr'] || row['abbr'] || row['ABBREVIATION'] || '').trim();
          if (name) {
            newDepts.push({ name, abbr: abbr || name.substring(0, 4).toUpperCase(), headOfDeptId: null, description: '', auditGroup: 'Group A' });
          }
        });
        if (newDepts.length > 0) {
          onBulkAddDepts(newDepts);
        } else {
          alert('No valid departments found. Ensure CSV has a DEPARTMENT (or JABATAN) column.');
        }
      },
      error: () => alert('Failed to parse CSV.'),
    });
    if (deptFileInputRef.current) deptFileInputRef.current.value = '';
  };

  // ────────────────────────────────────────────────────────────
  // Step 2: Bulk Mapping CSV
  // ────────────────────────────────────────────────────────────
  const handleBulkMappingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        let lastValidDept = '';
        const newMappings: Omit<DepartmentMapping, 'id'>[] = [];
        for (const row of rows) {
          const deptRaw = String(row['DEPARTMENT'] || '').trim();
          const locRaw = String(row['LOCATION'] || '').trim();
          if (deptRaw) lastValidDept = deptRaw;
          if (!locRaw || !lastValidDept) continue;
          const targetDept = departments.find(d =>
            d.name.toLowerCase() === lastValidDept.toLowerCase() ||
            d.abbr?.toLowerCase() === lastValidDept.toLowerCase()
          );
          if (targetDept) {
            newMappings.push({ sourceName: locRaw, targetDepartmentId: targetDept.id });
          }
        }
        if (newMappings.length > 0) {
          for (const m of newMappings) await onAddDepartmentMapping(m);
          alert(`Successfully imported ${newMappings.length} mapping rules.`);
        } else {
          alert('No valid mappings found. Check the CSV format (columns: DEPARTMENT, LOCATION).');
        }
        if (bulkMappingRef.current) bulkMappingRef.current.value = '';
      },
    });
  };

  // ────────────────────────────────────────────────────────────
  // Step 3: Asset / Location Sync
  // ────────────────────────────────────────────────────────────
  const handleAssetSync = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      setAssetSyncStatus({ type: 'error', message: 'Please upload a .csv, .xls or .xlsx file.' });
      if (assetSyncRef.current) assetSyncRef.current.value = '';
      return;
    }
    setIsAssetSyncing(true);
    setAssetSyncStatus(null);

    const processData = async (rows: string[][]) => {
      try {
        if (rows.length < 2) throw new Error('File appears empty.');
        const header = rows[0].map(h => String(h || '').toLowerCase().trim());
        const labelCol = header.findIndex(h => h === 'label' || h.includes('label'));
        const bahagianCol = header.findIndex(h => h.includes('bahagian') || h === 'department' || h === 'unit');
        const lokasiCol = header.findIndex(h => h.includes('lokasi') || h.includes('location'));
        if (labelCol === -1 || bahagianCol === -1) {
          throw new Error(`Required columns missing. Need "Label" and "Bahagian". Found: ${rows[0].slice(0, 5).join(', ')}`);
        }

        const seenLabels = new Set<string>();
        const bahagianCounts: Record<string, number> = {};
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

        const deptByNorm: Record<string, string> = {};
        departments.forEach(d => {
          deptByNorm[d.name.trim().toLowerCase()] = d.id;
          if (d.abbr) deptByNorm[d.abbr.trim().toLowerCase()] = d.id;
        });

        const resolveBahagian = (bahagian: string): string | undefined => {
          const bLow = bahagian.toLowerCase().trim();
          const dbMap = departmentMappings.find(m => m.sourceName.trim().toLowerCase() === bLow);
          if (dbMap) return dbMap.targetDepartmentId;
          if (deptByNorm[bLow]) return deptByNorm[bLow];
          const staticMatch = ASSET_BUILTIN_MAP[bLow];
          if (staticMatch && deptByNorm[staticMatch.toLowerCase()]) return deptByNorm[staticMatch.toLowerCase()];
          const bNorm = bLow.replace(/\s*&\s*/g, ' dan ').replace(/\s+/g, ' ');
          for (const [name, id] of Object.entries(deptByNorm)) {
            if (name.replace(/\s*&\s*/g, ' dan ').replace(/\s+/g, ' ') === bNorm) return id;
          }
          return undefined;
        };

        const deptTotals: Record<string, number> = {};
        const unmatchedDepts = new Set<string>();
        let totalMatchedAssets = 0;
        for (const [bahagian, count] of Object.entries(bahagianCounts)) {
          const deptId = resolveBahagian(bahagian);
          if (deptId) { deptTotals[deptId] = (deptTotals[deptId] || 0) + count; totalMatchedAssets += count; }
          else unmatchedDepts.add(`${bahagian} (${count})`);
        }
        if (Object.keys(deptTotals).length === 0) throw new Error('No departments could be matched. Check your mapping rules.');

        const locationObjects: Omit<Location, 'id'>[] = [];
        for (const [locKey, count] of Object.entries(locationCounts)) {
          const [lokasiName, bahagian] = locKey.split('|||');
          const deptId = resolveBahagian(bahagian);
          if (!deptId) continue;
          locationObjects.push({
            name: lokasiName,
            abbr: lokasiName.split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 10),
            departmentId: deptId, building: '', description: '', supervisorId: '', contact: '',
            totalAssets: count,
          });
        }
        if (locationObjects.length > 0) await onUpsertLocations(locationObjects);

        setAssetSyncStatus({
          type: unmatchedDepts.size > 0 ? 'warn' : 'success',
          message: `Successfully synced ${totalMatchedAssets.toLocaleString()} assets across ${Object.keys(deptTotals).length} departments.`,
          detail: unmatchedDepts.size > 0
            ? `${unmatchedDepts.size} units unmatched: ${Array.from(unmatchedDepts).slice(0, 3).join(', ')}...`
            : `${locationObjects.length} locations updated/created.`,
        });
      } catch (err: any) {
        setAssetSyncStatus({ type: 'error', message: err.message || 'Sync failed' });
      } finally {
        setIsAssetSyncing(false);
        if (assetSyncRef.current) assetSyncRef.current.value = '';
      }
    };

    if (ext === 'csv') {
      Papa.parse(file, { header: false, skipEmptyLines: true, complete: (r) => processData(r.data as string[][]) });
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const buffer = ev.target?.result as ArrayBuffer;
        const wb = xlsxRead(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        processData(xlsxUtils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // ────────────────────────────────────────────────────────────
  // Staff: Optional
  // ────────────────────────────────────────────────────────────
  const handleDownloadStaffTemplate = () => {
    const headers = ['Name', 'Email', 'department', 'Designation', 'Role'];
    const sample = ['SHAHRIZAL BIN SHABUDDIN', 'shahrizal@example.com', 'JABATAN KEJURUTERAAN AWAM', 'Head Of Department', 'Staff'];
    const csv = [headers.join(','), sample.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'staff_import_template.csv';
    link.click();
  };

  const handleStaffFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => {
        const entries: { name: string; email: string; department?: string; designation?: string; role?: string }[] = [];
        results.data.forEach((row: any) => {
          const name = (row['Name'] || row['name'] || row['NAME'] || '').trim();
          const email = (row['Email'] || row['email'] || row['EMAIL'] || '').trim();
          const department = (row['department'] || row['Department'] || row['DEPARTMENT'] || '').trim();
          const designation = (row['Designation'] || row['designation'] || row['DESIGNATION'] || '').trim();
          const role = (row['Role'] || row['role'] || row['ROLE'] || '').trim();
          if (name || email) entries.push({ name, email, department: department || undefined, designation: designation || undefined, role: role || undefined });
        });
        if (entries.length > 0) onBulkActivateStaff(entries);
        else alert("No valid entries found. Ensure 'Name' and 'Email' columns exist.");
      },
      error: () => alert('Failed to parse CSV.'),
    });
    if (staffFileInputRef.current) staffFileInputRef.current.value = '';
  };

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = React.useState<'departments' | 'mappings' | 'sync' | 'staff'>('departments');

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'departments', label: '1. Departments', icon: FileSpreadsheet, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { id: 'mappings', label: '2. Mappings', icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { id: 'sync', label: '3. Asset Sync', icon: CheckCircle, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
    { id: 'staff', label: '4. Staff (Opt)', icon: UserCheck, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
  ] as const;

  return (
    <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Data Management Workflow</h3>
          <p className="text-sm text-slate-500">Configure your system data through these sequential modules.</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-8 bg-slate-50 p-1.5 rounded-[20px] border border-slate-200 w-fit">
        {tabs.map((tab) => {
          const IsActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-[14px] text-xs font-bold transition-all ${
                IsActive 
                  ? `${tab.bg} ${tab.color} ${tab.border} border shadow-sm scale-[1.02]` 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-[300px]">
        {/* Hidden file inputs */}
        <input type="file" ref={staffFileInputRef} className="hidden" accept=".csv" onChange={handleStaffFileUpload} />
        <input type="file" ref={deptFileInputRef} className="hidden" accept=".csv" onChange={handleDeptFileUpload} />
        <input type="file" ref={bulkMappingRef} className="hidden" accept=".csv" onChange={handleBulkMappingUpload} />

        {activeTab === 'departments' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="p-8 bg-indigo-50/50 rounded-3xl border border-indigo-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-indigo-600 uppercase tracking-widest leading-none mb-1">Module 01</p>
                  <h4 className="text-lg font-bold text-slate-900 leading-none caps-none">Official Departments</h4>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-6 max-w-2xl">
                Upload the official department list ([DEPARTMENT.csv]) to populate the system's baseline. This ensures all asset data correctly attributes to valid organizational units.
              </p>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleDownloadDeptTemplate} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all active:scale-95 leading-none">
                  Download Template
                </button>
                <button onClick={() => deptFileInputRef.current?.click()} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95 leading-none">
                  <FileSpreadsheet className="w-4 h-4" /> Import Departments CSV
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'mappings' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-6">
            <div className="p-8 bg-blue-50/50 rounded-3xl border border-blue-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Module 02</p>
                  <h4 className="text-lg font-bold text-slate-900 leading-none caps-none">Department Mapping Rules</h4>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-6 max-w-2xl">
                Upload the mapping reference ([MAPPING FROM CO TO SPPA.csv]) to automatically reconcile sub-units into parent departments. This is critical for accurate asset aggregation.
              </p>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => bulkMappingRef.current?.click()} className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center gap-2 active:scale-95 leading-none">
                  <FileSpreadsheet className="w-4 h-4" /> Import Mapping CSV
                </button>
              </div>
            </div>

            <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
              <MappingRules
                departments={departments}
                departmentMappings={departmentMappings}
                onAddDepartmentMapping={onAddDepartmentMapping}
                onDeleteDepartmentMapping={onDeleteDepartmentMapping}
                onSyncLocationMappings={onSyncLocationMappings}
              />
            </div>
          </div>
        )}

        {activeTab === 'sync' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="p-8 bg-violet-50/50 rounded-3xl border border-violet-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-violet-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-violet-600 uppercase tracking-widest leading-none mb-1">Module 03</p>
                  <h4 className="text-lg font-bold text-slate-900 leading-none caps-none">Sync Assets & Locations</h4>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-6 max-w-2xl">
                Upload [location.csv] or [senarai aset.csv]. The system will use your mapping rules to aggregate asset totals and create location units automatically.
              </p>
              <div className="flex flex-wrap gap-3 items-center">
                <button
                  onClick={() => assetSyncRef.current?.click()}
                  disabled={isAssetSyncing}
                  className="px-6 py-3 bg-violet-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-violet-500/20 hover:bg-violet-700 transition-all flex items-center gap-2 disabled:opacity-60 active:scale-95 leading-none"
                >
                  <RefreshCw className={`w-4 h-4 ${isAssetSyncing ? 'animate-spin' : ''}`} />
                  Sync Assets & Locations
                </button>
                <input ref={assetSyncRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleAssetSync} />
                {assetSyncStatus && (
                  <div className={`flex items-start gap-3 px-5 py-3 rounded-2xl text-xs font-medium border flex-1 max-w-md ${
                    assetSyncStatus.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : assetSyncStatus.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    {assetSyncStatus.type === 'success'
                      ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                      : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                    <div>
                      <div className="font-bold">{assetSyncStatus.message}</div>
                      {assetSyncStatus.detail && <div className="opacity-70 mt-1">{assetSyncStatus.detail}</div>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Optional</p>
                  <h4 className="text-lg font-bold text-slate-900 leading-none caps-none">Staff Management</h4>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-6 max-w-2xl">
                Upload a staff list to automatically create accounts and assign roles. This is optional but recommended for large teams.
              </p>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleDownloadStaffTemplate} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all active:scale-95 leading-none">
                  Download Template
                </button>
                <button onClick={() => staffFileInputRef.current?.click()} className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all flex items-center gap-2 active:scale-95 leading-none">
                  <UserCheck className="w-4 h-4" /> Import Staff CSV
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
