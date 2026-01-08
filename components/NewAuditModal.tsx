
import React, { useState } from 'react';
import { AuditSchedule } from '../types';

interface NewAuditModalProps {
  onClose: () => void;
  onAdd: (audit: Omit<AuditSchedule, 'id' | 'status'>) => void;
}

export const NewAuditModal: React.FC<NewAuditModalProps> = ({ onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    department: '',
    location: '',
    supervisor: '',
    date: '',
    building: '',
    assetCount: 0
  });

  // Calculate today's date in YYYY-MM-DD format for the 'min' attribute
  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      ...formData,
      auditor1: null,
      auditor2: null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-blue-600 p-5 md:p-6 text-white flex items-center justify-between">
          <div>
            <h3 className="text-lg md:text-xl font-bold">Schedule New Audit</h3>
            <p className="text-blue-100 text-[10px] md:text-xs mt-1">Register a department and location for inspection.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 md:p-8 space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Department</label>
              <input 
                required
                type="text"
                placeholder="e.g. Health & Safety"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                value={formData.department}
                onChange={e => setFormData({...formData, department: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Location</label>
              <input 
                required
                type="text"
                placeholder="e.g. Ground Floor Hub"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Supervisor</label>
              <input 
                required
                type="text"
                placeholder="Lead Personnel"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                value={formData.supervisor}
                onChange={e => setFormData({...formData, supervisor: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Audit Date</label>
              <div className="relative group">
                <input 
                  required
                  type="date"
                  min={today}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm cursor-pointer group-hover:bg-slate-100"
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                />
                <i className="fa-solid fa-calendar-plus absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none"></i>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Building</label>
              <input 
                type="text"
                placeholder="e.g. Block C"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                value={formData.building}
                onChange={e => setFormData({...formData, building: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Asset Count</label>
              <input 
                type="number"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                value={formData.assetCount}
                onChange={e => setFormData({...formData, assetCount: parseInt(e.target.value) || 0})}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="w-full sm:flex-grow py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all text-sm"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="w-full sm:flex-[2] py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 text-sm active:scale-95"
            >
              Create Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
