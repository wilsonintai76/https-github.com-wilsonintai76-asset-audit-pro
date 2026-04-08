
import React, { useState, useRef, useEffect } from 'react';
import { AppNotification } from '../types';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Bell, BellOff } from 'lucide-react';

interface NotificationCenterProps {
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  notifications, 
  onMarkAsRead, 
  onClearAll 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'urgent': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              Notifications
              <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md">{notifications?.length || 0}</span>
            </h4>
            <button 
              onClick={onClearAll}
              className="text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              Clear All
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {!notifications || notifications.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <BellOff className="w-6 h-6" />
                </div>
                <p className="text-sm text-slate-500 font-medium">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map((n) => (
                  <div 
                    key={n.id} 
                    className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer group relative ${!n.read ? 'bg-blue-50/30' : ''}`}
                    onClick={() => onMarkAsRead(n.id)}
                  >
                    {!n.read && (
                      <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-full"></div>
                    )}
                    <div className="flex gap-3">
                      <div className="mt-1 shrink-0">{getTypeIcon(n.type)}</div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-start mb-0.5">
                          <h5 className={`text-sm font-bold ${!n.read ? 'text-slate-900' : 'text-slate-600'}`}>
                            {n.title}
                          </h5>
                          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{n.timestamp}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{n.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-100 bg-slate-50/50 text-center">
            <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors">
              View All Notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
