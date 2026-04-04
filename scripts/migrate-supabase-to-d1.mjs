/**
 * Supabase → D1 Full Migration Script
 *
 * Pulls ALL app data from Supabase REST API (service role key bypasses RLS)
 * and inserts it into Cloudflare D1 using INSERT OR REPLACE.
 *
 * Table name mappings (Supabase → D1):
 *   audits       → audit_schedules
 *   cross_audits → cross_audit_permissions
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   node scripts/migrate-supabase-to-d1.mjs
 *
 * Re-running is safe — uses INSERT OR REPLACE.
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';

// ─── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL     = 'https://qwhkrbcvbqqclqdpigzw.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const D1_DB            = 'inspect-able-db';

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Set $env:SUPABASE_SERVICE_ROLE_KEY="<key>" first.');
  process.exit(1);
}

const AUTH_HEADERS = {
  'apikey':        SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Accept':        'application/json',
};

// ─── SQL helpers ─────────────────────────────────────────────────────────────
const esc = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean')  return v ? '1' : '0';
  if (typeof v === 'number')   return String(v);
  if (Array.isArray(v))        return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  if (typeof v === 'object')   return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

function runSQL(sql, label) {
  const tmp = `_mig_${Date.now()}_${Math.random().toString(36).slice(2)}.sql`;
  writeFileSync(tmp, sql, 'utf-8');
  try {
    console.log(`  ⏳ ${label}`);
    execSync(`npx wrangler d1 execute ${D1_DB} --remote --file=${tmp}`, { stdio: 'pipe' });
    console.log(`  ✅ ${label}`);
  } catch (err) {
    const out = (err.stderr?.toString() || '') + (err.stdout?.toString() || '') + err.message;
    const line = out.split('\n').find(l => /error|ERROR|SQLITE|unique/i.test(l)) || out.split('\n')[0] || '';
    console.error(`  ⚠️  ${label}: ${line.trim()}`);
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
  }
}

function insertBatch(table, columns, rows, mapper) {
  if (!rows.length) { console.log(`  ⏭  ${table}: 0 rows — skip`); return 0; }
  const CHUNK = 50;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const vals  = chunk.map(mapper).join(',\n  ');
    runSQL(
      `INSERT OR REPLACE INTO ${table} ${columns} VALUES\n  ${vals};`,
      `${table}: rows ${i + 1}–${Math.min(i + CHUNK, rows.length)} / ${rows.length}`
    );
    done += chunk.length;
  }
  return done;
}

// ─── Supabase REST fetch (handles pagination) ─────────────────────────────────
async function fetchAll(supabaseTable) {
  const PAGE = 1000;
  let rows = [], from = 0;
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${supabaseTable}?select=*&limit=${PAGE}&offset=${from}`,
      { headers: { ...AUTH_HEADERS, 'Range-Unit': 'items', 'Range': `${from}-${from + PAGE - 1}` } }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${text.slice(0, 200)}`);
    }
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    rows = rows.concat(page);
    if (page.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function pull(supabaseTable) {
  try {
    const rows = await fetchAll(supabaseTable);
    console.log(`  📊 ${supabaseTable}: ${rows.length} rows`);
    return rows;
  } catch (err) {
    if (err.message.startsWith('403')) {
      console.error(`  ❌ ${supabaseTable}: Permission denied.`);
      console.error(`     Fix: Run this in Supabase SQL Editor:`);
      console.error(`     GRANT USAGE ON SCHEMA public TO service_role;`);
      console.error(`     GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;`);
    } else {
      console.warn(`  ⚠️  ${supabaseTable}: ${err.message} — skipped`);
    }
    return null;
  }
}

// ─── Supabase Auth users ──────────────────────────────────────────────────────
async function fetchAuthUsers() {
  let users = [], page = 1;
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=100`,
      { headers: AUTH_HEADERS }
    );
    if (!res.ok) { console.warn(`  ⚠️  Auth API: ${res.status}`); break; }
    const body = await res.json();
    const chunk = body.users || [];
    users = users.concat(chunk);
    if (chunk.length < 100) break;
    page++;
  }
  return users;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function migrate() {
  console.log('\n🚀 Supabase → D1 Full Migration\n');
  const stats = {};

  // ── 1. Audit Groups (no dependencies) ──────────────────────────────────────
  console.log('\n📦 [1/13] audit_groups');
  const auditGroups = await pull('audit_groups');
  if (auditGroups?.length) {
    stats.audit_groups = insertBatch(
      'audit_groups', '(id, name, description, color, created_at)',
      auditGroups,
      (r) => `(${esc(r.id)}, ${esc(r.name)}, ${esc(r.description)}, ${esc(r.color)}, ${esc(r.created_at)})`
    );
  }

  // ── 2. Audit Phases ─────────────────────────────────────────────────────────
  console.log('\n📦 [2/13] audit_phases');
  const auditPhases = await pull('audit_phases');
  if (auditPhases?.length) {
    stats.audit_phases = insertBatch(
      'audit_phases', '(id, name, start_date, end_date, description, status, created_at)',
      auditPhases,
      (r) => `(${esc(r.id)}, ${esc(r.name)}, ${esc(r.start_date)}, ${esc(r.end_date)}, ${esc(r.description)}, ${esc(r.status || 'Active')}, ${esc(r.created_at)})`
    );
  }

  // ── 3. KPI Tiers ────────────────────────────────────────────────────────────
  console.log('\n📦 [3/13] kpi_tiers');
  const kpiTiers = await pull('kpi_tiers');
  if (kpiTiers?.length) {
    stats.kpi_tiers = insertBatch(
      'kpi_tiers', '(id, name, min_assets, description, created_at)',
      kpiTiers,
      (r) => `(${esc(r.id)}, ${esc(r.name)}, ${esc(r.min_assets)}, ${esc(r.description)}, ${esc(r.created_at)})`
    );
  }

  // ── 4. KPI Tier Targets ─────────────────────────────────────────────────────
  console.log('\n📦 [4/13] kpi_tier_targets');
  const kpiTierTargets = await pull('kpi_tier_targets');
  if (kpiTierTargets?.length) {
    stats.kpi_tier_targets = insertBatch(
      'kpi_tier_targets', '(id, tier_id, phase_id, target_percentage, created_at)',
      kpiTierTargets,
      (r) => `(${esc(r.id)}, ${esc(r.tier_id)}, ${esc(r.phase_id)}, ${esc(r.target_percentage)}, ${esc(r.created_at)})`
    );
  }

  // ── 5. Buildings ────────────────────────────────────────────────────────────
  console.log('\n📦 [5/13] buildings');
  const buildings = await pull('buildings');
  if (buildings?.length) {
    stats.buildings = insertBatch(
      'buildings', '(id, name, abbr, description, created_at)',
      buildings,
      (r) => `(${esc(r.id)}, ${esc(r.name)}, ${esc(r.abbr)}, ${esc(r.description)}, ${esc(r.created_at)})`
    );
  }

  // ── 6. Departments (depends on audit_groups) ────────────────────────────────
  console.log('\n📦 [6/13] departments');
  const departments = await pull('departments');
  if (departments?.length) {
    stats.departments = insertBatch(
      'departments', '(id, name, abbr, description, head_of_dept_id, audit_group_id, is_exempted, created_at)',
      departments,
      (r) => `(${esc(r.id)}, ${esc(r.name)}, ${esc(r.abbr)}, ${esc(r.description)}, ${esc(r.head_of_dept_id)}, ${esc(r.audit_group_id)}, ${r.is_exempted ? 1 : 0}, ${esc(r.created_at)})`
    );
  }

  // ── 7. Users (merge REST profiles + Auth metadata) ──────────────────────────
  console.log('\n📦 [7/13] users');
  const [restUsers, authUsers] = await Promise.all([
    pull('users'),
    fetchAuthUsers().then(u => { console.log(`  📊 auth: ${u.length} users`); return u; }),
  ]);

  const profileMap = {};
  (restUsers || []).forEach(p => { profileMap[p.id] = p; });

  const allUserIds = new Set([
    ...(restUsers || []).map(u => u.id),
    ...authUsers.map(u => u.id),
  ]);

  const mergedUsers = [...allUserIds].map(id => {
    const profile = profileMap[id] || {};
    const auth    = authUsers.find(u => u.id === id) || {};
    // roles: Supabase stores as text[] → JSON string for D1
    let roles = profile.roles || auth.user_metadata?.roles || ['Staff'];
    if (Array.isArray(roles)) roles = JSON.stringify(roles);
    return {
      id,
      name:                 profile.name || auth.user_metadata?.name || auth.email?.split('@')[0] || 'User',
      email:                profile.email || auth.email || '',
      roles,
      designation:          profile.designation || auth.user_metadata?.designation || null,
      picture:              profile.picture || auth.user_metadata?.avatar_url || null,
      department_id:        profile.department_id || null,
      contact_number:       profile.contact_number || null,
      status:               profile.status || 'Active',
      is_verified:          profile.is_verified !== undefined ? (profile.is_verified ? 1 : 0) : 1,
      must_change_pin:      profile.must_change_pin ? 1 : 0,
      certification_issued: profile.certification_issued || null,
      certification_expiry: profile.certification_expiry || null,
      last_active:          profile.last_active || auth.last_sign_in_at?.split('T')[0] || null,
      // dashboard_config is JSONB in Supabase → stringify for D1
      dashboard_config:     profile.dashboard_config ? JSON.stringify(profile.dashboard_config) : null,
      created_at:           profile.created_at || auth.created_at || new Date().toISOString(),
    };
  });

  if (mergedUsers.length) {
    stats.users = insertBatch(
      'users',
      '(id, name, email, roles, designation, picture, department_id, contact_number, status, is_verified, must_change_pin, certification_issued, certification_expiry, last_active, dashboard_config, created_at)',
      mergedUsers,
      (u) => `(${esc(u.id)}, ${esc(u.name)}, ${esc(u.email)}, ${esc(u.roles)}, ${esc(u.designation)}, ${esc(u.picture)}, ${esc(u.department_id)}, ${esc(u.contact_number)}, ${esc(u.status)}, ${u.is_verified}, ${u.must_change_pin}, ${esc(u.certification_issued)}, ${esc(u.certification_expiry)}, ${esc(u.last_active)}, ${esc(u.dashboard_config)}, ${esc(u.created_at)})`
    );
  }

  // ── 8. Locations ────────────────────────────────────────────────────────────
  console.log('\n📦 [8/13] locations');
  const locations = await pull('locations');
  if (locations?.length) {
    stats.locations = insertBatch(
      'locations', '(id, name, abbr, department_id, building_id, building, level, description, supervisor_id, contact, is_active, status, created_at)',
      locations,
      (r) => `(${esc(r.id)}, ${esc(r.name)}, ${esc(r.abbr)}, ${esc(r.department_id)}, ${esc(r.building_id)}, ${esc(r.building)}, ${esc(r.level)}, ${esc(r.description)}, ${esc(r.supervisor_id)}, ${esc(r.contact)}, ${r.is_active !== false ? 1 : 0}, ${esc(r.status || 'Active')}, ${esc(r.created_at)})`
    );
  }

  // ── 9. Audit Schedules (Supabase table: "audits") ────────────────────────────
  console.log('\n📦 [9/13] audit_schedules  ← Supabase "audits"');
  const audits = await pull('audits');
  if (audits?.length) {
    stats.audit_schedules = insertBatch(
      'audit_schedules', '(id, department_id, location_id, supervisor_id, auditor1_id, auditor2_id, date, status, phase_id, created_at)',
      audits,
      (r) => `(${esc(r.id)}, ${esc(r.department_id)}, ${esc(r.location_id)}, ${esc(r.supervisor_id)}, ${esc(r.auditor1_id)}, ${esc(r.auditor2_id)}, ${esc(r.date)}, ${esc(r.status || 'Pending')}, ${esc(r.phase_id)}, ${esc(r.created_at)})`
    );
  }

  // ── 10. Cross Audit Permissions (Supabase table: "cross_audits") ──────────────
  console.log('\n📦 [10/13] cross_audit_permissions  ← Supabase "cross_audits"');
  const crossAudits = await pull('cross_audits');
  if (crossAudits?.length) {
    stats.cross_audit_permissions = insertBatch(
      'cross_audit_permissions', '(id, auditor_dept_id, target_dept_id, is_active, is_mutual, created_at)',
      crossAudits,
      (r) => `(${esc(r.id)}, ${esc(r.auditor_dept_id)}, ${esc(r.target_dept_id)}, ${r.is_active ? 1 : 0}, ${r.is_mutual ? 1 : 0}, ${esc(r.created_at)})`
    );
  }

  // ── 11. Department Mappings ───────────────────────────────────────────────────
  console.log('\n📦 [11/13] department_mappings');
  const deptMappings = await pull('department_mappings');
  if (deptMappings?.length) {
    stats.department_mappings = insertBatch(
      'department_mappings', '(id, source_name, target_department_id, created_at)',
      deptMappings,
      (r) => `(${esc(r.id)}, ${esc(r.source_name)}, ${esc(r.target_department_id)}, ${esc(r.created_at)})`
    );
  }

  // ── 12. Institution KPI Targets ───────────────────────────────────────────────
  console.log('\n📦 [12/13] institution_kpi_targets');
  const instKpis = await pull('institution_kpi_targets');
  if (instKpis?.length) {
    stats.institution_kpi_targets = insertBatch(
      'institution_kpi_targets', '(phase_id, target_percentage)',
      instKpis,
      (r) => `(${esc(r.phase_id)}, ${esc(r.target_percentage)})`
    );
  }

  // ── 13. System Activities ─────────────────────────────────────────────────────
  console.log('\n📦 [13/13] system_activities');
  const activities = await pull('system_activities');
  if (activities?.length) {
    stats.system_activities = insertBatch(
      'system_activities', '(id, type, user_id, message, timestamp, metadata)',
      activities,
      (r) => `(${esc(r.id)}, ${esc(r.type)}, ${esc(r.user_id)}, ${esc(r.message)}, ${esc(r.created_at)}, ${esc(r.metadata ? JSON.stringify(r.metadata) : null)})`
    );
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  console.log('✅ Migration complete!\n');
  for (const [table, count] of Object.entries(stats)) {
    console.log(`   ${table}: ${count ?? 0} rows`);
  }
  console.log('─'.repeat(50));
}

migrate().catch(err => { console.error('\n💥 Fatal:', err); process.exit(1); });
