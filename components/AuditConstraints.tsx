import React from 'react';

interface AuditConstraintsProps {
  maxAssetsPerDay: number;
  onUpdateMaxAssetsPerDay: (value: number) => void;
}

export const AuditConstraints: React.FC<AuditConstraintsProps> = ({
  maxAssetsPerDay,
  onUpdateMaxAssetsPerDay,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
      <h3 className="text-xl font-bold text-slate-900 mb-2">Audit Constraints</h3>
      <p className="text-sm text-slate-500 mb-6">Configure daily audit limits.</p>
      
      <div className="space-y-4">
        <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Max Assets Per Day</label>
        <input 
          type="number"
          min="0"
          className="w-full md:w-64 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
          value={maxAssetsPerDay}
          onChange={(e) => onUpdateMaxAssetsPerDay(parseInt(e.target.value, 10) || 0)}
        />
      </div>
    </div>
  );
};
