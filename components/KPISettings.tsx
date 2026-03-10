
import React, { useState } from 'react';
import { KPITier, AuditPhase } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { Lock, Plus, Check, X, Pencil, Trash2 } from 'lucide-react';

interface KPISettingsProps {
  tiers: KPITier[];
  phases: AuditPhase[];
  onAddTier: (tier: Omit<KPITier, 'id'>) => void;
  onUpdateTier: (id: string, updates: Partial<KPITier>) => void;
  onDeleteTier: (id: string) => void;
}

export const KPISettings: React.FC<KPISettingsProps> = ({ tiers, phases, onAddTier, onUpdateTier, onDeleteTier }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tierToDelete, setTierToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ name: string, minAssets: number, maxAssets: number, targets: Record<string, number> }>({
    name: '', minAssets: 0, maxAssets: 0, targets: {}
  });

  // Constraints: Number of tiers is capped at 4.
  const maxAllowedTiers = 4;
  const isMaxTiersReached = (tiers?.length || 0) >= maxAllowedTiers;

  const sortedPhases = [...phases].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const sortedTiers = [...tiers].sort((a, b) => a.minAssets - b.minAssets);

  const startEdit = (tier: KPITier) => {
    setIsAdding(false);
    setEditingId(tier.id);

    // Find previous tier to determine minAssets
    const tierIndex = sortedTiers.findIndex(t => t.id === tier.id);
    const calculatedMin = tierIndex > 0 ? sortedTiers[tierIndex - 1].maxAssets + 1 : 0;

    setFormData({
      name: tier.name,
      minAssets: calculatedMin,
      maxAssets: tier.maxAssets,
      targets: { ...tier.targets }
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({ name: '', minAssets: 0, maxAssets: 0, targets: {} });
  };

  const handleAddClick = () => {
    const nextMin = sortedTiers.length > 0 ? sortedTiers[sortedTiers.length - 1].maxAssets + 1 : 0;
    setFormData({
      name: '',
      minAssets: nextMin,
      maxAssets: nextMin + 500, // Default range
      targets: {}
    });
    setIsAdding(true);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      onUpdateTier(editingId, formData);
    } else {
      onAddTier(formData);
    }
    resetForm();
  };

  const handleTargetChange = (phaseId: string, value: string) => {
    const numVal = Math.min(100, Math.max(0, parseInt(value) || 0));
    setFormData(prev => ({
      ...prev,
      targets: {
        ...prev.targets,
        [phaseId]: numVal
      }
    }));
  };

  const handleDeleteClick = (id: string) => {
    setTierToDelete(id);
  };

  const confirmDelete = () => {
    if (tierToDelete) {
      onDeleteTier(tierToDelete);
      setTierToDelete(null);
    }
  };

  return (
    <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden p-8 mt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Completion KPI Targets</h3>
          <p className="text-sm text-slate-500">
            Define up to {maxAllowedTiers} asset tiers.
          </p>
        </div>
        {/* Add Tier removed - fixed to 3 tiers */}
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-3xl border border-slate-200 mb-6 animate-in fade-in slide-in-from-top-2">
          <h4 className="text-sm font-bold text-slate-700 mb-4">Create New Asset Tier</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Tier Name</label>
              <input
                readOnly
                disabled
                className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed outline-none"
                value={formData.name}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                Min Assets
                <span className="text-[8px] font-normal lowercase text-slate-400">(Auto-calculated)</span>
              </label>
              <input
                readOnly
                type="number"
                className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed outline-none"
                value={formData.minAssets}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Max Assets</label>
              <input
                required
                type="number"
                min={formData.minAssets + 1}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                value={formData.maxAssets}
                onChange={e => setFormData({ ...formData, maxAssets: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Completion Targets per Phase (%)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sortedPhases.map(phase => (
                <div key={phase.id} className="space-y-1 bg-white p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{phase.name}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      className="w-full bg-transparent border-none text-sm font-bold focus:ring-0 p-0"
                      value={formData.targets[phase.id] ?? ''}
                      onChange={e => handleTargetChange(phase.id, e.target.value)}
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                </div>
              ))}
              {(!sortedPhases || sortedPhases.length === 0) && <p className="text-xs text-slate-400 italic col-span-4">Add audit phases first to set targets.</p>}
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/10 hover:bg-blue-700 transition-colors">
              Save Tier
            </button>
            <button type="button" onClick={resetForm} className="px-6 py-2 bg-white text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors border border-slate-200">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-48">Asset Tier</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-48">Range (Assets)</th>
              {sortedPhases.map(phase => (
                <th key={phase.id} className="px-4 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">
                  {phase.name} <br />
                  <span className="text-[9px] font-normal opacity-70">Target %</span>
                </th>
              ))}
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sortedTiers.map(tier => {
              const isEditing = editingId === tier.id;

              return (
                <tr key={tier.id} className={isEditing ? 'bg-blue-50/30' : 'hover:bg-slate-50/50 transition-colors'}>
                  {/* Tier Name */}
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <input
                        readOnly
                        disabled
                        className="w-full px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 cursor-not-allowed"
                        value={formData.name}
                      />
                    ) : (
                      <span className="font-bold text-slate-900 text-xs">{tier.name}</span>
                    )}
                  </td>

                  {/* Range */}
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          type="number"
                          className="w-16 px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-400 cursor-not-allowed"
                          value={formData.minAssets}
                        />
                        <span className="text-slate-400">-</span>
                        <input
                          type="number"
                          min={formData.minAssets + 1}
                          className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20"
                          value={formData.maxAssets}
                          onChange={e => setFormData({ ...formData, maxAssets: parseInt(e.target.value) })}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 font-mono">
                        {tier.minAssets} - {tier.maxAssets > 1000000 ? '∞' : tier.maxAssets}
                      </span>
                    )}
                  </td>

                  {/* Phase Targets */}
                  {sortedPhases.map(phase => (
                    <td key={phase.id} className="px-4 py-4 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="w-12 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center focus:ring-2 focus:ring-blue-500/20"
                            value={formData.targets[phase.id] ?? ''}
                            placeholder="-"
                            onChange={e => handleTargetChange(phase.id, e.target.value)}
                          />
                          <span className="ml-1 text-[10px] text-slate-400">%</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <span className={`text-xs font-black ${tier.targets[phase.id] ? 'text-slate-700' : 'text-slate-300'}`}>
                            {tier.targets[phase.id] ?? 0}%
                          </span>
                        </div>
                      )}
                    </td>
                  ))}

                  {/* Actions */}
                  <td className="px-6 py-4 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={handleSubmit} className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={resetForm} className="w-8 h-8 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        {/* Delete removed - fixed to 3 tiers */}
                        <button onClick={() => startEdit(tier)} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 flex items-center justify-center transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {(!sortedTiers || sortedTiers.length === 0) && !isAdding && (
              <tr>
                <td colSpan={3 + (sortedPhases?.length || 0)} className="px-6 py-12 text-center text-slate-400 italic">
                  No asset tiers defined. Add a tier to start tracking KPIs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmationModal
        isOpen={!!tierToDelete}
        title="Remove Asset Tier?"
        message="This will delete this KPI tier and all associated phase targets. This action is permanent."
        confirmLabel="Yes, Delete Tier"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setTierToDelete(null)}
        variant="danger"
      />
    </div>
  );
};
