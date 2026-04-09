import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface Entity {
  name: string;
  assets: number;
  auditors: number;
  memberCount: number;
  members: any[];
  isJoint: boolean;
  isConsolidated?: boolean;
}

interface ActiveEntitiesListProps {
  entities: Entity[];
  selectedEntity: string;
  onSelect: (name: string) => void;
  megaTargetThreshold: number;
  minAuditors: number;
  overallTotal?: number;
  threshold: number;
  strictAuditorRule: boolean;
  maxLocationsPerDay?: number;
}

export const ActiveEntitiesList: React.FC<ActiveEntitiesListProps> = ({
  entities,
  selectedEntity,
  onSelect,
  megaTargetThreshold,
  minAuditors,
  overallTotal,
  threshold,
  strictAuditorRule,
  maxLocationsPerDay = 5,
}) => {
  return (
    <Card className="rounded-[32px] border-slate-200 shadow-sm overflow-hidden mt-12">
      <CardHeader className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <CardTitle className="text-lg font-bold text-slate-900">Active Entities (Ranked by Assets)</CardTitle>
          <p className="text-sm text-slate-500">Live visualization of audit entities and resource strength.</p>
        </div>
        
        {overallTotal !== undefined && (
          <div className="bg-slate-900 px-5 py-3 rounded-2xl border border-slate-700 shadow-md">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Institutional Grand Total</p>
            <p className="text-xl font-mono font-black text-white">{overallTotal.toLocaleString()}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Updates</span>
        </div>
      </CardHeader>

      <CardContent className="p-8">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3 pb-4">
            {entities.map((entity, idx) => {
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
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Rank #{idx + 1}</span>
                    {entity.isConsolidated && (
                      <Badge variant="outline" className="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 text-[8px] font-black uppercase tracking-tighter border-none">
                        Consolidated Unit
                      </Badge>
                    )}
                  </div>
                  <span className={`truncate w-full text-left text-base font-bold ${entity.members?.length > 0 ? 'mb-1' : 'mb-3'}`}>{entity.name}</span>
                  {entity.members && entity.members.length > 0 && (
                    <div className={`flex flex-wrap gap-1 mb-3`}>
                      {entity.members.map((m: any) => (
                         <Badge key={m.id} variant="secondary" className={`px-1 rounded-[4px] text-[9px] font-bold uppercase tracking-widest ${isSelected ? 'bg-white/10 text-white/60' : 'bg-slate-100 text-slate-400'}`}>
                           {m.abbr}
                         </Badge>
                      ))}
                    </div>
                  )}

                  <div className={`flex gap-4 w-full border-t pt-3 ${isSelected ? 'border-white/10' : 'border-slate-100'}`}>
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase opacity-70">Assets</span>
                      <span className="text-xs">{entity.assets.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase opacity-70">Auditors</span>
                      <span className={`text-xs ${entity.auditors < minAuditors && !isSelected ? 'text-red-500' : ''}`}>
                        {entity.auditors}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
