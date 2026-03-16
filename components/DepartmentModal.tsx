
import React, { useState, useEffect } from 'react';
import { Department, User, DepartmentMapping } from '../types';
import { X, Layers, User as UserIcon, FileText, Boxes, Shield } from 'lucide-react';

interface DepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dept: Omit<Department, 'id'> | Partial<Department>) => void;
  initialData?: Department | null;
  users: User[];
  isAdmin: boolean;
  departmentMappings?: DepartmentMapping[];
}

export const DepartmentModal: React.FC<DepartmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  users,
  isAdmin,
  departmentMappings = []
}) => {
  const [formData, setFormData] = useState({
    name: '',
    abbr: '',
    headOfDeptId: null as string | null,
    description: '',
    totalAssets: 0
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        abbr: initialData.abbr || '',
        headOfDeptId: initialData.headOfDeptId || null,
        description: initialData.description || '',
        totalAssets: initialData.totalAssets || 0
      });
    } else {
      setFormData({
        name: '',
        abbr: '',
        headOfDeptId: null,
        description: '',
        totalAssets: 0
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-blue-600 p-6 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{initialData ? 'Edit Department' : 'New Department'}</h3>
              <p className="text-blue-100 text-xs mt-0.5">Manage administrative units and asset grouping.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 md:p-8 custom-scrollbar">
          <form id="department-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Department Name</label>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                  <input 
                    required
                    placeholder="e.g. Faculty of Engineering"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Abbreviation</label>
                <input 
                  required
                  placeholder="e.g. FENG"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={formData.abbr}
                  onChange={e => setFormData({ ...formData, abbr: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Head of Department</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                  <input 
                    placeholder="Name of Head/Dean"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    value={formData.headOfDeptId || ''}
                    onChange={e => setFormData({ ...formData, headOfDeptId: e.target.value || null })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Total Assets</label>
                <div className="relative">
                  <Boxes className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                  <input 
                    required
                    type="number"
                    min="0"
                    placeholder="e.g. 1500"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    value={formData.totalAssets}
                    onChange={e => setFormData({ ...formData, totalAssets: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Mapped From (Source Names)</label>
              {(() => {
                const sources = departmentMappings.filter(m => m.targetDepartmentId === initialData?.id);
                if (sources.length === 0) return (
                  <p className="text-xs text-slate-400 italic px-1">No mapping rules point to this department yet.</p>
                );
                return (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-blue-800 leading-relaxed">
                    {sources.map(m => m.sourceName).join(', ')}
                  </div>
                );
              })()}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Description</label>
              <div className="relative">
                <FileText className="absolute left-4 top-3.5 text-slate-300 w-4 h-4" />
                <textarea 
                  placeholder="Main campus administrative office..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm min-h-[100px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 md:p-8 border-t border-slate-100 bg-slate-50/50 flex flex-col-reverse sm:flex-row gap-4 shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-100 transition-all active:scale-95 shadow-sm"
          >
            Cancel
          </button>
          <button 
            type="submit"
            form="department-form"
            className="flex-[2] py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-500/20"
          >
            {initialData ? 'Save Changes' : 'Create Department'}
          </button>
        </div>
      </div>
    </div>
  );
};
