import React from 'react';
import { ClipboardCheck, Calendar, X } from 'lucide-react';

interface HistoricalRecordsProps {
  archives: any[];
  onClose: () => void;
}

export const HistoricalRecords: React.FC<HistoricalRecordsProps> = ({ archives, onClose }) => {
  return (
    <div className="mb-12 p-8 rounded-[32px] border-2 border-slate-100 bg-slate-50/50 animate-in fade-in slide-in-from-top-4 duration-500">
       <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-black text-slate-900">Historical Archives</h3>
            <p className="text-xs font-medium text-slate-400 mt-1">Previously saved strategic memos and audit reports in Cloudflare R2.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-all">
            <X className="w-5 h-5 text-slate-400" />
          </button>
       </div>

       {archives.length === 0 ? (
         <div className="py-12 text-center text-slate-400 text-xs italic bg-white border border-slate-100 rounded-2xl">
           No archived reports found in storage.
         </div>
       ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {archives.map((arch, i) => (
              <div key={i} className="group p-6 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{arch.metadata?.year || 'N/A'}</span>
                </div>
                <h4 className="text-sm font-black text-slate-900 mb-1">{arch.metadata?.type || arch.key.split('/').pop()}</h4>
                <p className="text-[10px] font-bold text-slate-400 mb-6">{new Date(arch.uploadedAt).toLocaleDateString()} at {new Date(arch.uploadedAt).toLocaleTimeString()}</p>
                <div className="flex items-center justify-between">
                   <span className="text-[9px] font-black text-indigo-400 uppercase">Coverage: {arch.metadata?.projectedKPI || '0'}%</span>
                   <button 
                     onClick={() => window.open(`/api/media/download?key=${encodeURIComponent(arch.key)}`, '_blank')}
                     className="px-3 py-1.5 bg-slate-50 text-slate-900 text-[9px] font-black uppercase rounded-lg hover:bg-slate-900 hover:text-white transition-all"
                   >
                     View Memo
                   </button>
                </div>
              </div>
            ))}
         </div>
       )}
    </div>
  );
};
