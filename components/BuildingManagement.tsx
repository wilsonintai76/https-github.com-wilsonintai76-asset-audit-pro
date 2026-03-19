
import React, { useState } from 'react';
import { Building, Location } from '../types';
import { Plus, Building2, Pencil, Trash2, MapPin, FileText } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { BuildingModal } from './BuildingModal';
import { ConfirmationModal } from './ConfirmationModal';

interface BuildingManagementProps {
  buildings: Building[];
  locations: Location[];
  onAdd: (building: Omit<Building, 'id'>) => Promise<Building | void>;
  onUpdate: (building: Partial<Building>) => Promise<Building | void>;
  onDelete: (id: string) => Promise<void>;
}

export const BuildingManagement: React.FC<BuildingManagementProps> = ({
  buildings,
  locations,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [buildingToDelete, setBuildingToDelete] = useState<Building | null>(null);

  const handleSave = async (data: Omit<Building, 'id'> | Partial<Building>) => {
    if (editingBuilding) {
      await onUpdate({ ...data, id: editingBuilding.id });
    } else {
      await onAdd(data as Omit<Building, 'id'>);
    }
  };

  const startEdit = (building: Building) => {
    setEditingBuilding(building);
    setIsModalOpen(true);
  };

  const startAdd = () => {
    setEditingBuilding(null);
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (buildingToDelete) {
      await onDelete(buildingToDelete.id);
      setBuildingToDelete(null);
    }
  };

  // Helper for colors
  const getColorIndex = (str: string) => {
    let hash = 0;
    for (let i = 0; i < (str?.length || 0); i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash);
  };
  
  const AVATAR_COLORS = [
    'bg-blue-100 text-blue-600 border-blue-200', 
    'bg-emerald-100 text-emerald-600 border-emerald-200',
    'bg-indigo-100 text-indigo-600 border-indigo-200', 
    'bg-purple-100 text-purple-600 border-purple-200',
    'bg-amber-100 text-amber-600 border-amber-200', 
    'bg-rose-100 text-rose-600 border-rose-200'
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Building Registry"
        icon={Building2}
        description="Manage global building and block definitions for all locations."
      >
        <button
          onClick={startAdd}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Building
        </button>
      </PageHeader>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest w-64">Building / Block</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Description</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest w-40 text-center">Linked Locations</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {buildings.map(building => {
                const colorClass = AVATAR_COLORS[getColorIndex(building.name) % AVATAR_COLORS.length];
                const linkedCount = locations.filter(l => l.buildingId === building.id).length;

                return (
                  <tr key={building.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shadow-sm border ${colorClass} shrink-0`}>
                          {building.abbr}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm truncate">{building.name}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{building.abbr}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2 text-[12px] text-slate-600 font-medium max-w-md">
                        <FileText className="w-3.5 h-3.5 mt-0.5 opacity-40 shrink-0" />
                        <span className="line-clamp-2">{building.description || 'No additional details provided'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {linkedCount} Locations
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <button 
                          onClick={() => startEdit(building)} 
                          className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setBuildingToDelete(building)} 
                          className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {buildings.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Building2 className="w-6 h-6" />
                    </div>
                    No buildings defined in the registry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BuildingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingBuilding}
      />

      <ConfirmationModal
        isOpen={!!buildingToDelete}
        title="Decommission Building?"
        message={`Are you sure you want to remove "${buildingToDelete?.name}"? Locations currently linked to this building will lose their reference.`}
        confirmLabel="Yes, Remove"
        cancelLabel="Keep Building"
        onConfirm={confirmDelete}
        onCancel={() => setBuildingToDelete(null)}
        variant="danger"
      />
    </div>
  );
};
