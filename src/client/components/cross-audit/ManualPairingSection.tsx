import React from 'react';
import { Link, ArrowRightLeft, ArrowRight } from 'lucide-react';

interface ManualPairingSectionProps {
  manualAuditorId: string;
  setManualAuditorId: (v: string) => void;
  manualTargetId: string;
  setManualTargetId: (v: string) => void;
  manualIsMutual: boolean;
  setManualIsMutual: (v: boolean) => void;
  entities: any[];
  onLinkEntities: () => void;
  simulatedPairings: any[];
}

export const ManualPairingSection: React.FC<ManualPairingSectionProps> = ({
  manualAuditorId,
  setManualAuditorId,
  manualTargetId,
  setManualTargetId,
  manualIsMutual,
  setManualIsMutual,
  entities,
  onLinkEntities,
  simulatedPairings
}) => {
  return (
    <div className="mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center gap-2 mb-6 px-2">
        <Link className="w-5 h-5 text-indigo-500" />
        <h3 className="text-xl font-black text-slate-900 tracking-tight">Strategic Manual Override</h3>
        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-md">Force Pairings</span>
      </div>
      
      <div className="p-8 rounded-[32px] border-2 border-slate-100 bg-white shadow-sm flex flex-col md:flex-row items-end gap-6">
        <div className="flex-1 space-y-3">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Inspecting Entity (Auditor)</label>
          <select 
           value={manualAuditorId}
           onChange={(e) => setManualAuditorId(e.target.value)}
           className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">Select Auditor Group...</option>
            {entities.map(e => <option key={e.id} value={e.id}>{e.name} ({e.auditors} Staff)</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 pb-3">
          <button 
           onClick={() => setManualIsMutual(!manualIsMutual)}
           className={`p-3 rounded-xl transition-all ${manualIsMutual ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
          >
            {manualIsMutual ? <ArrowRightLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 space-y-3">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Target Entity (To be Audited)</label>
          <select 
           value={manualTargetId}
           onChange={(e) => setManualTargetId(e.target.value)}
           className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">Select Target Group...</option>
            {entities.map(e => <option key={e.id} value={e.id}>{e.name} ({e.assets} Assets)</option>)}
          </select>
        </div>

        <button 
         onClick={onLinkEntities}
         disabled={!manualAuditorId || !manualTargetId || manualAuditorId === manualTargetId}
         className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-30 flex items-center gap-2 h-[48px]"
        >
          <Link className="w-4 h-4" /> Link Entities
        </button>
      </div>

      {/* SHOW UNASSIGNED GROUPS HELPER */}
      {entities.filter(e => 
        !simulatedPairings.some(p => p.auditorDeptId === e.id) || 
        !simulatedPairings.some(p => p.targetDeptId === e.id)
      ).length > 0 && (
        <div className="mt-6 flex items-center gap-4 px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl">
          <div className="flex flex-col">
           <span className="text-[10px] font-black uppercase text-amber-600">Pending Parity:</span>
           <span className="text-[8px] font-bold text-amber-400">Available to link</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {entities.filter(e => 
              !simulatedPairings.some(p => p.auditorDeptId === e.id) || 
              !simulatedPairings.some(p => p.targetDeptId === e.id)
            ).map(e => (
              <button 
               key={e.id} 
               onClick={() => { 
                 const needsAuditor = !simulatedPairings.some(p => p.targetDeptId === e.id);
                 const needsTarget = !simulatedPairings.some(p => p.auditorDeptId === e.id);
                 if (!manualAuditorId && needsTarget) setManualAuditorId(e.id); 
                 else if (!manualTargetId && needsAuditor) setManualTargetId(e.id);
                 else if (!manualAuditorId) setManualAuditorId(e.id);
                 else setManualTargetId(e.id);
               }} 
               className="px-2 py-1 bg-white border border-amber-200 rounded-lg text-[9px] font-black uppercase text-amber-500 hover:bg-amber-100 transition-all font-mono"
              >
                {e.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
