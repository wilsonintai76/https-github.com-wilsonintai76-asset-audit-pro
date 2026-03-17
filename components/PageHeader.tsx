
import React from 'react';
import { LucideIcon } from 'lucide-react';
import { AuditPhase } from '../types';
import { Zap, ArrowRight } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon: any;
  activePhase?: AuditPhase | null;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  description,
  icon: Icon,
  activePhase,
  className = ''
}) => {
  return (
    <div className={`p-8 rounded-[40px] border-2 transition-all duration-500 overflow-hidden relative ${activePhase
      ? 'bg-slate-900 border-emerald-500/50 text-white'
      : 'bg-white border-slate-200 text-slate-900'
    } ${className}`}>
      {activePhase && (
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
      )}

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center text-2xl shadow-inner ${activePhase
            ? 'bg-emerald-50 text-emerald-600'
            : 'bg-slate-50 text-slate-400 border border-slate-100'
          }`}>
            <Icon className="w-8 h-8" />
          </div>
          <div>
            <h2 className={`text-2xl font-black tracking-tight leading-none ${activePhase ? 'text-white' : 'text-slate-900'}`}>
              {title}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              {activePhase ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest">
                    ACTIVE PHASE: {activePhase.name}
                  </p>
                </>
              ) : (
                <p className="text-slate-500 text-sm font-medium">
                  {subtitle || description}
                </p>
              )}
            </div>
          </div>
        </div>

        {activePhase && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter mb-1">Window Progress</span>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-bold font-mono text-emerald-400">
                  {activePhase.startDate} <ArrowRight className="inline-block w-3 h-3 mx-1 opacity-40" /> {activePhase.endDate}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
