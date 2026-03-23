import { User, Department, Location, AuditSchedule, AuditPhase, KPITier, CrossAuditPermission, AuditGroup, Building } from '../types';

export const MOCK_PHASES: AuditPhase[] = [
  { id: 'p1', name: 'Phase 1: Preparation', startDate: '2026-03-01', endDate: '2026-03-31' },
  { id: 'p2', name: 'Phase 2: Execution', startDate: '2026-04-01', endDate: '2026-04-30' },
  { id: 'p3', name: 'Phase 3: Reporting', startDate: '2026-05-01', endDate: '2026-05-31' }
];

export const MOCK_BUILDINGS: Building[] = [
  { id: 'b1', name: 'Block A: Administrative', abbr: 'BLK-A' },
  { id: 'b2', name: 'Block B: Engineering', abbr: 'BLK-B' },
  { id: 'b3', name: 'Block C: IT & Multimedia', abbr: 'BLK-C' }
];

export const MOCK_GROUPS: AuditGroup[] = [
  { id: 'g1', name: 'Academic Units', color: '#4f46e5' },
  { id: 'g2', name: 'Support Units', color: '#10b981' },
  { id: 'g3', name: 'Infrastructure', color: '#f59e0b' }
];

export const MOCK_DEPARTMENTS: Department[] = [
  { id: 'd1', name: 'Jabatan Teknologi Maklumat', abbr: 'JTM', headOfDeptId: 'u1', headName: 'En. Kamal', description: 'IT Department', auditGroupId: 'g1', totalAssets: 1250, auditorCount: 5 },
  { id: 'd2', name: 'Jabatan Kejuruteraan Elektrik', abbr: 'JKE', headOfDeptId: 'u2', headName: 'Pn. Sarah', description: 'Electrical Engineering', auditGroupId: 'g1', totalAssets: 850, auditorCount: 3 },
  { id: 'd3', name: 'Unit Pengurusan Fasiliti', abbr: 'UPF', headOfDeptId: 'u3', headName: 'En. Ahmad', description: 'Facilities Management', auditGroupId: 'g3', totalAssets: 2100, auditorCount: 8 }
];

export const MOCK_LOCATIONS: Location[] = [
  { id: 'l1', name: 'Makmal Komputer 1', abbr: 'MK1', departmentId: 'd1', building: 'BLK-C', buildingId: 'b3', level: 'LEVEL 2', description: 'Computer Lab 1', supervisorId: 'u1', contact: '012-3456789', totalAssets: 45, isActive: true },
  { id: 'l2', name: 'Bilik Pensyarah JKE', abbr: 'BPJKE', departmentId: 'd2', building: 'BLK-B', buildingId: 'b2', level: 'LEVEL 1', description: 'JKE Lecturer Room', supervisorId: 'u2', contact: '013-4567890', totalAssets: 120, isActive: true },
  { id: 'l3', name: 'Main Server Room', abbr: 'MSR', departmentId: 'd1', building: 'BLK-A', buildingId: 'b1', level: 'LEVEL 3', description: 'Core Infrastructure', supervisorId: 'u1', contact: '014-5678901', totalAssets: 15, isActive: true }
];

export const MOCK_AUDITS: AuditSchedule[] = [
  { id: 'a1', departmentId: 'd1', locationId: 'l1', supervisorId: 'u1', auditor1Id: 'u4', auditor2Id: 'u5', date: '2026-04-05', status: 'In Progress', phaseId: 'p2' },
  { id: 'a2', departmentId: 'd2', locationId: 'l2', supervisorId: 'u2', auditor1Id: 'u4', auditor2Id: null, date: '2026-04-10', status: 'Pending', phaseId: 'p2' },
  { id: 'a3', departmentId: 'd1', locationId: 'l3', supervisorId: 'u1', auditor1Id: null, auditor2Id: null, date: null, status: 'Pending', phaseId: 'p2' }
];

export const MOCK_USERS = {
  admin: {
    id: 'u-admin',
    name: 'Demo Admin',
    email: 'admin@demo.local',
    roles: ['Admin'] as any,
    designation: 'Head Of Department',
    departmentId: 'd1',
    status: 'Active',
    isVerified: true
  },
  coordinator: {
    id: 'u-coord',
    name: 'Demo Coordinator',
    email: 'coord@demo.local',
    roles: ['Coordinator'] as any,
    designation: 'Coordinator',
    departmentId: 'd1',
    status: 'Active',
    isVerified: true
  },
  supervisor: {
    id: 'u-super',
    name: 'Demo Supervisor',
    email: 'super@demo.local',
    roles: ['Supervisor'] as any,
    designation: 'Supervisor',
    departmentId: 'd1',
    status: 'Active',
    isVerified: true
  },
  auditor: {
    id: 'u-auditor',
    name: 'Demo Auditor',
    email: 'auditor@demo.local',
    roles: ['Staff'] as any,
    designation: 'Staff',
    departmentId: 'd2',
    status: 'Active',
    isVerified: true,
    certificationIssued: '2026-01-01',
    certificationExpiry: '2027-01-01'
  },
  staff: {
    id: 'u-staff',
    name: 'Demo Staff',
    email: 'staff@demo.local',
    roles: ['Staff'] as any,
    designation: 'Staff',
    departmentId: 'd1',
    status: 'Active',
    isVerified: true
  }
};
