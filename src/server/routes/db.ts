import { Hono } from 'hono';
import { Context, Next } from 'hono';
import { cache } from 'hono/cache';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { Bindings, Variables } from '../types';
import { requirePermission } from '../middleware/rbac';
import { auditAssignmentGuard } from '../middleware/conflictOfInterest';

const db = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// ─── Edge Cache Helper ────────────────────────────────────────────────────────
// Wraps Hono's cache() for Cloudflare Workers Cache Storage API.
// Only safe for GET routes whose data changes infrequently (admin config, phases, tiers).
// Cache-Control max-age controls both the CF edge cache and browser cache.
const edgeCache = (seconds: number) =>
  cache({ cacheName: 'db', cacheControl: `public, max-age=${seconds}, s-maxage=${seconds}` });
// ─────────────────────────────────────────────────────────────────────────────

// ─── RBAC Helper ────────────────────────────────────────────────────────────
// Returns a Hono middleware that enforces minimum required roles.
// Reads real roles from the user context (already fetched from D1 by authMiddleware).
const requireRoles = (...allowed: string[]) =>
  async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
    const user = c.get('user');
    const userRoles: string[] = user?.roles || (user?.role ? [user.role] : []);
    if (!userRoles.some(r => allowed.includes(r))) {
      return c.json({ error: 'Forbidden: insufficient role' }, 403);
    }
    await next();
  };

// ─── Audit Lock Guard ────────────────────────────────────────────────────────
// Blocks structural PATCH changes (phaseId, departmentId, locationId) on a
// "locked" audit (one that already has a date AND at least one auditor assigned).
// Mirrors the isAuditLocked check in App.tsx — now enforced server-side.
const auditLockGuard = async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
  const id = c.req.param('id');
  const updates = (c.req as any).valid('json') as Record<string, any>;
  const structuralFields = ['phaseId', 'departmentId', 'locationId'];
  const touchesStructure = structuralFields.some(f => updates[f] !== undefined);

  if (!touchesStructure) return next();

  const existing = await c.env.DB.prepare(
    'SELECT date, auditor1_id, auditor2_id FROM audit_schedules WHERE id = ?',
  ).bind(id).first<{ date: string | null; auditor1_id: string | null; auditor2_id: string | null }>();

  if (existing && existing.date && (existing.auditor1_id || existing.auditor2_id)) {
    return c.json(
      { error: 'Locked audits cannot have their phase, department, or location changed' },
      409,
    );
  }
  return next();
};

// ─── Zero-Asset Guard ────────────────────────────────────────────────────────
// Prevents scheduling a new audit for a department with zero total assets.
// Mirrors the client-side check in handleAddAudit in App.tsx.
const zeroAssetGuard = async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
  const body = (c.req as any).valid('json') as { departmentId?: string | null };
  const deptId = body?.departmentId;
  if (!deptId) return next();

  const dept = await c.env.DB.prepare(
    'SELECT total_assets, name FROM departments WHERE id = ?',
  ).bind(deptId).first<{ total_assets: number; name: string }>();

  if (dept && (dept.total_assets || 0) === 0) {
    return c.json(
      { error: `Cannot schedule an audit for '${dept.name}' — it has zero total assets` },
      422,
    );
  }
  return next();
};

// ─── Status Transition Guard ─────────────────────────────────────────────────
// Enforces the valid audit state machine:
//   Pending → In Progress → Completed (no skipping, no going backwards)
// Applies to PATCH /audits/:id when status is being changed.
const VALID_TRANSITIONS: Record<string, string[]> = {
  'Pending':     ['In Progress'],
  'In Progress': ['Completed'],
  'Completed':   [],
};

const statusTransitionGuard = async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
  const updates = (c.req as any).valid('json') as { status?: string };
  if (!updates.status) return next();

  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(
    'SELECT status FROM audit_schedules WHERE id = ?',
  ).bind(id).first<{ status: string }>();

  if (!existing) return next(); // Will 404 in handler

  const allowed = VALID_TRANSITIONS[existing.status] || [];
  if (!allowed.includes(updates.status)) {
    return c.json(
      {
        error: `Invalid status transition: '${existing.status}' → '${updates.status}' is not permitted`,
        allowedTransitions: allowed,
        code: 'INVALID_TRANSITION',
      },
      422,
    );
  }
  return next();
};
// ────────────────────────────────────────────────────────────────────────────

// Schemas (Example for Assets - needs to match types.ts)
const assetSchema = z.object({
  id: z.string().uuid().optional(),
  tag: z.string(),
  name: z.string(),
  location: z.string(),
  status: z.string(),
  last_inspected: z.string().optional(),
});

// Audits
const auditSchema = z.object({
  id: z.string().optional(),
  status: z.string(),
  date: z.string().nullable(),
  departmentId: z.string().nullable(),
  locationId: z.string().nullable(),
  supervisorId: z.string().nullable(),
  auditor1Id: z.string().nullable(),
  auditor2Id: z.string().nullable(),
  phaseId: z.string().nullable(),
});

const patchAuditSchema = z.object({
  status: z.string().optional(),
  date: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  locationId: z.string().nullable().optional(),
  supervisorId: z.string().nullable().optional(),
  auditor1Id: z.string().nullable().optional(),
  auditor2Id: z.string().nullable().optional(),
  phaseId: z.string().nullable().optional(),
});

const userSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  roles: z.array(z.string()).optional(),
  designation: z.string().nullable().optional(),
  picture: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  contactNumber: z.string().nullable().optional(),
  status: z.string().optional(),
  isVerified: z.boolean().optional(),
  mustChangePIN: z.boolean().optional(),
  certificationIssued: z.string().nullable().optional(),
  certificationExpiry: z.string().nullable().optional(),
});

const patchUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  roles: z.array(z.string()).optional(),
  departmentId: z.string().nullable().optional(),
  contactNumber: z.string().nullable().optional(),
  isVerified: z.boolean().optional(),
  lastActive: z.string().optional(),
  certificationIssued: z.string().nullable().optional(),
  certificationExpiry: z.string().nullable().optional(),
});

db.get('/audits', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, department_id, location_id, supervisor_id, auditor1_id, auditor2_id, date, status, phase_id FROM audit_schedules'
    ).all();
    
    return c.json((results || []).map((a: any) => ({
      id: a.id,
      departmentId: a.department_id,
      locationId: a.location_id,
      supervisorId: a.supervisor_id,
      auditor1Id: a.auditor1_id,
      auditor2Id: a.auditor2_id,
      date: a.date,
      status: a.status,
      phaseId: a.phase_id
    })));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/audits', zValidator('json', auditSchema), requirePermission('edit:audit:assign'), zeroAssetGuard, auditAssignmentGuard, async (c) => {
  const audit = c.req.valid('json');
  const id = audit.id || crypto.randomUUID();
  
  try {
    await c.env.DB.prepare(
      `INSERT INTO audit_schedules 
       (id, department_id, location_id, supervisor_id, auditor1_id, auditor2_id, date, status, phase_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      audit.departmentId ?? null,
      audit.locationId ?? null,
      audit.supervisorId ?? null,
      audit.auditor1Id ?? null,
      audit.auditor2Id ?? null,
      audit.date ?? null,
      audit.status ?? 'Scheduled',
      audit.phaseId ?? null
    ).run();

    return c.json({
      id,
      ...audit
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.patch('/audits/:id', zValidator('json', patchAuditSchema), requirePermission('edit:audit:assign'), auditLockGuard, statusTransitionGuard, auditAssignmentGuard, async (c) => {
  const id = c.req.param('id');
  const updates = c.req.valid('json');

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.date !== undefined) { fields.push('date = ?'); values.push(updates.date); }
  if (updates.departmentId !== undefined) { fields.push('department_id = ?'); values.push(updates.departmentId); }
  if (updates.locationId !== undefined) { fields.push('location_id = ?'); values.push(updates.locationId); }
  if (updates.supervisorId !== undefined) { fields.push('supervisor_id = ?'); values.push(updates.supervisorId); }
  if (updates.auditor1Id !== undefined) { fields.push('auditor1_id = ?'); values.push(updates.auditor1Id); }
  if (updates.auditor2Id !== undefined) { fields.push('auditor2_id = ?'); values.push(updates.auditor2Id); }
  if (updates.phaseId !== undefined) { fields.push('phase_id = ?'); values.push(updates.phaseId); }

  if (fields.length === 0) return c.json({ success: true });

  try {
    await c.env.DB.prepare(
      `UPDATE audit_schedules SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values, id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.delete('/audits/:id', requireRoles('Admin', 'Coordinator'), async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM audit_schedules WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/audits/bulk', requireRoles('Admin', 'Coordinator'), async (c) => {
  const audits = await c.req.json();
  try {
    const statements = audits.map((a: any) => {
      const id = a.id || crypto.randomUUID();
      return c.env.DB.prepare(
        `INSERT INTO audit_schedules 
         (id, department_id, location_id, supervisor_id, auditor1_id, auditor2_id, date, status, phase_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        a.departmentId ?? null,
        a.locationId ?? null,
        a.supervisorId ?? null,
        a.auditor1Id ?? null,
        a.auditor2Id ?? null,
        a.date ?? null,
        a.status ?? 'Scheduled',
        a.phaseId ?? null
      );
    });
    await c.env.DB.batch(statements);
    return c.json({ success: true, count: audits.length });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Users
db.get('/users', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
    'SELECT id, name, email, roles, designation, picture, department_id, contact_number, status, is_verified, must_change_pin, certification_issued, certification_expiry, last_active FROM users',
  ).all();

    return c.json((results || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      roles: JSON.parse(u.roles || '["Staff"]'),
      designation: u.designation,
      picture: u.picture,
      departmentId: u.department_id,
      contactNumber: u.contact_number,
      status: u.status,
      isVerified: u.is_verified === 1,
      mustChangePIN: u.must_change_pin === 1,
      certificationIssued: u.certification_issued,
      certificationExpiry: u.certification_expiry,
      lastActive: u.last_active,
    })));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/users', requireRoles('Admin', 'Coordinator'), zValidator('json', userSchema), async (c) => {
  const user = c.req.valid('json');
  const id = user.id || crypto.randomUUID();
  
  try {
    await c.env.DB.prepare(
      `INSERT INTO users 
       (id, name, email, roles, designation, picture, department_id, contact_number, status, is_verified, must_change_pin, certification_issued, certification_expiry) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      user.name,
      user.email,
      JSON.stringify(user.roles || ['Staff']),
      user.designation ?? null,
      user.picture ?? null,
      user.departmentId ?? null,
      user.contactNumber ?? null,
      user.status ?? 'Active',
      user.isVerified ? 1 : 0,
      user.mustChangePIN ? 1 : 0,
      user.certificationIssued ?? null,
      user.certificationExpiry ?? null
    ).run();

    return c.json({ id, ...user });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.patch('/users/:id', zValidator('json', patchUserSchema), async (c) => {
  const id = c.req.param('id');
  const updates = c.req.valid('json');
  const caller = c.get('user');
  const callerRoles: string[] = caller?.roles || [];
  const isAdmin = callerRoles.includes('Admin');
  const isCoordinator = callerRoles.includes('Coordinator');

  // Non-admin/coordinator can only update their own record
  if (!isAdmin && !isCoordinator && caller?.id !== id) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  // Only Admin can change roles, verification, and certification
  if (!isAdmin && (updates.roles !== undefined || updates.isVerified !== undefined || updates.certificationIssued !== undefined || updates.certificationExpiry !== undefined)) {
    return c.json({ error: 'Forbidden: only Admin can change roles or certification' }, 403);
  }

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.roles !== undefined) { fields.push('roles = ?'); values.push(JSON.stringify(updates.roles)); }
  if (updates.departmentId !== undefined) { fields.push('department_id = ?'); values.push(updates.departmentId); }
  if (updates.contactNumber !== undefined) { fields.push('contact_number = ?'); values.push(updates.contactNumber); }
  if (updates.isVerified !== undefined) { fields.push('is_verified = ?'); values.push(updates.isVerified ? 1 : 0); }
  if (updates.lastActive !== undefined) { fields.push('last_active = ?'); values.push(updates.lastActive); }
  if (updates.certificationIssued !== undefined) { fields.push('certification_issued = ?'); values.push(updates.certificationIssued); }
  if (updates.certificationExpiry !== undefined) { fields.push('certification_expiry = ?'); values.push(updates.certificationExpiry); }

  if (fields.length === 0) return c.json({ success: true });

  try {
    await c.env.DB.prepare(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values, id).run();
    // Evict cached roles/departmentId if any privileged fields changed
    const privilegedChanged = updates.roles !== undefined || updates.departmentId !== undefined
      || updates.isVerified !== undefined || updates.certificationIssued !== undefined
      || updates.certificationExpiry !== undefined;
    if (privilegedChanged) {
      await c.env.SETTINGS.delete(`ucache:${id}`).catch(() => {});
    }
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.delete('/users/:id', requireRoles('Admin'), async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    // Evict roles cache + force-out active session
    await Promise.allSettled([
      c.env.SETTINGS.delete(`ucache:${id}`),
      c.env.SETTINGS.delete(`sess:${id}`),
    ]);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/users/:id/verify', requireRoles('Admin'), async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('UPDATE users SET is_verified = 1, status = \'Active\' WHERE id = ?').bind(id).run();
    // Evict stale role cache so next request fetches updated status from D1
    await c.env.SETTINGS.delete(`ucache:${id}`).catch(() => {});
    const { results } = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).all();
    const u = results[0] as any;
    return c.json({
      id: u.id,
      name: u.name,
      email: u.email,
      roles: JSON.parse(u.roles || '["Staff"]'),
      designation: u.designation,
      picture: u.picture,
      departmentId: u.department_id,
      contactNumber: u.contact_number,
      status: u.status,
      isVerified: u.is_verified === 1,
      mustChangePIN: u.must_change_pin === 1,
      certificationIssued: u.certification_issued,
      certificationExpiry: u.certification_expiry,
      lastActive: u.last_active,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Departments
db.get('/departments', edgeCache(60), async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
    'SELECT id, name, abbr, description, head_of_dept_id, audit_group_id, is_exempted, total_assets, uninspected_asset_count FROM departments',
  ).all();
    return c.json((results || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      abbr: d.abbr,
      description: d.description,
      headOfDeptId: d.head_of_dept_id,
      auditGroupId: d.audit_group_id,
      isExempted: d.is_exempted === 1,
      totalAssets: d.total_assets ?? 0,
      uninspectedAssetCount: d.uninspected_asset_count ?? 0,
    })));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/departments', requirePermission('manage:departments'), async (c) => {
  const dept = await c.req.json();
  const id = dept.id || crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      'INSERT INTO departments (id, name, abbr, description, head_of_dept_id, audit_group_id, is_exempted) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      id,
      dept.name,
      dept.abbr,
      dept.description ?? null,
      dept.headOfDeptId ?? null,
      dept.auditGroupId ?? null,
      dept.isExempted ? 1 : 0
    ).run();
    return c.json({ id, ...dept });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.patch('/departments/:id', requirePermission('manage:departments'), async (c) => {
  const id = c.req.param('id');
  const updates = await c.req.json();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.abbr !== undefined) { fields.push('abbr = ?'); values.push(updates.abbr); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.headOfDeptId !== undefined) { fields.push('head_of_dept_id = ?'); values.push(updates.headOfDeptId); }
  if (updates.auditGroupId !== undefined) { fields.push('audit_group_id = ?'); values.push(updates.auditGroupId); }
  if (updates.isExempted !== undefined) { fields.push('is_exempted = ?'); values.push(updates.isExempted ? 1 : 0); }
  if (updates.totalAssets !== undefined) { fields.push('total_assets = ?'); values.push(updates.totalAssets); }
  if (updates.uninspectedAssetCount !== undefined) { fields.push('uninspected_asset_count = ?'); values.push(updates.uninspectedAssetCount); }

  if (fields.length === 0) return c.json({ success: true });

  try {
    await c.env.DB.prepare(`UPDATE departments SET ${fields.join(', ')} WHERE id = ?`).bind(...values, id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.delete('/departments/:id', requirePermission('manage:departments'), async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM departments WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.delete('/departments/:id/force', requireRoles('Admin'), async (c) => {
  const id = c.req.param('id');
  try {
    // In D1, we might need a stored procedure-like logic or multi-statement
    // For now, let's just delete dependencies manually if needed, or assume CASCADE if set.
    await c.env.DB.prepare('DELETE FROM departments WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/departments/clear', requireRoles('Admin'), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const keep_user_id: string | undefined = body?.keep_user_id;
  try {
    // Delete in FK-safe order: child tables first, then departments
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM audit_schedules'),
      c.env.DB.prepare('DELETE FROM locations'),
      c.env.DB.prepare('DELETE FROM cross_audit_permissions'),
      c.env.DB.prepare('DELETE FROM department_mappings'),
      // Delete all users except the admin who triggered the reset
      keep_user_id
        ? c.env.DB.prepare('DELETE FROM users WHERE id != ?').bind(keep_user_id)
        : c.env.DB.prepare('DELETE FROM users'),
      c.env.DB.prepare('DELETE FROM departments'),
    ]);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Locations
db.get('/locations', edgeCache(60), async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
    'SELECT id, name, abbr, department_id, building_id, level, description, supervisor_id, contact, total_assets, uninspected_asset_count, is_active, status FROM locations',
  ).all();
    return c.json((results || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      abbr: l.abbr,
      departmentId: l.department_id,
      buildingId: l.building_id,
      level: l.level,
      description: l.description,
      supervisorId: l.supervisor_id,
      contact: l.contact,
      totalAssets: l.total_assets ?? 0,
      uninspectedAssetCount: l.uninspected_asset_count ?? 0,
      isActive: l.is_active === 1,
      status: l.status
    })));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/locations', requirePermission('manage:locations'), async (c) => {
  const loc = await c.req.json();
  const id = loc.id || crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      `INSERT INTO locations 
       (id, name, abbr, department_id, building_id, level, description, supervisor_id, contact, total_assets, uninspected_asset_count, is_active, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      loc.name,
      loc.abbr,
      loc.departmentId,
      loc.buildingId ?? null,
      loc.level ?? null,
      loc.description ?? null,
      loc.supervisorId ?? null,
      loc.contact ?? null,
      loc.totalAssets ?? 0,
      loc.uninspectedAssetCount ?? 0,
      loc.isActive !== undefined ? (loc.isActive ? 1 : 0) : 1,
      loc.status ?? 'Active'
    ).run();
    return c.json({ id, ...loc });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.patch('/locations/:id', requirePermission('manage:locations'), async (c) => {
  const id = c.req.param('id');
  const updates = await c.req.json();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.abbr !== undefined) { fields.push('abbr = ?'); values.push(updates.abbr); }
  if (updates.departmentId !== undefined) { fields.push('department_id = ?'); values.push(updates.departmentId); }
  if (updates.buildingId !== undefined) { fields.push('building_id = ?'); values.push(updates.buildingId); }
  if (updates.level !== undefined) { fields.push('level = ?'); values.push(updates.level); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.supervisorId !== undefined) { fields.push('supervisor_id = ?'); values.push(updates.supervisorId); }
  if (updates.contact !== undefined) { fields.push('contact = ?'); values.push(updates.contact); }
  if (updates.totalAssets !== undefined) { fields.push('total_assets = ?'); values.push(updates.totalAssets); }
  if (updates.uninspectedAssetCount !== undefined) { fields.push('uninspected_asset_count = ?'); values.push(updates.uninspectedAssetCount); }
  if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }

  if (fields.length === 0) return c.json({ success: true });

  try {
    await c.env.DB.prepare(`UPDATE locations SET ${fields.join(', ')} WHERE id = ?`).bind(...values, id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.delete('/locations/:id', requirePermission('manage:locations'), async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM locations WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.delete('/locations/:id/force', requireRoles('Admin'), async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM locations WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/locations/clear', requireRoles('Admin'), async (c) => {
  try {
    // Delete audit_schedules first (they FK-reference locations)
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM audit_schedules'),
      c.env.DB.prepare('DELETE FROM locations'),
    ]);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/locations/bulk', requireRoles('Admin', 'Coordinator'), async (c) => {
  const locs = await c.req.json();
  try {
    const statements = locs.map((loc: any) => {
      const id = loc.id || crypto.randomUUID();
      return c.env.DB.prepare(
        `INSERT INTO locations 
         (id, name, abbr, department_id, building_id, level, description, supervisor_id, contact, total_assets, uninspected_asset_count, is_active, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        loc.name,
        loc.abbr,
        loc.departmentId,
        loc.buildingId ?? null,
        loc.level ?? null,
        loc.description ?? null,
        loc.supervisorId ?? null,
        loc.contact ?? null,
        loc.totalAssets ?? 0,
        loc.uninspectedAssetCount ?? 0,
        loc.isActive !== undefined ? (loc.isActive ? 1 : 0) : 1,
        loc.status ?? 'Active'
      );
    });

    await c.env.DB.batch(statements);
    return c.json({ success: true, count: locs.length });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Department Mappings
db.get('/department-mappings', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM department_mappings').all();
    return c.json((results || []).map((m: any) => ({
      ...m,
      sourceName: m.source_name,
      targetDepartmentId: m.target_department_id
    })));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/department-mappings', requireRoles('Admin', 'Coordinator'), async (c) => {
  const mapping = await c.req.json();
  const id = mapping.id || crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      'INSERT INTO department_mappings (id, source_name, target_department_id) VALUES (?, ?, ?) ON CONFLICT(source_name) DO UPDATE SET target_department_id=EXCLUDED.target_department_id'
    ).bind(id, mapping.sourceName, mapping.targetDepartmentId).run();
    return c.json({ id, ...mapping });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/department-mappings/clear', requireRoles('Admin', 'Coordinator'), async (c) => {
  try {
    await c.env.DB.prepare('DELETE FROM department_mappings').run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.delete('/department-mappings/:id', requireRoles('Admin', 'Coordinator'), async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM department_mappings WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Permissions
db.get('/permissions', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM cross_audit_permissions').all();
    return c.json((results || []).map((p: any) => ({
      id: p.id,
      auditorDeptId: p.auditor_dept_id,
      targetDeptId: p.target_dept_id,
      isActive: p.is_active === 1,
      isMutual: p.is_mutual === 1
    })));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/permissions', async (c) => {
  const perm = await c.req.json();
  const id = perm.id || crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      'INSERT INTO cross_audit_permissions (id, auditor_dept_id, target_dept_id, is_active, is_mutual) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, perm.auditorDeptId, perm.targetDeptId, perm.isActive ? 1 : 0, perm.isMutual ? 1 : 0).run();
    return c.json({ id, ...perm });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/permissions/bulk', async (c) => {
  const perms = await c.req.json();
  try {
    const statements = perms.map((p: any) => {
      const id = p.id || crypto.randomUUID();
      return c.env.DB.prepare(
        'INSERT INTO cross_audit_permissions (id, auditor_dept_id, target_dept_id, is_active, is_mutual) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, p.auditorDeptId, p.targetDeptId, p.isActive ? 1 : 0, p.isMutual ? 1 : 0);
    });
    await c.env.DB.batch(statements);
    return c.json({ success: true, count: perms.length });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.delete('/permissions/:id', async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM cross_audit_permissions WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.delete('/permissions/bulk', async (c) => {
  const { ids } = await c.req.json();
  try {
    const placeholders = ids.map(() => '?').join(',');
    await c.env.DB.prepare(`DELETE FROM cross_audit_permissions WHERE id IN (${placeholders})`).bind(...ids).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.patch('/permissions/:id', async (c) => {
  const id = c.req.param('id');
  const updates = await c.req.json();
  const fields: string[] = [];
  const values: any[] = [];
  if (updates.auditorDeptId !== undefined) { fields.push('auditor_dept_id = ?'); values.push(updates.auditorDeptId); }
  if (updates.targetDeptId !== undefined) { fields.push('target_dept_id = ?'); values.push(updates.targetDeptId); }
  if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }
  if (updates.isMutual !== undefined) { fields.push('is_mutual = ?'); values.push(updates.isMutual ? 1 : 0); }
  if (fields.length === 0) return c.json({ success: true });
  try {
    await c.env.DB.prepare(`UPDATE cross_audit_permissions SET ${fields.join(', ')} WHERE id = ?`).bind(...values, id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Audit Phases
db.get('/audit-phases', edgeCache(300), async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM audit_phases').all();
    return c.json((results || []).map((p: any) => ({
      ...p,
      startDate: p.start_date,
      endDate: p.end_date
    })));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/audit-phases', requireRoles('Admin'), async (c) => {
  const phase = await c.req.json();
  const id = phase.id || crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      'INSERT INTO audit_phases (id, name, start_date, end_date, description, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, phase.name, phase.startDate, phase.endDate, phase.description ?? null, phase.status ?? 'Active').run();
    return c.json({ id, ...phase });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.patch('/audit-phases/:id', requireRoles('Admin'), async (c) => {
  const id = c.req.param('id');
  const updates = await c.req.json();
  const fields = [];
  const values = [];
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.startDate !== undefined) { fields.push('start_date = ?'); values.push(updates.startDate); }
  if (updates.endDate !== undefined) { fields.push('end_date = ?'); values.push(updates.endDate); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (fields.length === 0) return c.json({ success: true });
  try {
    await c.env.DB.prepare(`UPDATE audit_phases SET ${fields.join(', ')} WHERE id = ?`).bind(...values, id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.delete('/audit-phases/:id', requireRoles('Admin'), async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM audit_phases WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// KPI Tiers
db.get('/kpi-tiers', edgeCache(300), async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM kpi_tiers').all();
    return c.json((results || []).map((t: any) => ({
      ...t,
      minAssets: t.min_assets
    })));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/kpi-tiers', requireRoles('Admin'), async (c) => {
  const tier = await c.req.json();
  const id = tier.id || crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      'INSERT INTO kpi_tiers (id, name, min_assets, description) VALUES (?, ?, ?, ?)'
    ).bind(id, tier.name, tier.minAssets ?? 0, tier.description ?? null).run();
    return c.json({ id, ...tier });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.patch('/kpi-tiers/:id', requireRoles('Admin'), async (c) => {
  const id = c.req.param('id');
  const updates = await c.req.json();
  const fields = [];
  const values = [];
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.minAssets !== undefined) { fields.push('min_assets = ?'); values.push(updates.minAssets); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (fields.length === 0) return c.json({ success: true });
  try {
    await c.env.DB.prepare(`UPDATE kpi_tiers SET ${fields.join(', ')} WHERE id = ?`).bind(...values, id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.delete('/kpi-tiers/:id', requireRoles('Admin'), async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM kpi_tiers WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// KPI Tier Targets
db.get('/kpi-tier-targets', edgeCache(300), async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM kpi_tier_targets').all();
    return c.json((results || []).map((t: any) => ({
      id: t.id,
      tierId: t.tier_id,
      phaseId: t.phase_id,
      targetPercentage: t.target_percentage
    })));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/kpi-tier-targets', requireRoles('Admin'), async (c) => {
  const target = await c.req.json();
  const id = target.id || crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      'INSERT INTO kpi_tier_targets (id, tier_id, phase_id, target_percentage) VALUES (?, ?, ?, ?) ON CONFLICT(tier_id, phase_id) DO UPDATE SET target_percentage=excluded.target_percentage'
    ).bind(id, target.tierId, target.phaseId, target.targetPercentage).run();
    return c.json({ id, ...target });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.delete('/kpi-tier-targets/:id', requireRoles('Admin'), async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM kpi_tier_targets WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Audit Groups
db.get('/audit-groups', edgeCache(300), async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM audit_groups').all();
    return c.json(results);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/audit-groups', requireRoles('Admin', 'Coordinator'), async (c) => {
  const group = await c.req.json();
  const id = group.id || crypto.randomUUID();
  try {
    await c.env.DB.prepare('INSERT INTO audit_groups (id, name, description) VALUES (?, ?, ?)').bind(id, group.name, group.description ?? null).run();
    return c.json({ id, ...group });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.patch('/audit-groups/:id', requireRoles('Admin', 'Coordinator'), async (c) => {
  const id = c.req.param('id');
  const updates = await c.req.json();
  const fields = [];
  const values = [];
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (fields.length === 0) return c.json({ success: true });
  try {
    await c.env.DB.prepare(`UPDATE audit_groups SET ${fields.join(', ')} WHERE id = ?`).bind(...values, id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.delete('/audit-groups/:id', requireRoles('Admin'), async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM audit_groups WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Institution KPI Targets
db.get('/institution-kpi-targets', edgeCache(300), async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM institution_kpi_targets').all();
    return c.json((results || []).map((k: any) => ({
      ...k,
      phaseId: k.phase_id,
      targetPercentage: k.target_percentage,
    })));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/institution-kpi-targets', requireRoles('Admin'), async (c) => {
  const target = await c.req.json();
  try {
    await c.env.DB.prepare(
      'INSERT INTO institution_kpi_targets (phase_id, target_percentage) VALUES (?, ?) ON CONFLICT(phase_id) DO UPDATE SET target_percentage=EXCLUDED.target_percentage'
    ).bind(target.phaseId, target.targetPercentage).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Buildings — KV read-through cache ──────────────────────────────────────
// Buildings change very rarely. We cache the full list in KV (1h) and
// invalidate immediately on any write so readers always get fresh data.
const KV_BUILDINGS = 'buildings';
const KV_BUILDINGS_TTL = 3600; // 1 hour

async function buildingsFromKVorD1(c: any) {
  try {
    const cached = await c.env.SETTINGS.get(KV_BUILDINGS, { cacheTtl: 60 });
    if (cached) return JSON.parse(cached);
  } catch { /* KV unavailable */ }

  const { results } = await c.env.DB.prepare(
    'SELECT id, name, abbr, description, created_at FROM buildings ORDER BY name',
  ).all();
  const mapped = (results || []).map((b: any) => ({ ...b, createdAt: b.created_at }));

  try {
    await c.env.SETTINGS.put(KV_BUILDINGS, JSON.stringify(mapped), {
      expirationTtl: KV_BUILDINGS_TTL,
    });
  } catch { /* KV write failure is non-fatal */ }

  return mapped;
}
// ─────────────────────────────────────────────────────────────────────────────

db.get('/buildings', async (c) => {
  try {
    return c.json(await buildingsFromKVorD1(c));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/buildings', requireRoles('Admin', 'Coordinator'), zValidator('json', z.object({
  id:          z.string().optional(),
  name:        z.string().min(1),
  abbr:        z.string().min(1),
  description: z.string().nullable().optional(),
})), async (c) => {
  const building = c.req.valid('json');
  const id = building.id || crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      'INSERT INTO buildings (id, name, abbr, description) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name, abbr=EXCLUDED.abbr, description=EXCLUDED.description',
    ).bind(id, building.name, building.abbr, building.description ?? null).run();

    // Invalidate KV cache so next read fetches from D1
    await c.env.SETTINGS.delete(KV_BUILDINGS).catch(() => {});

    const b = await c.env.DB.prepare('SELECT * FROM buildings WHERE id = ?').bind(id).first<any>();
    return c.json({ ...b, createdAt: b?.created_at });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.patch('/buildings/:id', requireRoles('Admin', 'Coordinator'), zValidator('json', z.object({
  name:        z.string().min(1).optional(),
  abbr:        z.string().min(1).optional(),
  description: z.string().nullable().optional(),
})), async (c) => {
  const id      = c.req.param('id');
  const updates = c.req.valid('json');
  const fields: string[] = [];
  const values: any[]   = [];
  if (updates.name        !== undefined) { fields.push('name = ?');        values.push(updates.name); }
  if (updates.abbr        !== undefined) { fields.push('abbr = ?');        values.push(updates.abbr); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (fields.length === 0) return c.json({ success: true });
  try {
    await c.env.DB.prepare(`UPDATE buildings SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values, id).run();
    await c.env.SETTINGS.delete(KV_BUILDINGS).catch(() => {});
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.delete('/buildings/:id', requireRoles('Admin'), async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM buildings WHERE id = ?').bind(id).run();
    await c.env.SETTINGS.delete(KV_BUILDINGS).catch(() => {});
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// System Settings (SQL version for persistence if KV is for volatile)
db.get('/system-settings', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM system_settings').all();
    return c.json((results || []).map((s: any) => ({
      id: s.id,
      value: s.value,
      updatedAt: s.updated_at
    })));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/system-settings/:id', requireRoles('Admin'), async (c) => {
  const id = c.req.param('id');
  const { value } = await c.req.json();
  try {
    await c.env.DB.prepare(
      'INSERT INTO system_settings (id, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at'
    ).bind(id, JSON.stringify(value), new Date().toISOString()).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// System Activity
db.get('/activity', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM system_activities ORDER BY timestamp DESC LIMIT 100').all();
    return c.json((results || []).map((a: any) => ({
      ...a,
      userId: a.user_id,
      metadata: a.metadata ? JSON.parse(a.metadata) : {}
    })));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

db.post('/activity', async (c) => {
  const activity = await c.req.json();
  const id = crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      'INSERT INTO system_activities (id, type, user_id, message, metadata) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      id,
      activity.type || activity.action, // Support both naming variants if any
      activity.userId,
      activity.message || '',
      JSON.stringify(activity.metadata || {})
    ).run();
    return c.json({ id, ...activity });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export const dbRoutes = db;
