ALTER TABLE cross_audit_permissions RENAME TO _cross_audit_permissions_old;
CREATE TABLE cross_audit_permissions (
  id TEXT PRIMARY KEY,
  auditor_dept_id TEXT,
  target_dept_id TEXT,
  auditor_group_id TEXT,
  target_group_id TEXT,
  is_active INTEGER DEFAULT 1,
  is_mutual INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auditor_dept_id) REFERENCES departments(id),
  FOREIGN KEY (target_dept_id) REFERENCES departments(id),
  FOREIGN KEY (auditor_group_id) REFERENCES audit_groups(id),
  FOREIGN KEY (target_group_id) REFERENCES audit_groups(id)
);
INSERT INTO cross_audit_permissions (id, auditor_dept_id, target_dept_id, is_active, is_mutual, created_at)
SELECT id, auditor_dept_id, target_dept_id, is_active, is_mutual, created_at FROM _cross_audit_permissions_old;
DROP TABLE _cross_audit_permissions_old;
