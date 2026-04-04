
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useRBAC } from './contexts/RBACContext';
import { gateway } from './services/dataGateway';
import { supabase } from './services/supabase';
import { authService } from './services/auth';
import { AuditSchedule, AppNotification, User, UserRole, DashboardConfig, AppView, CrossAuditPermission, Department, Location, AuditPhase, KPITier, KPITierTarget, InstitutionKPITarget, DepartmentMapping, SystemActivity, AuditGroup, Building, RBACMatrix } from './types';
import { AuditTable } from './components/AuditTable';
import { Sidebar } from './components/Sidebar';
import { NotificationCenter } from './components/NotificationCenter';
import { UserManagement } from './components/UserManagement';
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
import { AdminDashboard } from './components/AdminDashboard';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { bulkManagement } from './services/bulkManagement';
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
  const [maxAssetsPerDay, setMaxAssetsPerDay] = useState<number>(1000);
  const [maxLocationsPerDay, setMaxLocationsPerDay] = useState<number>(5);
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

  const { rbacMatrix, hasPermission, updateRBAC } = useRBAC();

  // --- ROLE CHECKS ---
  const isAdmin = (currentUser?.roles || []).includes('Admin');
  const isCoordinator = (currentUser?.roles || []).includes('Coordinator');
  const isSupervisor = (currentUser?.roles || []).includes('Supervisor');
  const isAuditor = (currentUser?.roles || []).includes('Auditor');

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
    const id = crypto.randomUUID ? crypto.randomUUID() : `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
      await gateway.addSystemActivity(activity);
      // Refresh activities
      const updated = await gateway.getSystemActivity();
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
        gateway.getSystemActivity(),
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

      // System Settings
      try {
        const settings = await gateway.getSystemSettings();
        const constraints = settings.find(s => s.id === 'audit_constraints');
        if (constraints?.value) {
          if (constraints.value.maxAssetsPerDay) setMaxAssetsPerDay(constraints.value.maxAssetsPerDay);
          if (constraints.value.maxLocationsPerDay) setMaxLocationsPerDay(constraints.value.maxLocationsPerDay);
        }
      } catch (e) {
        console.warn("System settings failed to load:", e);
      }

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
    }
  }, [isAdmin, kpiTiers, auditPhases, kpiTierTargets]);



  // --- COMPUTED VALUES ---
  const departmentsWithAssets = useMemo(() => {
    return departments.map(dept => {
      const deptLocations = locations.filter(l => l.departmentId === dept.id);
      const computedAssets = deptLocations.reduce((sum, loc) => sum + (loc.totalAssets || 0), 0);
      // Use the mapping-derived dept.totalAssets as a floor: this captures assets that
      // weren't matched during the granular asset sync (unresolved Bahagian values).
      const finalAssets = Math.max(computedAssets, dept.totalAssets || 0);
      
      const auditors = users.filter(u => 
        u.departmentId === dept.id &&
        ['Staff', 'Auditor', 'Supervisor', 'Coordinator', 'Admin'].some(role => u.roles?.includes(role as any)) &&
        u.status === 'Active'
      ).length;

      // Manual setting takes precedence. 
      // We only auto-exempt in the specific sync function, not in the live UI memo.
      const finalIsExempted = !!dept.isExempted;

      const uninspectedAssets = deptLocations.reduce((sum, loc) => sum + (loc.uninspectedAssetCount || 0), 0);

      return {
        ...dept,
        totalAssets: finalAssets,
        uninspectedAssetCount: uninspectedAssets,
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
        // Use max(location sum, mapping-derived dept total) so authoritative mapping totals
        // act as a floor for assets that weren't matched during granular asset sync.
        const totalAssets = Math.max(calculatedAssets, d.totalAssets || 0);
        const auditors = allUsers.filter(u => 
          u.departmentId === d.id &&
          ['Staff', 'Auditor', 'Supervisor', 'Coordinator', 'Admin'].some(role => u.roles?.includes(role as any)) &&
          u.status === 'Active'
        ).length;
        
        // Only automatically EXEMPT if it's completely empty AND not part of a consolidation unit.
        // We never automatically UN-EXEMPT (to respect manual choices).
        const shouldBeExempted = d.isExempted === true || (totalAssets === 0 && auditors === 0 && !d.auditGroupId);

        return {
          id: d.id,
          data: { 
            totalAssets: totalAssets, 
            isExempted: !!shouldBeExempted
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
    } else if (!isAdmin && !(finalUser.roles || []).some((r: string) => ['Admin', 'Coordinator', 'Supervisor', 'Auditor'].includes(r))) {
      setViewState('app');
      setActiveView('profile');
    } else {
      setViewState('app');
      setActiveView('overview');
    }

    localStorage.setItem('audit_pro_session', JSON.stringify(finalUser));
  }, []);



  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.error("[App] Logout error:", e);
    } finally {
      // Cleanup local state
      setCurrentUser(null);
      setViewState('landing');
      setIsSidebarOpen(false);
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
          } else if (!isAdmin && !(user.roles || []).some((r: string) => ['Admin', 'Coordinator', 'Supervisor', 'Auditor'].includes(r))) {
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
              } else if (!isAdmin && !(user.roles || []).some((r: string) => ['Admin', 'Coordinator', 'Supervisor', 'Auditor'].includes(r))) {
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
        fallbackToLocalSession();
      }
    };

    const initialize = async () => {
      // Start data loading and session check in parallel for speed
      await Promise.allSettled([
        initSession(),
        loadAllData()
      ]);
      
      setIsInitialLoading(false);
    };

    initialize();


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
              } else if (!isAdmin && !user.roles.some((r: string) => ['Admin', 'Coordinator', 'Supervisor', 'Auditor'].includes(r))) {
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

  // Idle Timer for auto-logout (30 minutes)
  useEffect(() => {
    if (!currentUser) return;

    let timeoutId: NodeJS.Timeout;
    const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout();
      }, IDLE_TIMEOUT_MS);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(event => document.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [currentUser]);

  // --- ACTION HANDLERS ---
  const showError = useCallback((error: any, title: string = 'Operation Failed') => {
    console.error(error);
    let message = error?.message || 'An unexpected error occurred. Please try again.';

    if (message.includes('not found')) {
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
      logActivity('CREATE', `Created audit schedule for ${dept?.abbr || audit.departmentId}`, newAudit.id, { auditId: newAudit.id });
      return newAudit;
    } catch (e) {
      showError(e, 'Failed to Add Audit');
    }
  };

  const handleBulkAddAudits = async (newAudits: Omit<AuditSchedule, 'id'>[]) => {
    try {
      const result = await bulkManagement.addAudits(
        newAudits,
        users,
        departments,
        locations,
        departmentsWithAssets
      );

      if (!result.success) {
        showToast(result.message || 'Bulk Import Failed', 'error');
        return;
      }

      // Refresh data
      if (result.newUsersCreated?.length) setUsers(prev => [...prev, ...result.newUsersCreated!]);
      if (result.newDeptIds?.length) setDepartments(await gateway.getDepartments());
      
      const updatedLocs = await gateway.getLocations();
      setLocations(updatedLocs);

      const added = result.added || [];
      setSchedules(prev => [...prev, ...added]);

      setNotifications(prev => [{
        id: `bulk-${Date.now()}`,
        title: 'Batch Schedule Created',
        message: `Successfully imported ${added.length} audit entries. ${result.newDeptIds?.length || 0} new departments, ${result.newLocs?.length || 0} new locations, and ${result.newUsersCreated?.length || 0} temporary users were added.`,
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
        const audit = schedules.find(s => s.id === id);
        setSchedules(prev => prev.filter(s => s.id !== id));
        showToast('Audit deleted successfully');
        logActivity('DELETE', `Deleted audit schedule: ${audit?.id || id}`, undefined, { auditId: id });
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
      const u = users.find(user => user.id === userId);
      const isCertified = u?.certificationExpiry && new Date(u.certificationExpiry) > new Date();
      
      if (!isCertified) {
        throw new Error("Action Blocked: The selected user does not hold a valid institutional certificate. Assignments are restricted to certified auditors only.");
      }

      const updates: Partial<AuditSchedule> = slot === 1 ? { auditor1Id: userId } : { auditor2Id: userId };
      await gateway.updateAudit(id, updates);
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      
      const audit = schedules.find(s => s.id === id);
      const loc = locations.find(l => l.id === audit?.locationId);
      if (u && loc) {
        logActivity('AUDITOR_ASSIGNED', `${u.name} assigned to audit at ${loc.name}`, id);
      }
      showToast('Auditor assigned successfully');
    } catch (e) {
      showError(e, 'Assignment Denied');
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
      
      logActivity('LOCATION_CREATED', `New location created: ${newLoc.name} (${newLoc.departmentId})`);
      
      setNotifications(prev => [{
        id: `auto-${Date.now()}`,
        title: 'Auto-Schedule Created',
        message: `New audit schedule generated for ${newLoc.name}.`,
        timestamp: new Date().toISOString(),
        type: 'success',
        read: false
      }, ...prev]);
      showToast('Location added successfully');
      await refreshDepartmentTotals();
      logActivity('CREATE', `Created location: ${newLoc.name}`, undefined, { locationId: newLoc.id });
    } catch (e) {
      showError(e, 'Failed to Add Location');
    }
  };

  const handleBulkAddLocs = async (newLocs: Omit<Location, 'id'>[]) => {
    try {
      const result = await bulkManagement.addLocations(
        newLocs,
        departments,
        users,
        locations
      );

      if (!result.success) {
        setNotifications(prev => [{
          id: `bulk-loc-err-${Date.now()}`,
          title: 'Import Stopped — Unrecognised Departments',
          message: `The following department names in the CSV do not match any existing department: ${result.missingDepts?.join(', ')}. Please create mapping rules in System Settings → Department Mapping Rules to map these names to official departments, then re-import.`,
          timestamp: new Date().toISOString(),
          type: 'error',
          read: false
        }, ...prev]);
        return;
      }

      if (result.newUsersCreated?.length) {
        setUsers(prev => [...prev, ...result.newUsersCreated!]);
      }

      // Refresh states
      const allUpdatedLocs = await gateway.getLocations();
      setLocations(allUpdatedLocs);

      await refreshDepartmentTotals();
      const allUpdatedDepts = await gateway.getDepartments();
      setDepartments(allUpdatedDepts);

      setNotifications(prev => [{
        id: `bulk-loc-${Date.now()}`,
        title: 'Locations Imported',
        message: `Imported ${result.addedCount} new locations and updated ${result.updatedCount} existing locations.`,
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
      const { createdCount, skippedCount } = await bulkManagement.activateStaff(
        entries,
        users,
        departments
      );
      
      const updatedUsers = await gateway.getUsers();
      setUsers(updatedUsers);
      showToast(`Staff import complete: ${createdCount} created, ${skippedCount} duplicates skipped.`);
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
      logActivity('UPDATE', `Updated location: ${oldLoc?.name || id}`, undefined, { locationId: id, updates });
    } catch (e) {
      showError(e, 'Location Update Failed');
    }
  };

  const handleUpdateUninspectedAssetCounts = async (updates: { id: string, uninspectedCount: number }[]) => {
    try {
      await Promise.all(updates.map(u => gateway.updateLocation(u.id, { uninspectedAssetCount: u.uninspectedCount })));
      const updatedLocs = await gateway.getLocations();
      setLocations(updatedLocs);

      // Roll up uninspected counts to each department
      const deptUninspected: Record<string, number> = {};
      updatedLocs.forEach(l => {
        if (l.departmentId) deptUninspected[l.departmentId] = (deptUninspected[l.departmentId] || 0) + (l.uninspectedAssetCount || 0);
      });
      await Promise.all(
        Object.entries(deptUninspected).map(([deptId, count]) =>
          gateway.updateDepartment(deptId, { uninspectedAssetCount: count })
        )
      );
      setDepartments(await gateway.getDepartments());

      showToast('Uninspected asset counts updated successfully');
      logActivity('UPDATE', 'Uploaded uninspected asset registry');
    } catch (e) {
      showError(e, 'Failed to update uninspected counts');
    }
  };

  const handleDeleteLoc = async (id: string) => {
    const loc = locations.find(l => String(l.id) === String(id));
    if (!loc) return;

    const locAudits = schedules.filter(s => s.locationId === loc.id && s.departmentId === loc.departmentId);
    const hasActiveAssignments = locAudits.some(s => s.date || s.auditor1Id || s.auditor2Id);

    if (hasActiveAssignments) {
        customAlert("Action Blocked: This location is currently bound to an audit (Date or Officer assigned). Please unassign them before decommissioning.");
        return;
    }

    if (isAdmin) {
      customConfirm("Permanently Delete Location?", `Are you sure you want to permanently remove "${loc.name}"? This action is irreversible.`, async () => {
        try {
          const unassignedAudits = locAudits.filter(s => !s.date && !s.auditor1Id && !s.auditor2Id);
          if (unassignedAudits.length > 0) {
              await gateway.forceDeleteLocation(id);
          } else {
              await gateway.deleteLocation(id);
          }
          setLocations(prev => prev.filter(l => l.id !== id));
          showToast('Location permanently deleted');
          await refreshDepartmentTotals();
          logActivity('DELETE', `Permanently deleted location: ${loc.name}`, undefined, { locationId: id });
        } catch (e: any) {
          showError(e, 'Deletion Failed');
        }
      });
    } else {
      customConfirm("Request Decommission?", `Are you sure you want to request archiving for "${loc.name}"? An admin must approve this.`, async () => {
        try {
          const updated = await gateway.updateLocation(id, { status: 'Pending_Delete' });
          setLocations(prev => prev.map(l => l.id === id ? updated : l));
          showToast('Decommission request sent to Admin');
          logActivity('ARCHIVE', `Requested decommission for location: ${loc.name}`, undefined, { locationId: id });
        } catch (e) {
          showError(e, 'Archive Request Failed');
        }
      });
    }
  };

  const handleApproveArchive = async (locationId: string) => {
    const loc = locations.find(l => l.id === locationId);
    if (!loc) return;
    try {
      await gateway.forceDeleteLocation(locationId);
      setLocations(prev => prev.filter(l => l.id !== locationId));
      showToast('Decommission approved');
      await refreshDepartmentTotals();
      logActivity('DELETE', `Approved decommission for: ${loc.name}`, undefined, { locationId });
    } catch (e) {
      showError(e, 'Approval Failed');
    }
  };

  const handleRejectArchive = async (locationId: string) => {
    const loc = locations.find(l => l.id === locationId);
    if (!loc) return;
    try {
      const updated = await gateway.updateLocation(locationId, { status: 'Active' });
      setLocations(prev => prev.map(l => l.id === locationId ? updated : l));
      showToast('Decommission request rejected');
      logActivity('UPDATE', `Rejected decommission for: ${loc.name}`, undefined, { locationId });
    } catch (e) {
      showError(e, 'Rejection Failed');
    }
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
      logActivity('CREATE', `Created department: ${dept.name}`, undefined, { departmentId: createdDept.id });
      if (finalHeadId && finalHeadId !== dept.headOfDeptId) {
        setUsers(await gateway.getUsers());
      }
    } catch (e) {
      showError(e, 'Failed to Add Department');
    }
  };

  const handleBulkAddDepts = async (newDepts: Omit<Department, 'id'>[]) => {
    try {
      const result = await bulkManagement.addDepartments(
        newDepts,
        departments,
        users
      );
      
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
      
      // If exemption status changed, trigger a refresh to update totalAssets/exemption logic
      if (updates.isExempted !== undefined) {
        await refreshDepartmentTotals();
      }
      
      showToast('Department updated successfully');
      logActivity('UPDATE', `Updated department: ${id}`, undefined, { departmentId: id, updates });
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
        logActivity('DELETE', `Deleted department: ${dept?.name || id}`, undefined, { departmentId: id });
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

  const handleBulkRemovePermissions = async (ids: string[]) => {
    try {
      if (!ids?.length) return;
      await gateway.bulkDeletePermissions(ids);
      setCrossAuditPermissions(await gateway.getPermissions());
      showToast('Permissions cleared successfully');
    } catch (e) {
      showError(e, 'Bulk Removal Failed');
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
          .filter(p => {
            const t = kpiTierTargets.find(kt => kt.tierId === tier.id && kt.phaseId === p.id);
            return (t?.targetPercentage ?? tier.targets?.[p.id] ?? 0) > 0;
          })
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

  const handleAutoConsolidate = async (threshold: number, excludedIds: string[], minAuditors: number = 2) => {
    try {
      // Step 1: Immediate UI Purge to prevent stale renders
      setAuditGroups([]);
      
      // Step 2: Absolute Server-Side Purge
      // First, get all existing auto-generated groups
      const currentGroups = await gateway.getAuditGroups();
      const prevAutoGroups = currentGroups.filter(g => g.name?.startsWith('Group '));
      
      if (prevAutoGroups.length > 0) {
        // Unassign ALL departments from these groups first to avoid foreign key issues
        const allDepts = await gateway.getDepartments();
        for (const group of prevAutoGroups) {
          const groupDepts = allDepts.filter(d => d.auditGroupId === group.id);
          for (const dept of groupDepts) {
            await gateway.updateDepartment(dept.id, { auditGroupId: null });
          }
          await gateway.deleteAuditGroup(group.id);
        }
      }

      // Step 3: Use fresh, authoritative data for calculation
      const freshDepts = await gateway.getDepartments();
      const eligible = freshDepts
        .filter(d => !excludedIds.includes(d.id) && d.isExempted !== true)
        .sort((a, b) => (a.totalAssets || 0) - (b.totalAssets || 0));

      if (eligible.length === 0) {
        customAlert('No eligible departments to group. All may have been excluded or have 0 assets.');
        setAuditGroups(await gateway.getAuditGroups());
        return;
      }

      let bundles: (typeof eligible)[] = [];
      let currentBundle: typeof eligible = [];
      let runningAssets = 0;

      for (const dept of eligible) {
        runningAssets += dept.totalAssets || 0;
        currentBundle.push(dept);
        
        if (runningAssets >= threshold) {
            bundles.push([...currentBundle]);
            currentBundle = [];
            runningAssets = 0;
        }
      }
      
      if (currentBundle.length > 0) {
        if (bundles.length > 0) {
            const leftoverAssets = currentBundle.reduce((sum, d) => sum + (d.totalAssets || 0), 0);
            if (leftoverAssets < threshold * 0.7) {
              bundles[bundles.length - 1].push(...currentBundle);
            } else {
              bundles.push(currentBundle);
            }
        } else {
            bundles.push(currentBundle);
        }
      }

      // Step 4: Create groups and re-assign
      let groupIndex = 1;
      for (const b of bundles) {
        if (b.length === 0) continue;
        const newGroup = await gateway.addAuditGroup({
          name: `Group ${String.fromCharCode(65 + (groupIndex++) - 1)}`,
          description: `Auto-grouped: ${b.map(d => d.abbr).join(', ')}`
        });
        for (const dept of b) {
          await gateway.updateDepartment(dept.id, { auditGroupId: newGroup.id });
        }
      }

      // Step 5: Final refreshment from source of truth
      await loadAllData();
      
      const refreshedGroups = await gateway.getAuditGroups();
      setAuditGroups(refreshedGroups); // Explicitly update again for UI reactivity
      
      if (refreshedGroups.length > 0) {
        showToast(`Auto-consolidation complete! ${refreshedGroups.length} groups created.`);
      }
    } catch (e) {
      showError(e, 'Auto-Consolidation Failed');
    }
  };

  const handleSetDeptTotalsFromMapping = async (totals: Record<string, number>) => {
    try {
      for (const [deptId, total] of Object.entries(totals)) {
        if (total > 0) await gateway.updateDepartment(deptId, { totalAssets: total });
      }
      setDepartments(await gateway.getDepartments());
    } catch (e) {
      showError(e, 'Failed to set department totals from mapping');
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
        // Supabase insert limit â€” batch at 200 rows
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
        showToast(`Sync complete â€” ${updatedCount} location${updatedCount !== 1 ? 's' : ''} reassigned.`);
      } else {
        showToast('Sync complete â€” no locations needed updating.');
      }
    } catch (e) {
      showError(e, 'Failed to sync location mappings');
    }
  };

  const handleAddMember = async (user: User) => {
    try {
      const emailExists = users.some(u => u.email.toLowerCase() === user.email.toLowerCase());
      if (emailExists) {
        showToast('This email is already registered.', 'error');
        return;
      }
      await gateway.addUser(user);
      setUsers(await gateway.getUsers());
      showToast('Member added successfully');
      logActivity('CREATE', `Added new member: ${user.name}`, undefined, { userId: user.id });
    } catch (e) {
      showError(e, 'Failed to Add Member');
    }
  };

  const handleBulkAddMembers = async (newUsers: User[]) => {
    try {
      let createdCount = 0;
      for (const u of newUsers) {
        if (!users.some(ex => ex.email.toLowerCase() === u.email.toLowerCase())) {
          await gateway.addUser(u);
          createdCount++;
        }
      }
      setUsers(await gateway.getUsers());
      showToast(`Bulk add complete: ${createdCount} new members added.`);
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
        logActivity('UPDATE', `Updated member profile: ${id}`, undefined, { userId: id, updates });
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
        const user = users.find(u => u.id === id);
        await gateway.deleteUser(id);
        setUsers(await gateway.getUsers());
        showToast('Member removed successfully');
        logActivity('DELETE', `Removed member: ${user?.name || id}`, undefined, { userId: id });
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

  const checkProfileComplete = (u: User | null) => {
    if (!u) return false;
    const isAdmin = (u.roles || []).includes('Admin');
    if (isAdmin) return true;
    return !!(u.departmentId && u.contactNumber && u.designation);
  };

  const handleViewChange = (view: AppView) => {
    if (!currentUser) return;

    const hasPerm = (perm: string) => {
      const allowedRoles = rbacMatrix[perm] || [];
      return (currentUser.roles || []).some(r => allowedRoles.includes(r as UserRole));
    };

    // 1. Profile Completion Check
    // If it's NOT profile and NOT overview (or overview is not public), check completion
    if (view !== 'profile' && view !== 'overview') {
        if (!checkProfileComplete(currentUser)) {
            showToast('Please complete your profile first.', 'info');
            setActiveView('profile');
            return;
        }
    }

    // 2. Permission Matrix Check
    const viewToPerm: Record<string, string> = {
      'overview': 'view:overview',
      'schedule': 'view:schedule:all',
      'team': 'view:team:all',
      'settings': 'manage:system',
      'departments': 'manage:departments',
      'locations': 'manage:locations',
      'auditor-dashboard': 'view:audit:assigned'
    };

    const permId = viewToPerm[view];
    if (permId) {
      let isAllowed = hasPerm(permId);
      
      // Fallback for "Own" scopes if "All" fails
      if (!isAllowed) {
        if (view === 'schedule' && hasPerm('view:schedule:own')) isAllowed = true;
        if (view === 'team' && hasPerm('view:team:own')) isAllowed = true;
      }

      if (!isAllowed) {
        showToast('Access Denied: You do not have permission to view this section.', 'warning');
        return;
      }
    }

    setActiveView(view);
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
          </div>
        </div>
        <p className="mt-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Initializing Platform</p>
      </div>
    );
  }

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
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden select-none">
      <div className="flex flex-1 overflow-hidden">
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
        isProfileComplete={checkProfileComplete(currentUser)}
        rbacMatrix={rbacMatrix}
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
            {checkProfileComplete(currentUser) && (
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
              rbacMatrix={rbacMatrix}
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
            <UserManagement
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
              currentUserId={currentUser.id}
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
              currentUserRoles={currentUser.roles}
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
              schedules={schedules}
            />
           )}
           {activeView === 'admin-dashboard' && (
             <AdminDashboard 
               users={users}
               locations={locations}
               schedules={schedules}
               activities={activities}
               departments={departmentsWithAssets}
               buildings={buildings}
               phases={auditPhases}
               onApproveArchive={handleApproveArchive}
               onRejectArchive={handleRejectArchive}
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
              onBulkRemovePermissions={handleBulkRemovePermissions}
              showToast={showToast}
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
              maxLocationsPerDay={maxLocationsPerDay}
              onUpdateMaxAssetsPerDay={async (val) => {
                setMaxAssetsPerDay(val);
                await gateway.updateSystemSetting('audit_constraints', { maxAssetsPerDay: val, maxLocationsPerDay });
              }}
              onUpdateMaxLocationsPerDay={async (val) => {
                setMaxLocationsPerDay(val);
                await gateway.updateSystemSetting('audit_constraints', { maxAssetsPerDay, maxLocationsPerDay: val });
              }}
              onRebalanceSchedule={handleRebalanceSchedule}
              schedules={schedules}
              departmentMappings={departmentMappings}
              onAddDepartmentMapping={handleAddDepartmentMapping}
              onDeleteDepartmentMapping={handleDeleteDepartmentMapping}
              onSyncLocationMappings={handleSyncLocationMappings}
              onUpsertLocations={handleUpsertLocations}
              onSetDeptTotalsFromMapping={handleSetDeptTotalsFromMapping}
              onUpdateUninspectedAssets={handleUpdateUninspectedAssetCounts}
              locations={locations}
              onAddAuditGroup={handleAddAuditGroup}
              onUpdateAuditGroup={handleUpdateAuditGroup}
              onDeleteAuditGroup={handleDeleteAuditGroup}
              onAutoConsolidate={handleAutoConsolidate}
               auditGroups={auditGroups}
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
            <span className="hidden sm:inline">â€” Institutional Asset Audit Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono">v{import.meta.env.VITE_APP_VERSION || '1.0.0'}</span>
            <span>Â© {new Date().getFullYear()} Politeknik Kuching Sarawak. All rights reserved.</span>
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
    </div>
  );
};

export default App;
