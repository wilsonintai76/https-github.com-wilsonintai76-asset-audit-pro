
import React from 'react';
import { Lightbulb } from 'lucide-react';

export const SetupGuide: React.FC = () => {
  const steps = [
    { 
      title: "01. Onboard Departments", 
      desc: "Define your units (JKE, Kamsis, JKA, etc.) and their total asset counts. The system uses these counts to balance auditing loads.",
      tip: "Use CSV Import for bulk onboarding."
    },
    { 
      title: "02. Map Physical Locations", 
      desc: "Identify labs, workshop blocks, and classrooms. Crucially, assign a 'Block' and 'Level' to each location to enable the granular filtering system for auditors.",
      tip: "Locations must be linked to a parent department."
    },
    { 
      title: "03. Authorize Audit Teams", 
      desc: "Go to Team Management and issue 'Auditor Certificates'. Staff cannot self-assign to audits if their certificate is expired or missing.",
      tip: "Admin signature is required for certificate validity."
    },
    { 
      title: "04. Activate Planning Phases", 
      desc: "Set the official audit window in System Settings. This unlocks the calendar for all staff and enables date selection.",
      tip: "Phase dates should not overlap for clear KPI tracking."
    },
    { 
      title: "05. Run Optimization Matrix", 
      desc: "Execute the Pairing Engine in Settings. This automatically creates the cross-departmental permissions required for neutral auditing.",
      tip: "Review the Matrix before applying permissions."
    }
  ];

  return (
    <div className="space-y-4">
      {steps.map((item, i) => (
        <div key={i} className="flex flex-col sm:flex-row gap-6 p-8 bg-white border border-slate-200 rounded-[40px] group hover:border-emerald-300 transition-colors">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-lg font-black shrink-0 group-hover:scale-110 transition-transform shadow-xl shadow-slate-900/10">
            {i + 1}
          </div>
          <div>
            <h4 className="text-xl font-black text-slate-900 mb-2">{item.title}</h4>
            <p className="text-slate-500 font-medium leading-relaxed mb-4">{item.desc}</p>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-100">
              <Lightbulb className="w-3 h-3" />
              Pro Tip: {item.tip}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
