
import React from 'react';
import { AuditSchedule } from '../types';
import { CheckCircle2, Circle, Clock, UserPlus, Calendar } from 'lucide-react';

interface WorkflowTrackerProps {
  audit: AuditSchedule;
}

export const WorkflowTracker: React.FC<WorkflowTrackerProps> = ({ audit }) => {
  const stages = [
    { 
      id: 'reg', 
      label: 'Setup', 
      isDone: true, 
      icon: <CheckCircle2 className="w-3 h-3" />,
      color: 'text-emerald-500'
    },
    { 
      id: 'sched', 
      label: 'Schedule', 
      isDone: !!audit.date, 
      icon: <Calendar className="w-3 h-3" />,
      color: audit.date ? 'text-blue-500' : 'text-slate-300'
    },
    { 
      id: 'assign', 
      label: 'Assign', 
      isDone: !!(audit.auditor1Id || audit.auditor2Id), 
      icon: <UserPlus className="w-3 h-3" />,
      color: (audit.auditor1Id || audit.auditor2Id) ? 'text-indigo-500' : 'text-slate-300'
    },
    { 
      id: 'exec', 
      label: 'Audit', 
      isDone: audit.status === 'Completed', 
      isInProgress: audit.status === 'In Progress',
      icon: audit.status === 'Completed' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />,
      color: audit.status === 'Completed' ? 'text-emerald-500' : audit.status === 'In Progress' ? 'text-amber-500' : 'text-slate-300'
    }
  ];

  return (
    <div className="flex items-center gap-1.5">
      {stages.map((stage, idx) => (
        <React.Fragment key={stage.id}>
          <div 
            className={`flex flex-col items-center gap-1 group relative`}
            title={`${stage.label}: ${stage.isDone ? 'Complete' : stage.isInProgress ? 'In Progress' : 'Pending'}`}
          >
            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
              stage.isDone 
              ? `bg-white border-current ${stage.color}` 
              : stage.isInProgress 
              ? 'bg-amber-50 border-amber-200 text-amber-500 animate-pulse' 
              : 'bg-slate-50 border-slate-200 text-slate-300'
            }`}>
              {stage.isDone ? stage.icon : <Circle className="w-2 h-2 fill-current opacity-20" />}
            </div>
            
            {/* Tooltip */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[9px] font-black uppercase rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
              {stage.label}
            </div>
          </div>
          {idx < stages.length - 1 && (
            <div className={`w-3 h-[2px] rounded-full ${stages[idx + 1].isDone || stages[idx + 1].isInProgress ? 'bg-slate-300' : 'bg-slate-100'}`}></div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
