DELETE FROM cross_audit_permissions;

INSERT INTO cross_audit_permissions (id, auditor_group_id, target_group_id, is_active, is_mutual)
SELECT 'p1', a.id, b.id, 1, 1 FROM audit_groups a, audit_groups b WHERE a.name = 'Group A' AND b.name = 'Group E';

INSERT INTO cross_audit_permissions (id, auditor_group_id, target_group_id, is_active, is_mutual)
SELECT 'p2', a.id, b.id, 1, 1 FROM audit_groups a, audit_groups b WHERE a.name = 'Group B' AND b.name = 'Group C';

INSERT INTO cross_audit_permissions (id, auditor_group_id, target_group_id, is_active, is_mutual)
SELECT 'p3', a.id, b.id, 1, 1 FROM audit_groups a, audit_groups b WHERE a.name = 'Group D' AND b.name = 'Group F';

INSERT INTO cross_audit_permissions (id, auditor_group_id, target_group_id, is_active, is_mutual)
SELECT 'p4', a.id, b.id, 1, 1 FROM audit_groups a, audit_groups b WHERE a.name = 'Group H' AND b.name = 'Group I';

INSERT INTO cross_audit_permissions (id, auditor_group_id, target_group_id, is_active, is_mutual)
SELECT 'p5', a.id, b.id, 1, 0 FROM audit_groups a, audit_groups b WHERE a.name = 'Group A' AND b.name = 'Group J';

INSERT INTO cross_audit_permissions (id, auditor_group_id, target_group_id, is_active, is_mutual)
SELECT 'p6', a.id, b.id, 1, 0 FROM audit_groups a, audit_groups b WHERE a.name = 'Group B' AND b.name = 'Group J';

INSERT INTO cross_audit_permissions (id, auditor_group_id, target_group_id, is_active, is_mutual)
SELECT 'p7', a.id, b.id, 1, 0 FROM audit_groups a, audit_groups b WHERE a.name = 'Group J' AND b.name = 'Group G';

INSERT OR REPLACE INTO system_settings (id, value) VALUES 
('pairing_lock', '{"locked":true,"lockedAt":"2026-04-12T14:45:00.000Z","lockedBy":"Admin AI","pairingCount":7}');
