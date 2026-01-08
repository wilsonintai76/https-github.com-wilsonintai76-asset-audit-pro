
import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';

export const SystemSettings: React.FC = () => {
  const { departments, crossAuditPermissions: permissions, addCrossAuditPermission, removeCrossAuditPermission, toggleCrossAuditPermission } = useData();

  const [auditorDept, setAuditorDept] = useState('');
  const [targetDept, setTargetDept] = useState('');
  const [isMutual, setIsMutual] = useState(true);

  // Departments are objects now {id, name, ...}, assuming DataContext returns { departments: Department[] }
  // Wait, let's double check DataContext structure.
  // The DataContext had: `departments: Department[]` where Department has `name`.
  // The original props had `departments: string[]`.
  // I need to map `departments` to names or use the object.
  // Let's use `dept.name`.

  const availableDepts = departments.map(d => d.name).filter(d => d !== 'All');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (auditorDept && targetDept && auditorDept !== targetDept) {
      addCrossAuditPermission(auditorDept, targetDept, isMutual);
      setAuditorDept('');
      setTargetDept('');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-900">Institutional Audit Rules</h3>
          <p className="text-sm text-slate-500 mt-1">Configure cross-departmental auditing authorizations. Mutual rules allow departments to audit each other.</p>
        </div>

        <div className="p-6">
          <form onSubmit={handleAdd} className="flex flex-col gap-6 mb-8 p-6 bg-blue-50/30 rounded-2xl border border-blue-100">
            <div className="flex flex-col md:flex-row items-end gap-4">
              <div className="flex-grow space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Auditor Department</label>
                <select
                  required
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                  value={auditorDept}
                  onChange={e => setAuditorDept(e.target.value)}
                >
                  <option value="">Select Dept A</option>
                  {availableDepts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="flex items-center justify-center py-2 text-blue-500 text-lg">
                {isMutual ? <i className="fa-solid fa-arrows-left-right"></i> : <i className="fa-solid fa-arrow-right"></i>}
              </div>

              <div className="flex-grow space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Target Department</label>
                <select
                  required
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                  value={targetDept}
                  onChange={e => setTargetDept(e.target.value)}
                >
                  <option value="">Select Dept B</option>
                  {availableDepts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-blue-100 pt-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isMutual}
                    onChange={() => setIsMutual(!isMutual)}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-bold text-slate-900 block">Reciprocal Authorization</span>
                  <span className="text-[10px] text-slate-500 font-medium">Allow both departments to audit each other (Vice-Versa)</span>
                </div>
              </label>

              <button
                type="submit"
                disabled={!auditorDept || !targetDept || auditorDept === targetDept}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:grayscale"
              >
                Create Rule
              </button>
            </div>
          </form>

          <div className="space-y-3">
            <div className="px-2 text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Active Authorization Map</div>
            {permissions.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <i className="fa-solid fa-shield-halved text-slate-200 text-4xl mb-3"></i>
                <p className="text-sm text-slate-400 font-medium">No departmental rules defined yet.</p>
              </div>
            ) : (
              permissions.map(p => (
                <div key={p.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 transition-colors group">
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">{p.auditorDept}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Department A</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase mb-1 ${p.isMutual ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {p.isMutual ? 'Mutual' : 'One-Way'}
                      </div>
                      <i className={`fa-solid ${p.isMutual ? 'fa-arrows-left-right text-indigo-400' : 'fa-arrow-right text-slate-300'}`}></i>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">{p.targetDept}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Department B</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <span className={`text-[9px] font-black uppercase ${p.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {p.isActive ? 'Authorized' : 'Suspended'}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={p.isActive}
                        onChange={() => toggleCrossAuditPermission(p.id)}
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                    <button
                      onClick={() => removeCrossAuditPermission(p.id)}
                      className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <i className="fa-solid fa-trash-can text-sm"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
