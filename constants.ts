
import { AuditSchedule, User, AppNotification } from './types';

export const INITIAL_AUDITS: Omit<AuditSchedule, 'id'>[] = [
  {
    location: 'Main Laboratory - Wing A',
    supervisor: 'Dr. Sarah Chen',
    auditor1: 'Michael Scott',
    auditor2: null,
    date: '2024-11-20',
    status: 'Pending',
    department: 'Biological Sciences',
    building: 'Science Block C',
    assetCount: 142
  },
  {
    location: 'IT Infrastructure Hub',
    supervisor: 'James Wilson',
    auditor1: null,
    auditor2: null,
    date: '2024-11-22',
    status: 'Pending',
    department: 'Information Technology',
    building: 'Tech Tower',
    assetCount: 85
  },
  {
    location: 'Administrative Archive',
    supervisor: 'Linda Garcia',
    auditor1: 'Emily Blunt',
    auditor2: 'John Doe',
    date: '2024-11-18',
    status: 'Completed',
    department: 'Finance & Records',
    building: 'Admin East',
    assetCount: 310
  },
  {
    location: 'Chemistry Storage',
    supervisor: 'Dr. Robert Oppen',
    auditor1: null,
    auditor2: 'Alice Wonderland',
    date: '2024-11-25',
    status: 'Pending',
    department: 'Chemistry',
    building: 'Storage Vault B',
    assetCount: 56
  },
  {
    location: 'Sports Facility Gym',
    supervisor: 'Coach Carter',
    auditor1: 'Ben Affleck',
    auditor2: null,
    date: '2024-12-01',
    status: 'Pending',
    department: 'Athletics',
    building: 'West Campus Stadium',
    assetCount: 24
  }
];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    title: 'Upcoming Audit',
    message: 'Audit for "Main Laboratory" is scheduled for tomorrow.',
    timestamp: '2 hours ago',
    type: 'warning',
    read: false,
  },
  {
    id: 'n2',
    title: 'Schedule Update',
    message: 'Chemistry Storage audit has been confirmed for the 25th.',
    timestamp: '5 hours ago',
    type: 'info',
    read: false,
  },
  {
    id: 'n3',
    title: 'New Policy Uploaded',
    message: 'Check the new Q4 compliance guidelines in Documentation.',
    timestamp: '1 day ago',
    type: 'info',
    read: true,
  }
];

export const CURRENT_USER: User = {
  id: 'user-99',
  name: 'Alex Rivera',
  email: 'alex.rivera@institution.edu',
  roles: ['Auditor', 'Supervisor'], 
  department: 'Biological Sciences',
  contactNumber: '+1 (555) 012-3456',
  status: 'Active'
};
