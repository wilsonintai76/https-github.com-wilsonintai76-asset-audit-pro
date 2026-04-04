-- D1 Database Schema for Inspect-able (SQLite)

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- UID from Supabase Auth
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  roles TEXT NOT NULL, -- JSON array of UserRole
  designation TEXT,
  picture TEXT,
  department_id TEXT,
  contact_number TEXT,
  status TEXT DEFAULT 'Pending', -- Active, Inactive, Suspended, Pending
  is_verified INTEGER DEFAULT 0, -- Boolean
  must_change_pin INTEGER DEFAULT 0, -- Boolean
  certification_issued TEXT, -- ISO Date
  certification_expiry TEXT, -- ISO Date
  last_active TEXT, -- ISO Date
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Departments Table
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  abbr TEXT NOT NULL,
  head_of_dept_id TEXT,
  description TEXT,
  audit_group_id TEXT,
  is_exempted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Buildings Table
CREATE TABLE IF NOT EXISTS buildings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  abbr TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Locations Table
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  abbr TEXT NOT NULL,
  department_id TEXT NOT NULL,
  building_id TEXT,
  level TEXT,
  description TEXT,
  supervisor_id TEXT,
  contact TEXT,
  is_active INTEGER DEFAULT 1,
  status TEXT DEFAULT 'Active', -- Active, Archived, Pending_Delete
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (building_id) REFERENCES buildings(id)
);

-- Audit Phases Table
CREATE TABLE IF NOT EXISTS audit_phases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Audit Schedules Table
CREATE TABLE IF NOT EXISTS audit_schedules (
  id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  supervisor_id TEXT,
  auditor1_id TEXT,
  auditor2_id TEXT,
  date TEXT,
  status TEXT DEFAULT 'Pending', -- Pending, In Progress, Completed
  phase_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (location_id) REFERENCES locations(id),
  FOREIGN KEY (phase_id) REFERENCES audit_phases(id)
);

-- System Activities Table
CREATE TABLE IF NOT EXISTS system_activities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  user_id TEXT,
  message TEXT NOT NULL,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT, -- JSON string
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL, -- JSON string
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Audit Groups Table
CREATE TABLE IF NOT EXISTS audit_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- KPI Tiers Table
CREATE TABLE IF NOT EXISTS kpi_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  min_assets INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- KPI Tier Targets Table
CREATE TABLE IF NOT EXISTS kpi_tier_targets (
  id TEXT PRIMARY KEY,
  tier_id TEXT NOT NULL,
  phase_id TEXT NOT NULL,
  target_percentage REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tier_id) REFERENCES kpi_tiers(id),
  FOREIGN KEY (phase_id) REFERENCES audit_phases(id)
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_locations_dept ON locations(department_id);
CREATE INDEX IF NOT EXISTS idx_schedules_phase ON audit_schedules(phase_id);
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON system_activities(timestamp);
