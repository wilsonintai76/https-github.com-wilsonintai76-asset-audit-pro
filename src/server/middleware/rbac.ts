import { Context, Next } from 'hono';
import { Bindings, Variables } from '../types';

// ─── Default RBAC Matrix ─────────────────────────────────────────────────────
// Mirrors DEFAULT_RBAC_MATRIX in contexts/RBACContext.tsx (client-side).
// This is the server-side source-of-truth fallback when KV is unavailable.
// KV key: "rbac_matrix" in SETTINGS namespace overrides these defaults at runtime.
const DEFAULT_MATRIX: Record<string, string[]> = {
  'view:overview':               ['Admin', 'Coordinator', 'Supervisor', 'Auditor', 'Staff'],
  'view:schedule:all':           ['Admin', 'Coordinator'],
  'view:schedule:own':           ['Admin', 'Coordinator', 'Supervisor', 'Auditor', 'Staff'],
  'view:schedule:matrix':        ['Admin', 'Coordinator', 'Auditor'],
  'edit:audit:date':             ['Admin', 'Coordinator', 'Supervisor'],
  'edit:audit:assign':           ['Admin', 'Coordinator', 'Supervisor', 'Auditor'],
  'edit:audit:assign:others':    ['Admin', 'Coordinator'],
  'edit:audit:auto_assign':      ['Admin', 'Coordinator'],
  'view:audit:assigned':         ['Admin', 'Coordinator', 'Supervisor', 'Auditor', 'Staff'],
  'view:team:all':               ['Admin', 'Coordinator'],
  'view:team:own':               ['Admin', 'Coordinator', 'Supervisor'],
  'edit:team':                   ['Admin', 'Coordinator'],
  'manage:departments':          ['Admin', 'Coordinator'],
  'manage:locations':            ['Admin', 'Coordinator'],
  'manage:system':               ['Admin'],
  'view:admin:dashboard':        ['Admin'],
};

// ─── Immutable safety locks ───────────────────────────────────────────────────
// These permissions can never be removed from these roles via KV config.
const IMMUTABLE_GRANTS: Record<string, string[]> = {
  'manage:system':        ['Admin'],
  'view:admin:dashboard': ['Admin'],
  'edit:audit:assign':    ['Auditor'],
};

async function resolveMatrix(settings: Bindings['SETTINGS']): Promise<Record<string, string[]>> {
  let matrix = { ...DEFAULT_MATRIX };
  try {
    const raw = await settings.get('rbac_matrix', { cacheTtl: 300 });
    if (raw) {
      const overrides = JSON.parse(raw) as Record<string, string[]>;
      matrix = { ...matrix, ...overrides };
    }
  } catch {
    // KV unavailable — fall back to defaults silently
  }

  // Re-apply immutable grants so Admin can never lock themselves out
  for (const [permission, lockedRoles] of Object.entries(IMMUTABLE_GRANTS)) {
    matrix[permission] = [...new Set([...(matrix[permission] || []), ...lockedRoles])];
  }

  return matrix;
}

// ─── requirePermission ────────────────────────────────────────────────────────
// Usage: db.post('/departments', requirePermission('manage:departments'), handler)
// Reads the live RBAC matrix from KV (cached 5 min) and checks caller's roles.
export const requirePermission = (permission: string) =>
  async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
    const user = c.get('user');
    const userRoles: string[] = user?.roles || [];

    const matrix = await resolveMatrix(c.env.SETTINGS);
    const allowed = matrix[permission] || [];

    if (!userRoles.some(r => allowed.includes(r))) {
      return c.json(
        { error: `Forbidden: requires '${permission}' permission` },
        403,
      );
    }

    await next();
  };

// ─── hasPermissionInContext ───────────────────────────────────────────────────
// Helper for inline checks inside handlers (avoids a second KV read).
// Usage: const canAssignOthers = await hasPermissionInContext(c, 'edit:audit:assign:others');
export const hasPermissionInContext = async (
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  permission: string,
): Promise<boolean> => {
  const user = c.get('user');
  const userRoles: string[] = user?.roles || [];
  const matrix = await resolveMatrix(c.env.SETTINGS);
  const allowed = matrix[permission] || [];
  return userRoles.some(r => allowed.includes(r));
};
