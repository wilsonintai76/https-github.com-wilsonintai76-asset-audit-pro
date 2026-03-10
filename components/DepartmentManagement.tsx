
import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Department, Location } from '../types';
import { FileSpreadsheet, Plus, Layers, UserRound, Boxes, Pencil, Trash2 } from 'lucide-react';

interface DepartmentManagementProps {
  departments: Department[];
  locations: Location[];
  onAdd: (dept: Omit<Department, 'id'>) => void;
  onBulkAdd: (depts: Omit<Department, 'id'>[]) => void;
  onUpdate: (id: string, dept: Partial<Department>) => void;
  onDelete: (id: string) => void;
  isAdmin?: boolean;
}

export const DepartmentManagement: React.FC<DepartmentManagementProps> = ({ departments, locations, onAdd, onBulkAdd, onUpdate, onDelete, isAdmin = true }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', abbr: '', headOfDeptId: '', description: '', totalAssets: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- HANDLERS ---

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      onUpdate(editingId, formData);
      setEditingId(null);
    } else {
      onAdd(formData);
      setIsAdding(false);
    }
    setFormData({ name: '', abbr: '', headOfDeptId: '', description: '', totalAssets: 0 });
  };

  const startEdit = (dept: Department) => {
    setEditingId(dept.id);
    setFormData({ 
      name: dept.name, 
      abbr: dept.abbr || '', 
      headOfDeptId: dept.headOfDeptId, 
      description: dept.description,
      totalAssets: dept.totalAssets || 0
    });
    setIsAdding(true);
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
        
        {!isAdding && isAdmin && (
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={() => { setIsAdding(true); setEditingId(null); setFormData({ name: '', abbr: '', headOfDeptId: '', description: '', totalAssets: 0 }); }} className="px-5 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
              <Plus className="w-4 h-4 mr-2 inline-block" />New Dept
            </button>
          </div>
        )}
      </div>

      {/* FORM */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Department Name</label>
              <input required placeholder="e.g. Biological Sciences" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Abbreviation</label>
              <input required placeholder="e.g. BIOS" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none" value={formData.abbr} onChange={e => setFormData({ ...formData, abbr: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Head of Department</label>
              <input required placeholder="Name of Dean/Head" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none" value={formData.headOfDeptId} onChange={e => setFormData({ ...formData, headOfDeptId: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Total Assets</label>
              <input required type="number" min="0" placeholder="e.g. 450" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none" value={formData.totalAssets} onChange={e => setFormData({ ...formData, totalAssets: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="space-y-1 mb-6">
            <label className="text-[10px] font-black uppercase text-slate-400">Description</label>
            <textarea className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none h-20 resize-none" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/10 hover:bg-blue-700 transition-colors">{editingId ? 'Update' : 'Save'} Department</button>
            <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* LIST */}
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest w-[1%] whitespace-nowrap">Department</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {departments.map(dept => {
                const colorClass = AVATAR_COLORS[getColorIndex(dept.name) % AVATAR_COLORS.length];
                return (
                  <tr key={dept.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shadow-sm border ${colorClass} shrink-0`}>
                          {dept.abbr}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm truncate flex items-center gap-2">
                            {dept.name}
                            {/* Logic exists to hide manual grouping UI, but we show the badge if system grouped */}
                            {dept.auditGroup && <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[9px] text-blue-600 border border-blue-100 font-bold" title="Optimized Group Assignment">
                                <Layers className="w-3 h-3 mr-1 inline-block" />
                                {dept.auditGroup}
                            </span>}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium truncate max-w-[400px] mb-1.5">{dept.description || 'No description provided'}</div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-600 font-bold"><UserRound className="w-3 h-3 opacity-60" />{dept.headOfDeptId || 'No Head'}</div>
                            <div className="flex items-center gap-1.5 text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-600 font-bold"><Boxes className="w-3 h-3 opacity-60" />{(dept.totalAssets || 0).toLocaleString()} Assets</div>
                            {dept.totalAssets !== undefined && (
                              <div className="px-2 py-0.5 rounded bg-blue-50 text-[9px] text-blue-600 border border-blue-100 font-bold uppercase tracking-tighter">
                                Tier Detected
                              </div>
                            )}
                          </div>
                        </div>
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
                <tr><td colSpan={2} className="px-6 py-12 text-center text-slate-400"><div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3"><Layers className="w-6 h-6" /></div>No departments defined.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
