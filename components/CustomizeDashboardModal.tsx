
import React, { useState } from 'react';
import { DashboardConfig } from '../types';
import { BarChart3, LineChart, CalendarDays, Network, Award, X, Sliders } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

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
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl p-0 overflow-hidden bg-white">
        <DialogHeader className="bg-slate-900 p-6 text-white space-y-0 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <DialogTitle className="text-xl font-bold">Customize Dashboard</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Configure your workspace view preferences.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="space-y-3">
            {widgetDefinitions.map((widget) => {
              const Icon = widget.icon;
              return (
                <div 
                  key={widget.key}
                  onClick={() => toggle(widget.key)}
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
                  <Switch 
                    checked={tempConfig[widget.key]}
                    onCheckedChange={() => toggle(widget.key)}
                  />
                </div>
              );
            })}
          </div>

          <DialogFooter className="flex flex-row gap-3 pt-4 sm:justify-start">
            <Button 
              variant="outline"
              onClick={onClose}
              className="flex-grow py-6 border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all text-sm"
            >
              Discard Changes
            </Button>
            <Button 
              onClick={() => onSave(tempConfig)}
              className="flex-[2] py-6 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 text-sm border-none"
            >
              Save Configuration
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
