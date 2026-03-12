
import React, { useState, useRef } from 'react';
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';
import { Department, Location, User, DepartmentMapping } from '../types';
import { Plus, Layers, UserRound, Pencil, Trash2, Search, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { DepartmentModal } from './DepartmentModal';

// Institutional mapping: CSV "Bahagian" name → SPPA department name (partial/normalised match)
// Derived from MAPPING FROM CO TO SPPA.csv
const BUILTIN_NAME_MAP: Record<string, string> = {
  'unit kamsis':                                          'unit pengurusan kolej kediaman',
  'pejabat pengarah':                                     'unit khidmat pengurusan',
  'pejabat timbalan pengarah akademik':                   'unit khidmat pengurusan',
  'pejabat timbalan pengarah sokongan akademik':          'unit khidmat pengurusan',
  'unit pentadbiran':                                     'unit khidmat pengurusan',
  'unit perolehan dan bekalan':                           'unit khidmat pengurusan',
  'unit perakaunan dan bayaran':                          'unit khidmat pengurusan',
  'jabatan sukan & kokurikulum':                          'jabatan sukan ko-kurikulum dan kebudayaan',
  'unit pengurusan kualiti':                              'unit jaminan kualiti',
  'unit psikologi & kerjaya':                             'unit pengurusan psikologi',
  'unit latihan & pendidikan lanjutan':                   'unit latihan dan pendidikan lanjutan',
  'unit cisec':                                           'corporate, industrial services & employability centre',
  'unit perhubungan & latihan industri':                  'unit perhubungan dan latihan industri',
  'unit pembangunan instruksional & multimedia':          'unit pembangunan instruksional dan multimedia',
  'unit pembangunan & senggaraan':                        'unit pembangunan dan senggaraan',
  'unit r&d':                                             'unit penyelidikan, inovasi dan komersialan',
  'unit komunikasi korporat':                             'unit komunikasi korporat',
  'unit keusahawanan':                                    'unit keusahawanan',
  'unit centre of geomatics':                             'unit centre of geomatics',
  'unit keselamatan dan kesihatan':                       'unit keselamatan dan kesihatan',
};

interface DepartmentManagementProps {
  departments: Department[];
  locations?: Location[];
  departmentMappings?: DepartmentMapping[];
  users: User[];
  onAdd: (dept: Omit<Department, 'id'>) => void;
  onUpdate: (id: string, dept: Partial<Department>) => void;
  onBulkUpdate?: (updates: { id: string; data: Partial<Department> }[]) => Promise<void>;
  onDelete: (id: string) => void;
  isAdmin?: boolean;
}

export const DepartmentManagement: React.FC<DepartmentManagementProps> = ({ departments, locations = [], departmentMappings = [], users, onAdd, onUpdate, onBulkUpdate, onDelete, isAdmin = true }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [filterText, setFilterText] = useState('');
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | 'warn'; message: string; detail?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // --- HANDLERS ---

  const handleSave = (data: Omit<Department, 'id'> | Partial<Department>) => {
    if (editingDept) {
      onUpdate(editingDept.id, data as Partial<Department>);
    } else {
      onAdd(data as Omit<Department, 'id'>);
    }
  };

  const startEdit = (dept: Department) => {
    setEditingDept(dept);
    setIsModalOpen(true);
  };

  const startAdd = () => {
    setEditingDept(null);
    setIsModalOpen(true);
  };

  const handleSyncFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Only allow csv/xlsx
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      setSyncStatus({ type: 'error', message: 'Please upload a .csv or .xlsx file.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSyncing(true);
    setSyncStatus(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const buffer = ev.target?.result as ArrayBuffer;
        const wb = xlsxRead(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Get rows as arrays (header row included)
        const rows: string[][] = xlsxUtils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];

        if (rows.length < 2) throw new Error('File appears empty.');

        // Detect column indices from header row
        const header = rows[0].map(h => String(h).toLowerCase().trim());
        const labelCol = header.findIndex(h => h === 'label' || h === 'no. siri' || h === 'label aset');
        const bahagianCol = header.findIndex(h => h.includes('bahagian') || h.includes('jabatan') || h === 'department');
        if (labelCol === -1 || bahagianCol === -1) {
          throw new Error(`Could not find required columns. Found headers: ${rows[0].slice(0,6).join(', ')}`);
        }

        // Count assets per Bahagian, deduplicated by Label
        const seenLabels = new Set<string>();
        const bahagianCounts: Record<string, number> = {};
        for (const row of rows.slice(1)) {
          const label = String(row[labelCol] || '').trim();
          const bahagian = String(row[bahagianCol] || '').trim();
          if (!label || !bahagian) continue;
          if (seenLabels.has(label)) continue;
          seenLabels.add(label);
          bahagianCounts[bahagian] = (bahagianCounts[bahagian] || 0) + 1;
        }

        // Resolve bahagian → department id
        const deptTotals: Record<string, number> = {};
        const unmatched: string[] = [];

        // Build normalised dept name → id map for fast lookup
        const deptByNormName: Record<string, string> = {};
        for (const d of departments) {
          deptByNormName[d.name.trim().toLowerCase()] = d.id;
        }

        for (const [bahagian, count] of Object.entries(bahagianCounts)) {
          const bLower = bahagian.toLowerCase().trim();

          // 1. App mapping rules (configured by user)
          const appMapping = departmentMappings.find(m => m.sourceName.trim().toLowerCase() === bLower);
          if (appMapping) {
            deptTotals[appMapping.targetDepartmentId] = (deptTotals[appMapping.targetDepartmentId] || 0) + count;
            continue;
          }

          // 2. Direct name match
          if (deptByNormName[bLower]) {
            deptTotals[deptByNormName[bLower]] = (deptTotals[deptByNormName[bLower]] || 0) + count;
            continue;
          }

          // 3. Builtin institutional map → resolve to SPPA name → department id
          const sppaName = BUILTIN_NAME_MAP[bLower];
          if (sppaName) {
            // Try exact match on SPPA name
            const deptId = deptByNormName[sppaName]
              // fallback: find dept whose name contains the key part
              || Object.entries(deptByNormName).find(([n]) => n.includes(sppaName.slice(0, 15)))?.[1];
            if (deptId) {
              deptTotals[deptId] = (deptTotals[deptId] || 0) + count;
              continue;
            }
          }

          // 4. Fuzzy: normalize & → dan, then retry
          const bNorm = bLower.replace(/\s*&\s*/g, ' dan ').replace(/\s+/g, ' ');
          if (deptByNormName[bNorm]) {
            deptTotals[deptByNormName[bNorm]] = (deptTotals[deptByNormName[bNorm]] || 0) + count;
            continue;
          }
          const fuzzyDept = Object.entries(deptByNormName).find(([n]) => {
            const nNorm = n.replace(/\s*&\s*/g, ' dan ').replace(/\s+/g, ' ');
            return nNorm === bNorm;
          });
          if (fuzzyDept) {
            deptTotals[fuzzyDept[1]] = (deptTotals[fuzzyDept[1]] || 0) + count;
            continue;
          }

          unmatched.push(`${bahagian} (${count})`);
        }

        if (Object.keys(deptTotals).length === 0) {
          setSyncStatus({
            type: 'error',
            message: 'No departments matched.',
            detail: `Unmatched: ${unmatched.slice(0, 5).join('; ')}`
          });
          setSyncing(false);
          return;
        }

        const bulkPayload = Object.entries(deptTotals).map(([id, total]) => ({ id, data: { totalAssets: total } }));
        if (onBulkUpdate) {
          await onBulkUpdate(bulkPayload);
        } else {
          await Promise.all(bulkPayload.map(u => onUpdate(u.id, u.data)));
        }

        const totalAssets = Object.values(deptTotals).reduce((a, b) => a + b, 0);
        const unmatchedAssets = unmatched.reduce((sum, u) => {
          const m = u.match(/\((\d+)\)$/);
          return sum + (m ? parseInt(m[1]) : 0);
        }, 0);

        setSyncStatus({
          type: unmatched.length > 0 ? 'warn' : 'success',
          message: `Synced ${Object.keys(deptTotals).length} departments — ${totalAssets.toLocaleString()} assets`,
          detail: unmatched.length > 0
            ? `${unmatched.length} unmatched Bahagian (${unmatchedAssets} assets): ${unmatched.slice(0, 5).join('; ')}${unmatched.length > 5 ? '...' : ''}`
            : undefined
        });
      } catch (err: any) {
        setSyncStatus({ type: 'error', message: err.message || 'Failed to parse file' });
      } finally {
        setSyncing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Helper for colors
  const getColorIndex = (str: string) => {
    let hash = 0;
    for (let i = 0; i < (str?.length || 0); i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash);
  };
  const AVATAR_COLORS = [
    'bg-blue-100 text-blue-600 border-blue-200', 'bg-emerald-100 text-emerald-600 border-emerald-200',
    'bg-indigo-100 text-indigo-600 border-indigo-200', 'bg-purple-100 text-purple-600 border-purple-200',
    'bg-amber-100 text-amber-600 border-amber-200', 'bg-rose-100 text-rose-600 border-rose-200'
  ];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Departments Registry</h3>
          <p className="text-sm text-slate-500">Manage base department data. Grouping and pairing is handled in System Settings.</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto items-center flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Filter departments..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          {isAdmin && (
            <>
              <button onClick={startAdd} className="px-5 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2">
                <Plus className="w-4 h-4" />New Dept
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={syncing}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
                title="Upload asset CSV or Excel to auto-update Total Assets for each department"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Assets'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleSyncFile}
              />
            </>
          )}
        </div>
      </div>

      {/* SYNC STATUS */}
      {syncStatus && (
        <div className={`flex items-start gap-3 px-5 py-3 rounded-2xl text-sm font-medium border ${
          syncStatus.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          syncStatus.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-800' :
          'bg-red-50 border-red-200 text-red-800'
        }`}>
          {syncStatus.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          <div className="flex-1">
            <div>{syncStatus.message}</div>
            {syncStatus.detail && <div className="text-xs mt-1 opacity-80">{syncStatus.detail}</div>}
          </div>
          <button onClick={() => setSyncStatus(null)} className="text-xs opacity-60 hover:opacity-100 shrink-0">✕</button>
        </div>
      )}

      {/* MODAL */}
      <DepartmentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingDept}
        users={users}
        isAdmin={isAdmin}
        departmentMappings={departmentMappings}
      />


      {/* LIST */}
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest w-[1%] whitespace-nowrap">Abbr</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Department Name</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap">HOD</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap text-right">Total Assets</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {departments.filter(dept => {
                const q = filterText.toLowerCase();
                return !q || dept.name.toLowerCase().includes(q) || (dept.abbr || '').toLowerCase().includes(q) || (dept.auditGroup || '').toLowerCase().includes(q);
              }).map(dept => {
                const colorClass = AVATAR_COLORS[getColorIndex(dept.name) % AVATAR_COLORS.length];
                const hodName = dept.headName || users.find(u => u.id === dept.headOfDeptId)?.name || dept.headOfDeptId;
                return (
                  <tr key={dept.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Abbr */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shadow-sm border ${colorClass}`}>
                        {dept.abbr}
                      </div>
                    </td>
                    {/* Department Name */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 text-sm">{dept.name}</div>
                      {(() => {
                        const mappedSources = departmentMappings.filter(m => m.targetDepartmentId === dept.id);
                        if (mappedSources.length === 0) return <div className="text-[11px] text-slate-400 italic mt-0.5">No mapping rules defined</div>;
                        return (
                          <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            {mappedSources.map(m => m.sourceName).join(', ')}
                          </div>
                        );
                      })()}
                      {(dept.auditGroup || dept.totalAssets !== undefined) && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {dept.auditGroup && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[9px] text-blue-600 border border-blue-100 font-bold" title="Optimized Group Assignment">
                              <Layers className="w-3 h-3 mr-1 inline-block" />
                              {dept.auditGroup}
                            </span>
                          )}
                          {dept.totalAssets !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-[9px] text-emerald-600 border border-emerald-100 font-bold uppercase tracking-tighter">
                              Tier Detected
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    {/* HOD */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {hodName
                        ? <div className="flex items-center gap-1.5 text-sm text-slate-700 font-medium"><UserRound className="w-3.5 h-3.5 text-slate-400" />{hodName}</div>
                        : <span className="text-xs text-slate-400 italic">No Head</span>
                      }
                    </td>
                    {/* Total Assets */}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-bold text-slate-900">{(dept.totalAssets || 0).toLocaleString()}</span>
                    </td>
                    {/* Actions */}
                    <td className="px-6 py-4 text-left align-middle">
                      {isAdmin && (
                        <div className="flex gap-1 justify-start">
                          <button onClick={() => startEdit(dept)} className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-colors"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => onDelete(dept.id)} className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!departments || departments.length === 0) && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400"><div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3"><Layers className="w-6 h-6" /></div>No departments defined.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
