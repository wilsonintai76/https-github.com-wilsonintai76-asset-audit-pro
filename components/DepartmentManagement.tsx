
import React, { useState, useMemo } from 'react';
import { Department, Location, User, AuditGroup } from '../types';
import { Plus, Layers, UserRound, Boxes, Pencil, Trash2, Building2, GitMerge, Ban, ChevronRight, Sparkles } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { AuditPhase } from '../types';
import { DepartmentModal } from './DepartmentModal';

const EXCLUSION_STORAGE_KEY = 'consolidation_excluded_dept_ids';
const THRESHOLD_STORAGE_KEY = 'consolidation_threshold';

function loadExcluded(): string[] {
  try { return JSON.parse(localStorage.getItem(EXCLUSION_STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveExcluded(ids: string[]) {
  localStorage.setItem(EXCLUSION_STORAGE_KEY, JSON.stringify(ids));
}
function loadThreshold(): number {
  return parseInt(localStorage.getItem(THRESHOLD_STORAGE_KEY) || '1000', 10);
}
function saveThreshold(t: number) {
  localStorage.setItem(THRESHOLD_STORAGE_KEY, String(t));
}

interface DepartmentManagementProps {
  departments: Department[];
  locations: Location[];
  users: User[];
  onAdd: (dept: Omit<Department, 'id'>) => void;
  onUpdate: (id: string, dept: Partial<Department>) => void;
  onDelete: (id: string) => void;
  isAdmin?: boolean;
  phases?: AuditPhase[];
  auditGroups?: AuditGroup[];
  onAddGroup?: (group: Omit<AuditGroup, 'id'>) => Promise<AuditGroup | void>;
  onUpdateGroup?: (id: string, group: Partial<AuditGroup>) => void;
  onDeleteGroup?: (id: string) => void;
  onAutoConsolidate?: (threshold: number, excludedIds: string[]) => Promise<void>;
}

export const DepartmentManagement: React.FC<DepartmentManagementProps> = ({
  departments,
  onAdd,
  onUpdate,
  onDelete,
  users,
  isAdmin = true,
  phases = [],
  auditGroups = [],
  onAddGroup,
  onUpdateGroup,
  onDeleteGroup,
  onAutoConsolidate,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [excludedIds, setExcludedIds] = useState<string[]>(() => loadExcluded());
  const [threshold, setThreshold] = useState<number>(() => loadThreshold());
  const [isConsolidating, setIsConsolidating] = useState(false);

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

  const toggleExclude = (id: string) => {
    setExcludedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      saveExcluded(next);
      return next;
    });
  };

  const handleThresholdChange = (val: number) => {
    setThreshold(val);
    saveThreshold(val);
  };

  const handleAutoConsolidate = async () => {
    if (!onAutoConsolidate) return;
    setIsConsolidating(true);
    try {
      await onAutoConsolidate(threshold, excludedIds);
    } finally {
      setIsConsolidating(false);
    }
  };

  // Preview: how many groups would be created
  const preview = useMemo(() => {
    const eligible = departments
      .filter(d => !excludedIds.includes(d.id) && (d.totalAssets || 0) > 0)
      .sort((a, b) => (a.totalAssets || 0) - (b.totalAssets || 0));

    let groups = 0, running = 0;
    for (const d of eligible) {
      running += d.totalAssets || 0;
      if (running >= threshold) { groups++; running = 0; }
    }
    if (running > 0) groups++;
    const alreadyGrouped = departments.filter(d => d.auditGroupId && !excludedIds.includes(d.id)).length;
    return { eligible: eligible.length, groups, alreadyGrouped };
  }, [departments, excludedIds, threshold]);

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

  const activePhase = React.useMemo(() => {
    const today = new Date();
    return (phases || []).find(p => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return today >= start && today <= end;
    });
  }, [phases]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments & Units"
        icon={Building2}
        activePhase={activePhase}
        description="Configure institutional structure, departments, and unit heads."
      >
        {isAdmin && (
          <button
            onClick={startAdd}
            className={`px-5 py-2.5 rounded-2xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 ${activePhase
                ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20 shadow-none'
                : 'bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-700'
              }`}
          >
            <Plus className="w-4 h-4" />
            New Dept
          </button>
        )}
      </PageHeader>

      {/* AUTO-CONSOLIDATION PANEL */}
      {isAdmin && (
        <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <GitMerge className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Unit Auto-Consolidation</h4>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Automatically groups unassigned departments together until their combined assets reach the threshold. Toggle <Ban className="inline w-3 h-3 text-rose-400" /> on any department to exclude it.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 px-3 py-2">
                <Boxes className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={threshold}
                  onChange={e => handleThresholdChange(parseInt(e.target.value) || 1000)}
                  className="w-24 text-sm font-bold text-slate-900 bg-transparent outline-none"
                />
                <span className="text-xs text-slate-400 font-medium">assets/group</span>
              </div>
              <button
                onClick={handleAutoConsolidate}
                disabled={isConsolidating || !onAutoConsolidate}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[13px] transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {isConsolidating ? 'Regrouping...' : preview.alreadyGrouped > 0 ? 'Reset & Re-Group' : 'Auto-Group'}
              </button>
            </div>
          </div>
          {/* Preview chip */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
            <span className="px-2 py-0.5 bg-slate-100 rounded-md font-bold text-slate-600">{preview.eligible} departments will be processed</span>
            <ChevronRight className="w-3 h-3 opacity-40" />
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-bold border border-indigo-100">{preview.groups} groups will be created</span>
            {preview.alreadyGrouped > 0 && (
              <>
                <ChevronRight className="w-3 h-3 opacity-40" />
                <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-md font-bold border border-amber-100">{preview.alreadyGrouped} existing groups will be reset</span>
              </>
            )}
            {excludedIds.length > 0 && (
              <>
                <ChevronRight className="w-3 h-3 opacity-40" />
                <span className="px-2 py-0.5 bg-rose-50 text-rose-500 rounded-md font-bold border border-rose-100">{excludedIds.length} excluded</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* LIST */}
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full text-left min-w-[900px]">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Department</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Head of Department</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Asset</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Tier & Group</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {departments.map(dept => {
                const colorClass = AVATAR_COLORS[getColorIndex(dept.name) % AVATAR_COLORS.length];
                const headUser = users.find(u => u.id === dept.headOfDeptId);
                const isExcluded = excludedIds.includes(dept.id);

                return (
                  <tr key={dept.id} className={`hover:bg-slate-50/50 transition-colors ${isExcluded ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shadow-sm border ${colorClass} shrink-0`}>
                          {dept.abbr}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm truncate flex items-center gap-2">
                            {dept.name}
                            {isExcluded && <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-500 text-[9px] font-black border border-rose-100 uppercase">Excluded</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium truncate max-w-[250px]">{dept.description || 'No description provided'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                        <UserRound className="w-4 h-4 opacity-40" />
                        {headUser ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{headUser.name}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{headUser.id}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not Assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-slate-600 font-bold">
                        <Boxes className="w-4 h-4 opacity-40" />
                        {(dept.totalAssets || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {dept.totalAssets !== undefined && (
                          <div className="px-2 py-0.5 rounded bg-blue-50 text-[9px] text-blue-600 border border-blue-100 font-bold uppercase tracking-tighter">
                            Tier Detected
                          </div>
                        )}
                        {(dept.auditGroupId) && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-[9px] text-indigo-600 border border-indigo-100 font-bold flex items-center gap-1" title="Consolidated Audit Group">
                            <Layers className="w-3 h-3" />
                            {auditGroups.find(g => g.id === dept.auditGroupId)?.name || 'Unknown Group'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-left align-middle">
                      {isAdmin && (
                        <div className="flex gap-1 justify-start">
                          {/* Exclude from auto-consolidation toggle */}
                          <button
                            onClick={() => toggleExclude(dept.id)}
                            title={isExcluded ? 'Click to include in auto-grouping' : 'Click to exclude from auto-grouping'}
                            className={`w-9 h-9 flex items-center justify-center border rounded-xl transition-colors ${isExcluded
                                ? 'bg-rose-50 border-rose-200 text-rose-500 hover:bg-rose-100'
                                : 'bg-white border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200'
                              }`}
                          >
                            <Ban className="w-4 h-4" />
                          </button>
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

      <DepartmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingDept}
        users={users}
        isAdmin={isAdmin}
        auditGroups={auditGroups}
      />
    </div>
  );
};
