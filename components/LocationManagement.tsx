import React, { useState, useMemo } from 'react';
import { Location, UserRole, Department, User, AuditPhase } from '../types';
import { Network, ChevronDown, MapPin, Landmark, User as UserIcon, Phone, Pencil, Trash2, MapPinned, Building2, Layers, Plus } from 'lucide-react';
import { LocationModal } from './LocationModal';
import { PageHeader } from './PageHeader';

interface LocationManagementProps {
  locations: Location[];
  departments: Department[];
  users: User[];
  userRoles: UserRole[];
  userDeptId?: string;
  onAdd: (loc: Omit<Location, 'id'>) => void;
  onUpdate: (id: string, loc: Partial<Location>) => void;
  onDelete: (id: string) => void;
  phases?: AuditPhase[];
}

export const LocationManagement: React.FC<LocationManagementProps> = ({ 
  locations, departments, users, userRoles, userDeptId, onAdd, onUpdate, onDelete, phases = [] 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
  const [selectedBlockFilter, setSelectedBlockFilter] = useState('All');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('All');

  const LEVELS = ["FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", "FOURTH FLOOR", "FIFTH FLOOR"];

  const isAdmin = userRoles.includes('Admin');
  const isCoordinator = userRoles.includes('Coordinator');
  const isSupervisor = userRoles.includes('Supervisor');

  const filteredLocations = useMemo(() => {
    let base = (isCoordinator && !isAdmin)
      ? locations.filter(l => l.departmentId === userDeptId) 
      : locations;

    if (selectedDeptFilter !== 'All') {
      base = base.filter(l => l.departmentId === selectedDeptFilter);
    }
    if (selectedBlockFilter !== 'All') {
      base = base.filter(l => l.building === selectedBlockFilter);
    }
    if (selectedLevelFilter !== 'All') {
      base = base.filter(l => l.level === selectedLevelFilter);
    }

    return [...base].sort((a, b) => {
      if (a.departmentId !== b.departmentId) {
        return a.departmentId.localeCompare(b.departmentId);
      }
      const buildingA = a.building || '';
      const buildingB = b.building || '';
      if (buildingA !== buildingB) {
        return buildingA.localeCompare(buildingB);
      }
      const indexA = LEVELS.indexOf(a.level || '');
      const indexB = LEVELS.indexOf(b.level || '');
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      return (a.level || '').localeCompare(b.level || '');
    });
  }, [locations, isCoordinator, isAdmin, userDeptId, selectedDeptFilter, selectedBlockFilter, selectedLevelFilter]);

  const availableBlocks = useMemo(() => {
    let base = (isCoordinator && !isAdmin) ? locations.filter(l => l.departmentId === userDeptId) : locations;
    if (selectedDeptFilter !== 'All') base = base.filter(l => l.departmentId === selectedDeptFilter);
    return Array.from(new Set(base.map(l => l.building).filter(Boolean))).sort();
  }, [locations, isCoordinator, isAdmin, userDeptId, selectedDeptFilter]);

  const availableLevels = useMemo(() => {
    let base = (isCoordinator && !isAdmin) ? locations.filter(l => l.departmentId === userDeptId) : locations;
    if (selectedDeptFilter !== 'All') base = base.filter(l => l.departmentId === selectedDeptFilter);
    if (selectedBlockFilter !== 'All') base = base.filter(l => l.building === selectedBlockFilter);
    return Array.from(new Set(base.map(l => l.level).filter(Boolean))).sort((a: any, b: any) => {
      const indexA = LEVELS.indexOf(a || '');
      const indexB = LEVELS.indexOf(b || '');
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      return (a || '').localeCompare(b || '');
    });
  }, [locations, isCoordinator, isAdmin, userDeptId, selectedDeptFilter, selectedBlockFilter]);

  const handleSave = (data: Omit<Location, 'id'> | Partial<Location>) => {
    if (editingLocation) {
      onUpdate(editingLocation.id, data as Partial<Location>);
    } else {
      onAdd(data as Omit<Location, 'id'>);
    }
  };

  const startEdit = (loc: Location) => {
    setEditingLocation(loc);
    setIsModalOpen(true);
  };

  const startAdd = () => {
    setEditingLocation(null);
    setIsModalOpen(true);
  };

  // Helper to get consistent color for departments
  const getColorIndex = (str: string) => {
    let hash = 0;
    for (let i = 0; i < (str?.length || 0); i++) {
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

  const activePhase = useMemo(() => {
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
        title="Location Nodes"
        icon={MapPin}
        activePhase={activePhase}
        description={(isCoordinator && !isAdmin) ? `Managing locations for ${userDeptId}` : 'Institutional site mapping and audit execution points.'}
      >
        {(isAdmin || (isCoordinator && !isAdmin)) && (
          <button 
            onClick={startAdd}
            className={`px-4 py-2 rounded-2xl text-[13px] font-bold shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap active:scale-95 ${
              activePhase 
                ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20 shadow-none' 
                : 'bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-700'
            }`}
          >
            <Plus className="w-4 h-4" />
            New Location
          </button>
        )}
      </PageHeader>

      {/* FILTERS BAR */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-2 rounded-[24px] border border-slate-100 shadow-sm sm:w-fit">
        {isAdmin && (
          <div className="relative min-w-[180px] w-full sm:w-auto">
            <Network className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
            <select
              className="w-full pl-10 pr-8 py-2 bg-slate-50/50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10 outline-none transition-all appearance-none cursor-pointer hover:bg-white"
              value={selectedDeptFilter}
              onChange={(e) => {
                setSelectedDeptFilter(e.target.value);
                setSelectedBlockFilter('All');
                setSelectedLevelFilter('All');
              }}
            >
              <option value="All">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3 pointer-events-none" />
          </div>
        )}

        <div className="relative min-w-[140px] w-full sm:w-auto">
          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
          <select
            className="w-full pl-10 pr-8 py-2 bg-slate-50/50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10 outline-none transition-all appearance-none cursor-pointer hover:bg-white"
            value={selectedBlockFilter}
            onChange={(e) => {
              setSelectedBlockFilter(e.target.value);
              setSelectedLevelFilter('All');
            }}
          >
            <option value="All">All Blocks</option>
            {availableBlocks.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3 pointer-events-none" />
        </div>

        <div className="relative min-w-[140px] w-full sm:w-auto">
          <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
          <select
            className="w-full pl-10 pr-8 py-2 bg-slate-50/50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10 outline-none transition-all appearance-none cursor-pointer hover:bg-white"
            value={selectedLevelFilter}
            onChange={(e) => setSelectedLevelFilter(e.target.value)}
          >
            <option value="All">All Levels</option>
            {availableLevels.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3 pointer-events-none" />
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-left">Location Details</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-left w-[220px]">Supervisor Name / Contact</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center w-[120px]">Total Assets</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-left w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLocations.map(loc => {
                 const dept = departments.find(d => d.id === loc.departmentId);
                 const colorClass = AVATAR_COLORS[getColorIndex(dept?.name || loc.departmentId) % AVATAR_COLORS.length];
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
                          <div className="mt-1.5 text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                            <Landmark className="w-3.5 h-3.5" />
                            {dept?.name || loc.departmentId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="flex flex-col gap-1">
                        {loc.supervisorId ? (
                            <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                                    <UserIcon className="w-3 h-3" />
                                </div>
                                {users.find(u => u.id === loc.supervisorId)?.name || loc.supervisorId}
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
                    <td className="px-6 py-4 align-middle">
                      {(isAdmin || isCoordinator || isSupervisor) && (
                        <div className="flex gap-1">
                          {(isAdmin || isCoordinator || isSupervisor) && (
                            <button onClick={() => startEdit(loc)} className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-colors" title={isSupervisor && !isAdmin && !isCoordinator ? 'Edit Block / Level / Total Assets' : 'Edit Location'}>
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {(isAdmin || isCoordinator) && (
                            <button onClick={() => onDelete(loc.id)} className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 rounded-xl transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
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
                      <p className="text-xs text-slate-500">No records match your current criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LocationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingLocation}
        departments={departments}
        users={users}
        isAdmin={isAdmin}
        isCoordinator={isCoordinator}
        isSupervisor={isSupervisor && !isAdmin && !isCoordinator}
        userDeptId={userDeptId}
      />
    </div>
  );
};
