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
  audit_group     TEXT
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
                           roles <@ ARRAY['Admin','Coordinator','HeadOfDept','Supervisor','Auditor','Staff','Guest']::TEXT[]
                         ),
  picture              TEXT,
  department_id        UUID,        -- FK to departments(id) added via ALTER TABLE below
  contact_number       TEXT,
  permissions          TEXT[]       DEFAULT '{}',
  last_active          TIMESTAMP WITH TIME ZONE,
  certification_issued DATE,
  certification_expiry DATE,
  status               TEXT NOT NULL DEFAULT 'Active'
                         CONSTRAINT chk_user_status CHECK (status IN ('Active','Inactive','Suspended')),
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

-- Public access policies (replace with role-based policies in production)
CREATE POLICY "Public Access" ON audit_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON audit_phases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON departments  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON users        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON locations    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON audits       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON cross_audits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON kpi_tiers    FOR ALL USING (true) WITH CHECK (true);

-- =============================================================
-- INDEXES  (FK columns + common filter columns)
-- =============================================================
-- audit_phases
CREATE INDEX idx_audit_phases_dates       ON audit_phases(start_date, end_date);

-- departments
CREATE INDEX idx_departments_head         ON departments(head_of_dept_id);

-- users
CREATE INDEX idx_users_department_id      ON users(department_id);
CREATE INDEX idx_users_status             ON users(status);
CREATE INDEX idx_users_roles              ON users USING GIN (roles);

-- locations
CREATE INDEX idx_locations_department_id  ON locations(department_id);
CREATE INDEX idx_locations_supervisor_id  ON locations(supervisor_id);

-- audits
CREATE INDEX idx_audits_phase_id          ON audits(phase_id);
CREATE INDEX idx_audits_department_id     ON audits(department_id);
CREATE INDEX idx_audits_location_id       ON audits(location_id);
CREATE INDEX idx_audits_supervisor_id     ON audits(supervisor_id);
CREATE INDEX idx_audits_date              ON audits(date);
CREATE INDEX idx_audits_status            ON audits(status);

-- cross_audits
CREATE INDEX idx_cross_audits_auditor     ON cross_audits(auditor_dept_id);
CREATE INDEX idx_cross_audits_target      ON cross_audits(target_dept_id);

-- =============================================================
-- QUICK REFERENCE: safe delete order
-- =============================================================
-- To delete a DEPARTMENT:
--   1. DELETE FROM audits       WHERE department_id = $id   (or location_id IN dept locations)
--   2. DELETE FROM locations    WHERE department_id = $id
--   3. DELETE FROM departments  WHERE id = $id
--      → cross_audits rows auto-deleted  (CASCADE)
--      → users.department_id auto-nulled (SET NULL)
--      → departments.head_of_dept_id already nullable
--
-- To delete a LOCATION:
--   1. DELETE FROM audits    WHERE location_id = $id
--   2. DELETE FROM locations WHERE id = $id
--
-- To delete an AUDIT PHASE:
--   1. DELETE FROM audits      WHERE phase_id = $id
--   2. DELETE FROM audit_phases WHERE id = $id
--
-- To delete a USER:
--   DELETE FROM users WHERE id = $id
--   → audits.supervisor_id / auditor1_id / auditor2_id auto-nulled (SET NULL)
--   → locations.supervisor_id auto-nulled                          (SET NULL)
--   → departments.head_of_dept_id auto-nulled                      (SET NULL)

-- =============================================================
-- SEED DATA – Initial Admin User
-- =============================================================
INSERT INTO users (
  id,
  name,
  email,
  pin,
  roles,
  status,
  is_verified,
  dashboard_config
) VALUES (
  '1891',
  'Admin',
  'admin@assetauditpro.com',
  '1234',
  ARRAY['Admin'],
  'Active',
  true,
  '{"showStats":true,"showTrends":true,"showUpcoming":true,"showCertification":true,"showDeptDistribution":true}'
)
ON CONFLICT (id) DO UPDATE SET
  roles       = EXCLUDED.roles,
  pin         = EXCLUDED.pin,
  status      = EXCLUDED.status,
  is_verified = EXCLUDED.is_verified;
