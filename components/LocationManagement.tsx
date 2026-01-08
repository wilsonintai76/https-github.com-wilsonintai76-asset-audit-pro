
import React, { useState, useMemo } from 'react';
import { Location } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';

export const LocationManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const { locations, departments: deptList, addLocation, updateLocation, deleteLocation } = useData();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');

  const userDept = currentUser?.department;
  const userRoles = currentUser?.roles || [];

  const [formData, setFormData] = useState({
    name: '',
    abbr: '',
    department: userDept || '',
    building: '',
    description: '',
    pic: '',
    contact: ''
  });

  const isAdmin = userRoles.includes('Admin');
  const isSupervisor = userRoles.includes('Supervisor');

  const departments = ['All', ...deptList.map(d => d.name)];

  const filteredLocations = useMemo(() => {
    // 1. Initial filter based on permissions (Supervisors only see their own department)
    let base = (isSupervisor && !isAdmin)
      ? locations.filter(l => l.department === userDept)
      : locations;

    // 2. Apply the UI department filter
    if (selectedDeptFilter !== 'All') {
      base = base.filter(l => l.department === selectedDeptFilter);
    }

    return base;
  }, [locations, isSupervisor, isAdmin, userDept, selectedDeptFilter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = {
      ...formData,
      department: isAdmin ? formData.department : (userDept || formData.department)
    };
    if (editingId) {
      updateLocation(editingId, finalData);
      setEditingId(null);
    } else {
      addLocation(finalData);
      setIsAdding(false);
    }
    setFormData({
      name: '',
      abbr: '',
      department: userDept || '',
      building: '',
      description: '',
      pic: '',
      contact: ''
    });
  };

  const startEdit = (loc: Location) => {
    setEditingId(loc.id);
    setFormData({
      name: loc.name,
      abbr: loc.abbr || '',
      department: loc.department,
      building: loc.building,
      description: loc.description,
      pic: loc.pic || '',
      contact: loc.contact || ''
    });
    setIsAdding(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Audit Locations</h3>
          <p className="text-sm text-slate-500">
            {(isSupervisor && !isAdmin) ? `Managing locations for ${userDept}` : 'Institutional site mapping and asset nodes.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Department Filter - Only show if user has access to multiple departments (Admins) */}
          {isAdmin && (
            <div className="relative min-w-[200px] w-full sm:w-auto">
              <i className="fa-solid fa-sitemap absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <select
                className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm appearance-none cursor-pointer"
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
              >
                <option value="All">All Departments</option>
                {departments.filter(d => d !== 'All').map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
            </div>
          )}

          {!isAdding && (
            <button
              onClick={() => { setIsAdding(true); setEditingId(null); setFormData({ name: '', abbr: '', department: userDept || '', building: '', description: '', pic: '', contact: '' }); }}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-location-dot"></i>
              New Location
            </button>
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
                value={formData.department}
                onChange={e => setFormData({ ...formData, department: e.target.value })}
              >
                <option value="">Select Department</option>
                {departments.filter(d => d !== 'All').map(d => <option key={d} value={d}>{d}</option>)}
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
              <label className="text-[10px] font-black uppercase text-slate-400">Person In Charge (PIC)</label>
              <input
                required
                placeholder="Name of PIC"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                value={formData.pic}
                onChange={e => setFormData({ ...formData, pic: e.target.value })}
              />
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
            <div className="space-y-1 lg:col-span-2">
              <label className="text-[10px] font-black uppercase text-slate-400">Short Description</label>
              <input
                placeholder="Brief details about the site"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
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
          <table className="w-full text-left min-w-[900px]">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Location Name</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Abbr</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Department</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Responsible PIC</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Direct Contact</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLocations.map(loc => (
                <tr key={loc.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{loc.name}</div>
                    <div className="text-[10px] text-slate-400 italic">
                      {loc.building ? `${loc.building} • ` : ''}{loc.description}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded border border-blue-100">
                      {loc.abbr}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded border border-slate-200">
                      {loc.department}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-900">{loc.pic || '—'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-500 font-medium">
                      <i className="fa-solid fa-phone text-[10px] mr-1.5 opacity-40"></i>
                      {loc.contact || '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => startEdit(loc)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Location"
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                      </button>
                      <button
                        onClick={() => deleteLocation(loc.id)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove Location"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLocations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center max-w-xs mx-auto">
                      <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 mb-4">
                        <i className="fa-solid fa-map-location-dot text-2xl"></i>
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
