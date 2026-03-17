
import React, { useState, useMemo, useEffect } from 'react';
import { Department, User, AuditGroup } from '../types';
import { X, Building2, User as UserIcon, FileText, Search, ChevronDown, Boxes, Layers } from 'lucide-react';

interface DepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dept: Omit<Department, 'id'> | Partial<Department>) => void;
  initialData?: Department | null;
  users: User[];
  isAdmin: boolean;
  auditGroups?: AuditGroup[];
}

export const DepartmentModal: React.FC<DepartmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  users,
  isAdmin,
  auditGroups = []
}) => {
  const [formData, setFormData] = useState({
    name: '',
    abbr: '',
    headOfDeptId: '',
    description: '',
    totalAssets: 0,
    auditGroupId: ''
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isHeadDropdownOpen, setIsHeadDropdownOpen] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        abbr: initialData.abbr || '',
        headOfDeptId: initialData.headOfDeptId || '',
        description: initialData.description || '',
        totalAssets: initialData.totalAssets || 0,
        auditGroupId: initialData.auditGroupId || ''
      });
    } else {
      setFormData({
        name: '',
        abbr: '',
        headOfDeptId: '',
        description: '',
        totalAssets: 0,
        auditGroupId: ''
      });
    }
    setSearchQuery('');
    setIsHeadDropdownOpen(false);
  }, [initialData, isOpen]);

  const filteredHeads = useMemo(() => {
    let base = users;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      base = base.filter(u => 
        u.name.toLowerCase().includes(q) || 
        u.id.toLowerCase().includes(q)
      );
    }
    
    return [...base].sort((a, b) => a.name.localeCompare(b.name));
  }, [users, searchQuery]);

  const selectedHead = useMemo(() => 
    users.find(u => u.id === formData.headOfDeptId),
    [users, formData.headOfDeptId]
  );

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
        <div className="bg-indigo-600 p-6 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{initialData ? 'Edit Department' : 'New Department'}</h3>
              <p className="text-indigo-100 text-xs mt-0.5">Define core organizational unit parameters.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 md:p-8 custom-scrollbar">
          <form id="department-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Row 1: Name & Abbr */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Department Name</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                  <input 
                    required
                    placeholder="e.g. Faculty of Engineering"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
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
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  value={formData.abbr}
                  onChange={e => setFormData({ ...formData, abbr: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
            
            {/* Audit Group Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Consolidation Group (Audit Group)</label>
              <div className="relative">
                <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                <select 
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none font-bold"
                  value={formData.auditGroupId}
                  onChange={e => setFormData({ ...formData, auditGroupId: e.target.value })}
                >
                  <option value="">No Group (Independent Unit)</option>
                  {auditGroups.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              </div>
            </div>

            {/* Row 2: Head of Department */}
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Head Of Department</label>
              <div 
                className={`relative group ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => isAdmin && setIsHeadDropdownOpen(!isHeadDropdownOpen)}
              >
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                <div className={`w-full pl-11 pr-10 py-3 bg-slate-50 border rounded-2xl text-sm font-bold transition-all cursor-pointer flex items-center min-h-[48px] ${isHeadDropdownOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200'}`}>
                  {selectedHead ? (
                    <span className="text-slate-900">{selectedHead.name} <span className="text-slate-400 font-medium ml-1">({selectedHead.id})</span></span>
                  ) : (
                    <span className="text-slate-400 font-medium">Select Head Of Department...</span>
                  )}
                </div>
                <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 transition-transform duration-200 ${isHeadDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isHeadDropdownOpen && (
                <div className="absolute z-[110] left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                      <input 
                        autoFocus
                        placeholder="Search by name or staff ID..."
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredHeads.length > 0 ? (
                      filteredHeads.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full px-4 py-3 text-left hover:bg-indigo-50 transition-colors flex items-center justify-between group"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData({ ...formData, headOfDeptId: u.id });
                            setIsHeadDropdownOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          <div>
                            <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-700">{u.name}</div>
                            <div className="text-[10px] text-slate-400 font-medium">{u.id} • {u.roles.join(', ')}</div>
                          </div>
                          {formData.headOfDeptId === u.id && (
                            <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-sm shadow-indigo-500/50"></div>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-center bg-white">
                        <UserIcon className="w-8 h-8 text-slate-100 mx-auto mb-2" />
                        <p className="text-xs text-slate-400 font-bold">No users found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Row 3: Total Assets & Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Initial/Manual Asset Count</label>
                <div className="relative">
                  <Boxes className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                  <input 
                    type="number"
                    min="0"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    value={formData.totalAssets}
                    onChange={e => setFormData({ ...formData, totalAssets: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Notes / Mission</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-3.5 text-slate-300 w-4 h-4" />
                  <textarea 
                    placeholder="Brief description of the department..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm min-h-[48px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
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
            Discard Changes
          </button>
          <button 
            type="submit"
            form="department-form"
            className="flex-[2] py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-indigo-700 transition-all active:scale-95 shadow-xl shadow-indigo-500/20"
          >
            {initialData ? 'Save Modifications' : 'Initialize Department'}
          </button>
        </div>
      </div>
    </div>
  );
};
