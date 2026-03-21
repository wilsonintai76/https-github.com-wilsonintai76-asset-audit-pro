import React from 'react';

interface AuditConstraintsProps {
  maxAssetsPerDay: number;
  onUpdateMaxAssetsPerDay: (value: number) => void;
  maxLocationsPerDay: number;
  onUpdateMaxLocationsPerDay: (value: number) => void;
}

export const AuditConstraints: React.FC<AuditConstraintsProps> = ({
  maxAssetsPerDay,
  onUpdateMaxAssetsPerDay,
  maxLocationsPerDay,
  onUpdateMaxLocationsPerDay,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
      <h3 className="text-xl font-bold text-slate-900 mb-2">Audit Constraints</h3>
      <p className="text-sm text-slate-500 mb-6">Configure institutional limits to determine auditor recommendations.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <label className="text-xs font-black uppercase text-slate-400 tracking-widest block">Max Assets Per Day</label>
          <input 
            type="number"
            min="100"
            step="100"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
            value={maxAssetsPerDay}
            onChange={(e) => onUpdateMaxAssetsPerDay(parseInt(e.target.value, 10) || 1000)}
          />
          <p className="text-[10px] text-slate-400 font-medium">Limits assets a team can audit in 24 hours.</p>
        </div>

        <div className="space-y-4">
          <label className="text-xs font-black uppercase text-slate-400 tracking-widest block">Max Locations Per Day</label>
          <input 
            type="number"
            min="1"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
            value={maxLocationsPerDay}
            onChange={(e) => onUpdateMaxLocationsPerDay(parseInt(e.target.value, 10) || 5)}
          />
          <p className="text-[10px] text-slate-400 font-medium">Limits distinct locations a team can visit daily.</p>
        </div>
      </div>
    </div>
  );
};

