-- ============================================================
-- Supabase Backup Schema for Inspect-able
-- Run this ONCE in Supabase Dashboard → SQL Editor
-- These tables mirror D1 and act as the backup store.
-- ============================================================

-- Backup metadata
CREATE TABLE IF NOT EXISTS _backup_log (
  id          BIGSERIAL PRIMARY KEY,
  ran_at      TIMESTAMPTZ DEFAULT NOW(),
  tables_synced INTEGER,
  rows_synced   INTEGER,
  status      TEXT DEFAULT 'ok',
  error       TEXT
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  email                TEXT UNIQUE NOT NULL,
  roles                JSONB NOT NULL DEFAULT '["Staff"]',
  designation          TEXT,
  picture              TEXT,
  department_id        TEXT,
  contact_number       TEXT,
  status               TEXT DEFAULT 'Active',
  is_verified          BOOLEAN DEFAULT FALSE,
  must_change_pin      BOOLEAN DEFAULT FALSE,
  certification_issued TEXT,
  certification_expiry TEXT,
  last_active          TEXT,
  dashboard_config     JSONB,
  created_at           TEXT
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  abbr             TEXT NOT NULL,
  description      TEXT,
  head_of_dept_id  TEXT,
  audit_group_id   TEXT,
  is_exempted      BOOLEAN DEFAULT FALSE,
  created_at       TEXT
);

-- Buildings
CREATE TABLE IF NOT EXISTS buildings (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  abbr        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT
);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  abbr          TEXT NOT NULL,
  department_id TEXT NOT NULL,
  building_id   TEXT,
  building      TEXT,
  level         TEXT,
  description   TEXT,
  supervisor_id TEXT,
  contact       TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  status        TEXT DEFAULT 'Active',
  created_at    TEXT
);

-- Audit Groups
CREATE TABLE IF NOT EXISTS audit_groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT,
  created_at  TEXT
);

-- Audit Phases
CREATE TABLE IF NOT EXISTS audit_phases (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL,
  description TEXT,
  status      TEXT DEFAULT 'Active',
  created_at  TEXT
);

-- Audit Schedules
CREATE TABLE IF NOT EXISTS audit_schedules (
  id            TEXT PRIMARY KEY,
  department_id TEXT NOT NULL,
  location_id   TEXT NOT NULL,
  supervisor_id TEXT,
  auditor1_id   TEXT,
  auditor2_id   TEXT,
  date          TEXT,
  status        TEXT DEFAULT 'Pending',
  phase_id      TEXT NOT NULL,
  created_at    TEXT
);

-- KPI Tiers
CREATE TABLE IF NOT EXISTS kpi_tiers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  min_assets  INTEGER NOT NULL,
  description TEXT,
  created_at  TEXT
);

-- KPI Tier Targets
CREATE TABLE IF NOT EXISTS kpi_tier_targets (
  id                TEXT PRIMARY KEY,
  tier_id           TEXT NOT NULL,
  phase_id          TEXT NOT NULL,
  target_percentage REAL NOT NULL,
  created_at        TEXT
);

-- Institution KPI Targets
CREATE TABLE IF NOT EXISTS institution_kpi_targets (
  phase_id          TEXT PRIMARY KEY,
  target_percentage REAL NOT NULL
);

-- Cross Audit Permissions
CREATE TABLE IF NOT EXISTS cross_audit_permissions (
  id               TEXT PRIMARY KEY,
  auditor_dept_id  TEXT NOT NULL,
  target_dept_id   TEXT NOT NULL,
  is_active        BOOLEAN DEFAULT TRUE,
  is_mutual        BOOLEAN DEFAULT FALSE,
  created_at       TEXT
);

-- Department Mappings
CREATE TABLE IF NOT EXISTS department_mappings (
  id                   TEXT PRIMARY KEY,
  source_name          TEXT UNIQUE NOT NULL,
  target_department_id TEXT NOT NULL,
  created_at           TEXT
);

-- System Activities
CREATE TABLE IF NOT EXISTS system_activities (
  id        TEXT PRIMARY KEY,
  type      TEXT NOT NULL,
  user_id   TEXT,
  message   TEXT NOT NULL,
  timestamp TEXT,
  metadata  JSONB
);

-- System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  id         TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TEXT
);

-- Disable RLS on backup tables (service role key has full access anyway)
ALTER TABLE users                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE departments            DISABLE ROW LEVEL SECURITY;
ALTER TABLE buildings              DISABLE ROW LEVEL SECURITY;
ALTER TABLE locations              DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_groups           DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_phases           DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_schedules        DISABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_tiers              DISABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_tier_targets       DISABLE ROW LEVEL SECURITY;
ALTER TABLE institution_kpi_targets DISABLE ROW LEVEL SECURITY;
ALTER TABLE cross_audit_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE department_mappings    DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_activities      DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings        DISABLE ROW LEVEL SECURITY;
ALTER TABLE _backup_log            DISABLE ROW LEVEL SECURITY;
