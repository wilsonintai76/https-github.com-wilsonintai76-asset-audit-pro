-- =============================================================
-- Asset Audit Pro – Fully Relational Supabase Schema
-- All columns use snake_case.
--
-- Entity Relationship Map:
--
--   audit_phases ──< audits          (phase_id  FK, ON DELETE RESTRICT)
--   departments  ──< locations       (department_id FK, ON DELETE RESTRICT)
--   departments  ──< audits          (department_id FK, ON DELETE RESTRICT)
--   departments  ──< cross_audits    (auditor_dept_id / target_dept_id FK, ON DELETE CASCADE)
--   departments  ──< users           (department_id FK, ON DELETE SET NULL) ← DEFERRABLE (circular)
--   departments  ──  users           (head_of_dept_id FK, ON DELETE SET NULL) ← DEFERRABLE (circular)
--   locations    ──< audits          (location_id FK, ON DELETE RESTRICT)
--   locations    ──  users           (supervisor_id FK, ON DELETE SET NULL)
--   users        ──< audits          (supervisor_id / auditor1_id / auditor2_id FK, ON DELETE SET NULL)
--
-- Circular dependency (departments ↔ users) is broken by making
-- both FKs DEFERRABLE INITIALLY DEFERRED.
--
-- Delete order enforced by FK RESTRICT:
--   audits → locations → departments
--                      → audit_phases
-- =============================================================

-- =============================================================
-- DROP EXISTING TABLES
-- =============================================================
DROP TABLE IF EXISTS audits       CASCADE;
DROP TABLE IF EXISTS cross_audits CASCADE;
DROP TABLE IF EXISTS locations    CASCADE;
DROP TABLE IF EXISTS kpi_tiers    CASCADE;
DROP TABLE IF EXISTS users        CASCADE;
DROP TABLE IF EXISTS departments  CASCADE;
DROP TABLE IF EXISTS audit_groups CASCADE;
DROP TABLE IF EXISTS audit_phases CASCADE;
DROP TABLE IF EXISTS system_activities CASCADE;
DROP TABLE IF EXISTS department_mappings CASCADE;

-- =============================================================
-- 0. AUDIT GROUPS
--    No dependencies. Stores named groups for cross-audit grouping.
-- =============================================================
CREATE TABLE audit_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- 1. AUDIT PHASES
--    No dependencies.
-- =============================================================
CREATE TABLE audit_phases (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  CONSTRAINT chk_phase_dates CHECK (end_date >= start_date)
);

-- =============================================================
-- 2. DEPARTMENTS
--    head_of_dept_id FK → users added below after users table
--    exists (circular dependency resolution).
-- =============================================================
CREATE TABLE departments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  abbr            TEXT NOT NULL,
  head_of_dept_id TEXT,          -- FK to users(id) added via ALTER TABLE below
  description     TEXT,
  audit_group     TEXT,
  total_assets    INTEGER DEFAULT 0
);

-- =============================================================
-- 3. USERS
--    department_id FK → departments added below (circular).
--    roles is a validated TEXT array (fixed enum values).
-- =============================================================
CREATE TABLE users (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  email                TEXT NOT NULL UNIQUE,
  pin                  TEXT         DEFAULT '1234',
  roles                TEXT[]       NOT NULL DEFAULT '{}'
                         CONSTRAINT chk_roles CHECK (
                           roles <@ ARRAY['Admin','Coordinator','Supervisor','Auditor','Staff','Guest']::TEXT[]
                         ),
  picture              TEXT,
  department_id        UUID,        -- FK to departments(id) added via ALTER TABLE below
  contact_number       TEXT,
  permissions          TEXT[]       DEFAULT '{}',
  last_active          TIMESTAMP WITH TIME ZONE,
  certification_issued DATE,
  certification_expiry DATE,
  designation          TEXT         CONSTRAINT chk_user_designation CHECK (
                           designation IS NULL OR designation IN ('Head Of Department','Coordinator','Supervisor','Lecturer')
                         ),
  status               TEXT NOT NULL DEFAULT 'Active'
                         CONSTRAINT chk_user_status CHECK (status IN ('Active','Inactive','Suspended','Pending')),
  is_verified          BOOLEAN NOT NULL DEFAULT false,
  dashboard_config     JSONB   NOT NULL DEFAULT '{
    "showStats": true,
    "showTrends": true,
    "showUpcoming": true,
    "showCertification": true,
    "showDeptDistribution": true
  }'
);

-- Resolve the circular dependency with DEFERRABLE FKs.
-- Both are SET NULL so neither side blocks the other on delete.
ALTER TABLE departments
  ADD CONSTRAINT fk_dept_head
  FOREIGN KEY (head_of_dept_id) REFERENCES users(id)
  ON DELETE SET NULL ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE users
  ADD CONSTRAINT fk_user_dept
  FOREIGN KEY (department_id) REFERENCES departments(id)
  ON DELETE SET NULL ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- =============================================================
-- 4. LOCATIONS
--    Belongs to a department (RESTRICT – must delete locations
--    before deleting their department).
--    supervisor_id is a soft reference to a user (SET NULL on
--    user delete so the location survives without a supervisor).
-- =============================================================
CREATE TABLE locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT    NOT NULL,
  abbr          TEXT    NOT NULL,
  department_id UUID    NOT NULL
                  REFERENCES departments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  building      TEXT,
  level         TEXT,
  description   TEXT,
  supervisor_id TEXT
                  REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  contact       TEXT,
  total_assets  INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_total_assets CHECK (total_assets >= 0)
);

-- =============================================================
-- 5. AUDITS
--    audit_phases  → RESTRICT  (cannot delete a phase with audits)
--    departments   → RESTRICT  (cannot delete a dept with audits)
--    locations     → RESTRICT  (cannot delete a location with audits)
--    supervisor/auditors → SET NULL (user can be removed, audit kept)
-- =============================================================
CREATE TABLE audits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL
                  REFERENCES departments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  location_id   UUID NOT NULL
                  REFERENCES locations(id)   ON DELETE RESTRICT ON UPDATE CASCADE,
  supervisor_id TEXT
                  REFERENCES users(id)       ON DELETE SET NULL ON UPDATE CASCADE,
  auditor1_id   TEXT
                  REFERENCES users(id)       ON DELETE SET NULL ON UPDATE CASCADE,
  auditor2_id   TEXT
                  REFERENCES users(id)       ON DELETE SET NULL ON UPDATE CASCADE,
  date          DATE,         -- nullable: supervisor sets the date after location is created
  status        TEXT NOT NULL DEFAULT 'Pending'
                  CONSTRAINT chk_audit_status CHECK (status IN ('Pending','In Progress','Completed')),
  building      TEXT,
  phase_id      UUID NOT NULL
                  REFERENCES audit_phases(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- =============================================================
-- 6. CROSS AUDIT PERMISSIONS
--    Both department FKs CASCADE so that when a department is
--    removed all its cross-audit permissions are removed too.
-- =============================================================
CREATE TABLE cross_audits (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  auditor_dept_id UUID    NOT NULL
                    REFERENCES departments(id) ON DELETE CASCADE ON UPDATE CASCADE,
  target_dept_id  UUID    NOT NULL
                    REFERENCES departments(id) ON DELETE CASCADE ON UPDATE CASCADE,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  is_mutual       BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT uq_cross_audit UNIQUE (auditor_dept_id, target_dept_id)
);

-- =============================================================
-- 7. KPI TIERS
--    Standalone. targets JSONB maps phase_id → percentage (0-100).
--    Phase references inside JSONB are soft (no FK).
-- =============================================================
CREATE TABLE kpi_tiers (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT    NOT NULL,
  min_assets INTEGER NOT NULL CONSTRAINT chk_min_assets CHECK (min_assets >= 0),
  max_assets INTEGER NOT NULL,
  targets    JSONB   NOT NULL DEFAULT '{}',
  CONSTRAINT chk_asset_range CHECK (max_assets >= min_assets)
);

-- =============================================================
-- 8. DEPARTMENT MAPPINGS
--    Used to map names from imported CSVs to official department IDs
-- =============================================================
CREATE TABLE department_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL UNIQUE,
  target_department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================================
-- 9. SYSTEM ACTIVITIES
--    Tracks major system events (Scheduling, Assignments, etc.)
-- =============================================================
CREATE TABLE system_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  audit_id    UUID REFERENCES audits(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================
ALTER TABLE audit_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_tiers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_activities   ENABLE ROW LEVEL SECURITY;

-- Public access policies (replace with role-based policies in production)
CREATE POLICY "Public Access" ON audit_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON audit_phases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON departments  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON users        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON locations    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON audits       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON cross_audits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON kpi_tiers    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON department_mappings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON system_activities   FOR ALL USING (true) WITH CHECK (true);

-- =============================================================
-- RPC FUNCTIONS FOR COMPLEX OPERATIONS
-- =============================================================

-- 1. Force Delete Location (Deletes associated audits first)
CREATE OR REPLACE FUNCTION force_delete_location(loc_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM audits WHERE location_id = loc_id;
  DELETE FROM locations WHERE id = loc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Force Delete Department (Deletes locations, audits, and users first)
CREATE OR REPLACE FUNCTION force_delete_department(dept_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Delete audits associated with locations in this department
  DELETE FROM audits WHERE location_id IN (SELECT id FROM locations WHERE department_id = dept_id);
  -- Delete audits directly associated with this department
  DELETE FROM audits WHERE department_id = dept_id;
  -- Delete locations
  DELETE FROM locations WHERE department_id = dept_id;
  -- Delete users (except those who might be needed elsewhere, but schema says SET NULL for head_of_dept)
  DELETE FROM users WHERE department_id = dept_id;
  -- Delete the department
  DELETE FROM departments WHERE id = dept_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Clear All Locations (and their audits)
CREATE OR REPLACE FUNCTION clear_all_locations()
RETURNS VOID AS $$
BEGIN
  -- We must delete audits first because they reference locations with RESTRICT
  DELETE FROM audits WHERE true;
  DELETE FROM locations WHERE true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Clear All Departments and all associated data
CREATE OR REPLACE FUNCTION clear_all_departments(keep_user_id TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  -- 1. Remove all transactional data
  DELETE FROM audits WHERE true;
  DELETE FROM locations WHERE true;
  DELETE FROM cross_audits WHERE true;
  
  -- 2. Handle users (keeping the specific one if provided)
  IF keep_user_id IS NOT NULL THEN
    -- First null out references to depts to avoid constraint issues during user/dept removal
    UPDATE users SET department_id = NULL WHERE true;
    UPDATE departments SET head_of_dept_id = NULL WHERE true;
    
    DELETE FROM users WHERE id <> keep_user_id;
  ELSE
    UPDATE departments SET head_of_dept_id = NULL WHERE true;
    DELETE FROM users WHERE true;
  END IF;
  
  -- 3. Remove structural data
  DELETE FROM department_mappings WHERE true;
  DELETE FROM departments WHERE true;
  -- Note: audit_groups and audit_phases are NOT cleared as they are system configuration
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- 2. Create the SuperAdmin User
INSERT INTO users (
  id,
  name,
  email,
  pin,
  roles,
  status,
  is_verified,
  designation,
  department_id,
  dashboard_config
) VALUES (
  '0000',
  'SuperAdmin',
  'admin@asset-audit.pro',
  '9999',
  ARRAY['Admin'],
  'Active',
  true,
  'Head Of Department',
  '00000000-0000-0000-0000-000000000000',
  '{"showStats":true,"showTrends":true,"showUpcoming":true,"showCertification":true,"showDeptDistribution":true}'
)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  email       = EXCLUDED.email,
  roles       = EXCLUDED.roles,
  pin         = EXCLUDED.pin,
  status      = EXCLUDED.status,
  designation = EXCLUDED.designation,
  department_id = EXCLUDED.department_id,
  is_verified = EXCLUDED.is_verified;

-- 3. Link Department Head
UPDATE departments 
SET head_of_dept_id = '0000'
WHERE id = '00000000-0000-0000-0000-000000000000';

