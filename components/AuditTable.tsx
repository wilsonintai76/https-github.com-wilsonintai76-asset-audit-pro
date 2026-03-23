
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AuditSchedule, User, UserRole, Department, Location, CrossAuditPermission, AuditPhase, Building as BuildingType } from '../types';
import { useRBAC } from '../contexts/RBACContext';
import { AuditReportModal } from './AuditReportModal';
import { 
  ShieldOff, 
  Loader2, 
  X, 
  ChevronDown, 
  Building, 
  Layers,
  UserCheck, 
  Phone, 
  Lock, 
  RotateCcw, 
  FileText, 
  Search,
  Filter,
  Calendar
} from 'lucide-react';
import { PageHeader } from './PageHeader';
import { AuditorAssignmentSlot } from './AuditorAssignmentSlot';

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
  onUpdateAudit: (id: string, updates: Partial<AuditSchedule>) => void;
  onToggleStatus: (id: string) => void;
  allDepartments: Department[];
  allLocations: Location[];
  crossAuditPermissions: CrossAuditPermission[];
  auditPhases: AuditPhase[];
  maxAssetsPerDay: number;
  buildings?: BuildingType[];
}

export const AuditTable: React.FC<AuditTableProps> = ({ 
  schedules, users, currentUserName, userRoles, departments, selectedDept, onDeptChange, selectedStatus, onStatusChange,
  selectedPhaseId, onPhaseChange, onAssign, onUnassign, onUpdateDate, onUpdateAudit, onToggleStatus,
  allDepartments, allLocations, crossAuditPermissions, auditPhases,
  maxAssetsPerDay,
  buildings = []
}) => {
  const { hasPermission, rbacMatrix } = useRBAC();
  const [reportAudit, setReportAudit] = useState<AuditSchedule | null>(null);
  const [selectedBlock, setSelectedBlock] = useState('All');
  const [selectedLevel, setSelectedLevel] = useState('All');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Role Checks
  const isAdmin = userRoles.includes('Admin');
  const isCoordinator = userRoles.includes('Coordinator');
  const isSupervisor = userRoles.includes('Supervisor');
  const isAuditor = userRoles.includes('Auditor');
  const isStaff = userRoles.includes('Staff');

  // New Logic: Any of these roles *can* audit if they are certified.
  const hasFieldRole = isAdmin || isCoordinator || isSupervisor || isAuditor || isStaff;

  // Find Current User Data for Certification Check
  const currentUser = users.find(u => u.name === currentUserName);
  const currentUserDept = allDepartments.find(d => d.id === currentUser?.departmentId);
  const currentUserDeptName = currentUserDept?.name || "N/A";
  
  const isCertified = React.useMemo(() => {
    if (!currentUser?.certificationExpiry) return false;
    const expiry = new Date(currentUser.certificationExpiry);
    const now = new Date();
    return expiry > now;
  }, [currentUser]);

  // Combined concept: Eligible Field Auditor
  const canSelfAssignSelf = hasFieldRole && isCertified;

  const hasPerm = (perm: string) => hasPermission(perm, userRoles);

  const canEditDates = hasPerm('edit:audit:date');
  const canSelfAssignPerm = hasPerm('edit:audit:assign');
  const canViewAllSchedule = hasPerm('view:schedule:all');
  const canViewOwnSchedule = hasPerm('view:schedule:own');

  const hasPhases = auditPhases?.length > 0;
  const todayStr = new Date().toISOString().split('T')[0];

  // Reset child filters when parent filter changes
  useEffect(() => {
    setSelectedBlock('All');
    setSelectedLevel('All');
  }, [selectedDept]);

  useEffect(() => {
    setSelectedLevel('All');
  }, [selectedBlock]);

  const getBuildingAbbr = (buildingId?: string | null, buildingName?: string) => {
    if (buildingId) {
      const b = buildings.find(b => b.id === buildingId);
      if (b) return b.abbr;
    }
    if (buildingName) {
      const cleanName = buildingName.toLowerCase().trim();
      const b = buildings.find(b => b.name.toLowerCase().trim() === cleanName);
      if (b) return b.abbr;
      return buildingName;
    }
    return '';
  };

  const availableLocations = useMemo(() => {
    if (selectedDept === 'All') return allLocations;
    const dept = allDepartments.find(d => d.name === selectedDept);
    if (!dept) return [];
    return allLocations.filter(l => l.departmentId === dept.id);
  }, [selectedDept, allLocations, allDepartments]);

  const uniqueBlocks = useMemo(() => {
    const blocks = new Set(availableLocations.map(l => getBuildingAbbr(l.buildingId, l.building)).filter(Boolean));
    return ['All', ...Array.from(blocks)].sort();
  }, [availableLocations, buildings]);

  const uniqueLevels = useMemo(() => {
    let filtered = availableLocations;
    if (selectedBlock !== 'All') {
      filtered = filtered.filter(l => getBuildingAbbr(l.buildingId, l.building) === selectedBlock);
    }
    const levels = new Set(filtered.map(l => l.level).filter(Boolean));
    return ['All', ...Array.from(levels)].sort();
  }, [availableLocations, selectedBlock]);

  const getEntityName = (deptId: string) => {
    const dept = allDepartments.find(d => d.id === deptId);
    return dept?.auditGroupId || deptId;
  };

  const getPhaseName = (phaseId: string) => {
    return auditPhases.find(p => p.id === phaseId)?.name || 'Unknown Phase';
  };

  const canAuditDepartment = (targetDeptId: string) => {
    const myEntityId = getEntityName(currentUser?.departmentId || '');
    const targetEntityId = getEntityName(targetDeptId);

    // 1. Prevent self-audit at the entity level (Department or Group)
    if (myEntityId === targetEntityId && !isAdmin) return false;

    // 2. Check if a pairing exists in crossAuditPermissions
    const hasPermission = crossAuditPermissions.some(p => 
      p.auditorDeptId === myEntityId && 
      p.targetDeptId === targetEntityId && 
      p.isActive
    );
    
    return isAdmin || hasPermission;
  };

  const getUserContact = (userId: string) => {
    return users.find(u => u.id === userId)?.contactNumber;
  };

  const getSiteSupervisorContact = (locationName: string) => {
    const loc = allLocations.find(l => l.name === locationName);
    return loc?.contact || '';
  };

  const checkDateConflict = (date: string, auditId: string) => {
    return schedules.some(s => s.id !== auditId && s.date === date && (s.auditor1 === currentUserName || s.auditor2 === currentUserName));
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
    const audit = schedules.find(s => s.id === auditId);
    if (!audit) return;

    if (!hasFieldRole) {
      alert("ACTION BLOCKED: Your current role does not permit performing audits.");
      return;
    }
    if (!isCertified) {
      let disableReason = "";
      if (isSupervisor || isCoordinator || isAuditor) {
        disableReason = "Certification Required: Supervisors/Coordinators/Auditors must hold a valid certificate to audit.";
      } else {
        disableReason = "Certification Required: Your auditor certificate is expired or invalid.";
      }
      alert(`ACTION BLOCKED: ${disableReason}`);
      return;
    }
    if (!hasPhases) {
      alert("Self-assignment is locked until an audit phase is configured.");
      return;
    }

    // Explicit Pairing Check (Defense in Depth)
    if (!canAuditDepartment(audit.departmentId)) {
      const myEnt = getEntityName(currentUser?.departmentId || '');
      const targetEnt = getEntityName(audit.departmentId);
      const reason = myEnt === targetEnt ? "You cannot audit your own department." : "This location is outside your assigned audit matrix.";
      alert(`PAIRING RESTRICTION: ${reason}`);
      return;
    }

    if (!date) {
      alert("Please select a valid audit date before assigning yourself.");
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
    onAssign(auditId, slot, currentUser?.id || '');
  };


  const getStatusBadgeStyles = (status: string) => {
    switch(status) {
      case 'Completed': return 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 cursor-pointer';
      case 'In Progress': return 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300 cursor-pointer';
      default: return 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed';
    }
  };

  // Filter based on selected filters AND RBAC Scope
  const displaySchedules = useMemo(() => {
    return schedules.filter(s => {
      // 1. RBAC Scope Filtering
      if (!canViewAllSchedule && canViewOwnSchedule) {
          if (s.departmentId !== currentUser?.departmentId) return false;
      }
      if (!canViewAllSchedule && !canViewOwnSchedule) {
          // If no view permission, show nothing (should be handled by App.tsx redirect, but safe fallback)
          return false;
      }

      // 2. UI Filter logic
      const loc = allLocations.find(l => l.id === s.locationId);
      if (selectedBlock !== 'All' && getBuildingAbbr(loc?.buildingId, loc?.building) !== selectedBlock) return false;
      if (selectedLevel !== 'All' && loc?.level !== selectedLevel) return false;
      
      return true;
    });
  }, [schedules, selectedBlock, selectedLevel, allLocations, canViewAllSchedule, canViewOwnSchedule, currentUser]);

  const isAuditLocked = (audit: AuditSchedule) => {
    return !!(audit.date && (audit.auditor1Id || audit.auditor2Id));
  };

  const activePhase = useMemo(() => {
    const today = new Date();
    return (auditPhases || []).find(p => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return today >= start && today <= end;
    });
  }, [auditPhases]);

  return (
    <div className="space-y-6 flex flex-col flex-1 min-h-0">
      <PageHeader
        title="Audit Schedules"
        icon={Calendar}
        activePhase={activePhase}
        description="Plan and manage institutional audit windows and auditor assignments."
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
                {isSupervisor || isCoordinator || isAuditor ? 'Management override disabled.' : 'Authorization revoked.'} Your certification is expired.
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

      {/* Filters Bar */}
      <div className="bg-white rounded-[32px] p-4 border border-slate-200 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest mb-2 lg:mb-0 lg:mr-4">
                  <Filter className="w-4 h-4" />
                  Filters
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-grow">
                  {/* Department Filter */}
                  <div className="relative">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-1 block">Department</label>
                    <div className="relative">
                        <select
                        className="w-full pl-4 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer hover:bg-white"
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

                  {/* Block Filter */}
                  <div className="relative">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-1 block">Block / Building</label>
                    <div className="relative">
                        <select
                        className="w-full pl-4 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer hover:bg-white"
                        value={selectedBlock}
                        onChange={(e) => setSelectedBlock(e.target.value)}
                        >
                        {uniqueBlocks.map(b => {
                            if (b === 'All') return <option key={b} value={b}>All Blocks</option>;
                            const fullBuilding = buildings.find(building => building.abbr === b);
                            const displayName = fullBuilding ? `${b} | ${fullBuilding.name}` : b;
                            return <option key={b} value={b}>{displayName}</option>;
                        })}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3 pointer-events-none" />
                    </div>
                  </div>

                  {/* Level Filter */}
                  <div className="relative">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-1 block">Level</label>
                    <div className="relative">
                        <select
                        className="w-full pl-4 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer hover:bg-white"
                        value={selectedLevel}
                        onChange={(e) => setSelectedLevel(e.target.value)}
                        >
                        {uniqueLevels.map(l => (
                            <option key={l} value={l}>{l === 'All' ? 'All Levels' : l}</option>
                        ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3 pointer-events-none" />
                    </div>
                  </div>

                  {/* Status Filter */}
                  <div className="relative">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-1 block">Status</label>
                    <div className="relative">
                        <select
                        className="w-full pl-4 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer hover:bg-white"
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
                  </div>
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
         
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="w-full overflow-auto scrollbar-thumb-slate-300 rounded-[40px] flex-1">
          <table className="w-full text-left min-w-[1000px] border-separate border-spacing-0">
            <thead className="bg-slate-50/50 border-b border-slate-100 sticky top-0 z-20">
              <tr>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest w-48 sticky left-0 bg-slate-50 z-30 border-r border-slate-100">Date</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest w-64 sticky left-48 bg-slate-50 z-30 border-r border-slate-100">Location</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest w-64">Site Supervisor</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest w-64">Auditors</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest w-32 text-center">Status</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest w-16 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displaySchedules.map(audit => {
                const loc = allLocations.find(l => l.id === audit.locationId);
                const isCurrentUserAssigned = audit.auditor1Id === currentUser?.id || audit.auditor2Id === currentUser?.id;
                
                // Calculate assets assigned on this date
                const auditsOnDate = schedules.filter(s => s.date === audit.date && (s.auditor1Id === currentUser?.id || s.auditor2Id === currentUser?.id));
                const totalAssetsOnDate = auditsOnDate.reduce((sum, s) => {
                  const loc = allLocations.find(l => l.id === s.locationId);
                  return sum + (loc?.totalAssets || 0);
                }, 0);
                
                const currentLoc = allLocations.find(l => l.id === audit.locationId);
                const isUserOverLimit = !isCurrentUserAssigned && (totalAssetsOnDate + (currentLoc?.totalAssets || 0) > maxAssetsPerDay);
                
                const isPast = audit.date && audit.date < todayStr;
                const userCanAudit = canAuditDepartment(audit.departmentId);
                const isDateValid = isDateInValidPhase(audit.date, audit.phaseId);
                const locationLevel = loc?.level;

                const isLocked = isAuditLocked(audit);

                return (
                  <tr key={audit.id} className={`hover:bg-slate-50/50 transition-colors ${isLocked ? 'bg-slate-50/30 opacity-90' : ''}`}>
                    <td className="px-8 py-6 align-top sticky left-0 bg-white z-10 border-r border-slate-100">
                      <div className="flex flex-col gap-2">
                        <div className="relative group flex items-center gap-2">
                          <div className="relative flex-1 min-w-[130px]">
                            <Calendar className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10 ${
                              !audit.date ? 'text-amber-500' : 'text-slate-400'
                            }`} />
                            <input 
                              type="date" 
                              value={audit.date || ''}
                              disabled={!hasPhases || isLocked || !canEditDates}
                              onChange={(e) => handleDateChange(audit.id, e.target.value, audit.phaseId)}
                              className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold border outline-none transition-all ${
                                isLocked
                                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                  : !hasPhases
                                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                  : !audit.date 
                                  ? 'bg-amber-50 border-amber-100 text-amber-600 focus:ring-amber-500/20' 
                                  : !isDateValid
                                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-500/20 group-hover:bg-white'
                              }`}
                            />
                            {isLocked && (
                              <div className="absolute -top-3 right-0 z-20">
                                <div className="px-1.5 py-0.5 bg-slate-800 text-white text-[8px] font-black uppercase rounded flex items-center gap-1 shadow-sm">
                                  <Lock className="w-2 h-2" /> Locked
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {!isLocked && canEditDates && hasPhases && !audit.date && (
                            <button
                              onClick={() => {
                                const today = new Date().toISOString().split('T')[0];
                                const phase = auditPhases.find(p => p.id === audit.phaseId);
                                if (isDateInValidPhase(today, audit.phaseId)) {
                                  handleDateChange(audit.id, today, audit.phaseId);
                                } else if (phase) {
                                  handleDateChange(audit.id, phase.startDate, audit.phaseId);
                                }
                              }}
                              className="shrink-0 px-3 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 text-[10px] font-black uppercase tracking-widest active:scale-95"
                              title="Quick Pick: Set to Today or Phase Start"
                            >
                              Pick
                            </button>
                          )}
                        </div>
                        {isDateValid === false && audit.date && (
                          <div className="text-[9px] font-bold text-red-500 whitespace-nowrap bg-red-50 px-2 py-1 rounded-lg border border-red-100 w-fit">
                            Outside phase window
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 align-top sticky left-48 bg-white z-10 border-r border-slate-100">
                      <div className="flex flex-col gap-1.5">
                        <div className="font-bold text-slate-900 text-base">{loc?.name || audit.locationId}</div>
                        {loc?.building && (
                          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                            <Building className="w-3 h-3 opacity-40" />
                            {loc.building}
                          </div>
                        )}
                        {locationLevel && (
                          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                            <Layers className="w-3 h-3 opacity-40" />
                            {locationLevel}
                          </div>
                        )}
                        <span className="inline-flex w-fit px-2.5 py-1 bg-slate-100 text-slate-600 text-[9px] font-black uppercase rounded-lg border border-slate-200 mt-1 tracking-widest">
                          {allDepartments.find(d => d.id === audit.departmentId)?.name || audit.departmentId}
                        </span>
                      </div>
                    </td>

                    <td className="px-8 py-6 align-top">
                      <div className="flex flex-col gap-1.5">
                        <div className="font-bold text-slate-700 text-xs flex items-center gap-2.5">
                           <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                             <UserCheck className="w-4 h-4" />
                           </div>
                           {users.find(u => u.id === audit.supervisorId)?.name || audit.supervisorId}
                        </div>
                        {loc?.contact && (
                          <div className="flex items-center gap-2 pl-10.5">
                            <Phone className="w-3 h-3 text-slate-300" />
                            <span className="text-[10px] text-slate-400 font-bold font-mono tracking-tighter">{loc.contact}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-8 py-6 align-top">
                      <div className="space-y-3">
                        {[1, 2].map(slotNum => (
                          <AuditorAssignmentSlot
                            key={slotNum}
                            slotNum={slotNum as 1 | 2}
                            audit={audit}
                            users={users}
                            currentUser={currentUser}
                            canManageAssignments={(canEditDates || canSelfAssignPerm) && !isLocked}
                            canSelfAssignSelf={canSelfAssignSelf && !isLocked}
                            userCanAudit={userCanAudit}
                            isCurrentUserAssigned={isCurrentUserAssigned}
                            isPast={isPast}
                            isDateValid={isDateValid}
                            hasPhases={hasPhases}
                            isUserOverLimit={isUserOverLimit}
                            hasFieldRole={hasFieldRole}
                            isCertified={isCertified}
                            isSupervisor={isSupervisor}
                            isCoordinator={isCoordinator}
                            isAuditor={isAuditor}
                            onAssign={handleSelfAssign}
                            onUnassign={onUnassign}
                            getUserContact={getUserContact}
                            getEntityName={getEntityName}
                            maxAssetsPerDay={maxAssetsPerDay}
                          />
                        ))}
                      </div>
                    </td>

                    <td className="px-8 py-6 align-top text-center">
                      <button 
                        onClick={() => (canEditDates || isAdmin) && onToggleStatus(audit.id)}
                        disabled={!(canEditDates || isAdmin) || audit.status === 'Pending'}
                        className={`inline-flex items-center px-4 py-2 rounded-xl text-[10px] font-black uppercase border tracking-widest transition-all active:scale-95 ${getStatusBadgeStyles(audit.status)} ${!(canEditDates || isAdmin) && 'opacity-50 pointer-events-none'}`}
                      >
                        {audit.status}
                        {(canEditDates || isAdmin) && audit.status !== 'Pending' && <RotateCcw className="w-2 h-2 ml-2 opacity-40" />}
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
                        </div>
                    </td>
                  </tr>
                );
              })}
              {(!displaySchedules || displaySchedules.length === 0) && (
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
