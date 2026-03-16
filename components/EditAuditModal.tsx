import React, { useState, useMemo, useEffect } from 'react';
import { AuditSchedule, Department, Location, AuditPhase, User } from '../types';
import { X, CalendarDays, ChevronDown, CalendarPlus } from 'lucide-react';

interface EditAuditModalProps {
  audit: AuditSchedule;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<AuditSchedule>) => void;
  departments: Department[];
  locations: Location[];
  auditPhases: AuditPhase[];
  users: User[];
}

export const EditAuditModal: React.FC<EditAuditModalProps> = ({ audit, onClose, onUpdate, departments, locations, auditPhases, users }) => {
  const [formData, setFormData] = useState({
    departmentId: audit.departmentId || '',
    locationId: audit.locationId || '',
    supervisorId: audit.supervisorId || '',
    date: audit.date || '',
    phaseId: audit.phaseId || ''
  });

  const hasPhases = auditPhases?.length > 0;
  const today = new Date().toISOString().split('T')[0];

  const selectedPhase = useMemo(() => 
    auditPhases.find(p => p.id === formData.phaseId), 
    [auditPhases, formData.phaseId]
  );

  const availableLocations = useMemo(() => {
    if (!formData.departmentId) return [];
    return locations.filter(loc => loc.departmentId === formData.departmentId);
  }, [locations, formData.departmentId]);

  const handleDeptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      departmentId: e.target.value,
      locationId: '',
      supervisorId: ''
    }));
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const locId = e.target.value;
    const selectedLoc = locations.find(l => l.id === locId);
    
    setFormData(prev => ({
      ...prev,
      locationId: locId,
      supervisorId: selectedLoc?.supervisorId || ''
    }));
  };

  const isDateInValidPhase = (dateStr: string, phaseId: string): boolean => {
    if (!auditPhases || auditPhases.length === 0) return false; 
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
    if (!formData.phaseId) {
        alert("Please select a target Audit Phase.");
        return;
    }
    if (formData.date && !isDateInValidPhase(formData.date, formData.phaseId)) {
        alert(`The selected date falls outside of the authorized window for ${selectedPhase?.name}.`);
        return;
    }
    onUpdate(audit.id, formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-blue-600 p-5 md:p-6 text-white flex items-center justify-between">
          <div>
            <h3 className="text-lg md:text-xl font-bold">Edit Audit Schedule</h3>
            <p className="text-blue-100 text-[10px] md:text-xs mt-1">Update the details for this audit.</p>
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
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400 w-4 h-4 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Department</label>
              <div className="relative">
                <select
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm appearance-none cursor-pointer"
                  value={formData.departmentId}
                  onChange={handleDeptChange}
                >
                  <option value="">Select Department</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
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
                  disabled={!formData.departmentId || !formData.phaseId}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm appearance-none cursor-pointer disabled:opacity-50"
                  value={formData.locationId}
                  onChange={handleLocationChange}
                >
                  <option value="">
                    {!formData.phaseId ? 'Select Phase First' : 
                     !formData.departmentId ? 'Select Dept First' : 
                     !availableLocations || availableLocations.length === 0 ? 'No locations found' : 'Select Location'}
                  </option>
                  {availableLocations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Site Supervisor</label>
              <div className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600">
                {formData.supervisorId ? (users.find(u => u.id === formData.supervisorId)?.name || formData.supervisorId) : 'No supervisor assigned'}
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Audit Date</label>
              <div className="relative group">
                <input 
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
              disabled={!formData.phaseId || !formData.locationId}
              className={`w-full sm:flex-[2] py-3 text-white font-bold rounded-2xl transition-all shadow-lg text-sm active:scale-95 ${!formData.phaseId || !formData.locationId ? 'bg-slate-300 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
