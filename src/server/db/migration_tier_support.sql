-- Migration: Add support for Tiers and Task Forces in Group Builder
-- Adds 'tier' to audit_groups
-- Adds 'tier' and 'is_task_force' to departments

ALTER TABLE audit_groups ADD COLUMN tier TEXT;
ALTER TABLE departments ADD COLUMN tier TEXT;
ALTER TABLE departments ADD COLUMN is_task_force INTEGER DEFAULT 0;
