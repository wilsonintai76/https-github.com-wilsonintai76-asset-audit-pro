-- =============================================================
-- SEED DATA – System Infrastructure & Admin
-- =============================================================

-- 1. Create a dedicated System Department for Admins
INSERT INTO departments (
  id,
  name,
  abbr,
  description,
  audit_group
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'SYSTEM MANAGEMENT',
  'SYSTEM',
  'Dedicated department for application administrators and system management.',
  'Group A'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  abbr = EXCLUDED.abbr;

-- 2. Create the Super Admin User
INSERT INTO users (
  id,
  name,
  email,
  roles,
  department_id,
  status,
  is_verified
) VALUES (
  '9c4931a8-61f4-4c4b-a53a-cc786e30ef01',
  'SysAdmin',
  'wilsonintai76@gmail.com',
  ARRAY['Admin', 'Coordinator', 'Supervisor', 'Staff'],
  '00000000-0000-0000-0000-000000000000',
  'Active',
  true
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  roles = EXCLUDED.roles,
  status = EXCLUDED.status,
  is_verified = EXCLUDED.is_verified;

-- 3. Set Super Admin as head of System Management
UPDATE departments 
SET head_of_dept_id = '9c4931a8-61f4-4c4b-a53a-cc786e30ef01'
WHERE id = '00000000-0000-0000-0000-000000000000';
