
import React, { useMemo, useState } from 'react';
import { KPITier, AuditPhase, KPITierTarget } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { Lock, Plus, Check, X, Pencil, Trash2 } from 'lucide-react';

interface KPISettingsProps {
  tiers: KPITier[];
  phases: AuditPhase[];
  tierTargets: KPITierTarget[];
  onAddTier: (tier: Omit<KPITier, 'id'>) => void;
  onUpdateTier: (id: string, updates: Partial<KPITier>) => void;
  onDeleteTier: (id: string) => void;
  onUpdateTarget: (tierId: string, phaseId: string, percentage: number) => void;
}

export const KPISettings: React.FC<KPISettingsProps> = ({
  tiers,
  phases,
  tierTargets,
  onAddTier,
  onUpdateTier,
  onDeleteTier,
  onUpdateTarget
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tierToDelete, setTierToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ name: string; minAssets: number; maxAssets: number; targets: Record<string, number> }>({
    name: '',
    minAssets: 0,
    maxAssets: 0,
    targets: {}
  });

  const sortedPhases = [...phases].sort((a,b) => a.startDate.localeCompare(b.startDate));
  const sortedTiers = [...tiers].sort((a, b) => {
    if (a.minAssets !== b.minAssets) return a.minAssets - b.minAssets;
    return a.maxAssets - b.maxAssets;
  });

  const targetsByTier = useMemo(() => {
    // Source of truth is the relational table; this keeps UI consistent even if tiers[] is stale.
    const map = new Map<string, Record<string, number>>();
    for (const row of tierTargets || []) {
      const current = map.get(row.tierId) || {};
      current[row.phaseId] = row.targetPercentage ?? 0;
      map.set(row.tierId, current);
    }
    return map;
  }, [tierTargets]);

  const startEdit = (tier: KPITier) => {
    setEditingId(tier.id);
    
    // Calculate effective minAssets from the preceding tier in the sorted list
    const tierIndex = sortedTiers.findIndex(t => t.id === tier.id);
    const calculatedMin = tierIndex > 0 ? sortedTiers[tierIndex - 1].maxAssets + 1 : 0;

    const currentTargets = targetsByTier.get(tier.id) || tier.targets || {};
    setFormData({
      name: tier.name || '',
      minAssets: calculatedMin, // Force continuity
      maxAssets: tier.maxAssets || 0,
      targets: { ...currentTargets }
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', minAssets: 0, maxAssets: 0, targets: {} });
  };

  const handleTargetChange = (phaseId: string, raw: string) => {
    const value = raw === '' ? 0 : Math.max(0, Math.min(100, Number(raw)));
    setFormData(prev => ({ ...prev, targets: { ...prev.targets, [phaseId]: value } }));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    onUpdateTier(editingId, { maxAssets: formData.maxAssets });
    for (const phase of sortedPhases) {
      const pct = formData.targets[phase.id] ?? 0;
      onUpdateTarget(editingId, phase.id, pct);
    }
    resetForm();
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
            Asset tiers are automatically created when you add an audit phase.
          </p>
        </div>

      </div>

      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-48">Asset Tier</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-48">Range (Assets)</th>
              {sortedPhases.map(phase => (
                <th key={phase.id} className="px-4 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">
                  {phase.name} <br/>
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
                         className="w-full px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-400 cursor-not-allowed outline-none"
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
                            onChange={e => setFormData({...formData, maxAssets: parseInt(e.target.value)})}
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
                            <span className={`text-xs font-black ${(targetsByTier.get(tier.id)?.[phase.id] ?? tier.targets?.[phase.id] ?? 0) ? 'text-slate-700' : 'text-slate-300'}`}>
                              {targetsByTier.get(tier.id)?.[phase.id] ?? tier.targets?.[phase.id] ?? 0}%
                            </span>
                         </div>
                       )}
                    </td>
                  ))}

                  {/* Actions */}
                  <td className="px-6 py-4 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={saveEdit} className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={resetForm} className="w-8 h-8 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300">
                           <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(tier)} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 flex items-center justify-center transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        {/* Remove Delete button to lock to 3 tiers */}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {(!sortedTiers || sortedTiers.length === 0) && (
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
