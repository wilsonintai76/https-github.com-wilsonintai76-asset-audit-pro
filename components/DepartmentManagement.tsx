
import React, { useState } from 'react';
import { Department, Location, User, AuditGroup } from '../types';
import { Plus, Layers, UserRound, Boxes, Pencil, Trash2, Building2 } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { AuditPhase } from '../types';
import { DepartmentModal } from './DepartmentModal';

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
  onAddGroup?: (group: Omit<AuditGroup, 'id'>) => void;
  onUpdateGroup?: (id: string, group: Partial<AuditGroup>) => void;
  onDeleteGroup?: (id: string) => void;
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
  onDeleteGroup
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

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
            className={`px-5 py-2.5 rounded-2xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 ${
              activePhase 
                ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20 shadow-none' 
                : 'bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-700'
            }`}
          >
            <Plus className="w-4 h-4" />
            New Dept
          </button>
        )}
      </PageHeader>

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
                
                return (
                  <tr key={dept.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shadow-sm border ${colorClass} shrink-0`}>
                          {dept.abbr}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm truncate">{dept.name}</div>
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
                      <div className="flex items-center gap-2">
                        {dept.totalAssets !== undefined && (
                          <div className="px-2 py-0.5 rounded bg-blue-50 text-[9px] text-blue-600 border border-blue-100 font-bold uppercase tracking-tighter">
                            Tier Detected
                          </div>
                        )}
                        {(dept.auditGroupId || dept.auditGroup) && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-[9px] text-indigo-600 border border-indigo-100 font-bold flex items-center gap-1" title="Consolidated Audit Group">
                            <Layers className="w-3 h-3" />
                            {dept.auditGroupId 
                              ? auditGroups.find(g => g.id === dept.auditGroupId)?.name || 'Unknown Group'
                              : dept.auditGroup
                            }
                          </span>
                        )}
                      </div>
                    </td>
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
