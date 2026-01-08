
import React, { useState } from 'react';
import { Department } from '../types';
import { useData } from '../contexts/DataContext';

export const DepartmentManagement: React.FC = () => {
  const { departments, addDepartment, updateDepartment, deleteDepartment } = useData();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', abbr: '', headOfDept: '', description: '', totalAssets: 0 });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateDepartment(editingId, formData);
      setEditingId(null);
    } else {
      addDepartment(formData);
      setIsAdding(false);
    }
    setFormData({ name: '', abbr: '', headOfDept: '', description: '', totalAssets: 0 });
  };

  const startEdit = (dept: Department) => {
    setEditingId(dept.id);
    setFormData({
      name: dept.name,
      abbr: dept.abbr || '',
      headOfDept: dept.headOfDept,
      description: dept.description,
      totalAssets: dept.totalAssets || 0
    });
    setIsAdding(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Departments</h3>
          <p className="text-sm text-slate-500">Global institutional structure management.</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => { setIsAdding(true); setEditingId(null); setFormData({ name: '', abbr: '', headOfDept: '', description: '', totalAssets: 0 }); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
          >
            <i className="fa-solid fa-plus mr-2"></i>New Department
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Department Name</label>
              <input
                required
                placeholder="e.g. Biological Sciences"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Abbreviation</label>
              <input
                required
                placeholder="e.g. BIOS"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                value={formData.abbr}
                onChange={e => setFormData({ ...formData, abbr: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Head of Department</label>
              <input
                required
                placeholder="Name of Dean/Head"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                value={formData.headOfDept}
                onChange={e => setFormData({ ...formData, headOfDept: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Total Assets</label>
              <input
                required
                type="number"
                min="0"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                value={formData.totalAssets}
                onChange={e => setFormData({ ...formData, totalAssets: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="space-y-1 mb-6">
            <label className="text-[10px] font-black uppercase text-slate-400">Description</label>
            <textarea
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none h-20"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold">
              {editingId ? 'Update' : 'Save'} Department
            </button>
            <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Department Name</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Abbr</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Head of Dept</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Total Assets</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {departments.map(dept => (
              <tr key={dept.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">{dept.name}</div>
                  <div className="text-[10px] text-slate-400 italic">{dept.description}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded border border-blue-100">
                    {dept.abbr}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-slate-600">{dept.headOfDept}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-boxes-stacked text-slate-300 text-xs"></i>
                    <span className="text-sm font-bold text-slate-700">{dept.totalAssets || 0}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => startEdit(dept)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button onClick={() => deleteDepartment(dept.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {departments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                  No departments defined. Click "New Department" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
