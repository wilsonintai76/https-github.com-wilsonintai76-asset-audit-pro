
import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { AuditSchedule, User, UserRole, Department, Location, CrossAuditPermission, AuditPhase } from '../types';
import { NewAuditModal } from './NewAuditModal';
import { AuditReportModal } from './AuditReportModal';
import { parseSearchQuery } from '../services/geminiService';
import { 
  ShieldOff, 
  Wand2, 
  Loader2, 
  X, 
  ChevronDown, 
  FileSpreadsheet, 
  Plus, 
  Building, 
  Layers,
  UserCheck, 
  Phone, 
  Minus, 
  Lock, 
  UserMinus, 
  RotateCcw, 
  FileText, 
  Search,
  Trash2
} from 'lucide-react';

interface AuditTableProps {
  schedules: AuditSchedule[];
  users: User[];
  currentUserName: string;
  userRoles: UserRole[];
  departments: string[];
  selectedDept: string;
  onDeptChange: (dept: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedPhaseId: string;
  onPhaseChange: (id: string) => void;
  onAssign: (id: string, slot: 1 | 2, userId: string) => void;
  onUnassign: (id: string, slot: 1 | 2) => void;
  onUpdateDate: (id: string, newDate: string) => void;
  onToggleStatus: (id: string) => void;
  allDepartments: Department[];
  allLocations: Location[];
  onAddAudit: (audit: Omit<AuditSchedule, 'id' | 'status' | 'auditor1' | 'auditor2'>) => void;
  onBulkAddAudits: (audits: Omit<AuditSchedule, 'id'>[]) => void;
  onDeleteAudit: (id: string) => void;
  crossAuditPermissions: CrossAuditPermission[];
  auditPhases: AuditPhase[];
  onGenerateSchedules?: () => Promise<void>;
}

export const AuditTable: React.FC<AuditTableProps> = ({ 
  schedules, users, currentUserName, userRoles, departments, selectedDept, onDeptChange, selectedStatus, onStatusChange,
  selectedPhaseId, onPhaseChange, onAssign, onUnassign, onUpdateDate, onToggleStatus,
  allDepartments, allLocations, onAddAudit, onBulkAddAudits, onDeleteAudit, crossAuditPermissions, auditPhases,
  onGenerateSchedules
}) => {
  const [reportAudit, setReportAudit] = useState<AuditSchedule | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [localSearchTerm, setLocalSearchTerm] = useState(''); // Additional text filter from AI
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Role Checks
  const isAdmin = userRoles.includes('Admin');
  const isCoordinator = userRoles.includes('Coordinator');
  const isHeadOfDept = userRoles.includes('HeadOfDept');
  const isSupervisor = userRoles.includes('Supervisor');
  const isAuditor = userRoles.includes('Auditor');
  const isStaff = userRoles.includes('Staff');

  // Anyone with a field role CAN audit — but only if they are certified
  const hasFieldRole = isAdmin || isCoordinator || isHeadOfDept || isSupervisor || isAuditor || isStaff;

  // Find Current User Data for Certification Check
  const currentUser = users.find(u => u.name === currentUserName);
  const currentUserDeptId = currentUser?.departmentId || '';
  const currentUserDeptName = allDepartments.find(d => d.id === currentUserDeptId)?.name || "N/A";

  // UUID → display name helpers (AuditSchedule stores IDs, resolved here for display)
  const getDeptName = (id: string) => allDepartments.find(d => d.id === id)?.name || '';
  const getLocName = (id: string) => allLocations.find(l => l.id === id)?.name || '';
  const getUserDisplayName = (id: string | null | undefined): string | null =>
    !id ? null : (users.find(u => u.id === id)?.name ?? null);

  const isCertified = React.useMemo(() => {
    if (!currentUser?.certificationExpiry) return false;
    const expiry = new Date(currentUser.certificationExpiry);
    const now = new Date();
    return expiry > now;
  }, [currentUser]);

  // Combined concept: Eligible Field Auditor
  const canSelfAssignSelf = hasFieldRole && isCertified;

  // Permission Logic for Management Actions (Not self-assign)
  const canAddAudit = isAdmin || isCoordinator;
  const canManageAssignments = isAdmin || isCoordinator || isHeadOfDept || isSupervisor;
  const canToggleStatus = isAdmin || isCoordinator || isHeadOfDept || isSupervisor;

  const hasPhases = auditPhases.length > 0;
  const todayStr = new Date().toISOString().split('T')[0];

  const handleSmartSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setLocalSearchTerm('');
      onDeptChange('All');
      onStatusChange('All');
      return;
    }

    setIsSearching(true);
    try {
      const filters = await parseSearchQuery(searchQuery, departments);
      
      // Apply the AI interpreted filters
      if (filters.department) onDeptChange(filters.department);
      if (filters.status) onStatusChange(filters.status);
      if (filters.text) setLocalSearchTerm(filters.text);
      
    } catch (err) {
      console.error(err);
      // Fallback: just use text search
      setLocalSearchTerm(searchQuery);
    } finally {
      setIsSearching(false);
    }
  };

  // Returns the audit-group name (or dept name) for same-group conflict detection — accepts dept UUID
  const getEntityName = (deptId: string) => {
    const dept = allDepartments.find(d => d.id === deptId);
    return dept?.auditGroup || dept?.name || deptId;
  };

  const getPhaseName = (phaseId: string) => {
    return auditPhases.find(p => p.id === phaseId)?.name || 'Unknown Phase';
  };

  // targetDeptId: UUID of the audit's owning department
  const canAuditDepartment = (targetDeptId: string) => {
    const myEntity = getEntityName(currentUserDeptId);
    const targetEntity = getEntityName(targetDeptId);

    // Block same-dept or same-group (conflict of interest)
    if ((currentUserDeptId === targetDeptId || myEntity === targetEntity) && currentUserDeptId && !isAdmin) return false;

    const hasPermission = crossAuditPermissions.some(p =>
      p.auditorDeptId === currentUserDeptId &&
      p.targetDeptId === targetDeptId &&
      p.isActive
    );

    return isAdmin || hasPermission;
  };

  const getUserContact = (userId: string | null | undefined) => {
    return !userId ? undefined : users.find(u => u.id === userId)?.contactNumber;
  };

  const getSiteSupervisorContact = (locationId: string) => {
    const loc = allLocations.find(l => l.id === locationId);
    return loc?.contact || '';
  };

  const checkDateConflict = (date: string, auditId: string) => {
    return schedules.some(s => s.id !== auditId && s.date === date && (s.auditor1Id === currentUser?.id || s.auditor2Id === currentUser?.id));
  };

  const isDateInValidPhase = (dateStr: string, phaseId: string): boolean => {
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

  const handleDateChange = (id: string, newDate: string, phaseId: string) => {
    if (!hasPhases) {
        alert("Scheduling Disabled: An audit phase must be configured in System Settings before dates can be selected.");
        return;
    }
    if (newDate && !isDateInValidPhase(newDate, phaseId)) {
        const phase = auditPhases.find(p => p.id === phaseId);
        alert(`ACCESS DENIED: The date falls outside of ${phase?.name}'s window (${phase?.startDate} to ${phase?.endDate}).`);
        return;
    }
    onUpdateDate(id, newDate);
  };

  const handleSelfAssign = (auditId: string, slot: 1 | 2, date: string, phaseId: string) => {
    if (!hasFieldRole) {
      alert("ACTION BLOCKED: Your current role does not permit performing audits.");
      return;
    }
    if (!isCertified) {
      alert("ACTION BLOCKED: Your institutional certification is invalid or expired. All roles must hold an active certificate to self-assign to field audits.");
      return;
    }
    if (!hasPhases) {
      alert("Self-assignment is locked until an audit phase is configured.");
      return;
    }
    if (!date) {
      alert("Awaiting Date: The supervisor has not yet scheduled a date for this audit. Self-assignment is only available once a date is set.");
      return;
    }
    if (!isDateInValidPhase(date, phaseId)) {
        alert("The current date set for this audit is not within its valid phase. Please update the date first.");
        return;
    }
    const hasConflict = checkDateConflict(date, auditId);
    if (hasConflict) {
      alert("Schedule Conflict: You are already assigned to another audit on this date.");
      return;
    }
    const userId = currentUser?.id;
    if (!userId) return;
    onAssign(auditId, slot, userId);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (selectedPhaseId === 'All' || !selectedPhaseId) {
      alert("IMPORT BLOCKED: Please select a specific 'Audit Phase' from the filter buttons above (e.g., 'Phase 1') before importing. All imported audits will be assigned to the selected phase.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const newAudits: Omit<AuditSchedule, 'id'>[] = [];
        let skipped = 0;

        results.data.forEach((row: any) => {
          // Mapping based on user request:
          // LABEL -> building (Unique label)
          // PEGAWAI PENEMPATAN -> supervisor
          // BAHAGIAN -> department
          // LOKASI TERKINI -> location
          const location = row['LOKASI TERKINI'] || row['Location'] || row['location'];
          const department = row['BAHAGIAN'] || row['Department'] || row['department'];
          const supervisor = row['PEGAWAI PENEMPATAN'] || row['Supervisor'] || row['supervisor'];
          const building = row['LABEL'] || row['Building'] || row['building'] || '';
          const date = row['Date'] || row['date'] || '';

          if (location && department) {
            newAudits.push({
              location: String(location).trim(),
              department: String(department).trim(),
              supervisor: supervisor ? String(supervisor).trim() : 'To be filled',
              date: date, 
              building: String(building).trim(),
              phaseId: selectedPhaseId,
              status: 'Pending',
              auditor1: null,
              auditor2: null
            });
          } else {
            skipped++;
          }
        });

        if (newAudits.length > 0) {
          onBulkAddAudits(newAudits);
          alert(`Successfully scheduled ${newAudits.length} new audits for ${getPhaseName(selectedPhaseId)}.${skipped > 0 ? ` (${skipped} rows skipped due to missing required fields)` : ''}`);
        } else {
          alert("No valid audit rows found. Ensure CSV has 'LOKASI TERKINI' and 'BAHAGIAN' columns.");
        }
      },
      error: () => alert("Failed to parse CSV file.")
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getStatusBadgeStyles = (status: string) => {
    switch(status) {
      case 'Completed': return 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 cursor-pointer';
      case 'In Progress': return 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300 cursor-pointer';
      default: return 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed';
    }
  };

  // Filter based on local text search as well
  const displaySchedules = schedules.filter(s => {
    if (!localSearchTerm) return true;
    const term = localSearchTerm.toLowerCase();
    return (
      getLocName(s.locationId).toLowerCase().includes(term) ||
      getDeptName(s.departmentId).toLowerCase().includes(term) ||
      (getUserDisplayName(s.supervisorId) || '').toLowerCase().includes(term) ||
      (getUserDisplayName(s.auditor1Id) || '').toLowerCase().includes(term) ||
      (getUserDisplayName(s.auditor2Id) || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept=".csv"
      />

      {hasFieldRole && !isCertified && (
        <div className="bg-rose-600 text-white px-6 py-4 rounded-3xl shadow-xl shadow-rose-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">
              <ShieldOff className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-sm uppercase tracking-widest">Self-Assignment Locked</h4>
              <p className="text-xs text-rose-100 font-medium">
                {isSupervisor || isCoordinator ? 'Management override disabled.' : 'Authorization revoked.'} Your certification is expired.
              </p>
            </div>
          </div>
          <button 
            onClick={() => window.location.hash = '#profile'}
            className="px-4 py-2 bg-white text-rose-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-50 transition-colors shrink-0"
          >
            Check Status
          </button>
        </div>
      )}

      {/* Smart Search & Filters Bar */}
      <div className="bg-white rounded-[32px] p-2 border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-2">
          
          <form onSubmit={handleSmartSearch} className="flex-grow flex items-center bg-slate-50 rounded-2xl px-4 py-2 border border-transparent focus-within:border-blue-300 focus-within:bg-blue-50/30 transition-all">
             {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <Wand2 className="w-4 h-4 text-slate-400" />}
             <input 
                type="text" 
                placeholder="Ask Gemini to filter... (e.g. 'Show pending audits in Electrical')" 
                className="bg-transparent border-none w-full text-sm font-medium focus:ring-0 placeholder:text-slate-400 ml-2"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
             />
             {searchQuery && (
                <button type="button" onClick={() => { setSearchQuery(''); setLocalSearchTerm(''); onDeptChange('All'); onStatusChange('All'); }} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                </button>
             )}
          </form>

          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
              <div className="relative min-w-[140px]">
                <select
                  className="w-full pl-4 pr-8 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer hover:bg-slate-50"
                  value={selectedStatus}
                  onChange={(e) => onStatusChange(e.target.value)}
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3 pointer-events-none" />
              </div>

              <div className="relative min-w-[180px]">
                <select
                  className="w-full pl-4 pr-8 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer hover:bg-slate-50"
                  value={selectedDept}
                  onChange={(e) => onDeptChange(e.target.value)}
                >
                  {departments.map(d => (
                    <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3 pointer-events-none" />
              </div>
          </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-2">
         {['All', ...auditPhases.map(p => ({ id: p.id, name: p.name }))].map(phase => {
             const isAll = typeof phase === 'string';
             const phaseId = isAll ? 'All' : (phase as any).id;
             const phaseName = isAll ? 'All Phases' : (phase as any).name;
             
             return (
              <button 
                key={phaseId} 
                onClick={() => onPhaseChange(phaseId)} 
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${selectedPhaseId === phaseId ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
              >
                 {phaseName}
              </button>
             );
         })}
         
         <div className="flex-grow"></div>

         {canAddAudit && (
          <div className="flex items-center gap-2">
            {onGenerateSchedules && (
              <button
                onClick={onGenerateSchedules}
                disabled={!hasPhases}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${!hasPhases ? 'bg-slate-100 text-slate-300 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'}`}
                title="Generate Pending schedule entries for all locations that don't have one in the active phase"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Generate Schedules
              </button>
            )}
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={!hasPhases}
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border ${!hasPhases ? 'bg-slate-100 text-slate-300 border-slate-200' : 'bg-white text-slate-500 border-slate-200 hover:text-emerald-500 hover:border-emerald-200'}`}
              title="Import CSV"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full text-left min-w-[1000px]">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest w-48">Date</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest w-32">Phase</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Location</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest w-64">Site Supervisor</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest w-64">Auditors</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest w-32 text-center">Status</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest w-16 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displaySchedules.map(audit => {
                const siteSupervisorContact = getSiteSupervisorContact(audit.locationId);
                const isCurrentUserAssigned = audit.auditor1Id === currentUser?.id || audit.auditor2Id === currentUser?.id;
                const isPast = audit.date && audit.date < todayStr;
                const userCanAudit = canAuditDepartment(audit.departmentId);
                const isDateValid = isDateInValidPhase(audit.date || '', audit.phaseId);
                const locationLevel = allLocations.find(l => l.id === audit.locationId)?.level;
                // Only the site supervisor/HeadOfDept (or admin/coordinator) may set the audit date
                const canEditDate = isAdmin || isCoordinator || isHeadOfDept || audit.supervisorId === currentUser?.id;

                return (
                  <tr key={audit.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6 align-top">
                      <div className="relative group">
                        <input 
                          type="date" 
                          value={audit.date || ''}
                          disabled={!hasPhases || !canEditDate}
                          onChange={(e) => handleDateChange(audit.id, e.target.value, audit.phaseId)}
                          title={!canEditDate ? 'Only the site supervisor or admin can set the audit date' : undefined}
                          className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold border outline-none transition-all ${
                            !hasPhases || !canEditDate
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                              : !audit.date 
                              ? 'bg-amber-50 border-amber-100 text-amber-600 focus:ring-amber-500/20' 
                              : !isDateValid
                              ? 'bg-rose-50 border-rose-200 text-rose-600'
                              : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-500/20 group-hover:bg-white'
                          }`}
                        />
                        {!canEditDate && <div className="text-[9px] text-center text-slate-400 font-medium mt-1">Supervisor sets date</div>}
                        {isDateValid === false && (
                          <div className="absolute -bottom-5 left-0 text-[9px] font-bold text-red-500 whitespace-nowrap">
                            Date outside phase window
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 align-top">
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-lg border border-blue-100 tracking-tight">
                        {getPhaseName(audit.phaseId)}
                      </span>
                    </td>

                    <td className="px-8 py-6 align-top">
                      <div className="flex flex-col gap-1.5">
                        <div className="font-bold text-slate-900 text-base">{getLocName(audit.locationId)}</div>
                        {audit.building && (
                          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                            <Building className="w-3 h-3 opacity-40" />
                            {audit.building}
                          </div>
                        )}
                        {locationLevel && (
                          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                            <Layers className="w-3 h-3 opacity-40" />
                            {locationLevel}
                          </div>
                        )}
                        <span className="inline-flex w-fit px-2.5 py-1 bg-slate-100 text-slate-600 text-[9px] font-black uppercase rounded-lg border border-slate-200 mt-1 tracking-widest">
                          {getDeptName(audit.departmentId)}
                        </span>
                      </div>
                    </td>

                    <td className="px-8 py-6 align-top">
                      <div className="flex flex-col gap-1.5">
                        <div className="font-bold text-slate-700 text-xs flex items-center gap-2.5">
                           <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                             <UserCheck className="w-4 h-4" />
                           </div>
                           {getUserDisplayName(audit.supervisorId) || 'Unassigned'}
                        </div>
                        {siteSupervisorContact && (
                          <div className="flex items-center gap-2 pl-10.5">
                            <Phone className="w-3 h-3 text-slate-300" />
                            <span className="text-[10px] text-slate-400 font-bold font-mono tracking-tighter">{siteSupervisorContact}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-8 py-6 align-top">
                      <div className="space-y-3">
                        {[1, 2].map(slotNum => {
                          const auditorId = slotNum === 1 ? audit.auditor1Id : audit.auditor2Id;
                          const auditorName = getUserDisplayName(auditorId);
                          const isAssigned = !!auditorId;
                          const contact = getUserContact(auditorId);
                          const isMe = auditorId === currentUser?.id;
                          
                          const canRemove = isAssigned && (canManageAssignments || isMe) && !isPast;
                          
                          // Check eligibility: Has field role + Valid Cert + No Conflict + Date set
                          const isDisabled = isAssigned || !canSelfAssignSelf || !userCanAudit || isCurrentUserAssigned || isPast || !isDateValid || !hasPhases || !audit.date;
                          
                          let disableReason = "";
                          if (isAssigned) {
                            disableReason = "Slot already occupied";
                          } else if (!hasFieldRole) {
                            disableReason = "Access Denied: Your role does not permit auditing.";
                          } else if (!isCertified) {
                            disableReason = "Certification Required: You must hold a valid institutional certificate to audit, regardless of role.";
                          } else if (!userCanAudit) {
                             const myEnt = getEntityName(currentUserDeptId);
                             const targetEnt = getEntityName(audit.departmentId);
                             disableReason = myEnt === targetEnt ? "Conflict of Interest: You cannot audit your own department group." : "Unauthorized Target: This location is outside your assigned cross-audit matrix.";
                          } else if (isCurrentUserAssigned) {
                            disableReason = "Already assigned to a slot in this audit instance.";
                          } else if (isPast) {
                            disableReason = "This audit date has already passed.";
                          } else if (!hasPhases) {
                            disableReason = "Scheduling is locked until an active phase is configured.";
                          } else if (!audit.date) {
                            disableReason = "Awaiting date: The supervisor must schedule a date before self-assignment is allowed.";
                          } else if (!isDateValid) {
                            disableReason = "The current audit date is outside the authorized phase window.";
                          }

                          return (
                            <div key={slotNum} className="min-h-[44px]">
                              {isAssigned ? (
                                <div className="flex items-center justify-between w-full bg-blue-50/50 rounded-xl p-2 border border-blue-100 group transition-all">
                                  <div className="min-w-0 pr-2">
                                    <div className="text-xs font-black text-slate-900 truncate flex items-center gap-1.5 uppercase tracking-tighter">
                                      {auditorName}
                                      {isMe && <span className="text-[10px] text-blue-600 font-bold normal-case ml-1">(You)</span>}
                                    </div>
                                      {contact && (
                                      <div className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5 font-bold">
                                        <Phone className="w-2 h-2 opacity-50" />
                                        {contact}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {canRemove && (
                                    <button 
                                      onClick={() => onUnassign(audit.id, slotNum as 1|2)}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:bg-red-500 hover:text-white transition-all shrink-0"
                                      title="Remove Assignment"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <button 
                                  onClick={() => !isDisabled && handleSelfAssign(audit.id, slotNum as 1|2, audit.date, audit.phaseId)}
                                  disabled={isDisabled}
                                  className={`w-full h-[44px] flex items-center justify-center border-2 border-dashed rounded-xl transition-all relative overflow-hidden group ${
                                    isDisabled 
                                      ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed' 
                                      : 'border-slate-200 bg-white text-slate-400 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-500 active:scale-[0.98]'
                                  }`}
                                  title={isDisabled ? disableReason : "Self-Assign to this slot as a Certified Auditor"}
                                >
                                  {isDisabled && (
                                    <div className="absolute top-0 right-0 p-1 opacity-20 group-hover:opacity-40 transition-opacity">
                                      <Lock className="w-2 h-2" />
                                    </div>
                                  )}
                                  <div className="flex flex-col items-center leading-none">
                                    {!isDisabled ? (
                                      <>
                                        <span className="text-[10px] font-black uppercase tracking-widest hidden group-hover:block">Assign Self</span>
                                        <Plus className="w-4 h-4 group-hover:mt-1" />
                                        <span className="text-[9px] font-bold opacity-70 group-hover:hidden">Empty Slot</span>
                                      </>
                                    ) : (
                                      <>
                                        <UserMinus className="w-4 h-4 mb-1 opacity-40" />
                                        <span className="text-[8px] font-black uppercase tracking-tighter px-2 truncate w-full text-center">
                                          {!hasFieldRole ? 'Role Denied' : !isCertified ? 'Uncertified' : !audit.date ? 'No Date Set' : 'Locked'}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    <td className="px-8 py-6 align-top text-center">
                      <button 
                        onClick={() => canToggleStatus && onToggleStatus(audit.id)}
                        disabled={!canToggleStatus || audit.status === 'Pending'}
                        className={`inline-flex items-center px-4 py-2 rounded-xl text-[10px] font-black uppercase border tracking-widest transition-all active:scale-95 ${getStatusBadgeStyles(audit.status)} ${!canToggleStatus && 'opacity-50 pointer-events-none'}`}
                      >
                        {audit.status}
                        {canToggleStatus && audit.status !== 'Pending' && <RotateCcw className="w-2 h-2 ml-2 opacity-40" />}
                      </button>
                    </td>

                    <td className="px-8 py-6 align-top text-center">
                        <div className="flex items-center justify-center gap-2">
                          {audit.status === 'Completed' && (
                              <button
                                  onClick={() => setReportAudit(audit)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors border border-slate-100 hover:border-blue-100 shadow-sm"
                                  title="Generate Formal Completion Report (AI)"
                              >
                                  <FileText className="w-4 h-4" />
                              </button>
                          )}
                          {canAddAudit && (
                            <button
                              onClick={() => onDeleteAudit(audit.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors border border-slate-100 hover:border-rose-100 shadow-sm"
                              title="Delete Audit Schedule"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                    </td>
                  </tr>
                );
              })}
              {displaySchedules.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-24 text-center">
                    <div className="max-w-xs mx-auto">
                        <div className="w-20 h-20 bg-slate-50 rounded-[24px] flex items-center justify-center mx-auto mb-6">
                          <Search className="w-10 h-10 text-slate-200" />
                        </div>
                        <h4 className="text-slate-900 font-bold mb-2">No Audits Found</h4>
                        <p className="text-xs text-slate-400 font-medium">Try adjusting your filters or search terms.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reportAudit && (
        <AuditReportModal 
            audit={reportAudit}
            onClose={() => setReportAudit(null)}
        />
      )}
    </div>
  );
};
