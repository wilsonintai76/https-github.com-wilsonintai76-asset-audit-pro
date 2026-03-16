
import React, { useState, useMemo, useEffect } from 'react';
import { Location, Department, User } from '../types';
import { X, MapPin, Building2, Layers, User as UserIcon, Phone, FileText, Search, ChevronDown } from 'lucide-react';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (loc: Omit<Location, 'id'> | Partial<Location>) => void;
  initialData?: Location | null;
  departments: Department[];
  users: User[];
  isAdmin: boolean;
  isCoordinator?: boolean;
  isSupervisor?: boolean;
  userDeptId?: string;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  departments,
  users,
  isAdmin,
  isCoordinator,
  isSupervisor,
  userDeptId
}) => {
  const [formData, setFormData] = useState({
    name: '',
    abbr: '',
    departmentId: userDeptId || '',
    building: '',
    level: '',
    description: '',
    supervisorId: '',
    contact: '',
    totalAssets: 0
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isSupervisorDropdownOpen, setIsSupervisorDropdownOpen] = useState(false);

  const LEVELS = ["FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", "FOURTH FLOOR", "FIFTH FLOOR"];

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        abbr: initialData.abbr || '',
        departmentId: initialData.departmentId || userDeptId || '',
        building: initialData.building || '',
        level: initialData.level || '',
        description: initialData.description || '',
        supervisorId: initialData.supervisorId || '',
        contact: initialData.contact || '',
        totalAssets: initialData.totalAssets || 0
      });
    } else {
      setFormData({
        name: '',
        abbr: '',
        departmentId: userDeptId || '',
        building: '',
        level: '',
        description: '',
        supervisorId: '',
        contact: '',
        totalAssets: 0
      });
    }
    setSearchQuery('');
  }, [initialData, isOpen, userDeptId]);

  const filteredSupervisors = useMemo(() => {
    // Filter by department first
    let base = users;
    if (formData.departmentId) {
       base = base.filter(u => u.departmentId === formData.departmentId);
    }
    
    // Then by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      base = base.filter(u => 
        u.name.toLowerCase().includes(q) || 
        u.id.toLowerCase().includes(q)
      );
    }
    
    // Sort by name
    return [...base].sort((a, b) => a.name.localeCompare(b.name));
  }, [users, formData.departmentId, searchQuery]);

  const selectedSupervisor = useMemo(() => 
    users.find(u => u.id === formData.supervisorId),
    [users, formData.supervisorId]
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
        <div className="bg-blue-600 p-6 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{initialData ? 'Edit Location' : 'New Location'}</h3>
              <p className="text-blue-100 text-xs mt-0.5">
                {isSupervisor ? 'Update Building, Level and Asset count for your location.' : 'Define site parameters and node mappings.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 md:p-8 custom-scrollbar">
          {isSupervisor && (
            <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-xs font-bold text-amber-700">Supervisor access — you can update Building / Block, Level, and Total Assets only.</p>
            </div>
          )}
          <form id="location-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Row 1: Name & Abbr */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Location Name</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                  <input 
                    required
                    disabled={isSupervisor}
                    placeholder="e.g. Main Chemistry Lab"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Abbreviation</label>
                <input 
                  required
                  disabled={isSupervisor}
                  placeholder="e.g. MCL-01"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  value={formData.abbr}
                  onChange={e => setFormData({ ...formData, abbr: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            {/* Row 2: Department & Building */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Department</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                  <select 
                    required
                    disabled={!isAdmin}
                    className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer disabled:opacity-60"
                    value={formData.departmentId}
                    onChange={e => setFormData({ ...formData, departmentId: e.target.value, supervisorId: '' })}
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Building / Block</label>
                <input 
                  placeholder="e.g. Science Block A"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={formData.building}
                  onChange={e => setFormData({ ...formData, building: e.target.value })}
                />
              </div>
            </div>

            {/* Row 3: Level & Total Assets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Level</label>
                <div className="relative">
                  <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                  <select 
                    className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                    value={formData.level}
                    onChange={e => setFormData({ ...formData, level: e.target.value })}
                  >
                    <option value="">Select Level</option>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Total Assets</label>
                <input 
                  type="number"
                  min="0"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={formData.totalAssets}
                  onChange={e => setFormData({ ...formData, totalAssets: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Row 4: Searchable Supervisor Selection */}
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Supervisor Name (Department Filtered)</label>
              {isSupervisor ? (
                <div className="w-full pl-11 pr-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-bold text-slate-500 opacity-60 relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                  {selectedSupervisor ? `${selectedSupervisor.name} (${selectedSupervisor.id})` : 'Not assigned'}
                </div>
              ) : (
                <>
                  <div 
                    className={`relative group ${!formData.departmentId ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => formData.departmentId && setIsSupervisorDropdownOpen(!isSupervisorDropdownOpen)}
                  >
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                    <div className={`w-full pl-11 pr-10 py-3 bg-slate-50 border rounded-2xl text-sm font-bold transition-all cursor-pointer flex items-center min-h-[48px] ${isSupervisorDropdownOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'}`}>
                      {selectedSupervisor ? (
                        <span className="text-slate-900">{selectedSupervisor.name} <span className="text-slate-400 font-medium ml-1">({selectedSupervisor.id})</span></span>
                      ) : (
                        <span className="text-slate-400 font-medium">Select Supervisor...</span>
                      )}
                    </div>
                    <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 transition-transform duration-200 ${isSupervisorDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {isSupervisorDropdownOpen && (
                    <div className="absolute z-[110] left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                          <input 
                            autoFocus
                            placeholder="Search by name or staff ID..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredSupervisors.length > 0 ? (
                          filteredSupervisors.map(u => (
                            <button
                              key={u.id}
                              type="button"
                              className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center justify-between group"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormData({ ...formData, supervisorId: u.id, contact: u.contactNumber || formData.contact });
                                setIsSupervisorDropdownOpen(false);
                                setSearchQuery('');
                              }}
                            >
                              <div>
                                <div className="text-sm font-bold text-slate-900 group-hover:text-blue-700">{u.name}</div>
                                <div className="text-[10px] text-slate-400 font-medium">{u.id} • {u.roles.join(', ')}</div>
                              </div>
                              {formData.supervisorId === u.id && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full shadow-sm shadow-blue-500/50"></div>
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-8 text-center bg-white">
                            <UserIcon className="w-8 h-8 text-slate-100 mx-auto mb-2" />
                            <p className="text-xs text-slate-400 font-bold">No supervisors found in this department</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Row 5: Contact & Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Contact Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                  <input 
                    required
                    disabled={isSupervisor}
                    type="tel"
                    placeholder="Phone / Ext"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                    value={formData.contact}
                    onChange={e => setFormData({ ...formData, contact: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Site Notes</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-3.5 text-slate-300 w-4 h-4" />
                  <textarea 
                    disabled={isSupervisor}
                    placeholder="Brief description of the area..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm min-h-[48px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none disabled:opacity-60 disabled:cursor-not-allowed"
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
            form="location-form"
            className="flex-[2] py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-500/20"
          >
            {initialData ? 'Save Modifications' : 'Initialize Location'}
          </button>
        </div>
      </div>
    </div>
  );
};
