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

-- 1.1 Create JKM Department
INSERT INTO departments (
  id,
  name,
  abbr,
  description,
  audit_group
) VALUES (
  '4b12b099-2614-42f7-aad7-021017f9795f',
  'JABATAN KEJURUTERAAN MEKANIKAL',
  'JKM',
  'Mechanical Engineering Department.',
  'Group A'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  abbr = EXCLUDED.abbr;

-- 2. Inject Admin Roles
-- This ensures the specified user has full admin permissions.
INSERT INTO users (
  id,
  name,
  email,
  roles,
  department_id,
  status,
  is_verified
) VALUES (
  '75608424-12d0-414d-add1-f507e296b5b4',
  'WILSON ANAK INTAI (POLIKU)',
  'wilson@poliku.edu.my',
  ARRAY['Admin', 'Coordinator', 'Supervisor', 'Staff'],
  '4b12b099-2614-42f7-aad7-021017f9795f', -- JKM
  'Active',
  true
) ON CONFLICT (id) DO UPDATE SET
  roles = EXCLUDED.roles,
  department_id = EXCLUDED.department_id,
  status = EXCLUDED.status,
  is_verified = EXCLUDED.is_verified;

-- 3. Set Admin as head of departments
UPDATE departments 
SET head_of_dept_id = '75608424-12d0-414d-add1-f507e296b5b4'
WHERE id IN ('00000000-0000-0000-0000-000000000000', '4b12b099-2614-42f7-aad7-021017f9795f');
