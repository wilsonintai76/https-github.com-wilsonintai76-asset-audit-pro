
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { gateway } from './services/dataGateway';
import { supabase } from './services/supabase';
import { authService } from './services/auth';
import { ItemNotFoundError } from './services/localDB';
import { AuditSchedule, AppNotification, User, UserRole, DashboardConfig, AppView, CrossAuditPermission, Department, Location, AuditPhase, KPITier, KPITierTarget, InstitutionKPITarget, DepartmentMapping, SystemActivity, AuditGroup, Building } from './types';
import { AuditTable } from './components/AuditTable';
import { Sidebar } from './components/Sidebar';
import { NotificationCenter } from './components/NotificationCenter';
import { TeamManagement } from './components/TeamManagement';
import { OverviewDashboard } from './components/OverviewDashboard';
import { BuildingManagement } from './components/BuildingManagement';
import { AuditorDashboard } from './components/AuditorDashboard';
import { SystemSettings } from './components/SystemSettings';
import { DepartmentManagement } from './components/DepartmentManagement';
import { LocationManagement } from './components/LocationManagement';
import { UserProfile } from './components/UserProfile';
import { LandingPage } from './components/LandingPage';
import { KnowledgeBase } from './components/KnowledgeBase';
import { AutoUpdater } from './components/AutoUpdater';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { ArrowLeft, ShieldCheck, Menu, BookOpen, AlertCircle, X } from 'lucide-react';

const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  showStats: true,
  showTrends: true,
  showUpcoming: true,
  showDeptDistribution: true
};

type ViewState = 'landing' | 'app' | 'docs';

const App: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<AppView>('overview');

  // Data State
  const [schedules, setSchedules] = useState<AuditSchedule[]>([]);
  const [maxAssetsPerDay, setMaxAssetsPerDay] = useState<number>(500);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [crossAuditPermissions, setCrossAuditPermissions] = useState<CrossAuditPermission[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [auditPhases, setAuditPhases] = useState<AuditPhase[]>([]);
  const [kpiTiers, setKpiTiers] = useState<KPITier[]>([]);
  const [kpiTierTargets, setKpiTierTargets] = useState<KPITierTarget[]>([]);
  const [institutionKPIs, setInstitutionKPIs] = useState<InstitutionKPITarget[]>([]);
  const [departmentMappings, setDepartmentMappings] = useState<DepartmentMapping[]>([]);
  const [auditGroups, setAuditGroups] = useState<AuditGroup[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activities, setActivities] = useState<SystemActivity[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

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
    setConfirmState({ title: 'Notice', message, onConfirm: () => { }, isDestructive: false });
  };
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const closeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const logActivity = useCallback(async (type: SystemActivity['type'], message: string, auditId?: string, metadata?: any) => {
    if (!currentUser) return;
    try {
      const activity = {
        type,
        message,
        userId: currentUser.id,
        auditId,
        metadata
      };
      await gateway.addActivity(activity);
      // Refresh activities
      const updated = await gateway.getActivities();
      setActivities(updated);
    } catch (e) {
      console.error("Failed to log activity:", e);
    }
  }, [currentUser]);

  // --- INITIAL DATA LOAD ---
  const loadAllData = useCallback(async () => {
    try {
      const results = await Promise.all([
        gateway.getAudits(),
        gateway.getUsers(),
        gateway.getDepartments(),
        gateway.getLocations(),
        gateway.getPermissions(),
        gateway.getAuditPhases(),
        gateway.getKPITiers(),
        gateway.getDepartmentMappings(),
        gateway.getActivities(),
        gateway.getAuditGroups(),
        gateway.getInstitutionKPIs(),
        gateway.getBuildings()
      ]);

      const [auditsData, usersData, deptsData, locsData, permsData, phasesData, kpiTiersData, departmentMappingsData, activitiesData, auditGroupsData, institutionKPIsData, buildingsData] = results;
      
      setSchedules(auditsData);
      setUsers(usersData);
      setDepartments(deptsData);
      setLocations(locsData);
      setCrossAuditPermissions(permsData);
      setAuditPhases(phasesData);
      setKpiTiers(kpiTiersData);
      setDepartmentMappings(departmentMappingsData);
      setActivities(activitiesData);
      setAuditGroups(auditGroupsData);
      setInstitutionKPIs(institutionKPIsData);
      setBuildings(buildingsData);

      // KPI targets are optional during schema rollout; don't block the app if missing
      let kpiTargetsData: KPITierTarget[] = [];
      try {
        kpiTargetsData = await gateway.getKPITierTargets();
        setKpiTierTargets(kpiTargetsData);
      } catch (targetErr) {
        console.warn("KPI targets failed to load (non-fatal):", targetErr);
      }

      // Ensure 3 phases exist
      let finalPhases = phasesData;
      if (phasesData.length < 3) {
        const existingNames = phasesData.map(p => p.name);
        const requiredNames = ['Phase 1', 'Phase 2', 'Phase 3'];
        const today = new Date();
        for (let i = 0; i < requiredNames.length; i++) {
          const name = requiredNames[i];
          if (!existingNames.includes(name)) {
            const start = new Date(today);
            start.setDate(today.getDate() + i * 30);
            const end = new Date(start);
            end.setDate(start.getDate() + 30);
            await gateway.addAuditPhase({
              name,
              startDate: start.toISOString().split('T')[0],
              endDate: end.toISOString().split('T')[0]
            });
          }
        }
        finalPhases = await gateway.getAuditPhases();
        setAuditPhases(finalPhases);
      }

      // Ensure 3 institutional targets exist
      const currentInstKPIs = await gateway.getInstitutionKPIs();
      let instNeeded = false;
      for (const phase of finalPhases) {
        if (!currentInstKPIs.find(k => k.phaseId === phase.id)) {
          await gateway.updateInstitutionKPI(phase.id, 100);
          instNeeded = true;
        }
      }
      if (instNeeded) setInstitutionKPIs(await gateway.getInstitutionKPIs());

      // Ensure 3 KPI tiers exist (Small / Medium / Large) using percentage thresholds
      let finalKpiTiers = kpiTiersData;
      const requiredTierNames = ['Small', 'Medium', 'Large'];
      const defaultTierRanges = [
        { min: 0,   max: 29  },
        { min: 30,  max: 69  },
        { min: 70,  max: 100 }
      ];
      // Rename legacy 'Tier 1/2/3' entries on first load after upgrade
      for (const tier of kpiTiersData) {
        const legacyNameMap: Record<string, string> = { 'Tier 1': 'Small', 'Tier 2': 'Medium', 'Tier 3': 'Large' };
        if (legacyNameMap[tier.name]) {
          await gateway.updateKPITier(tier.id, { name: legacyNameMap[tier.name] });
        }
      }
      
      if (finalKpiTiers.length < 3) {
        const existingNames = finalKpiTiers.map(p => p.name);
        for (let i = 0; i < requiredTierNames.length; i++) {
          const name = requiredTierNames[i];
          if (!existingNames.includes(name)) {
            await gateway.addKPITier({
              name,
              minAssets: defaultTierRanges[i].min
            });
          }
        }
        finalKpiTiers = await gateway.getKPITiers();
        setKpiTiers(finalKpiTiers);
      } else {
        // Migration: If any tier has minAssets > 100, they are using raw asset counts instead of percentages.
        const needsMigration = kpiTiersData.some(t => t.minAssets > 100);
        if (needsMigration) {
          const sorted = [...kpiTiersData].sort((a,b) => a.minAssets - b.minAssets);
          if (sorted.length >= 3) {
            await gateway.updateKPITier(sorted[0].id, { minAssets: 0 });
            await gateway.updateKPITier(sorted[1].id, { minAssets: 30 });
            await gateway.updateKPITier(sorted[2].id, { minAssets: 70 });
            finalKpiTiers = await gateway.getKPITiers();
            setKpiTiers(finalKpiTiers);
          }
        }
      }

      // Ensure 3 tiers have relational targets for each phase
      const latestTargets = await gateway.getKPITierTargets();
      let targetsNeeded = false;
      for (const tier of finalKpiTiers) {
        for (const phase of finalPhases) {
          if (!latestTargets.find(t => t.tierId === tier.id && t.phaseId === phase.id)) {
            await gateway.setKPITierTarget(tier.id, phase.id, 100);
            targetsNeeded = true;
          }
        }
      }
      if (targetsNeeded) setKpiTierTargets(await gateway.getKPITierTargets());

      const finalKpiTargets = await gateway.getKPITierTargets();

      setSchedules(auditsData);
      setUsers(usersData);
      setDepartments(deptsData);
      setLocations(locsData);
      setCrossAuditPermissions(permsData);
      setAuditPhases(finalPhases);
      setKpiTiers(finalKpiTiers);
      setKpiTierTargets(finalKpiTargets);
      setDepartmentMappings(departmentMappingsData);
    } catch (e) {
      console.error("Critical: Failed to load application data", e);
      const raw = (e as any)?.message ? String((e as any).message) : String(e);
      const hint = raw.toLowerCase().includes('does not exist')
        ? `Database schema mismatch: ${raw}. Please run the latest SUPABASE_SETUP.sql in Supabase.`
        : "Failed to load application data. Please refresh.";
      setConnectionErrorMessage(hint);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // --- ROLE CHECKS ---
  const isAdmin = (currentUser?.roles || []).includes('Admin');
  const isCoordinator = (currentUser?.roles || []).includes('Coordinator');
  const isSupervisor = (currentUser?.roles || []).includes('Supervisor');

  // --- COMPUTED VALUES ---
  const departmentsWithAssets = useMemo(() => {
    return departments.map(dept => {
      const deptLocations = locations.filter(l => l.departmentId === dept.id);
      const computedAssets = deptLocations.reduce((sum, loc) => sum + (loc.totalAssets || 0), 0);
      // We use the larger of the two: manually entered or sum of locations
      const finalAssets = Math.max(dept.totalAssets || 0, computedAssets);
      
      const auditors = users.filter(u => 
        u.departmentId === dept.id &&
        ['Staff', 'Supervisor', 'Coordinator', 'Admin'].some(role => u.roles?.includes(role as any)) &&
        u.status === 'Active'
      ).length;

      // Auto-exempt if 0 assets and 0 active auditors, unless manually overridden
      // Exception: If part of a Consolidation Unit (Audit Group), do not auto-exempt
      const isAutoExempted = finalAssets === 0 && auditors === 0 && !dept.auditGroupId;
      const finalIsExempted = dept.isExempted || isAutoExempted;

      return {
        ...dept,
        totalAssets: finalAssets,
        auditorCount: auditors,
        isExempted: finalIsExempted
      };
    });
  }, [departments, locations, users]);

  const refreshDepartmentTotals = async () => {
    try {
      console.log("[Auto-Sync] Recalculating department asset totals and exemption tags...");
      const allLocs = await gateway.getLocations();
      const allDepts = await gateway.getDepartments();
      const allUsers = await gateway.getUsers();

      const deptTotals: Record<string, number> = {};
      allLocs.forEach(loc => {
        if (loc.departmentId) {
          deptTotals[loc.departmentId] = (deptTotals[loc.departmentId] || 0) + (loc.totalAssets || 0);
        }
      });

      const updates = allDepts.map(d => {
        const calculatedAssets = deptTotals[d.id] || 0;
        const totalAssets = Math.max(d.totalAssets || 0, calculatedAssets);
        const auditors = allUsers.filter(u => 
          u.departmentId === d.id &&
          ['Staff', 'Supervisor', 'Coordinator', 'Admin'].some(role => u.roles?.includes(role as any)) &&
          u.status === 'Active'
        ).length;
        
        // Keep manual exemption if it's already true, or apply auto-exemption
        const shouldBeExempted = d.isExempted || (totalAssets === 0 && auditors === 0);

        return {
          id: d.id,
          data: { 
            totalAssets: calculatedAssets,
            isExempted: shouldBeExempted
          }
        };
      }).filter(u => {
        const d = allDepts.find(dept => dept.id === u.id);
        const assetsChanged = d && d.totalAssets !== u.data.totalAssets;
        const exemptionChanged = d && d.isExempted !== u.data.isExempted;
        return assetsChanged || exemptionChanged;
      });

      if (updates.length > 0) {
        console.log(`[Auto-Sync] Updating ${updates.length} departments...`);
        await handleBulkUpdateDepts(updates);
      }
    } catch (e) {
      console.error("[Auto-Sync] Failed to refresh department totals:", e);
    }
  };

  const departmentNames = useMemo(() => {
    const names = new Set(departmentsWithAssets.map(d => d.name));
    schedules.forEach(s => {
      const dept = departmentsWithAssets.find(d => d.id === s.departmentId);
      if (dept) names.add(dept.name);
    });
    return ['All', ...Array.from(names)].sort();
  }, [departmentsWithAssets, schedules]);

  const filteredSchedules = useMemo(() => {
    if (!currentUser) return [];
    return schedules.filter(s => {
      const dept = departmentsWithAssets.find(d => d.id === s.departmentId);
      const deptName = dept?.name || s.departmentId;
      if (selectedDept !== 'All' && deptName !== selectedDept) return false;
      if (selectedStatus !== 'All' && s.status !== selectedStatus) return false;
      if (selectedPhaseId !== 'All') {
        if (s.phaseId !== selectedPhaseId) return false;
      }

      // Exclude departments with zero assets from the schedule
      if (dept && (dept.totalAssets || 0) === 0) return false;

      // Limit visibility to own department for non-admins
      if (!isAdmin && s.departmentId !== currentUser.departmentId) return false;

      return true;
    });
  }, [schedules, selectedDept, selectedStatus, selectedPhaseId, currentUser, departmentsWithAssets, isAdmin]);

  const topDepartments = useMemo(() => {
    return departmentsWithAssets
      .map(dept => {
        const deptSchedules = schedules.filter(s => s.departmentId === dept.id);
        const total = deptSchedules.length;
        const completed = deptSchedules.filter(s => s.status === 'Completed').length;
        const compliance = (dept.totalAssets || 0) === 0 ? 100 : (total > 0 ? Math.round((completed / total) * 100) : 0);
        return { name: dept.name, compliance, total };
      })
      .filter(d => d.total > 0 || d.compliance === 100) // Keep zero-asset departments if they are at 100%
      .sort((a, b) => b.compliance - a.compliance || b.total - a.total)
      .slice(0, 3);
  }, [departmentsWithAssets, schedules]);

  // --- AUTH HANDLERS ---
  const handleLoginSuccess = useCallback(async (userProfile: User) => {
    const finalUser = { ...userProfile };
    setCurrentUser(finalUser);

    // Default view logic
    const isCertified = finalUser.certificationExpiry && new Date(finalUser.certificationExpiry) > new Date();
    const isAdmin = (finalUser.roles || []).includes('Admin');

    if (finalUser.mustChangePIN) {
      setViewState('app');
      setActiveView('profile');
    } else if (finalUser.status === 'Pending') {
      setViewState('app');
      setActiveView('profile');
    } else if (!isAdmin && isCertified) {
      setViewState('app');
      setActiveView('auditor-dashboard');
    } else if (!isAdmin && !(finalUser.roles || []).some((r: string) => ['Admin', 'Coordinator', 'Supervisor'].includes(r))) {
      setViewState('app');
      setActiveView('profile');
    } else {
      setViewState('app');
      setActiveView('overview');
    }

    localStorage.setItem('audit_pro_session', JSON.stringify(finalUser));
  }, []);

  const determineMockRoles = (role: UserRole): UserRole[] => {
    switch (role) {
      case 'Admin': return ['Admin', 'Coordinator', 'Supervisor', 'Staff'];
      case 'Coordinator': return ['Coordinator', 'Supervisor', 'Staff'];
      case 'Supervisor': return ['Supervisor', 'Staff'];
      case 'Staff': return ['Staff'];
      default: return ['Staff'];
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
      email: role === 'Admin' ? 'wilson@poliku.edu.my' : `${role.toLowerCase()}@demo.com`,
      roles: inheritedRoles,
      status: 'Active',
      lastActive: new Date().toISOString(),
      certificationExpiry: fortyFiveDaysLater.toISOString().split('T')[0],
      departmentId: role === 'Admin' ? 'dummy-dept-id' : 'dummy-dept-id',
      isVerified: true
    };


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
      try { await gateway.addUser(user); } catch (err) { }
    }

    await handleLoginSuccess(user);
    if (targetView) setActiveView(targetView);
    setIsLoggingIn(false);
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.error("[App] Logout error:", e);
    } finally {
      // ALWAYS clear local state regardless of Supabase results
      localStorage.removeItem('audit_pro_session');
      setCurrentUser(null);
      setViewState('landing');
      setIsSidebarOpen(false); // Close sidebar just in case
    }
  };

  useEffect(() => {
    const fallbackToLocalSession = () => {
      const savedSession = localStorage.getItem('audit_pro_session');
      if (savedSession) {
        try {
          const user = JSON.parse(savedSession);
          if (user.email?.toLowerCase().endsWith('@poliku.edu.my')) {
            user.roles = user.roles || ['Staff'];
            // Admins are already marked in DB, but for local session consistency:
            if (user.roles.includes('Admin')) {
              user.status = 'Active';
              user.isVerified = true;
            }
            localStorage.setItem('audit_pro_session', JSON.stringify(user));
          }
          setCurrentUser(user);
          setViewState('app');
          const isCertified = user.certificationExpiry && new Date(user.certificationExpiry) > new Date();
          const isAdmin = (user.roles || []).includes('Admin');
          if (user.status === 'Pending') {
            setActiveView('profile');
          } else if (!isAdmin && isCertified) {
            setActiveView('auditor-dashboard');
          } else if (!isAdmin && !(user.roles || []).some((r: string) => ['Admin', 'Coordinator', 'Supervisor'].includes(r))) {
            setActiveView('profile');
          } else {
            setActiveView('overview');
          }
        } catch (e) {
          localStorage.removeItem('audit_pro_session');
        }
      }
    };

    const initSession = async () => {
      // 1. Check for errors in URL (e.g. from Auth Hooks or Domain Blocking)
      const hash = window.location.hash;
      if (hash && (hash.includes('error=') || hash.includes('error_description='))) {
        const params = new URLSearchParams(hash.replace('#', '?'));
        const errorMsg = params.get('error_description') || params.get('error') || 'Authentication failed';
        
        // Clean the URL to avoid repeated alerts on refresh
        window.history.replaceState(null, '', window.location.pathname);
        
        customAlert(decodeURIComponent(errorMsg.replace(/\+/g, ' ')));
        setIsInitialLoading(false);
        return;
      }

      if (!supabase) {
        setIsInitialLoading(false);
        return;
      }

      // Check for Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        try {
          const user = await authService.getCurrentUser();
          if (user) {
            setCurrentUser(user);
            setViewState('app');
            
            if (user.status === 'Pending') {
              setActiveView('profile');
            } else {
              const isCertified = user.certificationExpiry && new Date(user.certificationExpiry) > new Date();
              const isAdmin = (user.roles || []).includes('Admin');
              if (!isAdmin && isCertified) {
                setActiveView('auditor-dashboard');
              } else if (!isAdmin && !(user.roles || []).some((r: string) => ['Admin', 'Coordinator', 'Supervisor'].includes(r))) {
                setActiveView('profile');
              } else {
                setActiveView('overview');
              }
            }
          } else {
            console.warn("getCurrentUser returned null despite having a session. Falling back to local storage.");
            fallbackToLocalSession();
          }
        } catch (err) {
          console.error("Failed to load user profile:", err);
          fallbackToLocalSession();
        }
      } else {
        // Fallback to local storage for non-auth users or previous sessions
        fallbackToLocalSession();
      }
      setIsInitialLoading(false);
    };

    initSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase?.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const user = await authService.getCurrentUser();
          if (user) {
            setCurrentUser(user);
            setViewState('app');
            // Route to the correct view based on user state
            if (user.status === 'Pending') {
              setActiveView('profile');
            } else {
              const isCertified = user.certificationExpiry && new Date(user.certificationExpiry) > new Date();
              const isAdmin = user.roles.includes('Admin');
              if (!isAdmin && isCertified) {
                setActiveView('auditor-dashboard');
              } else if (!isAdmin && !user.roles.some((r: string) => ['Admin', 'Coordinator', 'Supervisor'].includes(r))) {
                setActiveView('profile');
              } else {
                setActiveView('overview');
              }
            }
          } else {
            fallbackToLocalSession();
          }
        } catch (err) {
          console.error('[Auth] SIGNED_IN handler failed:', err);
          fallbackToLocalSession();
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setViewState('landing');
      }
    }) || { data: { subscription: null } };

    return () => {
      subscription?.unsubscribe();
    };
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
      timestamp: new Date().toISOString(),
      type: 'urgent',
      read: false
    }, ...prev]);
  }, []);

  const getPhaseForDepartment = useCallback((deptId: string) => {
    const dept = departmentsWithAssets.find(d => d.id === deptId);
    if (!dept) return auditPhases[0]?.id || '';

    const assets = dept.totalAssets || 0;
    
    // Find the highest department asset
    let maxAssets = 0;
    for (const d of departmentsWithAssets) {
        if ((d.totalAssets || 0) > maxAssets) maxAssets = d.totalAssets || 0;
    }
    
    // Calculate this department's percentage
    const deptPercentage = maxAssets > 0 ? (assets / maxAssets) * 100 : 0;

    // Find the tier that matches this percentage
    const tier = kpiTiers
      .filter(t => deptPercentage >= t.minAssets)
      .sort((a, b) => b.minAssets - a.minAssets)[0];

    if (tier) {
      // Return the first phase that has a target > 0
      const sortedPhases = [...auditPhases].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const firstPhaseId = sortedPhases.find(p => {
         const target = kpiTierTargets.find(kt => kt.tierId === tier.id && kt.phaseId === p.id)?.targetPercentage 
                        || tier.targets?.[p.id] 
                        || 0;
         return target > 0;
      })?.id;
      if (firstPhaseId) return firstPhaseId;
    }
    return auditPhases[0]?.id || '';
  }, [departmentsWithAssets, auditPhases, kpiTiers, kpiTierTargets]);

  const isAuditLocked = (audit: AuditSchedule) => {
    return !!(audit.date && (audit.auditor1Id || audit.auditor2Id));
  };

  const isSystemLocked = useMemo(() => schedules.some(isAuditLocked), [schedules]);

  const handleAddAudit = async (audit: Omit<AuditSchedule, 'id' | 'status' | 'auditor1Id' | 'auditor2Id'>) => {
    try {
      const dept = departmentsWithAssets.find(d => d.id === audit.departmentId);
      if (dept && (dept.totalAssets || 0) === 0) {
        throw new Error(`Cannot add audit for ${dept.name} as it has zero assets.`);
      }

      // Auto-assign phase based on department assets
      const phaseId = getPhaseForDepartment(audit.departmentId);

      const newAudit = await gateway.addAudit({
        ...audit,
        phaseId: phaseId || audit.phaseId,
        status: 'Pending',
        auditor1Id: null,
        auditor2Id: null
      });
      setSchedules(prev => [...prev, newAudit]);
      showToast('Audit added successfully');
      return newAudit;
    } catch (e) {
      showError(e, 'Failed to Add Audit');
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

      // 2.5 Process Supervisors (Create temporary users if they don't exist)
      const uniqueSupervisors = Array.from(new Set(newAudits.map(a => a.supervisorId).filter(id => id && id !== 'To be filled')));
      const newUsersCreated: User[] = [];

      for (const supName of uniqueSupervisors) {
        // Check if user already exists by name
        const existingUser = users.find(u => u.name.toLowerCase() === supName.toLowerCase());

        if (!existingUser) {
          // Generate a temporary ID (T-xxxx)
          const tempId = `T-${Math.floor(1000 + Math.random() * 9000)}`;

          const newUser: User = {
            id: tempId,
            name: supName,
            email: `temp_${tempId}@example.com`, // Placeholder email
            roles: ['Supervisor'],
            status: 'Inactive', // Mark as inactive so they need to be verified/updated
            isVerified: false
          };

          const addedUser = await gateway.addUser(newUser);
          newUsersCreated.push(addedUser);
        }
      }

      if (newUsersCreated.length > 0) {
        setUsers(prev => [...prev, ...newUsersCreated]);
      }

      // Map supervisor names to their IDs for the audits and locations
      const getSupervisorId = (name: string) => {
        if (!name || name === 'To be filled') return '';
        const user = [...users, ...newUsersCreated].find(u => u.name.toLowerCase() === name.toLowerCase());
        return user ? user.id : ''; 
      };

      // Update audits with actual user IDs
      const processedAudits = newAudits.map(a => ({
        ...a,
        supervisorId: getSupervisorId(a.supervisorId)
      }));

      // 3. Add new departments
      if (newDeptIds.length > 0) {
        for (const id of newDeptIds) {
          const newDept: Omit<Department, 'id'> = {
            name: `Imported Dept ${id}`,
            abbr: `IMP-${id.substring(0, 3)}`,
            headOfDeptId: 'dummy-user-id',
            description: `Imported department: ${id}`,
            auditGroupId: null
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
      if (newLocs?.length > 0) {
        const locsToAdd: Omit<Location, 'id'>[] = newLocs.map(loc => {
          // Find a supervisor for this location from the audits
          const auditForLoc = processedAudits.find(a => a.locationId === loc.locationId && a.departmentId === loc.departmentId);
          const supId = auditForLoc ? auditForLoc.supervisorId : 'dummy-user-id';

          return {
            name: loc.locationId, // Using ID as name for imported ones if not provided
            abbr: loc.locationId.substring(0, 3).toUpperCase(),
            departmentId: loc.departmentId,
            building: 'Main',
            description: `Imported location: ${loc.locationId}`,
            supervisorId: supId,
            contact: '-',
            totalAssets: locationAssetCounts[`${loc.locationId}|${loc.departmentId}`] || 0
          };
        });
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

      // 5. Finally add the audits (filtered by assets)
      const assetFilteredAudits = processedAudits.filter(a => {
        const dept = departmentsWithAssets.find(d => d.id === a.departmentId);
        return dept && (dept.totalAssets || 0) > 0;
      });

      if (assetFilteredAudits.length === 0) {
        showToast('No audits imported. All provided departments have zero assets.');
        return;
      }

      const added = await gateway.bulkAddAudits(assetFilteredAudits);
      setSchedules(prev => [...prev, ...added]);

      setNotifications(prev => [{
        id: `bulk-${Date.now()}`,
        title: 'Batch Schedule Created',
        message: `Successfully imported ${added?.length || 0} audit entries. ${newDeptIds?.length || 0} new departments, ${newLocs?.length || 0} new locations, and ${newUsersCreated.length} temporary users were added to the database.`,
        timestamp: new Date().toISOString(),
        type: 'success',
        read: false
      }, ...prev]);
      showToast('Audits imported successfully');
    } catch (e) {
      showError(e, 'Bulk Import Failed');
    }
  };

  const handleDeleteAudit = async (id: string) => {
    customConfirm("Delete Audit", "Are you sure you want to delete this audit schedule? This action cannot be undone.", async () => {
      try {
        await gateway.deleteAudit(id);
        setSchedules(prev => prev.filter(s => s.id !== id));
        showToast('Audit deleted successfully');
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
      
      const auditor = users.find(u => u.id === userId);
      const audit = schedules.find(s => s.id === id);
      const loc = locations.find(l => l.id === audit?.locationId);
      if (auditor && loc) {
        logActivity('AUDITOR_ASSIGNED', `${auditor.name} assigned to audit at ${loc.name}`, id);
      }
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

  const handleUpdateAudit = async (id: string, updates: Partial<AuditSchedule>) => {
    try {
      const schedule = schedules.find(s => s.id === id);
      if (schedule && isAuditLocked(schedule) && (updates.phaseId || updates.departmentId || updates.locationId)) {
        throw new Error("Locked audits cannot have their phase, department, or location changed.");
      }
        await gateway.updateAudit(id, updates);
        setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
        showToast('Audit updated successfully');
    } catch (e) {
      showError(e, 'Audit Update Failed');
    }
  };

  const handleUpdateAuditDate = async (id: string, date: string) => {
    try {
      await gateway.updateAudit(id, { date });
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, date } : s));
      
      const audit = schedules.find(s => s.id === id);
      const loc = locations.find(l => l.id === audit?.locationId);
      if (loc) {
        logActivity('SCHEDULE_DATE', `Audit date set to ${date} for ${loc.name}`, id);
      }
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
      const updatedLocs = await gateway.getLocations();
      setLocations(updatedLocs);
      
      logActivity('LOCATION_CREATED', `New location created: ${loc.name} (${loc.departmentId})`);
      
      setNotifications(prev => [{
        id: `auto-${Date.now()}`,
        title: 'Auto-Schedule Created',
        message: `New audit schedule generated for ${loc.name}.`,
        timestamp: new Date().toISOString(),
        type: 'success',
        read: false
      }, ...prev]);
      showToast('Location added successfully');
      await refreshDepartmentTotals();
    } catch (e) {
      showError(e, 'Failed to Add Location');
    }
  };

  const handleBulkAddLocs = async (newLocs: Omit<Location, 'id'>[]) => {
    try {
      // --- STEP 1: Resolve department NAMES to UUIDs ---
      // The CSV may provide raw dept names OR UUIDs already resolved by mapping rules.
      let deptNameToId = new Map<string, string>(
        departments.map(d => [d.name.toUpperCase().trim(), d.id])
      );
      // Also build a set of valid dept UUIDs so already-mapped IDs pass through
      const validDeptIds = new Set(departments.map(d => d.id.toLowerCase().trim()));

      const uniqueDeptNamesInImport = Array.from(new Set(newLocs.map(l => l.departmentId.toUpperCase().trim())));
      // Unresolvable = not a known dept name AND not already a valid dept UUID
      const missingDeptNames = uniqueDeptNamesInImport.filter(
        name => !deptNameToId.has(name) && !validDeptIds.has(name.toLowerCase())
      );

      if (missingDeptNames.length > 0) {
        const originalNames = missingDeptNames.map(n =>
          newLocs.find(l => l.departmentId.toUpperCase().trim() === n)?.departmentId || n
        );
        setNotifications(prev => [{
          id: `bulk-loc-err-${Date.now()}`,
          title: 'Import Stopped — Unrecognised Departments',
          message: `The following department names in the CSV do not match any existing department: ${originalNames.join(', ')}. Please create mapping rules in System Settings → Department Mapping Rules to map these names to official departments, then re-import.`,
          timestamp: new Date().toISOString(),
          type: 'error',
          read: false
        }, ...prev]);
        return;
      }

      // Remap locations: replace dept name with its actual UUID,
      // and resolve supervisor NAME → user ID.
      // If a supervisor doesn't exist yet, create a temporary user record for them.
      let userNameToId = new Map<string, string>(
        users.map(u => [u.name.toUpperCase().trim(), u.id])
      );

      // Find all unique supervisor names from the import that aren't already users
      const uniqueSupervisorNames = Array.from(
        new Set(newLocs.map(l => (l.supervisorId || '').trim()).filter(n => n && n !== 'To be filled'))
      );
      const missingSupervisors = uniqueSupervisorNames.filter(
        name => !userNameToId.has(name.toUpperCase().trim())
      );

      // Create temporary user records for missing supervisors
      const newUsersCreated: User[] = [];
      for (const name of missingSupervisors) {
        const tempId = `T-${Math.floor(1000 + Math.random() * 9000)}`;
        const deptName = newLocs.find(l => (l.supervisorId || '').trim() === name)?.departmentId || '';
        const deptId = deptNameToId.get(deptName.toUpperCase().trim());
        const newUser: User = {
          id: tempId,
          name: name,
          email: `temp_${tempId}@pending.local`,
          roles: ['Supervisor'],
          status: 'Inactive',
          isVerified: false,
          departmentId: deptId,
        };
        try {
          const addedUser = await gateway.addUser(newUser);
          newUsersCreated.push(addedUser);
          userNameToId.set(name.toUpperCase().trim(), addedUser.id);
        } catch (e) {
          console.warn(`Could not create temp user for supervisor: ${name}`, e);
        }
      }
      if (newUsersCreated.length > 0) {
        setUsers(prev => [...prev, ...newUsersCreated]);
      }

      const resolvedLocs: Omit<Location, 'id'>[] = newLocs.map(loc => {
        const supervisorName = (loc.supervisorId || '').toUpperCase().trim();
        const resolvedSupervisorId = userNameToId.get(supervisorName) || null;
        return {
          ...loc,
          departmentId: deptNameToId.get(loc.departmentId.toUpperCase().trim()) || loc.departmentId,
          supervisorId: resolvedSupervisorId as any,
        };
      });

      // --- STEP 2: Separate new locations from existing ones ---
      const existingLocsMap = new Map<string, Location>(locations.map(l => [`${l.name.toUpperCase()}|${l.departmentId}`, l]));

      const locsToAdd: Omit<Location, 'id'>[] = [];
      const locsToUpdate: { id: string, updates: Partial<Location> }[] = [];

      // Keep track of the latest totalAssets for each location from the import
      const latestLocsFromImport = new Map<string, Omit<Location, 'id'>>();
      resolvedLocs.forEach(loc => {
        latestLocsFromImport.set(`${loc.name.toUpperCase()}|${loc.departmentId}`, loc);
      });

      latestLocsFromImport.forEach((loc, key) => {
        const existingLoc = existingLocsMap.get(key);
        if (existingLoc) {
          // Build an updates object for any fields that differ from what's in the DB
          const updates: Partial<Location> = {};
          if (loc.totalAssets !== undefined && loc.totalAssets !== existingLoc.totalAssets) {
            updates.totalAssets = loc.totalAssets;
          }
          if (loc.supervisorId && loc.supervisorId !== existingLoc.supervisorId) {
            updates.supervisorId = loc.supervisorId;
          }
          if (loc.abbr && loc.abbr !== existingLoc.abbr) {
            updates.abbr = loc.abbr;
          }
          if (loc.building !== undefined && loc.building !== existingLoc.building) {
            updates.building = loc.building;
          }
          if (loc.level !== undefined && loc.level !== existingLoc.level) {
            updates.level = loc.level;
          }
          if (loc.contact !== undefined && loc.contact !== existingLoc.contact) {
            updates.contact = loc.contact;
          }
          if (loc.description !== undefined && loc.description !== existingLoc.description) {
            updates.description = loc.description;
          }
          if (Object.keys(updates).length > 0) {
            locsToUpdate.push({ id: existingLoc.id, updates });
          }
        } else {
          locsToAdd.push(loc);
        }
      });

      // --- STEP 3: Add new locations ---
      if (locsToAdd?.length > 0) {
        await gateway.bulkAddLocations(locsToAdd);
      }

      // 5. Update existing locations
      for (const update of locsToUpdate) {
        await gateway.updateLocation(update.id, update.updates);
      }

      // 6. Refresh states
      const allUpdatedLocs = await gateway.getLocations();
      setLocations(allUpdatedLocs);

      await refreshDepartmentTotals();
      const allUpdatedDepts = await gateway.getDepartments();
      setDepartments(allUpdatedDepts);

      setNotifications(prev => [{
        id: `bulk-loc-${Date.now()}`,
        title: 'Locations Imported',
        message: `Imported ${locsToAdd?.length || 0} new locations and updated ${locsToUpdate?.length || 0} existing locations.`,
        timestamp: new Date().toISOString(),
        type: 'success',
        read: false
      }, ...prev]);
    } catch (e) {
      showError(e, 'Bulk Import Failed');
    }
  };

  const handleBulkActivateStaff = async (entries: { name: string; email: string; department?: string; designation?: string; role?: string }[]) => {
    try {
      const userNameToObj = new Map<string, typeof users[0]>(users.map(u => [u.name.toUpperCase().trim(), u]));
      const deptNameToId = new Map<string, string>(departments.map(d => [d.name.toUpperCase().trim(), d.id]));
      let createdCount = 0;
      let updatedCount = 0;
      for (const entry of entries) {
        const deptId = entry.department ? (deptNameToId.get(entry.department.toUpperCase().trim()) ?? undefined) : undefined;
        const resolvedDesignation = (entry.designation as User['designation']) || undefined;
        const resolvedRoles: User['roles'] = entry.role ? [entry.role as any] : ['Staff'];
        // Match by name
        const existing = entry.name ? userNameToObj.get(entry.name.toUpperCase().trim()) : undefined;
        if (existing) {
          const updates: Partial<User> = { status: 'Active', isVerified: true };
          if (entry.email) updates.email = entry.email;
          if (deptId) updates.departmentId = deptId;
          if (resolvedDesignation) updates.designation = resolvedDesignation;
          if (entry.role) updates.roles = resolvedRoles;
          await gateway.updateUser(existing.id, updates);
          updatedCount++;
        } else {
          // Create new user
          const newUser: User = {
            id: crypto.randomUUID(),
            name: entry.name,
            email: entry.email || `${entry.name.replace(/\s+/g, '').toLowerCase()}@asset-audit.pro`,
            roles: resolvedRoles,
            designation: resolvedDesignation || 'Supervisor',
            status: 'Active',
            isVerified: true,
            departmentId: deptId,
          };
          await gateway.addUser(newUser);
          createdCount++;
        }
      }
      const updatedUsers = await gateway.getUsers();
      setUsers(updatedUsers);
      showToast(`Staff import complete: ${createdCount} created, ${updatedCount} updated.`);
    } catch (e) {
      showError(e, 'Staff Import Failed');
    }
  };

  const handleUpdateLoc = async (id: string, updates: Partial<Location>) => {
    try {
      const oldLoc = locations.find(l => l.id === id);
      await gateway.updateLocation(id, updates);
      setLocations(await gateway.getLocations());

      // Cascade supervisorId or departmentId changes to all audits for this location
      if (oldLoc) {
        const changedSupervisor = updates.supervisorId !== undefined && updates.supervisorId !== oldLoc.supervisorId;
        const changedDept = updates.departmentId !== undefined && updates.departmentId !== oldLoc.departmentId;

        if (changedSupervisor || changedDept) {
          const auditsToUpdate = schedules.filter(s => s.locationId === id);
          const auditUpdates: Partial<AuditSchedule> = {};
          if (changedSupervisor) auditUpdates.supervisorId = updates.supervisorId;
          if (changedDept) auditUpdates.departmentId = updates.departmentId;

          for (const audit of auditsToUpdate) {
            await gateway.updateAudit(audit.id, auditUpdates);
          }
          if (auditsToUpdate.length > 0) {
            setSchedules(await gateway.getAudits());
          }
        }
      }
      showToast('Location updated successfully');
      await refreshDepartmentTotals();
    } catch (e) {
      showError(e, 'Location Update Failed');
    }
  };

  const handleDeleteLoc = async (id: string) => {
    const loc = locations.find(l => String(l.id) === String(id));

    if (loc) {
      const locAudits = schedules.filter(s => s.locationId === loc.id && s.departmentId === loc.departmentId);
      const hasActiveAssignments = locAudits.some(s => s.auditor1Id || s.auditor2Id);

      if (hasActiveAssignments) {
        customAlert("Cannot delete this location because it has active audit assignments. Please unassign auditors first.");
        return;
      }
    }

    customConfirm("Delete Location", `Are you sure you want to delete ${loc?.name || 'this location'}?`, async () => {
      try {
        await gateway.deleteLocation(id);
        setLocations(await gateway.getLocations());
        showToast('Location deleted successfully');
        await refreshDepartmentTotals();
      } catch (e: any) {
        console.error("Delete failed:", e);
        if (e?.code === '23503') {
          customConfirm("Force Delete", "This location has pending audit schedules (unassigned). Do you want to delete the location and these pending schedules?", async () => {
            try {
              if (loc) {
                await gateway.forceDeleteLocation(id);
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
      let finalHeadId = dept.headOfDeptId;
      if (finalHeadId && finalHeadId.trim() !== '') {
        const existingUser = users.find(u => u.id === finalHeadId || u.name.toLowerCase() === finalHeadId!.toLowerCase());
        if (existingUser) {
          finalHeadId = existingUser.id;
          // Auto-activate if still pending
          if (existingUser.status === 'Pending' || !existingUser.isVerified) {
            await gateway.updateUser(existingUser.id, { status: 'Active', isVerified: true });
          }
        } else {
          // Create temp user
          const tempId = Math.floor(1000 + Math.random() * 9000).toString();
          const tempStaffId = `T-${tempId}`;
          const tempUser: User = {
            id: tempStaffId,
            name: finalHeadId,
            email: `temp${tempId}@asset-audit.pro`,
            roles: ['Staff'],
            designation: 'Head Of Department',
            status: 'Active',
            isVerified: true,
          };
          await gateway.addUser(tempUser);
          finalHeadId = tempStaffId;
        }
      } else {
        finalHeadId = null;
      }
      
      const createdDept = await gateway.addDepartment({ ...dept, headOfDeptId: finalHeadId, auditGroupId: null });
      // Link temp user to the newly created department
      if (finalHeadId && finalHeadId !== dept.headOfDeptId && createdDept?.id) {
        await gateway.updateUser(finalHeadId, { departmentId: createdDept.id });
      }
      setDepartments(await gateway.getDepartments());
      showToast('Department added successfully');
      if (finalHeadId && finalHeadId !== dept.headOfDeptId) {
        setUsers(await gateway.getUsers());
      }
    } catch (e) {
      showError(e, 'Failed to Add Department');
    }
  };

  const handleBulkAddDepts = async (newDepts: Omit<Department, 'id'>[]) => {
    try {
      let usersChanged = false;
      let currentUsers = [...users];
      const existingDeptsMap = new Map<string, Department>(
        departments.map(d => [d.name.toUpperCase().trim(), d])
      );

      for (const d of newDepts) {
        let finalHeadId = d.headOfDeptId;
        let newTempUserId: string | null = null;
        if (finalHeadId && finalHeadId.trim() !== '') {
          const existingUser = currentUsers.find(u => u.id === finalHeadId || u.name.toLowerCase() === finalHeadId!.toLowerCase());
          if (existingUser) {
            finalHeadId = existingUser.id;
            // Auto-activate if still pending
            if (existingUser.status === 'Pending' || !existingUser.isVerified) {
              await gateway.updateUser(existingUser.id, { status: 'Active', isVerified: true });
              usersChanged = true;
            }
          } else {
            const tempId = Math.floor(1000 + Math.random() * 9000).toString();
            const tempStaffId = `T-${tempId}`;
            newTempUserId = tempStaffId;
            const tempUser: User = {
              id: tempStaffId,
              name: finalHeadId,
              email: `temp${tempId}@asset-audit.pro`,
              roles: ['Staff'],
              designation: 'Head Of Department',
              status: 'Active',
              isVerified: true,
            };
            await gateway.addUser(tempUser);
            currentUsers.push(tempUser);
            finalHeadId = tempStaffId;
            usersChanged = true;
          }
        } else {
          finalHeadId = null;
        }

        const existingDept = existingDeptsMap.get(d.name.toUpperCase().trim());
        if (existingDept) {
          // Update existing department
          const updates: Partial<Department> = {};
          if (d.abbr && d.abbr !== existingDept.abbr) updates.abbr = d.abbr;
          if (finalHeadId !== existingDept.headOfDeptId) updates.headOfDeptId = finalHeadId;
          if (Object.keys(updates).length > 0) {
            await gateway.updateDepartment(existingDept.id, updates);
          }
          // Link temp user to existing dept
          if (newTempUserId) {
            await gateway.updateUser(newTempUserId, { departmentId: existingDept.id });
          }
        } else {
          const createdDept = await gateway.addDepartment({ ...d, headOfDeptId: finalHeadId, auditGroupId: null });
          // Link temp user to the newly created department
          if (newTempUserId && createdDept?.id) {
            await gateway.updateUser(newTempUserId, { departmentId: createdDept.id });
          }
        }
      }
      setDepartments(await gateway.getDepartments());
      setUsers(await gateway.getUsers());
      showToast(`Imported ${newDepts.length} departments successfully`);
    } catch (e) {
      showError(e, 'Bulk Import Failed');
    }
  };

  const handleUpdateDept = async (id: string, updates: Partial<Department>) => {
    try {
      await gateway.updateDepartment(id, updates);
      setDepartments(await gateway.getDepartments());
      showToast('Department updated successfully');
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
      const hasActiveAssignments = deptAudits.some(s => s.auditor1Id || s.auditor2Id);

      if (deptUsers?.length > 0) {
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
        showToast('Department deleted successfully');
      } catch (e: any) {
        console.error("Delete failed:", e);
        if (e?.code === '23503') {
          customConfirm("Force Delete", "This department has associated Locations or pending Audits. Do you want to delete the department and all these related records?", async () => {
            try {
              if (dept) {
                await gateway.forceDeleteDepartment(id);
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

  const handleAddPermission = async (auditorDeptId: string, targetDeptId: string, isMutual: boolean) => {
    try {
      await gateway.addPermission({ auditorDeptId, targetDeptId, isMutual, isActive: true });
      if (isMutual) {
        await gateway.addPermission({ auditorDeptId: targetDeptId, targetDeptId: auditorDeptId, isMutual: true, isActive: true });
      }
      setCrossAuditPermissions(await gateway.getPermissions());
      showToast('Permission added successfully');
    } catch (e) {
      showError(e, 'Failed to Add Permission');
    }
  };

  const handleBulkAddPermissions = async (perms: Omit<CrossAuditPermission, 'id'>[]) => {
    try {
      if (!perms?.length) return;
      await gateway.bulkAddPermissions(perms);
      setCrossAuditPermissions(await gateway.getPermissions());
      showToast(`Successfully added ${perms.length} pairings.`);
    } catch (e) {
      showError(e, 'Bulk Operation Failed');
    }
  };

  const handleRemovePermission = async (id: string) => {
    try {
      await gateway.deletePermission(id);
      setCrossAuditPermissions(await gateway.getPermissions());
      showToast('Permission removed successfully');
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

  const handleUpdatePhase = async (id: string, updates: Partial<AuditPhase>) => {
    try {
      await gateway.updateAuditPhase(id, updates);
      setAuditPhases(await gateway.getAuditPhases());
      showToast('Phase updated successfully');
    } catch (e) {
      showError(e, 'Phase Update Failed');
    }
  };

  const handleAddPhase = async (phase: Omit<AuditPhase, 'id'>) => {
    try {
      await gateway.addAuditPhase(phase);
      setAuditPhases(await gateway.getAuditPhases());
      showToast('Phase added successfully');
    } catch (e) {
      showError(e, 'Failed to Add Phase');
    }
  };

  const handleRebalanceSchedule = async () => {
    try {
      const allAudits = await gateway.getAudits();
      const allDepts = departmentsWithAssets;
      const allPhases = [...auditPhases].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const allTiers = [...kpiTiers].sort((a, b) => a.minAssets - b.minAssets);
      const allLocs = await gateway.getLocations();

      let updatedCount = 0;
      let createdCount = 0;

      for (const dept of allDepts) {
        // Skip departments with zero assets
        if ((dept.totalAssets || 0) === 0) continue;

        // 1. Find Tier
        let maxGlobalAssets = 0;
        for (const d of allDepts) {
            if ((d.totalAssets || 0) > maxGlobalAssets) maxGlobalAssets = d.totalAssets || 0;
        }
        const deptPercentage = maxGlobalAssets > 0 ? ((dept.totalAssets || 0) / maxGlobalAssets) * 100 : 0;
        
        const tier = [...allTiers]
           .filter(t => deptPercentage >= t.minAssets)
           .sort((a,b) => b.minAssets - a.minAssets)[0];
        if (!tier) continue;

        // 2. Identify Required Phases (those with target > 0)
        const requiredPhaseIds = allPhases
          .filter(p => (tier.targets[p.id] || 0) > 0)
          .map(p => p.id);

        if (requiredPhaseIds.length === 0) continue;

        // 3. Get existing audits for this department
        const deptAudits = allAudits.filter(a => a.departmentId === dept.id);
        const deptLocs = allLocs.filter(l => l.departmentId === dept.id);

        if (deptLocs.length === 0) continue;

        // 4. Ensure at least one audit exists for each required phase
        for (const phaseId of requiredPhaseIds) {
          const exists = deptAudits.some(a => a.phaseId === phaseId);
          if (!exists) {
            // Create a new audit for the first location in this phase
            const firstLoc = deptLocs[0];
            await gateway.addAudit({
              departmentId: dept.id,
              locationId: firstLoc.id,
              supervisorId: firstLoc.supervisorId || '',
              phaseId: phaseId,
              status: 'Pending',
              auditor1Id: null,
              auditor2Id: null,
              date: ''
            });
            createdCount++;
          }
        }

        // 5. Re-distribute UNLOCKED audits across required phases
        const unlockedAudits = deptAudits.filter(a => !isAuditLocked(a));
        if (unlockedAudits.length > 0) {
          unlockedAudits.forEach(async (audit, index) => {
            const targetPhaseId = requiredPhaseIds[index % requiredPhaseIds.length];
            if (audit.phaseId !== targetPhaseId) {
              await gateway.updateAudit(audit.id, { phaseId: targetPhaseId });
              updatedCount++;
            }
          });
        }
      }

      if (updatedCount > 0 || createdCount > 0) {
        setSchedules(await gateway.getAudits());
        customAlert(`Schedule rebalanced: ${createdCount} new audits created and ${updatedCount} audits moved to match Tier requirements.`);
      } else {
        customAlert("Schedule is already balanced according to Tier requirements.");
      }
    } catch (e) {
      showError(e, 'Rebalance Failed');
    }
  };

  const handleDeletePhase = async (id: string) => {
    customConfirm("Delete Phase", "Are you sure you want to delete this audit phase?", async () => {
      try {
        await gateway.deleteAuditPhase(id);
        setAuditPhases(await gateway.getAuditPhases());
        showToast('Phase deleted successfully');
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
      showToast('KPI Tier added successfully');
    } catch (e) {
      showError(e, 'Failed to Add KPI Tier');
    }
  };

  const handleUpdateKPITier = async (id: string, updates: Partial<KPITier>) => {
    try {
      await gateway.updateKPITier(id, updates);
      setKpiTiers(await gateway.getKPITiers());
      showToast('KPI Tier updated successfully');
    } catch (e) {
      showError(e, 'Failed to Update KPI Tier');
    }
  };

  const handleUpdateKPITierTarget = async (tierId: string, phaseId: string, percentage: number) => {
    try {
      await gateway.setKPITierTarget(tierId, phaseId, percentage);
      setKpiTierTargets(await gateway.getKPITierTargets());
    } catch (e) {
      showError(e, 'Failed to update target');
    }
  };

  const handleUpdateInstitutionKPI = async (phaseId: string, percentage: number) => {
    try {
      await gateway.updateInstitutionKPI(phaseId, percentage);
      const updated = await gateway.getInstitutionKPIs();
      setInstitutionKPIs(updated);
      showToast('Institutional KPI updated');
    } catch (e) {
      showError(e, 'Failed to update institutional KPI');
    }
  };

  const handleDeleteKPITier = async (id: string) => {
    customConfirm("Delete KPI Tier", "Are you sure you want to delete this KPI Tier?", async () => {
      try {
        await gateway.deleteKPITier(id);
        setKpiTiers(await gateway.getKPITiers());
        showToast('KPI Tier deleted successfully');
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

  const handleResetLocations = async () => {
    customConfirm("Reset Locations & Audits", "Are you sure you want to delete all locations and their associated audit schedules? This will NOT delete departments or users. Proceed?", async () => {
      try {
        await gateway.clearAllLocations();
        setLocations([]);
        setSchedules([]);
        setNotifications(prev => [{
          id: `reset-loc-${Date.now()}`,
          title: 'Locations Reset',
          message: 'All locations and associated audit schedules have been deleted.',
          timestamp: new Date().toISOString(),
          type: 'success',
          read: false
        }, ...prev]);
        showToast('All locations and audits reset successfully');
      } catch (e) {
        showError(e, 'Failed to reset locations');
      }
    });
  };

  const handleResetOperationalData = async () => {
    customConfirm("Reset Operational Data", "This will delete all departments, locations, user accounts (except yours), and audit schedules. System settings like Audit Phases and KPI Tiers will be preserved. Proceed?", async () => {
      try {
        await gateway.clearAllDepartments(currentUser.id);
        await gateway.clearDepartmentMappings();
        setDepartments([]);
        setLocations([]);
        setSchedules([]);
        setCrossAuditPermissions([]);
        setDepartmentMappings([]);

        // Refresh users to only keep the current user
        const updatedUsers = await gateway.getUsers();
        setUsers(updatedUsers);
        
        // Update current user's department to null in state if it's currently set
        setCurrentUser(prev => prev ? { ...prev, departmentId: undefined } : null);

        setNotifications(prev => [{
          id: `reset-ops-${Date.now()}`,
          title: 'System Reset',
          message: 'Operational data (Depts, Locs, Members) has been reset.',
          timestamp: new Date().toISOString(),
          type: 'success',
          read: false
        }, ...prev]);
        showToast('Operational data reset successfully');
      } catch (e) {
        showError(e, 'Failed to reset operational data');
      }
    });
  };

  const handleAddDepartmentMapping = async (mapping: Omit<DepartmentMapping, 'id'>) => {
    try {
      await gateway.addDepartmentMapping(mapping);
      setDepartmentMappings(await gateway.getDepartmentMappings());
      showToast('Mapping added successfully');
    } catch (e) {
      showError(e, 'Failed to add department mapping');
    }
  };

  const handleDeleteDepartmentMapping = async (id: string) => {
    try {
      await gateway.deleteDepartmentMapping(id);
      setDepartmentMappings(await gateway.getDepartmentMappings());
      showToast('Mapping deleted successfully');
    } catch (e) {
      showError(e, 'Failed to delete department mapping');
    }
  };

  // --- AUDIT GROUPS ---
  const handleAddAuditGroup = async (group: Omit<AuditGroup, 'id'>) => {
    try {
      const created = await gateway.addAuditGroup(group);
      setAuditGroups(await gateway.getAuditGroups());
      showToast('Audit Group created');
      return created;
    } catch (e) {
      showError(e, 'Failed to create group');
      return null;
    }
  };

  const handleUpdateAuditGroup = async (id: string, updates: Partial<AuditGroup>) => {
    try {
      await gateway.updateAuditGroup(id, updates);
      setAuditGroups(await gateway.getAuditGroups());
      showToast('Group updated');
    } catch (e) {
      showError(e, 'Update failed');
    }
  };

  const handleUpdateBuilding = async (building: Partial<Building>) => {
    try {
      const updated = await gateway.updateBuilding(building);
      setBuildings(prev => {
        const index = prev.findIndex(b => b.id === updated.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = updated;
          return next;
        }
        return [...prev, updated];
      });
      showToast(building.id ? "Building updated" : "Building registered");
      return updated;
    } catch (e: any) {
      showToast(e.message || "Failed to sync building", "error");
    }
  };

  const handleDeleteBuilding = async (id: string) => {
    try {
      await gateway.deleteBuilding(id);
      setBuildings(prev => prev.filter(b => b.id !== id));
      showToast("Building removed");
    } catch (e) {
      showError(e, 'Failed to remove building');
    }
  };

  const handleDeleteAuditGroup = async (id: string) => {
    if (confirm("Delete this group? Departments will be unassigned.")) {
      try {
        // The DB-level SET NULL on the audit_group_id FK handles the department unassignment automatically!
        // We just need to delete the group record.
        await gateway.deleteAuditGroup(id);
        
        setAuditGroups(await gateway.getAuditGroups());
        setDepartments(await gateway.getDepartments()); // Refresh depts to see the NULL reset
        showToast('Group removed');
      } catch (e) {
        showError(e, 'Delete failed');
      }
    }
  };

  const handleAutoConsolidate = async (threshold: number, excludedIds: string[]) => {
    try {
      // Step 1: Clear all previously auto-generated groups
      const prevAutoGroups = auditGroups.filter(g => g.name?.startsWith('Group '));
      if (prevAutoGroups.length > 0) {
        for (const group of prevAutoGroups) {
          // Unassign all departments from this group before deleting it
          const groupDepts = departmentsWithAssets.filter(d => d.auditGroupId === group.id);
          for (const dept of groupDepts) {
            await gateway.updateDepartment(dept.id, { auditGroupId: null });
          }
          await gateway.deleteAuditGroup(group.id);
        }
      }

      // Step 2: Re-fetch fresh state after clearing
      const freshDepts = await gateway.getDepartments();
      const eligible = freshDepts
        .filter(d => !excludedIds.includes(d.id) && (d.totalAssets || 0) > 0)
        .sort((a, b) => (a.totalAssets || 0) - (b.totalAssets || 0));

      if (eligible.length === 0) {
        customAlert('No eligible departments to group. All may have been excluded.');
        setAuditGroups(await gateway.getAuditGroups());
        setDepartments(freshDepts);
        return;
      }

      let groupIndex = 1;
      let bundle: typeof eligible = [];
      let running = 0;

      const flush = async () => {
        if (bundle.length === 0) return;
        const newGroup = await gateway.addAuditGroup({
          name: `Group ${String.fromCharCode(65 + (groupIndex++) - 1)}`,
          description: `Auto-grouped: ${bundle.map(d => d.abbr).join(', ')}`
        });
        for (const dept of bundle) {
          await gateway.updateDepartment(dept.id, { auditGroupId: newGroup.id });
        }
        bundle = [];
        running = 0;
      };

      for (const dept of eligible) {
        running += dept.totalAssets || 0;
        bundle.push(dept);
        if (running >= threshold) await flush();
      }
      await flush(); // flush any remaining

      setAuditGroups(await gateway.getAuditGroups());
      setDepartments(await gateway.getDepartments());
      showToast(`Auto-consolidation complete! ${groupIndex - 1} groups created.`);
    } catch (e) {
      showError(e, 'Auto-Consolidation Failed');
    }
  };

  const handleUpsertLocations = async (newLocs: Omit<Location, 'id'>[]) => {
    try {
      const existingMap = new Map<string, Location>(locations.map(l => [`${l.name.toUpperCase()}|${l.departmentId}`, l]));
      const toAdd: Omit<Location, 'id'>[] = [];
      const toUpdate: { id: string; updates: Partial<Location> }[] = [];
      for (const loc of newLocs) {
        const key = `${loc.name.toUpperCase()}|${loc.departmentId}`;
        const existing = existingMap.get(key);
        if (existing) {
          if (loc.totalAssets !== undefined && loc.totalAssets !== existing.totalAssets) {
            toUpdate.push({ id: existing.id, updates: { totalAssets: loc.totalAssets } });
          }
        } else {
          toAdd.push(loc);
        }
      }
      if (toAdd.length > 0) {
        // Supabase insert limit — batch at 200 rows
        for (let i = 0; i < toAdd.length; i += 200) {
          await gateway.bulkAddLocations(toAdd.slice(i, i + 200));
        }
      }
      for (const u of toUpdate) {
        await gateway.updateLocation(u.id, u.updates);
      }
      const updatedLocs = await gateway.getLocations();
      setLocations(updatedLocs);
      await refreshDepartmentTotals();
    } catch (e) {
      showError(e, 'Location Upsert Failed');
    }
  };

  const handleSyncLocationMappings = async () => {
    try {
      let updatedCount = 0;
      for (const mapping of departmentMappings) {
        // Find stub dept whose name matches sourceName
        const stubDept = departments.find(
          d => d.name.toUpperCase().trim() === mapping.sourceName.toUpperCase().trim()
        );
        if (!stubDept) continue;
        if (stubDept.id === mapping.targetDepartmentId) continue; // already correct

        // Find all locations in the stub dept
        const locs = locations.filter(l => l.departmentId === stubDept.id);
        for (const loc of locs) {
          await gateway.updateLocation(loc.id, { departmentId: mapping.targetDepartmentId });
          updatedCount++;
        }
      }
      if (updatedCount > 0) {
        setLocations(await gateway.getLocations());
        showToast(`Sync complete — ${updatedCount} location${updatedCount !== 1 ? 's' : ''} reassigned.`);
      } else {
        showToast('Sync complete — no locations needed updating.');
      }
    } catch (e) {
      showError(e, 'Failed to sync location mappings');
    }
  };

  const handleAddMember = async (user: User) => {
    try {
      await gateway.addUser(user);
      setUsers(await gateway.getUsers());
      showToast('Member added successfully');
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
      if (updates.id && updates.id !== id) {
        // ID is changing (Temp ID -> Real ID)
        const existingUserWithNewId = users.find(u => u.id === updates.id);
        if (existingUserWithNewId) {
          throw new Error(`The Staff ID ${updates.id} is already registered.`);
        }
        
        // Let Supabase handle the PK update and ON UPDATE CASCADE constraints natively!
        await gateway.updateUser(id, updates);
        
        // Reload all data so dependencies reflect the new ID
        await loadAllData(); 
        
        if (currentUser?.id === id) {
          const freshUser = (await gateway.getUsers()).find(u => u.id === updates.id);
          if (freshUser) {
            localStorage.setItem('audit_pro_session', JSON.stringify(freshUser));
            setCurrentUser(freshUser);
            if (freshUser.status === 'Active' && activeView === 'profile') {
              setActiveView('overview');
            }
          }
        }
      } else {
        await gateway.updateUser(id, updates);
        setUsers(await gateway.getUsers());
        showToast('Profile updated successfully');
        if (currentUser?.id === id) {
          setCurrentUser(prev => {
            if (!prev) return null;
            const updated = { ...prev, ...updates };
            localStorage.setItem('audit_pro_session', JSON.stringify(updated));
            if (prev.status === 'Pending' && updated.status === 'Active') {
              setActiveView('overview');
            }
            return updated;
          });
        }
      }
    } catch (e: any) {
      showError(e, 'Member Update Failed');
      throw e;
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (confirm("Remove user?")) {
      try {
        await gateway.deleteUser(id);
        setUsers(await gateway.getUsers());
        showToast('Member removed successfully');
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

  const handleUpdateUserStatus = async (id: string, status: 'Active' | 'Inactive' | 'Suspended' | 'Pending') => {
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
    } catch (e) {
      showError(e, 'Role Update Failed');
    }
  };

  const handleViewChange = (view: AppView) => {
    setActiveView(view);
  };

  if (viewState === 'landing') {
    const totalAssets = departmentsWithAssets.reduce((sum, d) => sum + (d.totalAssets || 0), 0);
    const completedAudits = schedules.filter(s => s.status === 'Completed').length;
    const totalAuditsCount = schedules.length;
    const complianceProgress = totalAuditsCount > 0 ? Math.round((completedAudits / totalAuditsCount) * 100) : 0;

    return (
      <LandingPage
        onEnter={async () => {
          if (currentUser) {
            setViewState('app');
          } else {
            await authService.loginWithGoogle();
          }
        }}
        onShowKnowledgeBase={() => setViewState('docs')}
        totalAssets={totalAssets}
        totalPhases={auditPhases.length}
        complianceProgress={complianceProgress}
        phases={auditPhases}
        activities={activities}
        topDepartments={topDepartments}
        onDemoLogin={undefined}
      />
    );
  }

  if (viewState === 'docs') {
    return (
      <div className="h-screen bg-slate-50 overflow-x-hidden overflow-y-auto relative">
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

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold animate-pulse">Initializing Session...</p>
      </div>
    );
  }

  const visibleUsers = isAdmin ? users : users.filter(u => u.departmentId === currentUser.departmentId);
  const visibleDepartments = isAdmin ? departmentsWithAssets : departmentsWithAssets.filter(d => d.id === currentUser?.departmentId);
  const visibleLocations = isAdmin ? locations : locations.filter(l => l.departmentId === currentUser.departmentId);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <AutoUpdater />
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeView={activeView}
        onViewChange={handleViewChange}
        onLogout={handleLogout}
        userRoles={currentUser.roles}
        isCertified={currentUser.certificationExpiry && new Date(currentUser.certificationExpiry) > new Date()}
        userStatus={currentUser.status}
      />

      <div className="flex-grow lg:pl-72 flex flex-col h-full min-w-0">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 capitalize leading-none">{activeView.replace('-', ' ')}</h1>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase border bg-indigo-50 text-indigo-600 border-indigo-100">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                Secure Session
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {currentUser.status !== 'Pending' && (
              <>
                <button
                  onClick={() => setActiveView('knowledge-base')}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${activeView === 'knowledge-base' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  title="Knowledge Base"
                >
                  <BookOpen className="w-5 h-5" />
                </button>
                <NotificationCenter 
                  notifications={notifications} 
                  onMarkAsRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))} 
                  onClearAll={() => setNotifications([])} 
                />
                <div className="h-8 w-px bg-slate-200"></div>
              </>
            )}
            <button onClick={() => setActiveView('profile')} className="flex items-center gap-2 p-1 pr-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">{currentUser.name[0]}</div>
              <span className="text-xs font-bold text-slate-700 hidden sm:block">{currentUser.name}</span>
            </button>
          </div>
        </header>

        <main className={`flex-grow p-4 md:p-8 w-full flex flex-col min-h-0 overflow-y-auto`}>
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
              onUpdateConfig={() => { }}
              phases={auditPhases}
              kpiTiers={kpiTiers}
              departments={departmentsWithAssets}
              locations={locations}
              currentUser={currentUser}
              activities={activities}
              maxAssetsPerDay={maxAssetsPerDay}
              auditGroups={auditGroups}
              institutionKPIs={institutionKPIs}
              buildings={buildings}
            />
          )}
          {activeView === 'auditor-dashboard' && (
            <AuditorDashboard
              schedules={schedules}
              currentUser={currentUser}
              phases={auditPhases}
              kpiTiers={kpiTiers}
              departments={departmentsWithAssets}
              locations={locations}
              institutionKPIs={institutionKPIs}
            />
          )}
          {activeView === 'schedule' && (
            <div className="flex-1 flex flex-col min-h-0">
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
                onUpdateAudit={handleUpdateAudit}
                onToggleStatus={handleToggleStatus}
                allDepartments={departmentsWithAssets}
                allLocations={locations}
                crossAuditPermissions={crossAuditPermissions}
                auditPhases={auditPhases}
                maxAssetsPerDay={maxAssetsPerDay}
                buildings={buildings}
              />
            </div>
          )}
          {activeView === 'team' && (
            <TeamManagement
              users={visibleUsers}
              departments={visibleDepartments}
              onAddMember={handleAddMember}
              onBulkAddMembers={handleBulkAddMembers}
              onUpdateMember={handleUpdateMember}
              onDeleteMember={handleDeleteMember}
              onUpdateRoles={handleUpdateUserRoles}
              onUpdateStatus={handleUpdateUserStatus}
              currentUserRoles={currentUser.roles}
              customConfirm={customConfirm}
              customAlert={customAlert}
              phases={auditPhases}
              selectedDeptFilter={selectedDept}
              onDeptFilterChange={setSelectedDept}
            />
          )}
          {activeView === 'departments' && (
            <DepartmentManagement
              departments={visibleDepartments}
              locations={visibleLocations}
              departmentMappings={departmentMappings}
              users={users}
              onAdd={handleAddDept}
              onUpdate={handleUpdateDept}
              onBulkUpdate={handleBulkUpdateDepts}
              onDelete={handleDeleteDept}
              isAdmin={isAdmin}
              phases={auditPhases}
              auditGroups={auditGroups}
              onAddGroup={handleAddAuditGroup}
              onUpdateGroup={handleUpdateAuditGroup}
              onDeleteGroup={handleDeleteAuditGroup}
              onAddAuditor={(deptId) => {
                setSelectedDept(deptId);
                setActiveView('team');
              }}
            />
          )}
          {activeView === 'locations' && (
            <LocationManagement
              locations={visibleLocations}
              departments={visibleDepartments}
              users={users}
              userRoles={currentUser.roles}
              userDeptId={currentUser.departmentId}
              onAdd={handleAddLoc}
              onBulkAdd={handleBulkAddLocs}
              onUpdate={handleUpdateLoc}
              onDelete={handleDeleteLoc}
              phases={auditPhases}
              buildings={buildings}
              onAddBuilding={handleUpdateBuilding}
            />
          )}
          {activeView === 'buildings' && (
            <BuildingManagement 
              buildings={buildings}
              locations={locations}
              onAdd={handleUpdateBuilding}
              onUpdate={handleUpdateBuilding}
              onDelete={handleDeleteBuilding}
            />
          )}
          {activeView === 'settings' && (
            <SystemSettings
              departments={departmentsWithAssets}
              users={users}
              permissions={crossAuditPermissions}
              phases={auditPhases}
              kpiTiers={kpiTiers}
              kpiTierTargets={kpiTierTargets}
              institutionKPIs={institutionKPIs}
              userRoles={currentUser.roles}
              onAddPermission={handleAddPermission}
              onRemovePermission={handleRemovePermission}
              onTogglePermission={handleTogglePermission}
              onUpdateDepartment={handleUpdateDept}
              onBulkUpdateDepartments={handleBulkUpdateDepts}
              onBulkAddPermissions={handleBulkAddPermissions}
              onAddPhase={handleAddPhase}
              onUpdatePhase={handleUpdatePhase}
              onDeletePhase={handleDeletePhase}
              onAddKPITier={handleAddKPITier}
              onUpdateKPITier={handleUpdateKPITier}
              onDeleteKPITier={handleDeleteKPITier}
              onUpdateKPITierTarget={handleUpdateKPITierTarget}
              onUpdateInstitutionKPI={handleUpdateInstitutionKPI}
              onResetLocations={handleResetLocations}
              onResetOperationalData={handleResetOperationalData}
              isSystemLocked={isSystemLocked}
              onBulkAddLocs={handleBulkAddLocs}
              onBulkAddDepts={handleBulkAddDepts}
              onBulkActivateStaff={handleBulkActivateStaff}
              maxAssetsPerDay={maxAssetsPerDay}
              onUpdateMaxAssetsPerDay={setMaxAssetsPerDay}
              onRebalanceSchedule={handleRebalanceSchedule}
              schedules={schedules}
              departmentMappings={departmentMappings}
              onAddDepartmentMapping={handleAddDepartmentMapping}
              onDeleteDepartmentMapping={handleDeleteDepartmentMapping}
              onSyncLocationMappings={handleSyncLocationMappings}
              onUpsertLocations={handleUpsertLocations}
              auditGroups={auditGroups}
              onAddAuditGroup={handleAddAuditGroup}
              onUpdateAuditGroup={handleUpdateAuditGroup}
              onDeleteAuditGroup={handleDeleteAuditGroup}
              onAutoConsolidate={handleAutoConsolidate}
            />
          )}
          {activeView === 'profile' && <UserProfile user={currentUser} departments={departmentsWithAssets} onUpdate={handleUpdateMember} />}
          {activeView === 'knowledge-base' && <KnowledgeBase phases={auditPhases} />}
        </main>

        {/* Global Footer */}
        <footer className="shrink-0 border-t border-slate-100 bg-white/80 backdrop-blur-sm px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-slate-500">Inspect-<span className="text-blue-500">able</span></span>
            <span className="hidden sm:inline">— Institutional Asset Audit Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono">v{import.meta.env.VITE_APP_VERSION || '1.0.0'}</span>
            <span>© {new Date().getFullYear()} Politeknik Kuching Sarawak. All rights reserved.</span>
          </div>
        </footer>
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
                className={`px-4 py-2 text-sm font-bold text-white rounded-xl transition-colors ${confirmState.isDestructive === false ? 'bg-blue-600 hover:bg-blue-700 w-full' : 'bg-red-600 hover:bg-red-700'
                  }`}
              >
                {confirmState.isDestructive === false ? 'OK' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </div>
  );
};

export default App;
