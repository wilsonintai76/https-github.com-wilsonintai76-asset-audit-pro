
import React, { useRef } from 'react';
import { Button } from './ui/button';
import Papa from 'papaparse';
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';
import type { Department, Location, DepartmentMapping } from '../types';
import { MappingRules } from './MappingRules';
import { FileSpreadsheet, UserCheck, RefreshCw, CheckCircle, AlertCircle, ArrowRight, Info } from 'lucide-react';

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
  onSetDeptTotalsFromMapping: (totals: Record<string, number>) => Promise<void>;
  onUpdateUninspectedAssets: (updates: { id: string, uninspectedCount: number }[]) => Promise<void>;
  locations: Location[];
}

export const DataManagementWorkflow: React.FC<DataManagementWorkflowProps> = ({
  departments,
  departmentMappings,
  locations,
  onBulkAddDepts,
  onBulkActivateStaff,
  onAddDepartmentMapping,
  onDeleteDepartmentMapping,
  onSyncLocationMappings,
  onUpsertLocations,
  onSetDeptTotalsFromMapping,
  onUpdateUninspectedAssets,
}) => {
  const staffFileInputRef = useRef<HTMLInputElement>(null);
  const deptFileInputRef = useRef<HTMLInputElement>(null);
  const assetSyncRef = useRef<HTMLInputElement>(null);
  const uninspectedAssetRef = useRef<HTMLInputElement>(null);
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
            newDepts.push({ name, abbr: abbr || name.substring(0, 4).toUpperCase(), headOfDeptId: null, description: '', auditGroupId: null });
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
        const deptAssetAccumulator: Record<string, number> = {};
        for (const row of rows) {
          const deptRaw = String(row['DEPARTMENT'] || '').trim();
          const locRaw = String(row['LOCATION'] || '').trim();
          const totalAset = parseInt(String(row['total aset'] || row['TOTAL ASET'] || '0').replace(/[^0-9]/g, '')) || 0;
          if (deptRaw) lastValidDept = deptRaw;
          if (!locRaw || !lastValidDept) continue;
          const targetDept = departments.find(d =>
            d.name.trim().toLowerCase() === lastValidDept.toLowerCase() ||
            d.abbr?.toLowerCase() === lastValidDept.toLowerCase()
          );
          if (targetDept) {
            newMappings.push({ sourceName: locRaw, targetDepartmentId: targetDept.id });
            deptAssetAccumulator[targetDept.id] = (deptAssetAccumulator[targetDept.id] || 0) + totalAset;
          }
        }
        if (newMappings.length > 0) {
          for (const m of newMappings) await onAddDepartmentMapping(m);
          if (Object.keys(deptAssetAccumulator).length > 0) {
            await onSetDeptTotalsFromMapping(deptAssetAccumulator);
          }
          alert(`Successfully imported ${newMappings.length} mapping rules and updated asset totals for ${Object.keys(deptAssetAccumulator).length} departments.`);
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
  
  const handleUninspectedAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      alert('Please upload a .csv, .xls or .xlsx file.');
      return;
    }
    setIsAssetSyncing(true);
    setAssetSyncStatus(null);

    const processUninspected = async (rows: string[][]) => {
      try {
        if (rows.length < 2) throw new Error('File appears empty.');
        const header = rows[0].map(h => String(h || '').toLowerCase().trim());
        const labelCol   = header.findIndex(h => h === 'label' || h.includes('label'));
        const lokasiCol  = header.findIndex(h => h.includes('lokasi') || h.includes('location'));
        const bahagianCol = header.findIndex(h => h.includes('bahagian') || h === 'department' || h === 'unit');

        if (labelCol === -1 || lokasiCol === -1) {
          throw new Error('Required columns missing. Need "Label" and "Lokasi Terkini".');
        }

        // Count unique assets per location name (+ optionally bahagian for disambiguation)
        const seenLabels = new Set<string>();
        // key: lokasi name, value: { count, bahagian hint }
        const locationCounts: Record<string, { count: number; bahagianHint: string }> = {};

        for (const row of rows.slice(1)) {
          const label   = String(row[labelCol] || '').trim();
          const lokasi  = String(row[lokasiCol] || '').trim();
          const bahagian = bahagianCol !== -1 ? String(row[bahagianCol] || '').trim() : '';
          if (!label || !lokasi) continue;
          if (seenLabels.has(label)) continue;
          seenLabels.add(label);
          if (!locationCounts[lokasi]) locationCounts[lokasi] = { count: 0, bahagianHint: bahagian };
          locationCounts[lokasi].count++;
        }

        // Build dept resolution (reuse same mapping logic as master registry)
        const deptByNorm: Record<string, string> = {};
        departments.forEach(d => {
          deptByNorm[d.name.trim().toLowerCase()] = d.id;
          if (d.abbr) deptByNorm[d.abbr.trim().toLowerCase()] = d.id;
        });

        const resolveDept = (bahagian: string): string | undefined => {
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

        const updates: { id: string; uninspectedCount: number }[] = [];
        let unmatched = 0;

        for (const [lokasiName, { count, bahagianHint }] of Object.entries(locationCounts)) {
          const lokasiLow = lokasiName.toLowerCase();

          // 1. Try name + resolved dept (most specific)
          const deptId = bahagianHint ? resolveDept(bahagianHint) : undefined;
          let found = deptId
            ? safeLocations.find(l => l.name.toLowerCase() === lokasiLow && l.departmentId === deptId)
            : undefined;

          // 2. Fall back to name-only match (location names are usually unique enough)
          if (!found) {
            const nameMatches = safeLocations.filter(l => l.name.toLowerCase() === lokasiLow);
            if (nameMatches.length === 1) {
              found = nameMatches[0];
            } else if (nameMatches.length > 1 && deptId) {
              found = nameMatches.find(l => l.departmentId === deptId) || nameMatches[0];
            }
          }

          if (found) {
            updates.push({ id: found.id, uninspectedCount: count });
          } else {
            unmatched++;
          }
        }

        if (updates.length > 0) {
          await onUpdateUninspectedAssets(updates);
          setAssetSyncStatus({
            type: unmatched > 0 ? 'warn' : 'success',
            message: `Updated uninspected counts for ${updates.length} location${updates.length !== 1 ? 's' : ''}.`,
            detail: unmatched > 0
              ? `${unmatched} location name${unmatched !== 1 ? 's' : ''} from the CSV didn't match any location in the system. Ensure Master Registry is synced first.`
              : undefined,
          });
        } else {
          setAssetSyncStatus({ type: 'warn', message: 'No matching locations found. Ensure Master Registry (Step 3) is synced first.' });
        }
      } catch (err: any) {
        setAssetSyncStatus({ type: 'error', message: err.message || 'Update failed' });
      } finally {
        setIsAssetSyncing(false);
        if (uninspectedAssetRef.current) uninspectedAssetRef.current.value = '';
      }
    };

    if (ext === 'csv') {
      Papa.parse(file, { header: false, skipEmptyLines: true, complete: (r) => processUninspected(r.data as string[][]) });
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const buffer = ev.target?.result as ArrayBuffer;
        const wb = xlsxRead(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        processUninspected(xlsxUtils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]);
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
        const allowedDomain = 'poliku.edu.my';
        const entries: { name: string; email: string; department?: string; designation?: string; role?: string }[] = [];
        let skippedCount = 0;

        results.data.forEach((row: any) => {
          const name = (row['Name'] || row['name'] || row['NAME'] || '').trim();
          const email = (row['Email'] || row['email'] || row['EMAIL'] || '').trim();
          const department = (row['department'] || row['Department'] || row['DEPARTMENT'] || '').trim();
          const designation = (row['Designation'] || row['designation'] || row['DESIGNATION'] || '').trim();
          const role = (row['Role'] || row['role'] || row['ROLE'] || '').trim();
          
          if (email && !email.toLowerCase().endsWith(`@${allowedDomain}`)) {
            skippedCount++;
            return;
          }

          if (name || email) entries.push({ name, email, department: department || undefined, designation: designation || undefined, role: role || undefined });
        });

        if (entries.length > 0) {
          onBulkActivateStaff(entries);
          if (skippedCount > 0) {
            alert(`Imported ${entries.length} members. Skipped ${skippedCount} entries because they did not use the @${allowedDomain} domain.`);
          }
        }
        else alert(`No valid entries found. Ensure 'Name' and 'Email' columns exist, and all emails use the @${allowedDomain} domain.`);
      },
      error: () => alert('Failed to parse CSV.'),
    });
    if (staffFileInputRef.current) staffFileInputRef.current.value = '';
  };

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = React.useState<'departments' | 'mappings' | 'sync' | 'uninspected' | 'staff'>('departments');

  const safeLocations  = locations ?? [];
  const hasDepts       = departments.length > 0;
  const hasMappings    = departmentMappings.length > 0;
  const hasRegistry    = safeLocations.length > 0;
  const hasUninspected = safeLocations.some(l => (l.uninspectedAssetCount ?? 0) > 0);

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'departments', label: '1. Departments', icon: FileSpreadsheet, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { id: 'mappings', label: '2. Mappings', icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { id: 'sync', label: '3. Master Registry', icon: CheckCircle, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
    { id: 'uninspected', label: '4. Uninspected Assets', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    { id: 'staff', label: '5. Staff (Opt)', icon: UserCheck, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
  ] as const;

  return (
    <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Data Management Workflow</h3>
          <p className="text-sm text-slate-500">Configure your system data through these sequential modules.</p>
        </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Master Data Configuration</h4>
                <p className="text-[10px] text-slate-500 font-medium">Use sequential tabs to synchronize institutional registries.</p>
              </div>
      </div>

      {/* Dependency chain banner */}
      <div className="flex flex-wrap items-center gap-1.5 mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] font-semibold text-amber-800">
        <Info className="w-3.5 h-3.5 shrink-0 text-amber-600" />
        <span className="font-black">Required order:</span>
        <span className={hasDepts ? 'text-emerald-700' : 'text-slate-500'}>1. Departments{hasDepts ? ' ✓' : ''}</span>
        <ArrowRight className="w-3 h-3 text-amber-400" />
        <span className={hasMappings ? 'text-emerald-700' : 'text-slate-500'}>2. Mappings{hasMappings ? ' ✓' : ''}</span>
        <ArrowRight className="w-3 h-3 text-amber-400" />
        <span className={hasRegistry ? 'text-emerald-700' : 'text-slate-500'}>3. Master Registry{hasRegistry ? ' ✓' : ''}</span>
        <ArrowRight className="w-3 h-3 text-amber-400" />
        <span className={hasUninspected ? 'text-emerald-700' : 'text-slate-500'}>4. Uninspected{hasUninspected ? ' ✓' : ''}</span>
        <span className="ml-auto text-amber-600">Mapping must be done BEFORE Master Registry for correct asset totals.</span>
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
        <input type="file" ref={assetSyncRef} className="hidden" accept=".csv,.xlsx,.xls" onChange={handleAssetSync} />
        <input type="file" ref={uninspectedAssetRef} className="hidden" accept=".csv,.xlsx,.xls" onChange={handleUninspectedAssetUpload} />
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
                {hasDepts && (
                  <button onClick={() => setActiveTab('mappings')} className="ml-auto px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center gap-2 active:scale-95">
                    Next: Mappings <ArrowRight className="w-4 h-4" />
                  </button>
                )}
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
                Upload [MAPPING FROM CO TO SPPA.csv] to reconcile sub-unit names from the old CO system into their parent SPPA departments. This mapping is used during the next step to correctly assign each asset row to its department. The <code className="bg-blue-100 px-1 rounded text-blue-700">total aset</code> column is also read and stored as the authoritative asset total per department — acting as a floor guarantee even if some sub-units remain unmatched during registry sync.
              </p>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => bulkMappingRef.current?.click()} className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center gap-2 active:scale-95 leading-none">
                  <FileSpreadsheet className="w-4 h-4" /> Import Mapping CSV
                </button>
                {hasMappings && (
                  <button onClick={() => setActiveTab('sync')} className="ml-auto px-5 py-3 bg-violet-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-violet-500/20 hover:bg-violet-700 transition-all flex items-center gap-2 active:scale-95">
                    Next: Registry Sync <ArrowRight className="w-4 h-4" />
                  </button>
                )}
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
                  <h4 className="text-lg font-bold text-slate-900 leading-none caps-none">Master Asset Registry Sync</h4>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-6 max-w-2xl">
                Upload [location.csv] or [senarai aset.csv] to define the institutional baseline. This creates location units and sets "Total Asset" targets. <span className="font-semibold text-violet-700">Mapping (Step 2) must be completed first</span> so sub-unit Bahagian names resolve to their correct parent departments.
              </p>
              {!hasMappings && (
                <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  No mapping rules found. Complete Step 2 first for correct asset-to-department assignment.
                  <button onClick={() => setActiveTab('mappings')} className="ml-auto underline hover:no-underline">Go to Mappings →</button>
                </div>
              )}
              <div className="flex flex-wrap gap-3 items-center">
                <button
                  onClick={() => assetSyncRef.current?.click()}
                  disabled={isAssetSyncing}
                  className="px-6 py-3 bg-violet-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-violet-500/20 hover:bg-violet-700 transition-all flex items-center gap-2 disabled:opacity-60 active:scale-95 leading-none"
                >
                  <RefreshCw className={`w-4 h-4 ${isAssetSyncing ? 'animate-spin' : ''}`} />
                  Upload Master Registry
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

        {activeTab === 'uninspected' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="p-8 bg-amber-50/50 rounded-3xl border border-amber-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-amber-600 uppercase tracking-widest leading-none mb-1">Module 04</p>
                  <h4 className="text-lg font-bold text-slate-900 leading-none caps-none">Uninspected Assets Tracking</h4>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-6 max-w-2xl">
                Upload [senarai aset belum diperiksa]. The system will count uninspected assets per location and update the Overview Hub statistics accordingly.
              </p>
              <div className="flex flex-wrap gap-3 items-center">
                <button
                  onClick={() => uninspectedAssetRef.current?.click()}
                  disabled={isAssetSyncing}
                  className="px-6 py-3 bg-amber-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-700 transition-all flex items-center gap-2 disabled:opacity-60 active:scale-95 leading-none"
                >
                  <FileSpreadsheet className={`w-4 h-4 ${isAssetSyncing ? 'animate-spin' : ''}`} />
                  Import Uninspected CSV
                </button>
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
