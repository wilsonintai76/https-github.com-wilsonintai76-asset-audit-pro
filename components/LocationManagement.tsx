
import React, { useState, useMemo } from 'react';
import { Location, Department, User, UserRole } from '../types';
import { Network, ChevronDown, MapPin, Landmark, User as UserIcon, Phone, Pencil, Trash2, MapPinned } from 'lucide-react';

interface LocationManagementProps {
  locations: Location[];
  departments: Department[];
  users: User[];
  userRoles: UserRole[];
  userDeptId?: string;
  onAdd: (loc: Omit<Location, 'id'>) => void;
  onUpdate: (id: string, loc: Partial<Location>) => void;
  onDelete: (id: string) => void;
}

export const LocationManagement: React.FC<LocationManagementProps> = ({ 
  locations, departments, users, userRoles, userDeptId, onAdd, onUpdate, onDelete 
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
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

  const LEVELS = ["FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", "FOURTH FLOOR", "FIFTH FLOOR"];

  const isAdmin = userRoles.includes('Admin');
  const isCoordinator = userRoles.includes('Coordinator');

  // Lookup maps for display
  const deptIdToName = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);
  const userIdToName = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users]);

  const filteredLocations = useMemo(() => {
    let base = (isCoordinator && !isAdmin)
      ? locations.filter(l => l.departmentId === userDeptId)
      : locations;

    if (selectedDeptFilter !== 'All') {
      base = base.filter(l => deptIdToName.get(l.departmentId) === selectedDeptFilter);
    }

    return [...base].sort((a, b) => {
      const deptA = deptIdToName.get(a.departmentId) ?? '';
      const deptB = deptIdToName.get(b.departmentId) ?? '';
      if (deptA !== deptB) return deptA.localeCompare(deptB);
      const buildingA = a.building || '';
      const buildingB = b.building || '';
      if (buildingA !== buildingB) return buildingA.localeCompare(buildingB);
      const levelA = a.level || '';
      const levelB = b.level || '';
      const indexA = LEVELS.indexOf(levelA);
      const indexB = LEVELS.indexOf(levelB);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      return levelA.localeCompare(levelB);
    });
  }, [locations, isCoordinator, isAdmin, userDeptId, selectedDeptFilter, deptIdToName]);

  const emptyForm = () => ({
    name: '', abbr: '',
    departmentId: userDeptId || '',
    building: '', level: '', description: '',
    supervisorId: '', contact: '', totalAssets: 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalData: Omit<Location, 'id'> = {
      name:         formData.name,
      abbr:         formData.abbr,
      departmentId: isAdmin ? formData.departmentId : (userDeptId || formData.departmentId),
      building:     formData.building,
      level:        formData.level,
      description:  formData.description,
      supervisorId: formData.supervisorId || '',
      contact:      formData.contact,
      totalAssets:  formData.totalAssets,
    };
    if (editingId) {
      onUpdate(editingId, finalData);
      setEditingId(null);
    } else {
      onAdd(finalData);
      setIsAdding(false);
    }
    setFormData(emptyForm());
  };

  const startEdit = (loc: Location) => {
    setEditingId(loc.id);
    setFormData({
      name:         loc.name,
      abbr:         loc.abbr || '',
      departmentId: loc.departmentId,
      building:     loc.building,
      level:        loc.level || '',
      description:  loc.description || '',
      supervisorId: loc.supervisorId || '',
      contact:      loc.contact || '',
      totalAssets:  loc.totalAssets || 0
    });
    setIsAdding(true);
  };

  // Helper to get consistent color for departments
  const getColorIndex = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  const AVATAR_COLORS = [
    'bg-blue-100 text-blue-600 border-blue-200',
    'bg-emerald-100 text-emerald-600 border-emerald-200',
    'bg-indigo-100 text-indigo-600 border-indigo-200',
    'bg-purple-100 text-purple-600 border-purple-200',
    'bg-amber-100 text-amber-600 border-amber-200',
    'bg-rose-100 text-rose-600 border-rose-200',
    'bg-cyan-100 text-cyan-600 border-cyan-200',
    'bg-slate-100 text-slate-600 border-slate-200'
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Audit Locations</h3>
          <p className="text-sm text-slate-500">
            {(isCoordinator && !isAdmin) ? `Managing locations for ${userDept}` : 'Institutional site mapping and asset nodes.'}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Department Filter - Only show if user has access to multiple departments (Admins) */}
          {isAdmin && (
            <div className="relative min-w-[200px] w-full sm:w-auto">
              <Network className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <select
                className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm appearance-none cursor-pointer"
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
              >
                <option value="All">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3 pointer-events-none" />
            </div>
          )}

          {!isAdding && (
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={() => { setIsAdding(true); setEditingId(null); setFormData(emptyForm()); }}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                New Location
              </button>
            </div>
          )}
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Location Name</label>
              <input 
                required
                placeholder="e.g. Main Chemistry Lab"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Abbreviation</label>
              <input 
                required
                placeholder="e.g. MCL-01"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                value={formData.abbr}
                onChange={e => setFormData({ ...formData, abbr: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Department</label>
              <select 
                required
                disabled={!isAdmin}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none disabled:opacity-70 focus:ring-2 focus:ring-blue-500/20"
                value={formData.departmentId}
                onChange={e => setFormData({ ...formData, departmentId: e.target.value })}
              >
                <option value="">Select Department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Building / Block</label>
              <input 
                placeholder="e.g. Science Block A"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                value={formData.building}
                onChange={e => setFormData({ ...formData, building: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Level</label>
              <select 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                value={formData.level}
                onChange={e => setFormData({ ...formData, level: e.target.value })}
              >
                <option value="">Select Level</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Site Supervisor</label>
              <select
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                value={formData.supervisorId}
                onChange={e => setFormData({ ...formData, supervisorId: e.target.value })}
              >
                <option value="">— Unassigned —</option>
                {users
                  .filter(u => !formData.departmentId || u.departmentId === formData.departmentId)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Contact Number</label>
              <input 
                required
                type="tel"
                placeholder="Phone / Ext"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                value={formData.contact}
                onChange={e => setFormData({ ...formData, contact: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Total Assets</label>
              <input 
                type="number"
                min="0"
                placeholder="0"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                value={formData.totalAssets}
                onChange={e => setFormData({ ...formData, totalAssets: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/10">
              {editingId ? 'Update' : 'Save'} Location
            </button>
            <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-left">Location Details</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-left w-[220px]">Site Supervisor / Contact</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center w-[120px]">Total Assets</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-left w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLocations.map(loc => {
                 const deptName = deptIdToName.get(loc.departmentId) ?? '';
                 const supervisorName = userIdToName.get(loc.supervisorId ?? '') ?? '';
                 const colorClass = AVATAR_COLORS[getColorIndex(deptName) % AVATAR_COLORS.length];
                 return (
                  <tr key={loc.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black shadow-sm border ${colorClass} shrink-0`}>
                          {loc.abbr}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            {loc.name}
                            {loc.building && <span className="text-[10px] text-slate-400 font-normal italic border-l border-slate-200 pl-2">{loc.building}</span>}
                            {loc.level && <span className="text-[10px] text-slate-400 font-normal italic border-l border-slate-200 pl-2">{loc.level}</span>}
                          </div>
                          <div className="mt-1.5">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded border border-slate-200 flex items-center gap-1 w-fit">
                                <Landmark className="w-3 h-3 opacity-50" />
                                {deptName || loc.departmentId}
                              </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle">
                      <div className="flex flex-col gap-1">
                        {supervisorName ? (
                            <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                                    <UserIcon className="w-3 h-3" />
                                </div>
                                {supervisorName}
                            </div>
                        ) : (
                            <span className="text-[10px] text-slate-400 italic">Unassigned</span>
                        )}
                        {loc.contact && (
                            <div className="text-[10px] text-slate-500 font-medium pl-8 flex items-center gap-1.5">
                                <Phone className="w-3 h-3 opacity-70" />
                                {loc.contact}
                            </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center align-middle">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                        {loc.totalAssets || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-left align-middle">
                      <div className="flex gap-1 justify-start">
                        <button 
                          onClick={() => startEdit(loc)} 
                          className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-colors"
                          title="Edit Location"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onDelete(loc.id)} 
                          className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 rounded-xl transition-colors"
                          title="Remove Location"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredLocations.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center max-w-xs mx-auto">
                      <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 mb-4">
                        <MapPinned className="w-8 h-8" />
                      </div>
                      <h4 className="text-slate-900 font-bold mb-1">No Locations Found</h4>
                      <p className="text-xs text-slate-500">No records match your current department filter or access level.</p>
                      {isAdmin && (
                        <button 
                          onClick={() => setSelectedDeptFilter('All')}
                          className="mt-4 text-xs font-bold text-blue-600 hover:underline"
                        >
                          Show All Departments
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
