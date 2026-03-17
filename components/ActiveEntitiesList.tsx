
import React from 'react';

interface Entity {
  name: string;
  assets: number;
  auditors: number;
  memberCount: number;
  members: any[];
  isJoint: boolean;
}

interface ActiveEntitiesListProps {
  entities: Entity[];
  selectedEntity: string;
  onSelect: (name: string) => void;
  megaTargetThreshold: number;
  minAuditors: number;
}

export const ActiveEntitiesList: React.FC<ActiveEntitiesListProps> = ({
  entities,
  selectedEntity,
  onSelect,
  megaTargetThreshold,
  minAuditors
}) => {
  return (
    <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden mt-12">
      <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Active Entities (Ranked by Assets)</h3>
          <p className="text-sm text-slate-500">Live visualization of audit entities and resource strength.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Updates</span>
        </div>
      </div>

      <div className="p-8">
        <div className="flex overflow-x-auto gap-3 pb-4 scrollbar-thin scrollbar-thumb-slate-200">
          {entities.sort((a, b) => b.assets - a.assets).map((entity, idx) => {
            const isMega = entity.assets >= megaTargetThreshold;
            const isSafe = entity.auditors >= minAuditors;
            const isSelected = selectedEntity === entity.name;

            return (
              <button
                key={entity.name}
                onClick={() => onSelect(entity.name)}
                className={`px-5 py-4 rounded-2xl text-sm font-bold whitespace-nowrap transition-all border flex flex-col items-start min-w-[200px] relative group ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <div className="flex justify-between w-full mb-2">
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>Rank #{idx + 1}</span>
                </div>
                <span className="truncate w-full text-left mb-3 text-base">{entity.name}</span>

                <div className={`flex gap-4 w-full border-t pt-3 ${isSelected ? 'border-white/10' : 'border-slate-100'}`}>
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase opacity-70">Assets</span>
                    <span className="text-xs">{entity.assets.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase opacity-70">Auditors</span>
                    <span className={`text-xs ${!isSafe && !isSelected ? 'text-red-500' : ''}`}>{entity.auditors}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
