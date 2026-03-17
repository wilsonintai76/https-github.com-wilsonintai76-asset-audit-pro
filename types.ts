
export interface AuditSchedule {
  id: string;
  departmentId: string;
  locationId: string;
  supervisorId: string | null;
  auditor1Id: string | null;
  auditor2Id: string | null;
  date: string | null;
  status: 'Pending' | 'In Progress' | 'Completed';
  phaseId: string;
}

export type Designation = 'Head Of Department' | 'Coordinator' | 'Supervisor' | 'Staff';

export type UserRole = 'Admin' | 'Coordinator' | 'Supervisor' | 'Staff';
export type AppView = 'overview' | 'schedule' | 'team' | 'settings' | 'departments' | 'locations' | 'profile' | 'knowledge-base' | 'auditor-dashboard';

export interface User {
  id: string;
  name: string;
  email: string;
  pin?: string;
  roles: UserRole[]; 
  designation?: Designation;
  picture?: string;
  departmentId?: string;
  contactNumber?: string;
  permissions?: string[];
  lastActive?: string;
  certificationIssued?: string; // ISO-8601 date string
  certificationExpiry?: string; // ISO-8601 date string
  status: 'Active' | 'Inactive' | 'Suspended' | 'Pending';
  isVerified?: boolean;
  mustChangePIN?: boolean;
  dashboardConfig?: DashboardConfig;
}

export interface Department {
  id: string;
  name: string;
  abbr: string;
  headOfDeptId: string | null;
  headName?: string | null;
  description: string;
  auditGroupId: string | null; // UUID of the AuditGroup (Normalized)
  totalAssets?: number;
}

export interface AuditGroup {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

export interface Location {
  id: string;
  name: string;
  abbr: string;
  departmentId: string;
  building: string;
  level?: string;
  description: string;
  supervisorId: string | null;
  contact: string;
  totalAssets?: number;
  isActive?: boolean;
}

export interface DashboardConfig {
  showStats: boolean;
  showTrends: boolean;
  showUpcoming: boolean;
  showDeptDistribution: boolean;
  showCertification?: boolean;
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
  targets?: Record<string, number>; // phaseId -> target %
}

export interface KPITierTarget {
  id: string;
  tierId: string;
  phaseId: string;
  targetPercentage: number;
}

export interface DepartmentMapping {
  id: string;
  sourceName: string;
  targetDepartmentId: string;
}

export interface SystemActivity {
  id: string;
  type: 'SCHEDULE_DATE' | 'AUDITOR_ASSIGNED' | 'LOCATION_CREATED' | 'AUDIT_COMPLETED' | 'ADMIN_RESET';
  userId: string | null;
  auditId?: string;
  message: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}
