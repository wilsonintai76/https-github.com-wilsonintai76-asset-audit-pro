
import React, { useState, useMemo, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { AuditSchedule, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';

type SortField = 'location' | 'date' | 'department';
type SortDirection = 'asc' | 'desc';

import { ConfirmationModal } from './ConfirmationModal';

interface AssignmentDropdownProps {
  users: User[];
  schedules: AuditSchedule[];
  currentAuditId: string;
  currentAuditDate: string;
  currentUserName: string;
  onSelect: (userName: string) => void;
  onClose: () => void;
}

const AssignmentDropdown: React.FC<AssignmentDropdownProps> = ({
  users,
  schedules,
  currentAuditId,
  currentAuditDate,
  currentUserName,
  onSelect,
  onClose
}) => {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const checkConflict = (userName: string) => {
    return schedules.some(s =>
      s.id !== currentAuditId &&
      s.date === currentAuditDate &&
      (s.auditor1 === userName || s.auditor2 === userName)
    );
  };

  const sortedAndFilteredUsers = useMemo(() => {
    const term = search.toLowerCase();
    const filtered = users.filter(u =>
      u.status === 'Active' &&
      (u.name.toLowerCase().includes(term) || u.department?.toLowerCase().includes(term))
    );

    return [...filtered].sort((a, b) => {
      const conflictA = checkConflict(a.name);
      const conflictB = checkConflict(b.name);
      if (conflictA && !conflictB) return 1;
      if (!conflictA && conflictB) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [users, search, schedules, currentAuditDate, currentAuditId]);

  const handleUserSelect = (userName: string) => {
    if (checkConflict(userName)) {
      const proceed = window.confirm(`WARNING: ${userName} already has an assignment on ${currentAuditDate}. Proceed with duplicate assignment?`);
      if (!proceed) return;
    }
    onSelect(userName);
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute z-[110] mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
    >
      <div className="p-3 border-b border-slate-100 bg-slate-50/50">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Assign Auditor for {currentAuditDate}</div>
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]"></i>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search all active auditors..."
            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto py-2">
        {sortedAndFilteredUsers.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-slate-400">No auditors found</div>
        ) : (
          sortedAndFilteredUsers.map(user => {
            const hasConflict = checkConflict(user.name);
            return (
              <button
                key={user.id}
                onClick={() => handleUserSelect(user.name)}
                className={`w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 ${hasConflict ? 'bg-amber-50/30' : ''}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${hasConflict ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                  {user.name[0]}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="text-xs font-bold text-slate-900 flex items-center justify-between gap-2">
                    <span className="truncate">{user.name}</span>
                    {hasConflict && (
                      <span className="shrink-0 flex items-center gap-1 text-[8px] bg-amber-50 text-amber-500 px-1 py-0.5 rounded font-black uppercase border border-amber-100">
                        Conflict
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{user.department}</div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

interface ExportModalProps {
  onClose: () => void;
  onExport: (columns: string[]) => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ onClose, onExport }) => {
  const availableColumns = [
    { id: 'date', label: 'Audit Date' },
    { id: 'location', label: 'Location' },
    { id: 'department', label: 'Department' },
    { id: 'supervisor', label: 'Supervisor' },
    { id: 'auditor1', label: 'Auditor 1' },
    { id: 'auditor2', label: 'Auditor 2' },
    { id: 'status', label: 'Status' },
    { id: 'building', label: 'Building' },
    { id: 'assetCount', label: 'Asset Count' },
  ];

  const [selected, setSelected] = useState<string[]>(availableColumns.map(c => c.id));

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold">Export Schedule</h3>
            <p className="text-slate-400 text-xs mt-1">Select columns to include in CSV export.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {availableColumns.map(col => (
              <label
                key={col.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${selected.includes(col.id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                  checked={selected.includes(col.id)}
                  onChange={() => toggle(col.id)}
                />
                <span className="text-xs font-bold text-slate-700">{col.label}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-grow py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => onExport(selected)}
              className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10 text-sm active:scale-95"
            >
              Download CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AuditTable: React.FC = () => {
  const { currentUser } = useAuth();
  const { schedules, users, crossAuditPermissions, departments: deptList, updateAudit, addNotification } = useData();

  // Local View State
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedAudit, setSelectedAudit] = useState<AuditSchedule | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [activeDropdown, setActiveDropdown] = useState<{ id: string, slot: 1 | 2 } | null>(null);

  // Dropdown UI states
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);

  const deptDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Derived Values
  const userRoles = currentUser?.roles || [];
  const currentUserName = currentUser?.name || '';
  const currentUserDept = currentUser?.department || 'N/A';

  const departmentNames = useMemo(() => {
    const names = new Set(deptList.map(d => d.name));
    schedules.forEach(s => names.add(s.department));
    return ['All', ...Array.from(names)].sort();
  }, [deptList, schedules]);

  // Click Outside Handlers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) {
        setIsDeptDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- ACTIONS (Re-implemented with Context) ---

  const handleAssign = async (id: string, slot: 1 | 2, userName: string) => {
    const audit = schedules.find(s => s.id === id);
    if (!audit) return;

    const isSupervisor = userRoles.includes('Supervisor');
    const isAdmin = userRoles.includes('Admin');

    if (isSupervisor && !isAdmin && audit.department !== currentUserDept) {
      addNotification('Unauthorized', 'Supervisors can only manage audits for their own department.', 'urgent');
      return;
    }

    const a1 = slot === 1 ? userName : audit.auditor1;
    const a2 = slot === 2 ? userName : audit.auditor2;
    const auditorCount = [a1, a2].filter(Boolean).length;

    const updates: Partial<AuditSchedule> = {
      auditor1: a1,
      auditor2: a2,
    };

    if (audit.status !== 'Completed') {
      updates.status = auditorCount === 2 ? 'In Progress' : 'Pending';
    }

    await updateAudit(id, updates);
    addNotification('Assignment Confirmed', `${userName} assigned to ${audit.location}.`, 'success');
  };

  const handleUpdateDate = async (id: string, newDate: string) => {
    const audit = schedules.find(s => s.id === id);
    if (!audit) return;

    const isSupervisor = userRoles.includes('Supervisor');
    const isAdmin = userRoles.includes('Admin');

    if (isSupervisor && !isAdmin && audit.department !== currentUserDept) {
      addNotification('Unauthorized', 'Supervisors can only update schedule dates for their own department.', 'urgent');
      return;
    }

    await updateAudit(id, { date: newDate });
    addNotification('Schedule Updated', `Audit rescheduled to ${newDate}.`, 'info');
  };

  const handleUpdateAuditStatus = async (id: string, status: AuditSchedule['status']) => {
    const audit = schedules.find(s => s.id === id);
    if (!audit) return;

    const isSupervisor = userRoles.includes('Supervisor');
    const isAdmin = userRoles.includes('Admin');
    const isAuditor = userRoles.includes('Auditor');
    const isAssigned = audit.auditor1 === currentUserName || audit.auditor2 === currentUserName;

    if (!isAdmin && !isSupervisor && (!isAuditor || !isAssigned)) {
      addNotification('Unauthorized', 'Only assigned auditors or managers can change audit status.', 'urgent');
      return;
    }

    await updateAudit(id, { status });
    addNotification('Status Updated', `Audit for ${audit.location} marked as ${status}.`, 'success');
  };

  // Confirmation State
  const [unassignData, setUnassignData] = useState<{ id: string, slot: 1 | 2, location: string } | null>(null);

  const handleUnassignClick = (id: string, slot: 1 | 2) => {
    const audit = schedules.find(s => s.id === id);
    if (!audit) return;

    const isSupervisor = userRoles.includes('Supervisor');
    const isAdmin = userRoles.includes('Admin');

    if (isSupervisor && !isAdmin && audit.department !== currentUserDept) {
      addNotification('Unauthorized', 'Supervisors can only unassign members within their department.', 'urgent');
      return;
    }

    setUnassignData({ id, slot, location: audit.location });
  };

  const confirmUnassign = async () => {
    if (!unassignData) return;
    const { id, slot } = unassignData;
    const audit = schedules.find(s => s.id === id);
    if (!audit) return;

    const a1 = slot === 1 ? null : audit.auditor1;
    const a2 = slot === 2 ? null : audit.auditor2;
    const auditorCount = [a1, a2].filter(Boolean).length;

    const updates: Partial<AuditSchedule> = {
      auditor1: a1,
      auditor2: a2
    };

    if (auditorCount < 2 && audit.status !== 'Completed') {
      updates.status = 'Pending';
    }

    await updateAudit(id, updates);
    addNotification('Assignment Removed', `Assignment removed from ${audit.location}.`, 'info');
    setUnassignData(null);
  };


  // --- FILTERING ---
  const filteredSchedules = useMemo(() => {
    if (!currentUser) return [];

    // Logic copied from App.tsx
    const authorizedAuditeeDepts = crossAuditPermissions
      .filter(p => p.isActive)
      .flatMap(p => {
        const auths = [];
        if (p.auditorDept === currentUserDept) auths.push(p.targetDept);
        if (p.isMutual && p.targetDept === currentUserDept) auths.push(p.auditorDept);
        return auths;
      });

    return schedules.filter(s => {
      const isSupervisor = userRoles.includes('Supervisor');
      const isAuditor = userRoles.includes('Auditor');
      const isAdmin = userRoles.includes('Admin');

      if (isSupervisor && !isAdmin) {
        if (s.department !== currentUserDept) return false;
      }

      if (isAuditor && !isAdmin && !isSupervisor) {
        const isOwnDept = s.department === currentUserDept;
        const isAuthorizedCrossDept = authorizedAuditeeDepts.includes(s.department);
        const isGeneral = s.department === 'General';
        if (!isOwnDept && !isAuthorizedCrossDept && !isGeneral) return false;
      } else if (selectedDept !== 'All' && s.department !== selectedDept) {
        return false;
      }

      if (selectedStatus !== 'All' && s.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [schedules, selectedDept, selectedStatus, currentUser, crossAuditPermissions, userRoles, currentUserDept]);

  // --- SORTING ---
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedSchedules = useMemo(() => {
    return [...filteredSchedules].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortField === 'location') {
        comparison = a.location.localeCompare(b.location);
      } else if (sortField === 'department') {
        comparison = a.department.localeCompare(b.department);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredSchedules, sortField, sortDirection]);

  // --- RENDER HELPERS ---

  const handleExport = (columns: string[]) => {
    const exportData = sortedSchedules.map(audit => {
      const row: any = {};
      columns.forEach(col => {
        row[col] = (audit as any)[col] || 'N/A';
      });
      return row;
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `institutional_audit_schedule_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportModalOpen(false);
  };

  const checkSelfConflict = (date: string, currentAuditId: string) => {
    return schedules.some(s =>
      s.id !== currentAuditId &&
      s.date === date &&
      (s.auditor1 === currentUserName || s.auditor2 === currentUserName)
    );
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-100 text-emerald-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <i className="fa-solid fa-sort ml-1.5 opacity-30"></i>;
    return sortDirection === 'asc'
      ? <i className="fa-solid fa-sort-up ml-1.5 text-blue-600"></i>
      : <i className="fa-solid fa-sort-down ml-1.5 text-blue-600"></i>;
  };

  const handleDateChange = (auditId: string, newDate: string) => {
    handleUpdateDate(auditId, newDate);
    setEditingDateId(null);
  };

  const statusOptions = ['All', 'Pending', 'In Progress', 'Completed'];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
      <div className="px-4 py-3 md:px-6 md:py-4 border-b border-slate-100 bg-slate-50/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
            <i className="fa-solid fa-calendar-day text-xs"></i>
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block leading-none mb-0.5 truncate">Chronological View</span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none truncate">Ordered by Audit Date</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
          >
            <i className="fa-solid fa-file-export text-blue-500"></i>
            Export CSV
          </button>

          <div className="flex items-center gap-2 relative" ref={statusDropdownRef}>
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest hidden sm:block">Status:</label>
            <button
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm min-w-[120px] transition-all hover:border-slate-300"
            >
              <i className="fa-solid fa-tags text-slate-400 text-[10px]"></i>
              <span className="flex-grow text-left">{selectedStatus}</span>
              <i className={`fa-solid fa-chevron-down text-[8px] text-slate-400 transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`}></i>
            </button>
            {isStatusDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-[110] animate-in fade-in slide-in-from-top-1">
                <div className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50 mb-1">
                  Select Status
                </div>
                {statusOptions.map(status => (
                  <button
                    key={status}
                    onClick={() => {
                      setSelectedStatus(status);
                      setIsStatusDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors flex items-center justify-between ${selectedStatus === status
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    {status}
                    {selectedStatus === status && <i className="fa-solid fa-check"></i>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {(userRoles.includes('Admin') || userRoles.includes('Supervisor')) && (
            <div className="flex items-center gap-2 relative" ref={deptDropdownRef}>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest hidden sm:block">Dept:</label>
              <button
                onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm min-w-[140px] transition-all hover:border-slate-300"
              >
                <i className="fa-solid fa-sitemap text-slate-400 text-[10px]"></i>
                <span className="flex-grow text-left truncate">{selectedDept}</span>
                <i className={`fa-solid fa-chevron-down text-[8px] text-slate-400 transition-transform ${isDeptDropdownOpen ? 'rotate-180' : ''}`}></i>
              </button>

              {isDeptDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-[110] animate-in fade-in slide-in-from-top-1">
                  <div className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50 mb-1">
                    Select Department
                  </div>
                  {departmentNames.map(dept => (
                    <button
                      key={dept}
                      onClick={() => {
                        setSelectedDept(dept);
                        setIsDeptDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors flex items-center justify-between ${selectedDept === dept
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                      {dept}
                      {selectedDept === dept && <i className="fa-solid fa-check"></i>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-200">
        <table className="w-full text-left border-collapse min-w-[800px] lg:min-w-full">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200">
              <th className="px-4 py-4 md:px-6 text-xs font-bold uppercase text-slate-500 tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('date')}>
                <div className="flex items-center">Date <SortIcon field="date" /></div>
              </th>
              <th className="px-4 py-4 md:px-6 text-xs font-bold uppercase text-slate-500 tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('location')}>
                <div className="flex items-center">Location <SortIcon field="location" /></div>
              </th>
              <th className="px-4 py-4 md:px-6 text-xs font-bold uppercase text-slate-500 tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('department')}>
                <div className="flex items-center">Department <SortIcon field="department" /></div>
              </th>
              <th className="px-4 py-4 md:px-6 text-xs font-bold uppercase text-slate-500 tracking-wider">Auditor 1</th>
              <th className="px-4 py-4 md:px-6 text-xs font-bold uppercase text-slate-500 tracking-wider">Auditor 2</th>
              <th className="px-4 py-4 md:px-6 text-xs font-bold uppercase text-slate-500 tracking-wider text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedSchedules.map((audit) => {
              const isToday = new Date(audit.date).toDateString() === new Date().toDateString();
              const isMyDept = audit.department === currentUserDept;
              const isAssignedToMe = audit.auditor1 === currentUserName || audit.auditor2 === currentUserName;
              const isLead = audit.auditor1 === currentUserName;

              const isAdmin = userRoles.includes('Admin');
              const isSupervisor = userRoles.includes('Supervisor');
              const isAuditor = userRoles.includes('Auditor');

              const canPickDate = (isLead || (isAssignedToMe && !audit.auditor1)) || (isSupervisor && isMyDept) || (isAdmin);
              const canComplete = (isAdmin || (isSupervisor && isMyDept) || isAssignedToMe) && audit.status === 'In Progress';

              const renderAuditorCell = (slot: 1 | 2, currentName: string | null) => {
                const isMe = currentName === currentUserName;

                // --- CASE 1: SLOT IS ALREADY ASSIGNED ---
                if (currentName) {
                  const canUnassign = isAdmin || (isSupervisor && isMyDept) || (isAuditor && isMe);

                  return (
                    <div className="flex items-center gap-2 group/auditor">
                      <span className={`text-sm font-medium whitespace-nowrap ${isMe ? 'text-blue-600 font-bold' : 'text-slate-700'}`}>
                        {currentName} {isMe && <span className="ml-1 text-[10px] font-black text-blue-600 uppercase tracking-tighter">(You)</span>}
                      </span>
                      {canUnassign && (
                        <button
                          onClick={() => handleUnassignClick(audit.id, slot)}
                          className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
                          title={isMe ? "Remove your assignment" : "Remove assignment"}
                        >
                          <i className="fa-solid fa-circle-xmark"></i>
                        </button>
                      )}
                    </div>
                  );
                }

                // --- CASE 2: SLOT IS VACANT ---

                // 2.1 ADMIN OR DEPT SUPERVISOR
                if (isAdmin || (isSupervisor && isMyDept)) {
                  return (
                    <div className="relative">
                      <button
                        onClick={() => setActiveDropdown({ id: audit.id, slot })}
                        className="inline-flex items-center px-3 py-1.5 bg-slate-50 text-slate-600 text-[10px] font-black uppercase rounded-lg border border-slate-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm active:scale-95 group/btn"
                      >
                        <i className="fa-solid fa-user-plus mr-1.5 text-[8px] transition-transform group-hover/btn:scale-125"></i>
                        Assign
                      </button>
                      {activeDropdown?.id === audit.id && activeDropdown?.slot === slot && (
                        <AssignmentDropdown
                          users={users}
                          schedules={schedules}
                          currentAuditId={audit.id}
                          currentAuditDate={audit.date}
                          currentUserName={currentUserName}
                          onSelect={(name) => {
                            handleAssign(audit.id, slot, name);
                            setActiveDropdown(null);
                          }}
                          onClose={() => setActiveDropdown(null)}
                        />
                      )}
                    </div>
                  );
                }

                // 2.2 AUDITOR ROLE
                if (isAuditor) {
                  if (isAssignedToMe) {
                    return <span className="text-[10px] text-slate-300 italic">Unassigned</span>;
                  }

                  const hasDateConflict = checkSelfConflict(audit.date, audit.id);
                  return (
                    <div className="relative">
                      <button
                        disabled={hasDateConflict}
                        onClick={() => handleAssign(audit.id, slot, currentUserName)}
                        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm active:scale-95 ${hasDateConflict
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60 border border-slate-100'
                          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/10'
                          }`}
                        title={hasDateConflict ? `You are already busy on ${audit.date}` : "Claim this slot for yourself"}
                      >
                        {hasDateConflict ? (
                          <><i className="fa-solid fa-calendar-xmark mr-1.5 text-[8px]"></i> Busy</>
                        ) : (
                          <><i className="fa-solid fa-user-plus mr-1.5 text-[8px]"></i> Claim Slot</>
                        )}
                      </button>
                    </div>
                  );
                }

                return <span className="text-[10px] text-slate-400 italic">Unassigned</span>;
              };

              return (
                <tr key={audit.id} className={`hover:bg-slate-50 transition-colors group ${isToday ? 'bg-blue-50/20' : ''}`}>
                  <td className="px-4 py-4 md:px-6 text-slate-900 whitespace-nowrap">
                    <div className="flex flex-col relative group/date">
                      {editingDateId === audit.id ? (
                        <input
                          autoFocus
                          type="date"
                          className="text-xs font-bold border border-blue-300 rounded px-1 py-0.5 outline-none focus:ring-2 focus:ring-blue-500/20"
                          defaultValue={audit.date}
                          onBlur={(e) => handleDateChange(audit.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleDateChange(audit.id, (e.target as HTMLInputElement).value);
                            if (e.key === 'Escape') setEditingDateId(null);
                          }}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{audit.date}</span>
                          {canPickDate && (
                            <button
                              onClick={() => setEditingDateId(audit.id)}
                              className="opacity-0 group-hover/date:opacity-100 transition-opacity text-blue-500 hover:text-blue-700"
                              title="Reschedule"
                            >
                              <i className="fa-solid fa-calendar-pen text-xs"></i>
                            </button>
                          )}
                        </div>
                      )}
                      {isToday && <span className="text-[9px] text-blue-600 font-black uppercase tracking-widest mt-0.5">Today</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4 md:px-6">
                    <button onClick={() => setSelectedAudit(audit)} className="font-semibold text-slate-900 hover:text-blue-600 hover:underline transition-colors text-left truncate max-w-[150px] md:max-w-none block">
                      {audit.location}
                    </button>
                    <div className="text-[10px] text-slate-400 font-medium">PIC: {audit.supervisor}</div>
                  </td>
                  <td className="px-4 py-4 md:px-6">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-md border border-slate-200">
                      {audit.department}
                    </span>
                  </td>

                  <td className="px-4 py-4 md:px-6">{renderAuditorCell(1, audit.auditor1)}</td>
                  <td className="px-4 py-4 md:px-6">{renderAuditorCell(2, audit.auditor2)}</td>

                  <td className="px-4 py-4 md:px-6 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full ${getStatusClass(audit.status)} whitespace-nowrap`}>
                        {audit.status}
                      </span>
                      {canComplete && (
                        <button
                          onClick={() => handleUpdateAuditStatus(audit.id, 'Completed')}
                          className="px-2 py-1 bg-emerald-600 text-white text-[8px] font-black uppercase rounded shadow-sm hover:bg-emerald-700 transition-colors active:scale-95"
                        >
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isExportModalOpen && (
        <ExportModal
          onClose={() => setIsExportModalOpen(false)}
          onExport={handleExport}
        />
      )}

      {selectedAudit && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedAudit(null)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 p-5 md:p-6 text-white flex items-center justify-between">
              <h4 className="text-lg font-bold">Location Details</h4>
              <button onClick={() => setSelectedAudit(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="p-6 md:p-8">
              <div className="mb-6">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Site Name</label>
                <p className="text-xl font-bold text-slate-900">{selectedAudit.location}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-8">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Department</label>
                  <div className="flex items-center gap-2 text-slate-700">
                    <i className="fa-solid fa-sitemap text-blue-500 text-xs"></i>
                    <span className="font-semibold text-sm">{selectedAudit.department}</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Building</label>
                  <div className="flex items-center gap-2 text-slate-700">
                    <i className="fa-solid fa-building text-blue-500 text-xs"></i>
                    <span className="font-semibold text-sm">{selectedAudit.building || 'N/A'}</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Asset Count</label>
                  <div className="flex items-center gap-2 text-slate-700">
                    <i className="fa-solid fa-tag text-blue-500 text-xs"></i>
                    <span className="font-semibold text-sm">{selectedAudit.assetCount || '0'} Items</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Supervisor</label>
                  <div className="flex items-center gap-2 text-slate-700">
                    <i className="fa-solid fa-user-tie text-blue-500 text-xs"></i>
                    <span className="font-semibold text-sm">{selectedAudit.supervisor}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedAudit(null)} className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-lg active:scale-[0.98]">
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!unassignData}
        title="Unassign Member?"
        message={`Are you sure you want to remove the assignment for ${unassignData?.location}?`}
        confirmLabel="Unassign"
        cancelLabel="Cancel"
        onConfirm={confirmUnassign}
        onCancel={() => setUnassignData(null)}
        variant="warning"
      />
    </div>
  );
};
