
import React, { useState } from 'react';
import { DashboardConfig } from '../types';
import { BarChart3, LineChart, CalendarDays, Network, Award, X } from 'lucide-react';

interface CustomizeDashboardModalProps {
  config: DashboardConfig;
  onClose: () => void;
  onSave: (config: DashboardConfig) => void;
}

export const CustomizeDashboardModal: React.FC<CustomizeDashboardModalProps> = ({ 
  config, 
  onClose, 
  onSave 
}) => {
  const [tempConfig, setTempConfig] = useState<DashboardConfig>({ ...config });

  const toggle = (key: keyof DashboardConfig) => {
    setTempConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const widgetDefinitions = [
    { key: 'showStats', label: 'Quick Stats Summary', icon: BarChart3, desc: 'Display total audits, pending tasks, and open slots.' },
    { key: 'showTrends', label: 'Compliance Trends', icon: LineChart, desc: 'Visualize audit progress and weekly goal adherence.' },
    { key: 'showUpcoming', label: 'Upcoming Audits', icon: CalendarDays, desc: 'List of next 3 scheduled audit locations.' },
    { key: 'showDeptDistribution', label: 'Departmental Distribution', icon: Network, desc: 'Breakdown of audit workload across institutional departments.' },
  ] as const;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold">Customize Dashboard</h3>
            <p className="text-slate-400 text-xs mt-1">Configure your workspace view preferences.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-3">
            {widgetDefinitions.map((widget) => {
              const Icon = widget.icon;
              return (
                <label 
                  key={widget.key}
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer group ${
                    tempConfig[widget.key] 
                      ? 'border-blue-100 bg-blue-50/30' 
                      : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-colors ${
                    tempConfig[widget.key] ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-grow">
                    <p className="text-sm font-bold text-slate-900">{widget.label}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{widget.desc}</p>
                  </div>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={tempConfig[widget.key]}
                      onChange={() => toggle(widget.key)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              onClick={onClose}
              className="flex-grow py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all text-sm"
            >
              Discard Changes
            </button>
            <button 
              onClick={() => onSave(tempConfig)}
              className="flex-[2] py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 text-sm"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
