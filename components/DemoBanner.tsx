import React from 'react';
import { useDemo } from '../contexts/DemoContext';
import { ShieldAlert, RefreshCcw, LogOut, Info } from 'lucide-react';

export const DemoBanner: React.FC = () => {
  const { isDemoMode, demoUser, exitDemoMode, resetDemoData } = useDemo();

  if (!isDemoMode) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white px-4 py-2 relative z-[100] shadow-lg animate-in fade-in slide-in-from-top duration-500">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-md">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="text-sm font-bold tracking-tight">DEMO MODE ACTIVE</span>
            <div className="h-4 w-px bg-white/20 hidden sm:block" />
            <span className="text-xs text-indigo-100 font-medium flex items-center gap-1.5">
              <Info className="w-3 h-3" />
              Viewing as <span className="text-white font-bold">{demoUser?.name} ({demoUser?.roles.join(', ')})</span>
            </span>
          </div>
        </div>
        
        {/* Actions removed - use Logout to exit and reset */}
      </div>
    </div>
  );
};
