
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { gateway } from './services/dataGateway';
import { ItemNotFoundError } from './services/localDB';
import { AuditSchedule, AppNotification, User, UserRole, DashboardConfig, AppView, CrossAuditPermission, Department, Location, AuditPhase, KPITier, AuditGroup } from './types';
import { AuditTable } from './components/AuditTable';
import { Sidebar } from './components/Sidebar';
import { NotificationCenter } from './components/NotificationCenter';
import { TeamManagement } from './components/TeamManagement';
import { OverviewDashboard } from './components/OverviewDashboard';
import { AuditorDashboard } from './components/AuditorDashboard';
import { LoginPage } from './components/LoginPage';
import { SystemSettings } from './components/SystemSettings';
import { DepartmentManagement } from './components/DepartmentManagement';
import { LocationManagement } from './components/LocationManagement';
import { UserProfile } from './components/UserProfile';
import { LandingPage } from './components/LandingPage';
import { KnowledgeBase } from './components/KnowledgeBase';
import { ArrowLeft, ShieldCheck, Menu, BookOpen, AlertCircle } from 'lucide-react';

const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  showStats: true,
  showTrends: true,
  showUpcoming: true,
  showCertification: true,
  showDeptDistribution: true
};

type ViewState = 'landing' | 'login' | 'app' | 'docs';

const App: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<AppView>('overview');
  
  // Data State
  const [schedules, setSchedules] = useState<AuditSchedule[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [crossAuditPermissions, setCrossAuditPermissions] = useState<CrossAuditPermission[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [auditPhases, setAuditPhases] = useState<AuditPhase[]>([]);
  const [kpiTiers, setKpiTiers] = useState<KPITier[]>([]);
  const [auditGroups, setAuditGroups] = useState<AuditGroup[]>([]);
  
  // UI State
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>('All');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
  } | null>(null);

  const customConfirm = (title: string, message: string, onConfirm: () => void, isDestructive = true) => {
    setConfirmState({ title, message, onConfirm, isDestructive });
  };

  const customAlert = (message: string) => {
    setConfirmState({ title: 'Notice', message, onConfirm: () => {}, isDestructive: false });
  };
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | null>(null);

  // --- INITIAL DATA LOAD ---
  const loadAllData = useCallback(async () => {
    try {
      const [auditsData, usersData, deptsData, locsData, permsData, phasesData, kpiData, auditGroupsData] = await Promise.all([
        gateway.getAudits(),
        gateway.getUsers(),
        gateway.getDepartments(),
        gateway.getLocations(),
        gateway.getPermissions(),
        gateway.getAuditPhases(),
        gateway.getKPITiers(),
        gateway.getAuditGroups()
      ]);
      setSchedules(auditsData);
      setUsers(usersData);
      setDepartments(deptsData);
      setLocations(locsData);
      setCrossAuditPermissions(permsData);
      setAuditPhases(phasesData);
      setKpiTiers(kpiData);
      setAuditGroups(auditGroupsData);
    } catch (e) {
      console.error("Critical: Failed to load application data", e);
      setConnectionErrorMessage("Failed to load application data. Please refresh.");
    }
  }, []);

  useEffect(() => {
    if (viewState === 'app') {
      loadAllData();
    }
  }, [viewState, loadAllData]);

  // --- COMPUTED VALUES ---
  
  const departmentNames = useMemo(() => {
    const names = new Set(departments.map(d => d.name));
    return ['All', ...Array.from(names)].sort();
  }, [departments]);

  const filteredSchedules = useMemo(() => {
    if (!currentUser) return [];
    return schedules.filter(s => {
      if (selectedDept !== 'All') {
        const deptName = departments.find(d => d.id === s.departmentId)?.name;
        if (deptName !== selectedDept) return false;
      }
      if (selectedStatus !== 'All' && s.status !== selectedStatus) return false;
      if (selectedPhaseId !== 'All') {
        if (s.phaseId !== selectedPhaseId) return false;
      }
      return true;
    });
  }, [schedules, selectedDept, selectedStatus, selectedPhaseId, currentUser, departments]);

  // --- AUTH HANDLERS ---
  const handleLoginSuccess = useCallback(async (userProfile: User) => {
    // Check verification status - If not verified, force role to Guest
    const finalUser = { ...userProfile };
    if (userProfile.isVerified === false) {
       finalUser.roles = ['Guest'];
       // We don't save the role change to backend here, just runtime state
    }

    setCurrentUser(finalUser);
    
    // Default view logic
    // If user is NOT Admin, but is certified, default to auditor dashboard
    const isCertified = finalUser.certificationExpiry && new Date(finalUser.certificationExpiry) > new Date();
    const isAdmin = finalUser.roles.includes('Admin');

    if (!isAdmin && isCertified) {
      setViewState('app');
      setActiveView('auditor-dashboard');
    } else {
      setViewState('app');
      setActiveView('overview');
    }

    localStorage.setItem('audit_pro_session', JSON.stringify(finalUser));
  }, []);

  const determineMockRoles = (role: UserRole): UserRole[] => {
    switch (role) {
      case 'Admin':       return ['Admin', 'Coordinator', 'HeadOfDept', 'Supervisor', 'Auditor', 'Staff'];
      case 'Coordinator': return ['Coordinator', 'HeadOfDept', 'Supervisor', 'Auditor', 'Staff'];
      case 'HeadOfDept':  return ['HeadOfDept', 'Supervisor', 'Auditor', 'Staff'];
      case 'Supervisor':  return ['Supervisor', 'Auditor', 'Staff'];
      case 'Auditor':     return ['Auditor'];
      case 'Staff':       return ['Staff'];
      case 'Guest':       return ['Guest'];
      default:            return ['Staff'];
    }
  };

  const handleMockLogin = async (role: UserRole, targetView?: AppView) => {
    setIsLoggingIn(true);
    setConnectionErrorMessage(null);
    await gateway.enableDemoMode();
    
    const inheritedRoles = determineMockRoles(role);
    const fortyFiveDaysLater = new Date();
    fortyFiveDaysLater.setDate(fortyFiveDaysLater.getDate() + 45);

    // Mock ID generation for demo
    let mockId = `9${Math.floor(Math.random() * 900) + 100}`; // Random 9xxx 4 digit ID

    let user: User = {
      id: mockId,
      name: role === 'Admin' ? 'Wilson Intai' : `Demo ${role}`,
      email: role === 'Admin' ? 'wilsonintai76@gmail.com' : `${role.toLowerCase()}@demo.com`,
      roles: inheritedRoles,
      status: 'Active',
      lastActive: new Date().toLocaleString(),
      certificationExpiry: fortyFiveDaysLater.toISOString().split('T')[0],
      departmentId: role === 'Admin' ? 'dummy-dept-id' : 'dummy-dept-id',
      isVerified: true
    };

    if (role === 'Guest') user.departmentId = 'dummy-dept-id';

    try {
      const existingUsers = await gateway.getUsers();
      const foundUser = existingUsers.find(u => {
        const isHighest = u.roles.includes(role) && 
           (role === 'Admin' || !u.roles.includes('Admin')) &&
           (role === 'Coordinator' || !u.roles.includes('Coordinator')) &&
           (role === 'Supervisor' || !u.roles.includes('Supervisor'));
        return isHighest;
      });
      if (foundUser) {
        user = foundUser;
      } else {
        // Ensure new mock user is persisted so updates work
        await gateway.addUser(user);
      }
    } catch (e) {
      console.warn("Login data fetch failed, proceeding with fresh local session", e);
      // Even if fetch failed, we should try to add the user to localDB to avoid "not found" errors on update
      try { await gateway.addUser(user); } catch(err) {}
    }
    
    await handleLoginSuccess(user);
    if (targetView) setActiveView(targetView);
    setIsLoggingIn(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('audit_pro_session');
    setCurrentUser(null);
    setViewState('landing');
  };

  useEffect(() => {
    const savedSession = localStorage.getItem('audit_pro_session');
    if (savedSession) {
      const user = JSON.parse(savedSession);
      // Re-apply verification check on session load
      if (user.isVerified === false) {
          user.roles = ['Guest'];
      }
      setCurrentUser(user);
      
      const isCertified = user.certificationExpiry && new Date(user.certificationExpiry) > new Date();
      const isAdmin = user.roles.includes('Admin');

      if (!isAdmin && isCertified && activeView === 'overview') {
        setActiveView('auditor-dashboard');
      }

      setViewState(prev => prev === 'docs' ? 'docs' : 'app');
    }
  }, []);

  // --- ACTION HANDLERS ---
  const showError = useCallback((error: any, title: string = 'Operation Failed') => {
    console.error(error);
    let message = error?.message || 'An unexpected error occurred. Please try again.';
    
    if (error instanceof ItemNotFoundError || message.includes('not found')) {
      message = `The requested item could not be found. It may have been deleted or not synchronized correctly. Please refresh the page.`;
    }
    
    setNotifications(prev => [{
      id: `err-${Date.now()}`,
      title,
      message,
      timestamp: 'Just now',
      type: 'urgent',
      read: false
    }, ...prev]);
  }, []);

  const handleAddAudit = async (audit: Omit<AuditSchedule, 'id' | 'status' | 'auditor1Id' | 'auditor2Id'>) => {
    try {
      const newAudit = await gateway.addAudit({
        ...audit,
        status: 'Pending',
        auditor1Id: null,
        auditor2Id: null
      });
      setSchedules(prev => [...prev, newAudit]);
      return newAudit;
    } catch (e) {
      showError(e, 'Failed to Add Audit');
    }
  };

  // Admin action: create a Pending audit for every location that doesn't
  // already have one in the active (or nearest upcoming) phase.
  const handleGenerateSchedules = async () => {
    try {
      const today = new Date().toISOString().substring(0, 10);
      const targetPhase =
        auditPhases.find(p => p.startDate <= today && p.endDate >= today) ||
        auditPhases.find(p => p.startDate > today) ||
        auditPhases[0];

      if (!targetPhase) {
        customAlert('No audit phase configured yet. Please create a phase in System Settings first.');
        return;
      }

      const coveredLocationIds = new Set(
        schedules.filter(s => s.phaseId === targetPhase.id).map(s => s.locationId)
      );
      const missing = locations.filter(l => !coveredLocationIds.has(l.id));

      if (missing.length === 0) {
        customAlert(`All locations already have a schedule for "${targetPhase.name}".`);
        return;
      }

      const newEntries = missing.map(loc => ({
        departmentId: loc.departmentId,
        locationId:   loc.id,
        supervisorId: loc.supervisorId || '',
        auditor1Id:   null as null,
        auditor2Id:   null as null,
        date:         null,
        status:       'Pending' as const,
        phaseId:      targetPhase.id,
        building:     loc.building || undefined,
      }));

      const created = await gateway.bulkAddAudits(newEntries);
      setSchedules(prev => [...prev, ...created]);

      setNotifications(prev => [{
        id: `gen-sched-${Date.now()}`,
        title: 'Schedules Generated',
        message: `${created.length} audit schedule(s) created for "${targetPhase.name}".`,
        timestamp: 'Just now',
        type: 'success',
        read: false
      }, ...prev]);
    } catch (e) {
      showError(e, 'Failed to Generate Schedules');
    }
  };

  const handleBulkAddAudits = async (newAudits: Omit<AuditSchedule, 'id'>[]) => {
    try {
      // 1. Extract unique departments and locations from the new audits
      const uniqueDepts = Array.from(new Set(newAudits.map(a => a.departmentId)));
      const uniqueLocs = newAudits.map(a => ({ locationId: a.locationId, departmentId: a.departmentId }));
      
      // Calculate asset counts per location
      const locationAssetCounts: Record<string, number> = {};
      newAudits.forEach(a => {
        const key = `${a.locationId}|${a.departmentId}`;
        locationAssetCounts[key] = (locationAssetCounts[key] || 0) + 1;
      });

      // Remove duplicates from uniqueLocs
      const uniqueLocsFiltered = uniqueLocs.filter((loc, index, self) =>
        index === self.findIndex((t) => t.locationId === loc.locationId && t.departmentId === loc.departmentId)
      );

      // 2. Identify which ones are new
      const existingDeptIds = new Set(departments.map(d => d.id));
      const newDeptIds = uniqueDepts.filter(id => !existingDeptIds.has(id));

      const existingLocKeys = new Set(locations.map(l => `${l.id}|${l.departmentId}`));
      const newLocs = uniqueLocsFiltered.filter(loc => !existingLocKeys.has(`${loc.locationId}|${loc.departmentId}`));

      // 3. Add new departments
      if (newDeptIds.length > 0) {
        for (const id of newDeptIds) {
          const newDept: Omit<Department, 'id'> = {
            name: `Imported Dept ${id}`,
            abbr: `IMP-${id.substring(0, 3)}`,
            headOfDeptId: undefined,
            description: `Imported department: ${id}`
          };
          await gateway.addDepartment(newDept);
        }
      }
      if (newDeptIds.length > 0) {
        // Refresh departments state
        const updatedDepts = await gateway.getDepartments();
        setDepartments(updatedDepts);
      }

      // 4. Add new locations
      if (newLocs.length > 0) {
        const locsToAdd = newLocs.map(loc => ({
          name: loc.locationId,
          abbr: loc.locationId.substring(0, 3).toUpperCase(),
          departmentId: loc.departmentId,
          building: 'Main',
          description: `Imported location: ${loc.locationId}`,
          supervisorId: '',
          contact: '-',
          totalAssets: locationAssetCounts[`${loc.locationId}|${loc.departmentId}`] || 0
        }));
        await gateway.bulkAddLocations(locsToAdd);
      }

      // Update existing locations with new asset counts
      const existingLocsToUpdate = locations.filter(l => locationAssetCounts[`${l.id}|${l.departmentId}`] !== undefined);
      for (const loc of existingLocsToUpdate) {
        const newCount = locationAssetCounts[`${loc.id}|${loc.departmentId}`];
        if (loc.totalAssets !== newCount) {
          await gateway.updateLocation(loc.id, { totalAssets: newCount });
        }
      }

      // Refresh locations state
      const updatedLocs = await gateway.getLocations();
      setLocations(updatedLocs);

      // 5. Finally add the audits
      const added = await gateway.bulkAddAudits(newAudits);
      setSchedules(prev => [...prev, ...added]);
      
      setNotifications(prev => [{
        id: `bulk-${Date.now()}`,
        title: 'Batch Schedule Created',
        message: `Successfully imported ${added.length} audit entries. ${newDeptIds.length} new departments and ${newLocs.length} new locations were added to the database.`,
        timestamp: 'Just now',
        type: 'success',
        read: false
      }, ...prev]);
    } catch (e) {
      showError(e, 'Bulk Import Failed');
    }
  };

  const handleDeleteAudit = async (id: string) => {
    customConfirm("Delete Audit", "Are you sure you want to delete this audit schedule? This action cannot be undone.", async () => {
      try {
        await gateway.deleteAudit(id);
        setSchedules(prev => prev.filter(s => s.id !== id));
      } catch (e: any) {
        console.error("Delete failed:", e);
        if (e?.code === '23503') {
          customAlert("Cannot delete this audit because it has related records (e.g. findings). Please delete them first.");
        } else {
          showError(e, 'Deletion Failed');
        }
      }
    });
  };

  const handleAssign = async (id: string, slot: 1 | 2, userId: string) => {
    try {
      const updates: Partial<AuditSchedule> = slot === 1 ? { auditor1Id: userId } : { auditor2Id: userId };
      await gateway.updateAudit(id, updates);
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    } catch (e) {
      showError(e, 'Assignment Failed');
    }
  };

  const handleUnassign = async (id: string, slot: 1 | 2) => {
    try {
      const updates: Partial<AuditSchedule> = slot === 1 ? { auditor1Id: null } : { auditor2Id: null };
      await gateway.updateAudit(id, updates);
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    } catch (e) {
      showError(e, 'Unassignment Failed');
    }
  };

  const handleUpdateAuditDate = async (id: string, date: string) => {
    try {
      await gateway.updateAudit(id, { date });
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, date } : s));
    } catch (e) {
      showError(e, 'Date Update Failed');
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      const schedule = schedules.find(s => s.id === id);
      if (!schedule) return;
      const newStatus = schedule.status === 'In Progress' ? 'Completed' : 'In Progress';
      await gateway.updateAudit(id, { status: newStatus });
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
    } catch (e) {
      showError(e, 'Status Update Failed');
    }
  };

  const handleAddLoc = async (loc: Omit<Location, 'id'>) => {
    try {
      const newLoc = await gateway.addLocation(loc);
      setLocations(await gateway.getLocations());

      // Auto-create a Pending audit schedule for the new location if a phase exists
      const today = new Date().toISOString().substring(0, 10);
      const activePhase = auditPhases.find(p => p.startDate <= today && p.endDate >= today)
        || auditPhases.find(p => p.startDate > today)
        || auditPhases[0];

      if (activePhase) {
        const newAudit = await gateway.addAudit({
          departmentId: newLoc.departmentId,
          locationId:   newLoc.id,
          supervisorId: newLoc.supervisorId,
          auditor1Id:   null,
          auditor2Id:   null,
          date:         null,
          status:       'Pending',
          phaseId:      activePhase.id,
        });
        setSchedules(prev => [...prev, newAudit]);
      }

      setNotifications(prev => [{
        id: `auto-${Date.now()}`,
        title: 'Auto-Schedule Created',
        message: `New audit schedule generated for ${loc.name}${activePhase ? '' : ' (no audit phase configured yet)'}.`,
        timestamp: 'Just now',
        type: 'success',
        read: false
      }, ...prev]);
    } catch (e) {
      showError(e, 'Failed to Add Location');
    }
  };

  const handleBulkAddLocs = async (newLocs: Omit<Location, 'id'>[]) => {
    try {
      // newLocs.departmentId  = department NAME string (from CSV Bahagian column)
      // newLocs.supervisorId  = supervisor NAME string (from CSV Pegawai Penempatan column)
      // We must:
      //   1. find/create departments  → get UUIDs
      //   2. find/create users        → get IDs (using the dept UUID for each supervisor)
      //   3. remap departmentId + supervisorId on every loc
      //   4. insert/update locations

      // ── helper: turn a full name into a stable slug used as user ID ──
      const nameToSlug = (name: string) =>
        name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60);

      // ── STEP 1: departments ──────────────────────────────────────────
      const importedDeptNames = Array.from(new Set(newLocs.map(l => l.departmentId).filter(Boolean)));
      const existingDeptNames = new Set(departments.map(d => d.name));
      const newDeptNames = importedDeptNames.filter(n => !existingDeptNames.has(n));

      for (const name of newDeptNames) {
        await gateway.addDepartment({
          name,
          abbr: name.substring(0, 3).toUpperCase(),
          headOfDeptId: undefined,
          description: `Imported department: ${name}`,
        });
      }

      const freshDepts = await gateway.getDepartments();
      setDepartments(freshDepts);
      const deptNameToId = new Map(freshDepts.map(d => [d.name, d.id]));

      // ── STEP 2: supervisors (users) ──────────────────────────────────
      // Build a map of supervisorName → deptName from the import data
      const supervisorDeptMap = new Map<string, string>();
      newLocs.forEach(loc => {
        if (loc.supervisorId && loc.departmentId) {
          supervisorDeptMap.set(loc.supervisorId, loc.departmentId);
        }
      });

      const importedSupervisorNames = Array.from(supervisorDeptMap.keys());
      const freshUsers = await gateway.getUsers();
      const existingUserNames = new Set(freshUsers.map(u => u.name));
      const newSupervisorNames = importedSupervisorNames.filter(n => n && !existingUserNames.has(n));

      for (const supervisorName of newSupervisorNames) {
        const slug = nameToSlug(supervisorName);
        const deptName = supervisorDeptMap.get(supervisorName) ?? '';
        const deptId = deptNameToId.get(deptName);
        await gateway.addUser({
          id:           slug,
          name:         supervisorName,
          email:        `${slug}@imported.local`,
          pin:          '1234',
          roles:        ['Supervisor'],
          departmentId: deptId,
          status:       'Active',
          isVerified:   true,
        });
      }

      const allUsers = await gateway.getUsers();
      setUsers(allUsers);
      const userNameToId = new Map(allUsers.map(u => [u.name, u.id]));

      // ── STEP 3: resolve departmentId + supervisorId on every loc ────
      const resolvedLocs = newLocs.map(loc => ({
        ...loc,
        departmentId: deptNameToId.get(loc.departmentId) ?? loc.departmentId,
        supervisorId: userNameToId.get(loc.supervisorId ?? '') ?? '',
      }));

      // ── STEP 4: separate new vs existing locations ───────────────────
      const existingLocsMap = new Map(locations.map(l => [`${l.name}|${l.departmentId}`, l]));
      const locsToAdd: Omit<Location, 'id'>[] = [];
      const locsToUpdate: { id: string, updates: Partial<Location> }[] = [];

      const latestLocsFromImport = new Map<string, Omit<Location, 'id'>>();
      resolvedLocs.forEach(loc => {
        latestLocsFromImport.set(`${loc.name}|${loc.departmentId}`, loc);
      });

      latestLocsFromImport.forEach((loc, key) => {
        const existingLoc = existingLocsMap.get(key);
        if (existingLoc) {
          // Always overwrite totalAssets for existing locations
          locsToUpdate.push({ id: existingLoc.id, updates: { totalAssets: loc.totalAssets ?? 0 } });
        } else {
          locsToAdd.push(loc);
        }
      });

      let added: Location[] = [];
      if (locsToAdd.length > 0) {
        added = await gateway.bulkAddLocations(locsToAdd);
      }
      for (const update of locsToUpdate) {
        await gateway.updateLocation(update.id, update.updates);
      }

      setLocations(await gateway.getLocations());

      // Auto-create Pending audit schedules for each newly added location
      const today = new Date().toISOString().substring(0, 10);
      const activePhase = auditPhases.find(p => p.startDate <= today && p.endDate >= today)
        || auditPhases.find(p => p.startDate > today)
        || auditPhases[0];

      let autoScheduleCount = 0;
      if (activePhase && added.length > 0) {
        const autoSchedules = added.map(loc => ({
          departmentId: loc.departmentId,
          locationId:   loc.id,
          supervisorId: loc.supervisorId,
          auditor1Id:   null as null,
          auditor2Id:   null as null,
          date:         null,
          status:       'Pending' as const,
          phaseId:      activePhase.id,
        }));
        const createdSchedules = await gateway.bulkAddAudits(autoSchedules);
        setSchedules(prev => [...prev, ...createdSchedules]);
        autoScheduleCount = createdSchedules.length;
      }

      setNotifications(prev => [{
        id: `bulk-loc-${Date.now()}`,
        title: 'Import Complete',
        message: [
          `${added.length} new location(s) added, ${locsToUpdate.length} updated.`,
          newDeptNames.length > 0 ? `${newDeptNames.length} department(s) created.` : '',
          newSupervisorNames.length > 0 ? `${newSupervisorNames.length} supervisor user(s) created.` : '',
          autoScheduleCount > 0 ? `${autoScheduleCount} audit schedule(s) auto-created.` : '',
        ].filter(Boolean).join(' '),
        timestamp: 'Just now',
        type: 'success',
        read: false
      }, ...prev]);
    } catch (e) {
      showError(e, 'Bulk Import Failed');
    }
  };

  const handleUpdateLoc = async (id: string, updates: Partial<Location>) => {
    try {
      await gateway.updateLocation(id, updates);
      setLocations(await gateway.getLocations());
    } catch (e) {
      showError(e, 'Location Update Failed');
    }
  };

  const handleDeleteLoc = async (id: string) => {
    const loc = locations.find(l => String(l.id) === String(id));
    
    if (loc) {
      const locAudits = schedules.filter(s => s.locationId === loc.id && s.departmentId === loc.departmentId);
      const hasActiveAssignments = locAudits.some(s => s.auditor1 || s.auditor2);

      if (hasActiveAssignments) {
        customAlert("Cannot delete this location because it has active audit assignments. Please unassign auditors first.");
        return;
      }
    }

    customConfirm("Delete Location", `Are you sure you want to delete ${loc?.name || 'this location'}?`, async () => {
      try {
        await gateway.deleteLocation(id);
        setLocations(await gateway.getLocations());
      } catch (e: any) {
        console.error("Delete failed:", e);
        if (e?.code === '23503') {
          customConfirm("Force Delete", "This location has pending audit schedules (unassigned). Do you want to delete the location and these pending schedules?", async () => {
             try {
                if (loc) {
                  await gateway.forceDeleteLocation(id, loc.name);
                } else {
                  await gateway.deleteLocation(id);
                }
                setLocations(await gateway.getLocations());
                setSchedules(await gateway.getAudits());
                customAlert("Location and pending schedules deleted successfully.");
             } catch (forceErr: any) {
                showError(forceErr, 'Force Deletion Failed');
             }
          });
        } else {
          showError(e, 'Deletion Failed');
        }
      }
    });
  };

  const handleAddDept = async (dept: Omit<Department, 'id'>) => {
    try {
      await gateway.addDepartment(dept);
      setDepartments(await gateway.getDepartments());
    } catch (e) {
      showError(e, 'Failed to Add Department');
    }
  };
  
  const handleBulkAddDepts = async (newDepts: Omit<Department, 'id'>[]) => {
    try {
      for (const d of newDepts) await gateway.addDepartment(d);
      setDepartments(await gateway.getDepartments());
    } catch (e) {
      showError(e, 'Bulk Import Failed');
    }
  };

  const handleUpdateDept = async (id: string, updates: Partial<Department>) => {
    try {
      await gateway.updateDepartment(id, updates);
      setDepartments(await gateway.getDepartments());
    } catch (e) {
      showError(e, 'Department Update Failed');
    }
  };

  const handleBulkUpdateDepts = async (updates: { id: string, data: Partial<Department> }[]) => {
    try {
      const promises = updates.map(u => gateway.updateDepartment(u.id, u.data));
      await Promise.all(promises);
      setDepartments(await gateway.getDepartments());
    } catch (e) {
      showError(e, 'Bulk Update Failed');
    }
  };

  const handleDeleteDept = async (id: string) => {
    const dept = departments.find(d => String(d.id) === String(id));
    
    if (dept) {
      const deptUsers = users.filter(u => u.departmentId === dept.id);
      const deptAudits = schedules.filter(s => s.departmentId === dept.id);
      const hasActiveAssignments = deptAudits.some(s => s.auditor1 || s.auditor2);

      if (deptUsers.length > 0) {
        customAlert(`Cannot delete department. There are ${deptUsers.length} users assigned to this department. Please reassign or remove them first.`);
        return;
      }

      if (hasActiveAssignments) {
        customAlert("Cannot delete department. There are active audit assignments in this department. Please unassign auditors first.");
        return;
      }
    }

    customConfirm("Delete Department", `Are you sure you want to delete ${dept?.name || 'this department'}?`, async () => {
      try {
        await gateway.deleteDepartment(id);
        setDepartments(await gateway.getDepartments());
      } catch (e: any) {
        console.error("Delete failed:", e);
        if (e?.code === '23503') {
           customConfirm("Force Delete", "This department has associated Locations or pending Audits. Do you want to delete the department and all these related records?", async () => {
             try {
                if (dept) {
                  await gateway.forceDeleteDepartment(id, dept.name);
                } else {
                  await gateway.deleteDepartment(id);
                }
                await loadAllData();
                customAlert("Department and related data deleted successfully.");
             } catch (forceErr: any) {
                showError(forceErr, 'Force Deletion Failed');
             }
           });
        } else {
          showError(e, 'Deletion Failed');
        }
      }
    });
  };

  const handleAddPermission = async (auditorDept: string, targetDept: string, isMutual: boolean) => {
    try {
      await gateway.addPermission({ auditorDept, targetDept, isMutual, isActive: true });
      setCrossAuditPermissions(await gateway.getPermissions());
    } catch (e) {
      showError(e, 'Failed to Add Permission');
    }
  };

  const handleRemovePermission = async (id: string) => {
    try {
      await gateway.deletePermission(id);
      setCrossAuditPermissions(await gateway.getPermissions());
    } catch (e) {
      showError(e, 'Permission Removal Failed');
    }
  };

  const handleTogglePermission = async (id: string, isActive: boolean) => {
    try {
      await gateway.updatePermission(id, { isActive });
      setCrossAuditPermissions(await gateway.getPermissions());
    } catch (e) {
      showError(e, 'Permission Update Failed');
    }
  };

  const handleAddPhase = async (phase: Omit<AuditPhase, 'id'>) => {
    try {
      await gateway.addAuditPhase(phase);
      setAuditPhases(await gateway.getAuditPhases());
    } catch (e) {
      showError(e, 'Failed to Add Phase');
    }
  };

  const handleAddAuditGroup = async (group: Omit<AuditGroup, 'id'>) => {
    try {
      await gateway.addAuditGroup(group);
      setAuditGroups(await gateway.getAuditGroups());
    } catch (e) {
      showError(e, 'Failed to Add Audit Group');
    }
  };

  const handleUpdateAuditGroup = async (id: string, updates: Partial<AuditGroup>) => {
    try {
      await gateway.updateAuditGroup(id, updates);
      setAuditGroups(await gateway.getAuditGroups());
    } catch (e) {
      showError(e, 'Failed to Update Audit Group');
    }
  };

  const handleDeleteAuditGroup = async (id: string) => {
    try {
      await gateway.deleteAuditGroup(id);
      setAuditGroups(await gateway.getAuditGroups());
    } catch (e) {
      showError(e, 'Failed to Delete Audit Group');
    }
  };

  const handleUpdatePhase = async (id: string, updates: Partial<AuditPhase>) => {
    try {
      await gateway.updateAuditPhase(id, updates);
      setAuditPhases(await gateway.getAuditPhases());
    } catch (e) {
      showError(e, 'Phase Update Failed');
    }
  };

  const handleDeletePhase = async (id: string) => {
    customConfirm("Delete Phase", "Are you sure you want to delete this audit phase?", async () => {
      try {
        await gateway.deleteAuditPhase(id);
        setAuditPhases(await gateway.getAuditPhases());
      } catch (e: any) {
        console.error("Delete failed:", e);
        if (e?.code === '23503') {
          customAlert("Cannot delete this phase because it is used in existing audits.");
        } else {
          showError(e, 'Deletion Failed');
        }
      }
    });
  };

  const handleAddKPITier = async (tier: Omit<KPITier, 'id'>) => {
    try {
      await gateway.addKPITier(tier);
      setKpiTiers(await gateway.getKPITiers());
    } catch (e) {
      showError(e, 'Failed to Add KPI Tier');
    }
  };

  const handleUpdateKPITier = async (id: string, updates: Partial<KPITier>) => {
    try {
      await gateway.updateKPITier(id, updates);
      setKpiTiers(await gateway.getKPITiers());
    } catch (e) {
      showError(e, 'KPI Tier Update Failed');
    }
  };

  const handleDeleteKPITier = async (id: string) => {
    customConfirm("Delete KPI Tier", "Are you sure you want to delete this KPI Tier?", async () => {
      try {
        await gateway.deleteKPITier(id);
        setKpiTiers(await gateway.getKPITiers());
      } catch (e: any) {
        console.error("Delete failed:", e);
        if (e?.code === '23503') {
          customAlert("Cannot delete this KPI tier because it is in use.");
        } else {
          showError(e, 'Deletion Failed');
        }
      }
    });
  };

  const handleClearAllLocations = async () => {
    customConfirm("Clear All Locations", "Are you sure you want to delete all locations and their associated audits? This action cannot be undone.", async () => {
      try {
        await gateway.clearAllLocations();
        setLocations([]);
        setSchedules([]);
        setNotifications(prev => [{
          id: `clear-loc-${Date.now()}`,
          title: 'Locations Cleared',
          message: 'All locations and associated audits have been deleted.',
          timestamp: 'Just now',
          type: 'success',
          read: false
        }, ...prev]);
      } catch (e) {
        showError(e, 'Failed to clear locations');
      }
    });
  };

  const handleClearAllDepartments = async () => {
    customConfirm("Clear All Departments & Data", "Are you sure you want to delete all departments, locations, users, and audits? This action cannot be undone.", async () => {
      try {
        await gateway.clearAllDepartments(currentUser.id);
        setDepartments([]);
        setLocations([]);
        setSchedules([]);
        
        // Refresh users to only keep the current user
        const updatedUsers = await gateway.getUsers();
        setUsers(updatedUsers);
        
        // Update current user's department to null in state
        setCurrentUser(prev => ({ ...prev, departmentId: undefined }));

        setNotifications(prev => [{
          id: `clear-dept-${Date.now()}`,
          title: 'System Cleared',
          message: 'All departments and associated data have been deleted.',
          timestamp: 'Just now',
          type: 'success',
          read: false
        }, ...prev]);
      } catch (e) {
        showError(e, 'Failed to clear system data');
      }
    });
  };

  // If user has HeadOfDept role and a departmentId, auto-set that department's headOfDeptId
  const syncHeadOfDept = async (userId: string, roles: UserRole[], departmentId?: string) => {
    if (!roles.includes('HeadOfDept') || !departmentId) return;
    try {
      await gateway.updateDepartment(departmentId, { headOfDeptId: userId });
      setDepartments(await gateway.getDepartments());
    } catch (e) {
      console.warn('Could not sync Head of Department:', e);
    }
  };

  const handleAddMember = async (user: User) => {
    try {
      await gateway.addUser(user);
      setUsers(await gateway.getUsers());
      await syncHeadOfDept(user.id, user.roles, user.departmentId);
    } catch (e) {
      showError(e, 'Failed to Add Member');
    }
  };

  const handleBulkAddMembers = async (newUsers: User[]) => {
    try {
      for (const u of newUsers) await gateway.addUser(u);
      setUsers(await gateway.getUsers());
    } catch (e) {
      showError(e, 'Bulk Import Failed');
    }
  };

  const handleUpdateMember = async (id: string, updates: Partial<User>) => {
    try {
      await gateway.updateUser(id, updates);
      setUsers(await gateway.getUsers());
      if (currentUser?.id === id) {
        setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
      }
      // If roles or departmentId changed, or user was just verified, re-sync head-of-dept
      if (updates.roles || updates.departmentId || updates.isVerified === true) {
        const updatedUser = (await gateway.getUsers()).find(u => u.id === id);
        if (updatedUser) await syncHeadOfDept(updatedUser.id, updatedUser.roles, updatedUser.departmentId);
      }
    } catch (e) {
      showError(e, 'Member Update Failed');
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (confirm("Remove user?")) {
      try {
        await gateway.deleteUser(id);
        setUsers(await gateway.getUsers());
      } catch (e: any) {
        console.error("Delete failed:", e);
        if (e?.code === '23503') {
          alert("Cannot delete this user because they are assigned to audits or have other dependencies. Please unassign them first.");
        } else {
          showError(e, 'Removal Failed');
          alert(`Failed to remove user: ${e.message}`);
        }
      }
    }
  };

  const handleUpdateUserStatus = async (id: string, status: 'Active' | 'Inactive' | 'Suspended') => {
    try {
      await gateway.updateUser(id, { status });
      setUsers(await gateway.getUsers());
    } catch (e) {
      showError(e, 'Status Update Failed');
    }
  };

  const handleUpdateUserRoles = async (id: string, roles: UserRole[]) => {
    try {
      await gateway.updateUser(id, { roles });
      setUsers(await gateway.getUsers());
      const updatedUser = (await gateway.getUsers()).find(u => u.id === id);
      if (updatedUser) await syncHeadOfDept(updatedUser.id, roles, updatedUser.departmentId);
    } catch (e) {
      showError(e, 'Role Update Failed');
    }
  };

  const handleViewChange = (view: AppView) => {
    setActiveView(view);
  };

  if (viewState === 'landing') {
    return (
      <LandingPage 
        onEnter={() => setViewState(currentUser ? 'app' : 'login')} 
        onShowKnowledgeBase={() => setViewState('docs')}
      />
    );
  }

  if (viewState === 'docs') {
    return (
      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-[100]">
           <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              <button 
                onClick={() => setViewState('landing')}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-xs font-bold"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </button>
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                   <ShieldCheck className="w-4 h-4" />
                 </div>
                 <span className="text-sm font-black text-slate-900 tracking-tight">System Documentation</span>
              </div>
              <div className="w-[100px] hidden md:block"></div> {/* Spacer to keep title centered */}
           </div>
        </nav>
        <div className="p-8 md:p-12">
           <KnowledgeBase />
        </div>
      </div>
    );
  }

  if (viewState === 'login') {
    return (
      <LoginPage 
        onGoogleLogin={() => {}} 
        onDemoLogin={handleMockLogin}
        isLoggingIn={isLoggingIn}
        error={connectionErrorMessage}
        onBack={() => setViewState('landing')} 
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold animate-pulse">Initializing Session...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        activeView={activeView} 
        onViewChange={handleViewChange} 
        onLogout={handleLogout} 
        userRoles={currentUser.roles} 
        isCertified={currentUser.certificationExpiry && new Date(currentUser.certificationExpiry) > new Date()}
      />

      <div className="flex-grow lg:pl-72 flex flex-col min-h-screen w-full">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 capitalize leading-none">{activeView.replace('-', ' ')}</h1>
              {currentUser.roles.includes('Guest') && currentUser.isVerified === false ? (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase border bg-amber-50 text-amber-600 border-amber-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    Verification Pending
                  </span>
              ) : (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase border bg-indigo-50 text-indigo-600 border-indigo-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                    Secure Session
                  </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveView('knowledge-base')}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${activeView === 'knowledge-base' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Knowledge Base"
            >
              <BookOpen className="w-5 h-5" />
            </button>
            <NotificationCenter notifications={notifications} onMarkAsRead={() => {}} onClearAll={() => {}} />
            <div className="h-8 w-px bg-slate-200"></div>
            <button onClick={() => setActiveView('profile')} className="flex items-center gap-2 p-1 pr-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">{currentUser.name[0]}</div>
              <span className="text-xs font-bold text-slate-700 hidden sm:block">{currentUser.name}</span>
            </button>
          </div>
        </header>

        <main className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full">
          {connectionErrorMessage && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="font-medium text-sm">{connectionErrorMessage}</span>
            </div>
          )}
          {activeView === 'overview' && (
            <OverviewDashboard 
              schedules={filteredSchedules} 
              config={currentUser.dashboardConfig || DEFAULT_DASHBOARD_CONFIG} 
              onUpdateConfig={() => {}} 
              phases={auditPhases}
              kpiTiers={kpiTiers}
              departments={departments}
              currentUser={currentUser}
            />
          )}
          {activeView === 'auditor-dashboard' && (
            <AuditorDashboard 
              schedules={schedules}
              currentUser={currentUser}
              phases={auditPhases}
              kpiTiers={kpiTiers}
            />
          )}
          {activeView === 'schedule' && (
            <AuditTable 
              schedules={filteredSchedules} 
              users={users} 
              currentUserName={currentUser.name} 
              userRoles={currentUser.roles} 
              departments={departmentNames} 
              selectedDept={selectedDept} 
              onDeptChange={setSelectedDept} 
              selectedStatus={selectedStatus}
              onStatusChange={setSelectedStatus}
              selectedPhaseId={selectedPhaseId}
              onPhaseChange={setSelectedPhaseId}
              onAssign={handleAssign} 
              onUnassign={handleUnassign}
              onUpdateDate={handleUpdateAuditDate}
              onToggleStatus={handleToggleStatus}
              allDepartments={departments}
              allLocations={locations}
              onAddAudit={handleAddAudit}
              onBulkAddAudits={handleBulkAddAudits}
              onDeleteAudit={handleDeleteAudit}
              crossAuditPermissions={crossAuditPermissions}
              auditPhases={auditPhases}
              onGenerateSchedules={handleGenerateSchedules}
            />
          )}
          {activeView === 'team' && (
            <TeamManagement 
              users={users} 
              onAddMember={handleAddMember} 
              onBulkAddMembers={handleBulkAddMembers} 
              onUpdateMember={handleUpdateMember} 
              onDeleteMember={handleDeleteMember} 
              onUpdateRoles={handleUpdateUserRoles} 
              onUpdateStatus={handleUpdateUserStatus} 
              currentUserRoles={currentUser.roles} 
              departments={departments} 
              customConfirm={customConfirm}
              customAlert={customAlert}
            />
          )}
          {activeView === 'departments' && (
            <DepartmentManagement 
              departments={departments} 
              locations={locations}
              auditGroups={auditGroups}
              onAdd={handleAddDept} 
              onBulkAdd={handleBulkAddDepts}
              onUpdate={handleUpdateDept} 
              onDelete={handleDeleteDept} 
            />
          )}
          {activeView === 'locations' && (
            <LocationManagement 
              locations={locations} 
              departments={departments}
              users={users}
              userRoles={currentUser.roles}
              userDeptId={currentUser.departmentId}
              onAdd={handleAddLoc} 
              onUpdate={handleUpdateLoc} 
              onDelete={handleDeleteLoc} 
            />
          )}
          {activeView === 'settings' && (
            <SystemSettings 
              departments={departments} 
              users={users}
              permissions={crossAuditPermissions}
              phases={auditPhases} 
              kpiTiers={kpiTiers}
              userRoles={currentUser.roles}
              onAddPermission={handleAddPermission} 
              onRemovePermission={handleRemovePermission} 
              onTogglePermission={handleTogglePermission} 
              onUpdateDepartment={handleUpdateDept}
              onBulkUpdateDepartments={handleBulkUpdateDepts}
              onAddPhase={handleAddPhase}
              onUpdatePhase={handleUpdatePhase}
              onDeletePhase={handleDeletePhase}
              onAddKPITier={handleAddKPITier}
              onUpdateKPITier={handleUpdateKPITier}
              onDeleteKPITier={handleDeleteKPITier}
              onClearAllLocations={handleClearAllLocations}
              onClearAllDepartments={handleClearAllDepartments}
              onBulkAddLocs={handleBulkAddLocs}
              auditGroups={auditGroups}
              onAddAuditGroup={handleAddAuditGroup}
              onUpdateAuditGroup={handleUpdateAuditGroup}
              onDeleteAuditGroup={handleDeleteAuditGroup}
            />
          )}
          {activeView === 'profile' && <UserProfile user={currentUser} departments={departmentNames} onUpdate={handleUpdateMember} />}
          {activeView === 'knowledge-base' && <KnowledgeBase />}
        </main>
      </div>

      {/* Custom Confirm Modal */}
      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-2">{confirmState.title}</h3>
            <p className="text-sm text-slate-600 mb-6">{confirmState.message}</p>
            <div className="flex gap-3 justify-end">
              {confirmState.isDestructive !== false && (
                <button 
                  onClick={() => setConfirmState(null)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              )}
              <button 
                onClick={() => {
                  confirmState.onConfirm();
                  setConfirmState(null);
                }}
                className={`px-4 py-2 text-sm font-bold text-white rounded-xl transition-colors ${
                  confirmState.isDestructive === false ? 'bg-blue-600 hover:bg-blue-700 w-full' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmState.isDestructive === false ? 'OK' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
