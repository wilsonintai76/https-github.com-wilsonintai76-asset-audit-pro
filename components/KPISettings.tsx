
import React, { useMemo, useState } from 'react';
import { KPITier, AuditPhase, KPITierTarget, Department } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { Lock, Plus, Check, X, Pencil, Trash2, Boxes } from 'lucide-react';

interface KPISettingsProps {
  tiers: KPITier[];
  phases: AuditPhase[];
  tierTargets: KPITierTarget[];
  onAddTier: (tier: Omit<KPITier, 'id'>) => void;
  onUpdateTier: (id: string, updates: Partial<KPITier>) => void;
  onDeleteTier: (id: string) => void;
  onUpdateTarget: (tierId: string, phaseId: string, percentage: number) => void;
  departments: Department[];
}

export const KPISettings: React.FC<KPISettingsProps> = ({
  tiers,
  phases,
  tierTargets,
  departments,
  onAddTier,
  onUpdateTier,
  onDeleteTier,
  onUpdateTarget
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tierToDelete, setTierToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ name: string; minAssets: number; targets: Record<string, number> }>({
    name: '',
    minAssets: 0,
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

  const highestDeptAssets = useMemo(() => {
    let max = 0;
    for (const d of departments) {
      if ((d.totalAssets || 0) > max) max = d.totalAssets || 0;
    }
    return max;
  }, [departments]);

  if (highestDeptAssets === 0) {
    return (
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden p-12 mt-8 text-center animate-in fade-in">
        <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">KPI Configuration Locked</h3>
        <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
          You must upload Departments and Locations first. The system requires real asset data to calculate the benchmark department and automatically generate dynamic percentage tiers.
        </p>
      </div>
    );
  }

  const startEdit = (tier: KPITier) => {
    setEditingId(tier.id);
    const currentTargets = targetsByTier.get(tier.id) || tier.targets || {};
    setFormData({
      name: tier.name || '',
      minAssets: tier.minAssets || 0,
      targets: { ...currentTargets }
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', minAssets: 0, targets: {} });
  };

  const handleTargetChange = (phaseId: string, raw: string) => {
    const value = raw === '' ? 0 : Math.max(0, Math.min(100, Number(raw)));
    setFormData(prev => ({ ...prev, targets: { ...prev.targets, [phaseId]: value } }));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    onUpdateTier(editingId, { minAssets: formData.minAssets });
    for (const phase of sortedPhases) {
      const pct = formData.targets[phase.id] ?? 0;
      onUpdateTarget(editingId, phase.id, pct);
    }
    resetForm();
  };



  const autoBalanceTiers = () => {
    let maxGlobalAssets = 0;
    const validDepts = departments.filter(d => (d.totalAssets || 0) > 0);
    validDepts.forEach(d => {
      if ((d.totalAssets || 0) > maxGlobalAssets) maxGlobalAssets = d.totalAssets || 0;
    });

    if (maxGlobalAssets === 0 || sortedTiers.length < 3) return;

    validDepts.sort((a,b) => (a.totalAssets || 0) - (b.totalAssets || 0));
    const idx33 = Math.floor(validDepts.length * 0.33);
    const idx66 = Math.floor(validDepts.length * 0.66);
    
    const val33 = validDepts[idx33]?.totalAssets || 0;
    const val66 = validDepts[idx66]?.totalAssets || 0;
    
    const p33 = Math.max(1, Math.round((val33 / maxGlobalAssets) * 100));
    const p66 = Math.max(p33 + 1, Math.round((val66 / maxGlobalAssets) * 100));
    
    // Save to database
    onUpdateTier(sortedTiers[1].id, { minAssets: p33 });
    onUpdateTier(sortedTiers[2].id, { minAssets: p66 });
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
            Set percentage boundaries to group your departments into Small, Medium, and Large.
          </p>
        </div>
        <button 
          onClick={autoBalanceTiers}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100/50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-[13px] transition-colors border border-slate-200 shadow-sm"
        >
          <Boxes className="w-4 h-4 text-blue-600" />
          Auto-Balance Tiers
        </button>
      </div>

      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-48">Asset Tier</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-64">Size Threshold (%)</th>
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
            {sortedTiers.map((tier, idx) => {
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
                      <div className="flex items-center gap-1">
                        <input 
                          type="number"
                          min={0}
                          max={100}
                          disabled={tier.id === sortedTiers[0].id}
                          className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-400"
                          value={formData.minAssets}
                          onChange={e => setFormData({...formData, minAssets: parseInt(e.target.value) || 0})}
                        />
                        <span className="text-xs text-slate-400 font-bold">%</span>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700">
                          {tier.minAssets}% 
                          {idx === sortedTiers.length - 1 ? ' and above' : ` to ${(sortedTiers[idx+1]?.minAssets || 100) - 1}%`}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                           ({Math.round(highestDeptAssets * (tier.minAssets / 100))} 
                           {idx === sortedTiers.length - 1 ? ' assets +' : ` to ${Math.round(highestDeptAssets * (((sortedTiers[idx+1]?.minAssets || 100)) / 100)) - 1} assets`})
                        </span>
                      </div>
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
