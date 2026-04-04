import { D1Database, R2Bucket } from '@cloudflare/workers-types';

interface R2BackupOptions {
  db: D1Database;
  bucket: R2Bucket;
}

interface BackupResult {
  tablesSync: number;
  rowsSync: number;
  key: string;
  errors: string[];
}

const BACKUP_TABLES: { table: string; query: string }[] = [
  { table: 'users',                   query: 'SELECT * FROM users' },
  { table: 'departments',             query: 'SELECT * FROM departments' },
  { table: 'buildings',               query: 'SELECT * FROM buildings' },
  { table: 'locations',               query: 'SELECT * FROM locations' },
  { table: 'audit_groups',            query: 'SELECT * FROM audit_groups' },
  { table: 'audit_phases',            query: 'SELECT * FROM audit_phases' },
  { table: 'audit_schedules',         query: 'SELECT * FROM audit_schedules' },
  { table: 'kpi_tiers',               query: 'SELECT * FROM kpi_tiers' },
  { table: 'kpi_tier_targets',        query: 'SELECT * FROM kpi_tier_targets' },
  { table: 'institution_kpi_targets', query: 'SELECT * FROM institution_kpi_targets' },
  { table: 'cross_audit_permissions', query: 'SELECT * FROM cross_audit_permissions' },
  { table: 'department_mappings',     query: 'SELECT * FROM department_mappings' },
  { table: 'system_settings',         query: 'SELECT * FROM system_settings' },
  { table: 'system_activities',       query: 'SELECT * FROM system_activities ORDER BY created_at DESC LIMIT 500' },
];

export async function backupD1ToR2({ db, bucket }: R2BackupOptions): Promise<BackupResult> {
  const result: BackupResult = { tablesSync: 0, rowsSync: 0, key: '', errors: [] };
  const snapshot: Record<string, any[]> = {};

  for (const def of BACKUP_TABLES) {
    try {
      const { results } = await db.prepare(def.query).all();
      snapshot[def.table] = results || [];
      result.tablesSync++;
      result.rowsSync += snapshot[def.table].length;
      console.log(`[Backup] ✅ ${def.table}: ${snapshot[def.table].length} rows`);
    } catch (err: any) {
      const msg = `${def.table}: ${err.message}`;
      result.errors.push(msg);
      console.error(`[Backup] ❌ ${msg}`);
    }
  }

  // Store as a timestamped JSON file: backups/2026-04-04T02-00-00Z.json
  const ts = new Date().toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, 'Z');
  const key = `backups/${ts}.json`;

  await bucket.put(key, JSON.stringify({
    createdAt: new Date().toISOString(),
    tables: result.tablesSync,
    rows: result.rowsSync,
    errors: result.errors,
    snapshot,
  }), {
    httpMetadata: { contentType: 'application/json' },
  });

  result.key = key;
  console.log(`[Backup] 📦 Snapshot saved to R2: ${key}`);
  return result;
}
