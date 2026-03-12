
import React, { useState, useEffect } from 'react';
import { KPITier, AuditPhase } from '../types';
import { Save, Info } from 'lucide-react';

interface KPISettingsProps {
  tiers: KPITier[];
  phases: AuditPhase[];
  onAddTier: (tier: Omit<KPITier, 'id'>) => void;
  onUpdateTier: (id: string, updates: Partial<KPITier>) => void;
  onDeleteTier: (id: string) => void;
}

const TIER_LABELS = ['Small', 'Medium', 'Large'] as const;
const TIER_COLORS = [
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', focus: 'focus:ring-emerald-500/20 focus:border-emerald-400' },
  { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200',   focus: 'focus:ring-amber-500/20 focus:border-amber-400'   },
  { bg: 'bg-rose-100',    text: 'text-rose-700',     border: 'border-rose-200',    focus: 'focus:ring-rose-500/20 focus:border-rose-400'     },
];

export const KPISettings: React.FC<KPISettingsProps> = ({ tiers, phases, onUpdateTier }) => {
  const sortedTiers = [...tiers].sort((a, b) => a.minAssets - b.minAssets);
  const sortedPhases = [...phases].sort((a, b) => a.startDate.localeCompare(b.startDate));

  const smallTier  = sortedTiers[0];
  const mediumTier = sortedTiers[1];
  const largeTier  = sortedTiers[2];

  // Threshold inputs
  const [mediumStart, setMediumStart] = useState<number>(mediumTier?.minAssets ?? 101);
  const [largeStart,  setLargeStart]  = useState<number>(largeTier?.minAssets  ?? 501);
  const [thresholdsDirty, setThresholdsDirty] = useState(false);

  // Per-tier per-phase target inputs (visit counts)
  const [localTargets, setLocalTargets] = useState<Record<string, Record<string, number>>>({});
  const [targetsDirty, setTargetsDirty] = useState(false);

  // Sync thresholds when tiers load/change
  useEffect(() => {
    if (mediumTier) setMediumStart(mediumTier.minAssets);
    if (largeTier)  setLargeStart(largeTier.minAssets);
    setThresholdsDirty(false);
  }, [mediumTier?.minAssets, largeTier?.minAssets]);

  // Sync local targets when tiers load/change
  useEffect(() => {
    const init: Record<string, Record<string, number>> = {};
    tiers.forEach(t => { init[t.id] = { ...t.targets }; });
    setLocalTargets(init);
    setTargetsDirty(false);
  }, [tiers]);

  const handleThresholdChange = (field: 'medium' | 'large', val: string) => {
    const num = Math.max(1, parseInt(val) || 1);
    if (field === 'medium') {
      setMediumStart(num);
      if (num >= largeStart) setLargeStart(num + 1);
    } else {
      setLargeStart(Math.max(num, mediumStart + 1));
    }
    setThresholdsDirty(true);
  };

  const handleSaveThresholds = () => {
    if (!smallTier || !mediumTier || !largeTier) return;
    const safeL = Math.max(largeStart, mediumStart + 1);
    onUpdateTier(smallTier.id,  { minAssets: 0,          maxAssets: mediumStart - 1 });
    onUpdateTier(mediumTier.id, { minAssets: mediumStart, maxAssets: safeL - 1      });
    onUpdateTier(largeTier.id,  { minAssets: safeL,       maxAssets: 1000000        });
    setThresholdsDirty(false);
  };

  const handleTargetChange = (tierId: string, phaseId: string, val: string) => {
    const num = Math.max(0, parseInt(val) || 0);
    setLocalTargets(prev => ({
      ...prev,
      [tierId]: { ...(prev[tierId] || {}), [phaseId]: num },
    }));
    setTargetsDirty(true);
  };

  const handleSaveTargets = () => {
    sortedTiers.forEach(tier => {
      if (localTargets[tier.id]) {
        onUpdateTier(tier.id, { targets: localTargets[tier.id] });
      }
    });
    setTargetsDirty(false);
  };

  const formatRange = (min: number, max?: number) =>
    max === undefined || max >= 1000000
      ? `${min.toLocaleString()} +`
      : `${min.toLocaleString()} – ${max.toLocaleString()}`;

  if (!smallTier || !mediumTier || !largeTier) {
    return (
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-8 mt-8">
        <p className="text-sm text-slate-400 italic text-center py-4">Loading tier configuration…</p>
      </div>
    );
  }

  const computedSmallMax  = mediumStart - 1;
  const computedMediumMax = Math.max(largeStart, mediumStart + 1) - 1;
  const computedLargeMin  = Math.max(largeStart, mediumStart + 1);

  return (
    <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden p-8 mt-8">

      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-slate-900">Completion KPI Targets</h3>
        <p className="text-sm text-slate-500 mt-1">
          Set 2 size thresholds to split departments into Small, Medium, and Large tiers.
          Then set how many audit visits are required per tier per phase.
        </p>
      </div>

      {/* ── Threshold Section ── */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 mb-8">
        <h4 className="text-sm font-bold text-slate-700 mb-1">Department Size Thresholds</h4>
        <p className="text-xs text-slate-400 mb-5">
          Departments are automatically categorised based on their total asset count.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {/* Small — always 0 */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase inline-block mb-2">
              Small
            </span>
            <p className="text-xs text-slate-600 font-medium">
              0 – {computedSmallMax.toLocaleString()} assets
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Starts at 0 (fixed)</p>
          </div>

          {/* Medium threshold */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black">Medium</span>
              starts at (assets)
            </label>
            <input
              type="number"
              min="1"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none"
              value={mediumStart}
              onChange={e => handleThresholdChange('medium', e.target.value)}
            />
            <p className="text-[11px] text-slate-400">
              Range: {mediumStart.toLocaleString()} – {computedMediumMax.toLocaleString()}
            </p>
          </div>

          {/* Large threshold */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black">Large</span>
              starts at (assets)
            </label>
            <input
              type="number"
              min={mediumStart + 1}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 outline-none"
              value={largeStart}
              onChange={e => handleThresholdChange('large', e.target.value)}
            />
            <p className="text-[11px] text-slate-400">
              Range: {computedLargeMin.toLocaleString()} and above
            </p>
          </div>
        </div>

        {thresholdsDirty && (
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handleSaveThresholds}
              className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/10 hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Thresholds
            </button>
            <button
              onClick={() => {
                setMediumStart(mediumTier.minAssets);
                setLargeStart(largeTier.minAssets);
                setThresholdsDirty(false);
              }}
              className="px-5 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* ── Audit Visit Requirements Table ── */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h4 className="text-sm font-bold text-slate-700">Audit Visit Requirements per Phase</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              How many audit visits a department in each tier must complete per phase. Enter 0 to skip that phase for the tier.
            </p>
          </div>
          {targetsDirty && (
            <button
              onClick={handleSaveTargets}
              className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/10 hover:bg-blue-700 transition-colors flex items-center gap-2 shrink-0"
            >
              <Save className="w-4 h-4" /> Save Targets
            </button>
          )}
        </div>

        {sortedPhases.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 text-center">
            <p className="text-sm text-slate-400 italic">
              Add audit phases in the Phases section above to set visit requirements.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
            <table className="w-full text-left min-w-[520px]">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-400 tracking-widest w-28">Tier</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-400 tracking-widest w-44">Asset Range</th>
                  {sortedPhases.map(phase => (
                    <th key={phase.id} className="px-4 py-3.5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">
                      {phase.name}
                      <span className="block text-[9px] font-normal normal-case opacity-60 mt-0.5">visits req.</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { tier: smallTier,  label: 'Small',  colors: TIER_COLORS[0], range: formatRange(0, computedSmallMax)  },
                  { tier: mediumTier, label: 'Medium', colors: TIER_COLORS[1], range: formatRange(mediumStart, computedMediumMax) },
                  { tier: largeTier,  label: 'Large',  colors: TIER_COLORS[2], range: formatRange(computedLargeMin)      },
                ].map(({ tier, label, colors, range }) => (
                  <tr key={tier.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black ${colors.bg} ${colors.text}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-slate-500 font-mono">{range}</span>
                    </td>
                    {sortedPhases.map(phase => {
                      const val = localTargets[tier.id]?.[phase.id] ?? tier.targets[phase.id] ?? 0;
                      return (
                        <td key={phase.id} className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="99"
                            className="w-16 mx-auto px-2 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none block"
                            value={val === 0 ? '' : val}
                            placeholder="0"
                            onChange={e => handleTargetChange(tier.id, phase.id, e.target.value)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="mt-6 flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          <strong>How tiers work:</strong> When generating an audit schedule, each department's total asset count is matched
          against the thresholds above. The matched tier's visit requirements are used to determine how many audits to
          schedule per phase.
        </p>
      </div>
    </div>
  );
};
