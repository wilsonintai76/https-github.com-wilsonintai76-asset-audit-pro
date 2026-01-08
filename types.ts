
export interface AuditSchedule {
  id: string;
  department: string;
  location: string;
  supervisor: string;
  auditor1: string | null;
  auditor2: string | null;
  date: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  building?: string;
  assetCount?: number;
}

export type UserRole = 'Admin' | 'Auditor' | 'Supervisor';
export type AppView = 'overview' | 'schedule' | 'team' | 'settings' | 'departments' | 'locations';

export interface User {
  id: string;
  name: string;
  email: string;
  roles: UserRole[]; 
  picture?: string;
  department?: string;
  contactNumber?: string; // Added field
  permissions?: string[];
  lastActive?: string;
  status: 'Active' | 'Inactive';
  dashboardConfig?: DashboardConfig;
}

export interface Department {
  id: string;
  name: string;
  abbr: string;
  headOfDept: string;
  description: string;
  totalAssets: number;
}

export interface Location {
  id: string;
  name: string;
  abbr: string;
  department: string;
  building: string;
  description: string;
  pic: string;
  contact: string;
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
  auditorDept: string;
  targetDept: string;
  isActive: boolean;
  isMutual: boolean;
}
