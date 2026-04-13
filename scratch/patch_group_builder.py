
import sys
import os

filepath = r'd:\asset-audit-pro\src\client\components\GroupBuilderTab.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if 'auditGroups.length > 0 && (' in line and 'builderTab === 2' not in line: # Try to find the one in Tab 2
        # This is a bit risky but let's try to find the second one or use more context
        pass
    
    # Let's use more context for the replacement
    if '{auditGroups.length > 0 && (' in line:
        # Check if it has a button on the next line
        pass

# Actually simpler: replace the specific block based on line number if we trust it
target_start = 540 - 1 # 0-indexed
target_end = 548 # 1-indexed in view_file is 0-indexed for slice

replacement = """                     {isGroupSimulatorActive && (
                       <div className="flex items-center gap-3">
                          <button 
                            onClick={onCancelGroupSimulation}
                            className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                          >
                            Discard Draft
                          </button>
                          <button 
                            onClick={() => onCommitGroups?.(simulatedGroups)}
                            disabled={isProcessing || initLocked}
                            className="px-8 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2 border-2 border-emerald-500"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            Commit & Initialize Groups
                          </button>
                       </div>
                     )}
                     {!isGroupSimulatorActive && auditGroups.length > 0 && (
                       <button
                         onClick={handleResetAllGroups}
                         disabled={isProcessing || initLocked}
                         className="w-12 h-12 bg-white border-2 border-rose-200 text-rose-400 hover:bg-rose-50 rounded-xl transition-all flex items-center justify-center"
                       >
                         <Trash2 className="w-5 h-5" />
                       </button>
                     )}
"""

# Check if lines[target_start] actually matches
if '{auditGroups.length > 0 && (' in lines[target_start]:
    lines[target_start:target_end] = [replacement]
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Successfully patched")
else:
    print(f"Mismatch at line {target_start+1}: {lines[target_start]}")
    # Let's try to find the line
    for i, line in enumerate(lines):
        if '{auditGroups.length > 0 && (' in line and i > 500:
             print(f"Found at line {i+1}")
             lines[i:i+9] = [replacement]
             with open(filepath, 'w', encoding='utf-8') as f:
                 f.writelines(lines)
             print("Successfully patched at found index")
             break
