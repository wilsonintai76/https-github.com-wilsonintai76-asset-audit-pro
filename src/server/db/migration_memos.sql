-- Migration: Add Strategic Memos table
CREATE TABLE IF NOT EXISTS strategic_memos (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  institution_name TEXT NOT NULL,
  projected_kpi REAL NOT NULL,
  feasibility_score INTEGER NOT NULL,
  total_assets INTEGER NOT NULL,
  total_auditors INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  content_json TEXT NOT NULL, -- Full snapshot of entities and pairings
  r2_html_key TEXT,
  approved_by TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_memos_year ON strategic_memos(year);
