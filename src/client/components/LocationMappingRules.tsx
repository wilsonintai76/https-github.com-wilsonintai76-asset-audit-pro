
import React, { useRef } from 'react';
import Papa from 'papaparse';
import { Location, LocationMapping } from '@shared/types';
import { MapPin, RefreshCw, Upload, ArrowRight, ChevronDown, Trash2 } from 'lucide-react';

interface LocationMappingRulesProps {
  locations: Location[];
  locationMappings: LocationMapping[];
  onAddLocationMapping: (mapping: Omit<LocationMapping, 'id'>) => Promise<void>;
  onDeleteLocationMapping: (id: string) => Promise<void>;
  onSyncLocationMappings: () => Promise<void>;
}

export const LocationMappingRules: React.FC<LocationMappingRulesProps> = ({
  locations,
  locationMappings,
  onAddLocationMapping,
  onDeleteLocationMapping,
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
        // Look for common location column names
        const locKey = Object.keys(rows[0] || {}).find(k =>
          /location|lokasi|bilik|room|place/i.test(k)
        );
        if (!locKey) {
          alert('Could not find a location column. Expected: Location, Lokasi, Bilik, or Room.');
          return;
        }
        const names = Array.from(
          new Set(rows.map(r => (r[locKey] || '').trim()).filter(Boolean))
        ).sort();
        setCsvSourceNames(names);
      },
    });
    e.target.value = '';
  };

  const handleAddRule = () => {
    if (!newMappingSource.trim() || !newMappingTargetId) {
      alert('Please provide both raw source name and target location.');
      return;
    }
    if (locationMappings.some(m => m.sourceName.toUpperCase() === newMappingSource.trim().toUpperCase())) {
      alert('A mapping for this source name already exists.');
      return;
    }
    onAddLocationMapping({ 
      sourceName: newMappingSource.trim(), 
      targetLocationId: newMappingTargetId 
    });
    setNewMappingSource('');
    setNewMappingTargetId('');
  };

  return (
    <div className="border border-sky-100 rounded-2xl overflow-hidden bg-sky-50/30">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-sky-50 border-b border-sky-100">
        <div className="flex items-center gap-3">
          <MapPin className="w-4 h-4 text-sky-500" />
          <h4 className="font-black text-sky-800 text-sm uppercase tracking-widest">Location Name Mappings</h4>
        </div>
        <button
          onClick={async () => {
            setIsSyncing(true);
            await onSyncLocationMappings();
            setIsSyncing(false);
          }}
          disabled={isSyncing || locationMappings.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-sky-500/20 hover:bg-sky-700 transition-all active:scale-95 disabled:opacity-40 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Locations'}
        </button>
      </div>

      <div className="p-5 space-y-5">
        <p className="text-xs text-slate-500 leading-relaxed">
          Map messy location names from your CSV (e.g., <code className="bg-white px-1 py-0.5 rounded border border-slate-200">Blok AAras 3Bilik 09</code>) 
          to official, structured locations. These rules will be applied automatically during future imports.
        </p>

        {/* Manual Rule Helper */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black uppercase text-slate-500 tracking-widest mb-1">Import Helper</p>
            <p className="text-xs text-slate-500">Upload an Asset CSV to quickly extract all raw location strings.</p>
          </div>
          <input ref={csvMappingRef} type="file" accept=".csv" className="hidden" aria-label="Upload source CSV file" onChange={handleCsvHelperUpload} />
          <button
            onClick={() => csvMappingRef.current?.click()}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition-all active:scale-95 shrink-0"
          >
            <Upload className="w-3.5 h-3.5" /> Upload CSV
          </button>
        </div>

        {/* Add Rule Row */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr,auto] gap-3 items-center">
          <div className="relative">
             <input 
               type="text"
               placeholder={csvSourceNames.length === 0 ? "Enter raw name from CSV..." : "Select or type raw name..."}
               className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-sky-500/20"
               value={newMappingSource}
               onChange={e => setNewMappingSource(e.target.value)}
               list="raw-location-names"
             />
             <datalist id="raw-location-names">
               {csvSourceNames.map(n => <option key={n} value={n} />)}
             </datalist>
          </div>
          <div className="flex items-center text-slate-300 justify-center">
            <ArrowRight className="w-5 h-5" />
          </div>
          <div className="relative">
            <select
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-sky-500/20 appearance-none"
              value={newMappingTargetId}
              onChange={e => setNewMappingTargetId(e.target.value)}
            >
              <option value="">Select Official Location</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.buildingId || 'No Building'})</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
          </div>
          <button
            onClick={handleAddRule}
            disabled={!newMappingSource.trim() || !newMappingTargetId}
            className="px-5 py-2.5 bg-sky-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-sky-500/20 hover:bg-sky-700 transition-all disabled:opacity-50"
          >
            Add Rule
          </button>
        </div>

        {/* Rules Table */}
        {locationMappings.length > 0 ? (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                <tr>
                  <th className="py-2.5 px-4 font-bold text-[10px] text-slate-500 uppercase tracking-wider border-b">Raw Source (CSV)</th>
                  <th className="py-2.5 px-4 font-bold text-[10px] text-slate-500 uppercase tracking-wider border-b">Target (App Location)</th>
                  <th className="py-2.5 px-4 font-bold text-[10px] text-slate-500 uppercase tracking-wider border-b w-20 text-center">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {locationMappings.map(mapping => {
                  const targetLoc = locations.find(l => l.id === mapping.targetLocationId);
                  return (
                    <tr key={mapping.id} className="hover:bg-sky-50/30 transition-colors">
                      <td className="py-3 px-4 text-sm font-bold text-slate-900 truncate max-w-[200px]" title={mapping.sourceName}>
                        {mapping.sourceName}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {targetLoc ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-sky-700">{targetLoc.name}</span>
                            <span className="text-[10px] text-slate-400">{targetLoc.buildingId} • Aras {targetLoc.level}</span>
                          </div>
                        ) : <span className="text-red-500 italic">Unknown Location</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onDeleteLocationMapping(mapping.id)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                          title="Delete mapping rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 bg-white/50 rounded-xl border border-dashed border-slate-300">
            <p className="text-sm text-slate-400">No location mapping rules defined.</p>
          </div>
        )}
      </div>
    </div>
  );
};
