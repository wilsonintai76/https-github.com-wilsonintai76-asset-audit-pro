
import React, { useRef } from 'react';
import Papa from 'papaparse';
import { Department, DepartmentMapping } from '../types';
import { Sliders, RefreshCw, Upload, ArrowRight, ChevronDown } from 'lucide-react';

interface MappingRulesProps {
  departments: Department[];
  departmentMappings: DepartmentMapping[];
  onAddDepartmentMapping: (mapping: Omit<DepartmentMapping, 'id'>) => Promise<void>;
  onDeleteDepartmentMapping: (id: string) => Promise<void>;
  onSyncLocationMappings: () => Promise<void>;
}

export const MappingRules: React.FC<MappingRulesProps> = ({
  departments,
  departmentMappings,
  onAddDepartmentMapping,
  onDeleteDepartmentMapping,
  onSyncLocationMappings,
}) => {
  const csvMappingRef = useRef<HTMLInputElement>(null);
  const [newMappingSource, setNewMappingSource] = React.useState('');
  const [newMappingTargetId, setNewMappingTargetId] = React.useState('');
  const [csvSourceNames, setCsvSourceNames] = React.useState<string[]>([]);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const handleCsvHelperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        const deptKey = Object.keys(rows[0] || {}).find(k =>
          /department|jabatan|dept|bahagian/i.test(k)
        );
        if (!deptKey) {
          alert('Could not find a department column. Expected: Department, Jabatan, Bahagian, or Dept.');
          return;
        }
        const names = Array.from(
          new Set(rows.map(r => (r[deptKey] || '').trim().toUpperCase()).filter(Boolean))
        ).sort();
        setCsvSourceNames(names);
      },
    });
    e.target.value = '';
  };

  const handleAddRule = () => {
    if (!newMappingSource.trim() || !newMappingTargetId) {
      alert('Please provide both source name and target department.');
      return;
    }
    if (departmentMappings.some(m => m.sourceName.toUpperCase() === newMappingSource.trim().toUpperCase())) {
      alert('A mapping for this source name already exists.');
      return;
    }
    onAddDepartmentMapping({ sourceName: newMappingSource.trim(), targetDepartmentId: newMappingTargetId });
    setNewMappingSource('');
    setNewMappingTargetId('');
  };

  return (
    <div className="border border-indigo-100 rounded-2xl overflow-hidden bg-indigo-50/30">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-indigo-50 border-b border-indigo-100">
        <div className="flex items-center gap-3">
          <Sliders className="w-4 h-4 text-indigo-500" />
          <h4 className="font-black text-indigo-800 text-sm uppercase tracking-widest">Current Mapping Rules</h4>
        </div>
        <button
          onClick={async () => {
            setIsSyncing(true);
            await onSyncLocationMappings();
            setIsSyncing(false);
          }}
          disabled={isSyncing || departmentMappings.length === 0}
          title="Re-apply all mapping rules to existing locations"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Locations'}
        </button>
      </div>

      <div className="p-5 space-y-5">
        <p className="text-xs text-slate-500">
          Map raw department names from your asset CSV to official departments. Rules apply automatically during Step 3.
          Use <span className="font-bold">Sync Locations</span> only to manually repair existing data after the fact.
        </p>

        {/* Manual Rule Helper */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black uppercase text-slate-500 tracking-widest mb-1">Manual Rule Helper</p>
            <p className="text-xs text-slate-500">Upload any asset CSV to extract department names for the dropdown below.</p>
          </div>
          <input ref={csvMappingRef} type="file" accept=".csv" className="hidden" onChange={handleCsvHelperUpload} />
          <button
            onClick={() => csvMappingRef.current?.click()}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition-all active:scale-95 shrink-0"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Source CSV
          </button>
        </div>

        {/* Add Rule Row */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:w-2/5">
            <select
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none"
              value={newMappingSource}
              onChange={e => setNewMappingSource(e.target.value)}
            >
              <option value="">{csvSourceNames.length === 0 ? '← Upload Asset CSV first' : 'Pick raw dept name from CSV'}</option>
              {csvSourceNames
                .filter(n => !departmentMappings.some(m => m.sourceName.toUpperCase() === n.toUpperCase()))
                .map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
          </div>
          <div className="flex items-center text-slate-400 justify-center">
            <ArrowRight className="w-5 h-5" />
          </div>
          <div className="relative w-full md:w-2/5">
            <select
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none"
              value={newMappingTargetId}
              onChange={e => setNewMappingTargetId(e.target.value)}
            >
              <option value="">Select Official Department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
          </div>
          <button
            onClick={handleAddRule}
            disabled={!newMappingSource.trim() || !newMappingTargetId}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all disabled:opacity-50 shrink-0"
          >
            Add Rule
          </button>
        </div>

        {/* Rules Table */}
        {departmentMappings.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="py-3 px-4 font-bold text-xs text-slate-500 uppercase tracking-wider border-b">Raw Source Name</th>
                  <th className="py-3 px-4 font-bold text-xs text-slate-500 uppercase tracking-wider border-b">Maps To (Official Dept)</th>
                  <th className="py-3 px-4 font-bold text-xs text-slate-500 uppercase tracking-wider border-b w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {departmentMappings.map(mapping => {
                  const targetDept = departments.find(d => d.id === mapping.targetDepartmentId);
                  return (
                    <tr key={mapping.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-sm font-bold text-slate-900">{mapping.sourceName}</td>
                      <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-600">
                        {targetDept ? targetDept.name : <span className="text-red-500 italic">Unknown Dept</span>}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          onClick={() => {
                            if (confirm(`Remove mapping for "${mapping.sourceName}"?`)) {
                              onDeleteDepartmentMapping(mapping.id);
                            }
                          }}
                          className="text-xs font-bold text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 bg-white rounded-xl border border-dashed border-slate-300">
            <p className="text-sm text-slate-500 font-medium">No mapping rules defined.</p>
            <p className="text-xs text-slate-400 mt-1">Add rules above or import a Mapping CSV in Step 2.</p>
          </div>
        )}

        {/* Ready Banner */}
        {departmentMappings.length > 0 && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-xs text-emerald-800">
            <span className="text-lg leading-none">✓</span>
            <div>
              <p className="font-black uppercase tracking-widest text-emerald-700 mb-0.5">Mapping rules ready</p>
              <p>Proceed to <span className="font-bold">Step 3 — Sync Assets &amp; Locations</span> below to apply them.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
