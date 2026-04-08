
import React from 'react';
import { Shield, Building, ShieldCheck, AlertTriangle, ArrowLeftRight } from 'lucide-react';

interface AuditTeamSectionProps {
  type: 'alpha' | 'beta';
  name: string;
  auditors: any[]; 
  totalAuditors: number;
  totalAssets: number;
  otherSideAssets: number;
  members?: any[];
  isJoint?: boolean;
}

const AuditTeamSection: React.FC<AuditTeamSectionProps> = ({ 
  type, name, auditors, totalAuditors, totalAssets, otherSideAssets, members, isJoint 
}) => {
  const isAlpha = type === 'alpha';
  const bgColor = isAlpha ? 'bg-indigo-50/20' : 'bg-rose-50/10';
  const textColor = isAlpha ? 'text-indigo-600' : 'text-rose-600';
  const barColor = isAlpha ? 'bg-indigo-600' : 'bg-rose-600';
  const borderColor = isAlpha ? 'border-indigo-100' : 'border-rose-100';
  const alignment = isAlpha ? 'items-start text-left' : 'items-end text-right';

  return (
    <div className={`flex-1 p-3 ${bgColor} ${isAlpha ? 'border-r border-slate-100' : ''} flex flex-col ${alignment}`}>
      <div className={`flex items-center gap-2 mb-2 ${isAlpha ? '' : 'flex-row-reverse'}`}>
        {isAlpha ? (
          <Shield className="w-3 h-3 text-indigo-600" />
        ) : (
          <Building className="w-3 h-3 text-rose-600" />
        )}
        <span className={`text-[8px] font-black uppercase tracking-tighter ${textColor}`}>
          Team {isAlpha ? 'Alpha (Audit Beta)' : 'Beta (Audit Alpha)'}
        </span>
      </div>
      
      <div className="w-full mb-1">
        {auditors.map((a, i) => (
          <div key={i} className="mb-2 last:mb-0">
            <h3 className="font-black text-slate-900 uppercase leading-tight text-[11px] tracking-tight truncate">
              {a.name}
            </h3>
            {/* Handle Joint Group Members Display */}
            {(isJoint || a.isJoint) && (members || a.members) && (
              <div className={`mt-1 ${isAlpha ? 'ml-1 pl-2 border-l-2 border-indigo-200' : 'mr-1 pr-2 border-r-2 border-rose-200'}`}>
                <p className={`text-[7px] font-black uppercase tracking-widest mb-0.5 ${textColor} opacity-70`}>Includes:</p>
                {(members || a.members).map((m: any, mIdx: number) => (
                  <p key={mIdx} className="text-[8px] font-bold text-slate-500 uppercase leading-none mb-0.5 truncate">
                    {isAlpha ? `• ${m.name}` : `${m.name} •`}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="flex mt-2 mb-3">
        <p className={`text-[8px] font-black ${textColor} ${isAlpha ? 'bg-indigo-50' : 'bg-rose-50'} px-2 py-0.5 rounded border ${borderColor} uppercase`}>
          {totalAssets.toLocaleString()} Assets • {totalAuditors} Auditor
        </p>
      </div>

      <div className={`w-full mt-auto flex justify-between items-center ${barColor} text-white p-2 rounded shadow-md border ${isAlpha ? 'border-indigo-700' : 'border-rose-700'}`}>
        <span className="text-[8px] font-black uppercase opacity-70 tracking-tighter">Workload:</span>
        <span className="font-black text-[12px] tracking-tight">
          {totalAuditors > 0 ? (otherSideAssets / Math.max(1, totalAuditors)).toFixed(0) : 'N/A'} 
          <span className="text-[7px] uppercase opacity-70 ml-0.5 font-normal">Assets/Auditor</span>
        </span>
      </div>
    </div>
  );
};

interface MatrixCardProps {
  pair: any;
  index: number;
}

export const MatrixCard: React.FC<MatrixCardProps> = ({ pair, index }) => {
  const safetyMet = pair.totalAuditorsInGroup >= 2;

  return (
    <div className={`bg-white rounded-lg border-2 shadow-sm overflow-hidden ${safetyMet ? 'border-indigo-400' : 'border-slate-100'}`}>
      <div className={`px-4 py-1.5 border-b flex justify-between items-center ${safetyMet ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3 h-3" />
          <span className="text-[9px] font-black uppercase tracking-widest font-mono">PARTNERSHIP #{index + 1}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[8px] font-black uppercase opacity-80 flex items-center gap-1">
            {safetyMet ? (
              <Shield className="w-3 h-3" />
            ) : (
              <AlertTriangle className="w-3 h-3" />
            )}
            {safetyMet ? 'SAFETY PAIR RULE ENFORCED' : 'SAFETY WARNING: UNDERSTAFFED'}
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch text-[10px]">
        {/* Team Alpha Section */}
        <AuditTeamSection 
          type="alpha"
          name={pair.auditors.map((a: any) => a.name).join(', ')}
          auditors={pair.auditors}
          totalAuditors={pair.totalAuditorsInGroup}
          totalAssets={pair.auditorSideAssets}
          otherSideAssets={pair.target.assets}
          isJoint={false} 
        />

        {/* Central Reciprocal Connection */}
        <div className="flex items-center justify-center p-2 bg-white shrink-0 sm:z-10">
          <div className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center bg-white shadow-lg">
            <ArrowLeftRight className="w-4 h-4 text-slate-500" />
          </div>
        </div>

        {/* Team Beta Section */}
        <AuditTeamSection 
          type="beta"
          name={pair.target.name}
          auditors={[pair.target]}
          totalAuditors={pair.target.auditors}
          totalAssets={pair.target.assets}
          otherSideAssets={pair.auditorSideAssets}
          isJoint={pair.target.isJoint}
          members={pair.target.members} 
        />
      </div>
    </div>
  );
};
