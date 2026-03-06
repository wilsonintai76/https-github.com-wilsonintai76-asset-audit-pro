
export interface AuditSchedule {
  id: string;
  departmentId: string;
  locationId: string;
  supervisorId: string;
  auditor1Id: string | null;
  auditor2Id: string | null;
  date: string | null;   // null = supervisor hasn't set a date yet
  status: 'Pending' | 'In Progress' | 'Completed';
  phaseId: string;
  building?: string;
}

export type UserRole = 'Admin' | 'Coordinator' | 'HeadOfDept' | 'Supervisor' | 'Auditor' | 'Staff' | 'Guest';
export type AppView = 'overview' | 'schedule' | 'team' | 'settings' | 'departments' | 'locations' | 'profile' | 'knowledge-base' | 'auditor-dashboard';

export interface User {
  id: string;
  name: string;
  email: string;
  pin?: string;
  roles: UserRole[]; 
  picture?: string;
  departmentId?: string;
  contactNumber?: string;
  permissions?: string[];
  lastActive?: string;
  certificationIssued?: string; // ISO-8601 date string
  certificationExpiry?: string; // ISO-8601 date string
  status: 'Active' | 'Inactive' | 'Suspended';
  isVerified?: boolean;
  dashboardConfig?: DashboardConfig;
}

export interface Department {
  id: string;
  name: string;
  abbr: string;
  headOfDeptId: string;
  description: string;
  auditGroup?: string;
}

export interface AuditGroup {
  id: string;
  name: string;
  description?: string;
}

export interface Location {
  id: string;
  name: string;
  abbr: string;
  departmentId: string;
  building: string;
  level?: string;
  description: string;
  supervisorId: string;
  contact: string;
  totalAssets?: number;
}

export interface DashboardConfig {
  showStats: boolean;
  showTrends: boolean;
  showUpcoming: boolean;
  showCertification: boolean;
  showDeptDistribution: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  read: boolean;
}

export interface AuditInsight {
  summary: string;
  recommendations: string[];
}

export interface CrossAuditPermission {
  id: string;
  auditorDeptId: string;
  targetDeptId: string;
  isActive: boolean;
  isMutual: boolean;
}

export interface AuditPhase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface KPITier {
  id: string;
  name: string;
  minAssets: number;
  maxAssets: number;
  // Key is phase.id, Value is percentage target (0-100)
  targets: Record<string, number>;
}
