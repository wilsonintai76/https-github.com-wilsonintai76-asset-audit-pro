
import React, { useState, useMemo, useEffect } from 'react';
import { AuditSchedule, Department, Location, AuditPhase } from '../types';
import { X, CalendarDays, ChevronDown, CalendarPlus } from 'lucide-react';

interface NewAuditModalProps {
  onClose: () => void;
  onAdd: (audit: Omit<AuditSchedule, 'id' | 'status' | 'auditor1' | 'auditor2'>) => void;
  departments: Department[];
  locations: Location[];
  auditPhases: AuditPhase[];
  existingSchedules: AuditSchedule[];
}

export const NewAuditModal: React.FC<NewAuditModalProps> = ({ onClose, onAdd, departments, locations, auditPhases, existingSchedules }) => {
  const [formData, setFormData] = useState({
    department: '',
    location: '',
    supervisor: '',
    date: '',
    building: '',
    level: '',
    phaseId: ''
  });

  const hasPhases = auditPhases.length > 0;
  const today = new Date().toISOString().split('T')[0];

  const selectedPhase = useMemo(() => 
    auditPhases.find(p => p.id === formData.phaseId), 
    [auditPhases, formData.phaseId]
  );

  // Logic: Filter locations so that a location only appears ONCE for any given phase.
  const availableLocations = useMemo(() => {
    if (!formData.department) return [];
    
    // Get all locations for this department
    const deptLocations = locations.filter(loc => loc.department === formData.department);
    
    // If no phase selected, show all (though button is disabled)
    if (!formData.phaseId) return deptLocations;

    // Get locations ALREADY scheduled in the selected phase
    const alreadyScheduledLocations = new Set(
      existingSchedules
        .filter(s => s.phaseId === formData.phaseId)
        .map(s => s.location)
    );

    // Only return locations NOT already scheduled in this specific phase
    return deptLocations.filter(loc => !alreadyScheduledLocations.has(loc.name));
  }, [locations, formData.department, formData.phaseId, existingSchedules]);

  // Effect to reset location if it becomes unavailable due to phase change
  useEffect(() => {
    if (formData.location && formData.phaseId) {
        const isStillAvailable = availableLocations.some(l => l.name === formData.location);
        if (!isStillAvailable) {
            setFormData(prev => ({ ...prev, location: '', building: '', level: '', supervisor: '' }));
        }
    }
  }, [formData.phaseId, availableLocations, formData.location]);

  const handleDeptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      department: e.target.value,
      location: '',
      building: '',
      level: '',
      supervisor: ''
    }));
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const locName = e.target.value;
    const selectedLoc = locations.find(l => l.name === locName);
    
    setFormData(prev => ({
      ...prev,
      location: locName,
      building: selectedLoc?.building || '',
      level: selectedLoc?.level || '',
      supervisor: selectedLoc?.pic || ''
    }));
  };

  const isDateInValidPhase = (dateStr: string, phaseId: string): boolean => {
    if (auditPhases.length === 0) return false; 
    if (!dateStr) return true; 
    const phase = auditPhases.find(p => p.id === phaseId);
    if (!phase) return false;
    
    const d = new Date(dateStr);
    const start = new Date(phase.startDate);
    const end = new Date(phase.endDate);
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);
    return d >= start && d <= end;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPhases) {
        alert("Action Denied: You must configure an audit phase in System Settings before scheduling audits.");
        return;
    }
    if (!formData.phaseId) {
        alert("Please select a target Audit Phase.");
        return;
    }
    if (formData.date && !isDateInValidPhase(formData.date, formData.phaseId)) {
        alert(`The selected date falls outside of the authorized window for ${selectedPhase?.name}.`);
        return;
    }
    onAdd(formData as any);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-blue-600 p-5 md:p-6 text-white flex items-center justify-between">
          <div>
            <h3 className="text-lg md:text-xl font-bold">Plan Audit Instance</h3>
            <p className="text-blue-100 text-[10px] md:text-xs mt-1">Select a phase to allocate this location to a specific timeframe.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 md:p-8 space-y-4 md:space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Target Audit Phase</label>
            <div className="relative">
              <select
                required
                className="w-full px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-bold text-blue-900 appearance-none cursor-pointer"
                value={formData.phaseId}
                onChange={e => setFormData({...formData, phaseId: e.target.value})}
              >
                <option value="">Select Phase</option>
                {auditPhases.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.startDate} to {p.endDate})</option>
                ))}
              </select>
              <CalendarDays className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400 w-4 h-4 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Department</label>
              <div className="relative">
                <select
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm appearance-none cursor-pointer"
                  value={formData.department}
                  onChange={handleDeptChange}
                >
                  <option value="">Select Department</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Location</label>
              <div className="relative">
                <select
                  required
                  disabled={!formData.department || !formData.phaseId}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm appearance-none cursor-pointer disabled:opacity-50"
                  value={formData.location}
                  onChange={handleLocationChange}
                >
                  <option value="">
                    {!formData.phaseId ? 'Select Phase First' : 
                     !formData.department ? 'Select Dept First' : 
                     availableLocations.length === 0 ? 'All locations scheduled for this phase' : 'Select Location'}
                  </option>
                  {availableLocations.map(l => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              </div>
              {formData.phaseId && formData.department && availableLocations.length === 0 && (
                <p className="text-[9px] text-amber-600 font-bold mt-1 uppercase">All department locations are already audited in this phase.</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Site Supervisor</label>
              <input 
                required
                type="text"
                placeholder="Auto-filled or Enter Name"
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
                  min={selectedPhase?.startDate || today}
                  max={selectedPhase?.endDate}
                  disabled={!formData.phaseId}
                  className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm cursor-pointer group-hover:bg-slate-100 ${
                    !formData.phaseId
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                />
                <CalendarPlus className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 ${!formData.phaseId ? 'text-slate-300' : 'text-blue-500'}`} />
              </div>
              {!formData.phaseId ? (
                <p className="text-[9px] text-amber-500 font-bold mt-1 uppercase">Pick Phase to Unlock Picker</p>
              ) : (
                <p className="text-[9px] text-blue-500 font-bold mt-1 uppercase">Window: {selectedPhase?.startDate} to {selectedPhase?.endDate}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Building</label>
              <input 
                type="text"
                placeholder="Auto-filled"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                value={formData.building}
                onChange={e => setFormData({...formData, building: e.target.value})}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Level</label>
              <input 
                type="text"
                placeholder="Auto-filled"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                value={formData.level}
                onChange={e => setFormData({...formData, level: e.target.value})}
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
              disabled={!formData.phaseId || !formData.location}
              className={`w-full sm:flex-[2] py-3 text-white font-bold rounded-2xl transition-all shadow-lg text-sm active:scale-95 ${!formData.phaseId || !formData.location ? 'bg-slate-300 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}
            >
              Confirm Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
