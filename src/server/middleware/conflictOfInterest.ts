import { Context, Next } from 'hono';
import { Bindings, Variables } from '../types';
import { hasPermissionInContext } from './rbac';

// ─── auditAssignmentGuard ─────────────────────────────────────────────────────
// Enforces two business rules on any request that sets auditor1Id / auditor2Id:
//
//  Rule 1 — Self-assignment only (for non-privileged roles):
//    Users without 'edit:audit:assign:others' (i.e. Auditors, Supervisors)
//    may only place their OWN id into an auditor slot.
//
//  Rule 2 — Conflict of interest (applies to ALL roles including Admin):
//    a) An auditor cannot be assigned to audit their own department.
//    b) An auditor can only be assigned to a department that has an active
//       cross_audit_permissions entry linking their department to the target.
//
// Assumes zValidator has already run (body is at c.req.valid('json')).
// Works for both POST /audits (new) and PATCH /audits/:id (updates).
// ─────────────────────────────────────────────────────────────────────────────
export const auditAssignmentGuard = async (
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next,
) => {
  // Grab already-validated body (zValidator runs before this middleware)
  const updates = (c.req as any).valid('json') as {
    auditor1Id?: string | null;
    auditor2Id?: string | null;
    departmentId?: string | null;
  };

  // Collect only the auditor IDs that are being explicitly set (non-null)
  const incomingAuditorIds = [updates.auditor1Id, updates.auditor2Id]
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  // Nothing to check if no auditor slot is being filled
  if (incomingAuditorIds.length === 0) {
    return next();
  }

  const caller = c.get('user')!;

  // ── Rule 1: Self-assignment enforcement ──────────────────────────────────
  const canAssignOthers = await hasPermissionInContext(c, 'edit:audit:assign:others');
  if (!canAssignOthers) {
    const illegalSlot = incomingAuditorIds.find(id => id !== caller.id);
    if (illegalSlot) {
      return c.json(
        { error: 'Forbidden: you may only assign yourself to an auditor slot' },
        403,
      );
    }
  }

  // ── Resolve the audit's target department ────────────────────────────────
  // For PATCH: fetch existing departmentId from DB if not overridden in body
  // For POST:  departmentId will always be in the body
  let targetDeptId: string | null = updates.departmentId ?? null;

  if (!targetDeptId) {
    const auditId = c.req.param('id'); // undefined on POST, present on PATCH
    if (auditId) {
      const existing = await c.env.DB.prepare(
        'SELECT department_id FROM audit_schedules WHERE id = ?',
      )
        .bind(auditId)
        .first<{ department_id: string | null }>();
      targetDeptId = existing?.department_id ?? null;
    }
  }

  if (!targetDeptId) {
    // Cannot perform conflict check without a target department
    return next();
  }

  // ── Rule 2: Conflict of interest per auditor ─────────────────────────────
  const today = new Date().toISOString().split('T')[0];

  for (const auditorId of incomingAuditorIds) {
    const auditor = await c.env.DB.prepare(
      'SELECT department_id, certification_expiry FROM users WHERE id = ?',
    )
      .bind(auditorId)
      .first<{ department_id: string | null; certification_expiry: string | null }>();

    // ── Rule 2c: Certification expiry ─────────────────────────────────────
    // Mirrors the client-side check in App.tsx handleAssign — now enforced server-side.
    const certExpiry = auditor?.certification_expiry;
    if (!certExpiry || certExpiry < today) {
      return c.json(
        {
          error: 'Assignment blocked: the selected auditor does not hold a valid institutional certificate',
          code: 'CERT_EXPIRED',
        },
        403,
      );
    }

    const auditorDeptId = auditor?.department_id;
    if (!auditorDeptId) continue; // No dept set, cannot verify — allow

    // Rule 2a: Own-department block
    if (auditorDeptId === targetDeptId) {
      return c.json(
        {
          error: 'Conflict of interest: an auditor cannot be assigned to audit their own department',
          code: 'SELF_DEPARTMENT',
        },
        409,
      );
    }

    // Rule 2b: Cross-audit permission required
    // Checks both directed (A→B) and mutual (is_mutual=1 and B→A) permissions
    const perm = await c.env.DB.prepare(`
      SELECT id FROM cross_audit_permissions
      WHERE is_active = 1 AND (
        (auditor_dept_id = ? AND target_dept_id = ?)
        OR
        (is_mutual = 1 AND auditor_dept_id = ? AND target_dept_id = ?)
      )
      LIMIT 1
    `)
      .bind(auditorDeptId, targetDeptId, targetDeptId, auditorDeptId)
      .first<{ id: string }>();

    if (!perm) {
      return c.json(
        {
          error: "Conflict of interest: no active cross-audit permission exists between the auditor's department and the target department",
          code: 'NO_CROSS_PERMISSION',
        },
        403,
      );
    }
  }

  return next();
};
