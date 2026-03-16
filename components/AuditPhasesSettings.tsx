
import React, { useState } from 'react';
import { AuditPhase } from '../types';
import { Plus, CalendarX, Pencil, Trash2, CalendarCheck, ChevronRight, Zap, History } from 'lucide-react';

interface AuditPhasesSettingsProps {
  phases: AuditPhase[];
  isAdmin?: boolean;
  onAdd: (phase: Omit<AuditPhase, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<AuditPhase>) => void;
  onDelete: (id: string) => void;
}

export const AuditPhasesSettings: React.FC<AuditPhasesSettingsProps> = ({ phases, isAdmin = false, onAdd, onUpdate, onDelete }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', startDate: '', endDate: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);

    if (start >= end) {
        alert("Start date must be strictly before the end date.");
        return;
    }

    // Overlap Check
    const newStart = start.getTime();
    const newEnd = end.getTime();

    const hasOverlap = phases.some(phase => {
      if (editingId && phase.id === editingId) return false;
      const existingStart = new Date(phase.startDate).getTime();
      const existingEnd = new Date(phase.endDate).getTime();

      // Overlap occurs if: (StartA <= EndB) and (EndA >= StartB)
      return newStart <= existingEnd && newEnd >= existingStart;
    });

    if (hasOverlap) {
      alert("This phase overlaps with an existing audit phase. Please choose different dates.");
      return;
    }

    if (editingId) {
      onUpdate(editingId, formData);
      setEditingId(null);
    } else {
      onAdd(formData);
      setIsAdding(false);
    }
    setFormData({ name: '', startDate: '', endDate: '' });
  };

  const startEdit = (phase: AuditPhase) => {
    setEditingId(phase.id);
    setFormData({ 
      name: phase.name || '', 
      startDate: phase.startDate || '', 
      endDate: phase.endDate || ''
    });
    setIsAdding(true);
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: '', startDate: '', endDate: '' });
  };

  const checkIsActive = (phase: AuditPhase) => {
    const today = new Date();
    const start = new Date(phase.startDate);
    const end = new Date(phase.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return today >= start && today <= end;
  };

  return (
    <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden p-8 mt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Audit Phases</h3>
          <p className="text-sm text-slate-500">Define active date ranges for audits (e.g., Phase 1: March). Date selection will be restricted to these periods.</p>
        </div>
        {isAdmin && !isAdding && (
          <button 
            onClick={() => setIsAdding(true)} 
            className="px-5 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Phase
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-3xl border border-slate-200 mb-6 animate-in fade-in slide-in-from-top-2">
            <h4 className="text-sm font-bold text-slate-700 mb-4">{editingId ? 'Edit Phase' : 'New Audit Phase'}</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">Phase Name</label>
                    <input 
                        required 
                        placeholder="e.g. Phase 1: Quarter 1" 
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none" 
                        value={formData.name} 
                        onChange={e => setFormData({ ...formData, name: e.target.value })} 
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">Start Date</label>
                    <input 
                        required 
                        type="date"
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none" 
                        value={formData.startDate} 
                        onChange={e => setFormData({ ...formData, startDate: e.target.value })} 
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">End Date</label>
                    <input 
                        required 
                        type="date"
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none" 
                        value={formData.endDate} 
                        onChange={e => setFormData({ ...formData, endDate: e.target.value })} 
                    />
                </div>
            </div>
            <div className="flex gap-2">
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/10 hover:bg-blue-700 transition-colors">
                    {editingId ? 'Update' : 'Save'} Phase
                </button>
                <button type="button" onClick={resetForm} className="px-6 py-2 bg-white text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors border border-slate-200">
                    Cancel
                </button>
            </div>
        </form>
      )}

      {(!phases || phases.length === 0) && !isAdding ? (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <CalendarX className="w-6 h-6" />
              </div>
              <p className="text-sm text-slate-500 font-medium">No audit phases defined.</p>
              <p className="text-xs text-slate-400">Audits can be scheduled on any date until phases are set.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {phases.sort((a,b) => a.startDate.localeCompare(b.startDate)).map(phase => {
                  const isActive = checkIsActive(phase);
                  return (
                    <div 
                      key={phase.id} 
                      className={`p-5 rounded-3xl border-2 transition-all duration-300 relative overflow-hidden group ${
                        isActive 
                          ? 'bg-emerald-50/40 border-emerald-500 shadow-lg shadow-emerald-500/10' 
                          : 'bg-white border-slate-100 hover:border-slate-200'
                      }`}
                    >
                        {isActive && (
                          <div className="absolute top-0 right-0 p-2">
                            <span className="flex h-3 w-3 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-start mb-4">
                            <h4 className={`font-black text-lg tracking-tight ${isActive ? 'text-emerald-900' : 'text-slate-900'}`}>
                              {phase.name}
                            </h4>
                            <div className="flex gap-1">
                                {isAdmin && (
                                  <>
                                    <button 
                                      onClick={() => startEdit(phase)} 
                                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                                        isActive 
                                          ? 'text-emerald-600 hover:bg-emerald-500/10' 
                                          : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                                      }`}
                                    >
                                        <Pencil className="w-3 h-3" />
                                    </button>
                                    <button 
                                      onClick={() => onDelete(phase.id)} 
                                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                                        isActive 
                                          ? 'text-emerald-400 hover:text-rose-600 hover:bg-rose-50' 
                                          : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                      }`}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs font-bold mb-2">
                            <div className={`px-2 py-1 rounded-lg border flex items-center gap-2 ${isActive ? 'bg-white border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                              <CalendarCheck className="w-3 h-3" />
                              {phase.startDate}
                            </div>
                            <ChevronRight className={`w-3 h-3 ${isActive ? 'text-emerald-300' : 'text-slate-300'}`} />
                            <div className={`px-2 py-1 rounded-lg border flex items-center gap-2 ${isActive ? 'bg-white border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                              <CalendarX className="w-3 h-3" />
                              {phase.endDate}
                            </div>
                        </div>

                        {isActive ? (
                            <div className="flex items-center gap-2 py-2 px-3 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest w-fit animate-pulse">
                                <Zap className="w-3 h-3" />
                                Live Operation Window
                            </div>
                        ) : (
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                             <History className="w-3 h-3" />
                             Standard Window
                          </div>
                        )}
                    </div>
                  );
              })}
          </div>
      )}
    </div>
  );
};
