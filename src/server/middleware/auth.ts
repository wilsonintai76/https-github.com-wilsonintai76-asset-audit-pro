import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { Bindings, Variables } from '../types';

// ─── KV key prefixes ──────────────────────────────────────────────────────────
// sess:{userId}   → { sessionId: string }   — single-session registry (24h TTL)
// ucache:{userId} → { roles, departmentId } — user-role cache (5min TTL)
// ─────────────────────────────────────────────────────────────────────────────
const USER_CACHE_TTL = 300;        // 5 minutes — roles rarely change mid-session
const SESSION_TTL    = 86_400;     // 24 hours  — refreshed on every token renew

/**
 * Verifies the Supabase JWT locally (HS256) — zero network round-trips.
 * Returns the raw payload or null on failure.
 */
export async function verifySupabaseJwt(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  try {
    return await verify(token, secret, 'HS256') as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Full auth middleware — verifies JWT, enforces single-session via KV, loads
 * user roles from KV cache (→ D1 fallback).  Applied to /db/*, /ai/*, /compute/*
 */
export const authMiddleware = async (
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next,
) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, message: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);

  // 1. Local JWT verification — no Supabase API call
  const payload = await verifySupabaseJwt(token, c.env.SUPABASE_JWT_SECRET);
  if (!payload) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  const userId    = payload.sub as string;
  const email     = (payload.email as string) || '';
  // session_id stays constant across token refreshes within the same login session
  const sessionId = (payload.session_id as string) || '';

  if (!userId) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  // 2. Domain check (last-resort — domainGuard covers /db, /ai, /compute)
  if (email && c.env.ALLOWED_DOMAIN && !email.toLowerCase().endsWith(`@${c.env.ALLOWED_DOMAIN.toLowerCase()}`)) {
    return c.json({ success: false, message: 'Institutional accounts only' }, 403);
  }

  // 3. Single-session enforcement via KV
  //    Only enforced when the client has registered a session (POST /api/auth/session).
  //    If no entry exists the request is let through (grace-period for first login).
  if (sessionId) {
    try {
      const stored = await c.env.SETTINGS.get(`sess:${userId}`);
      if (stored) {
        const { sessionId: storedSid } = JSON.parse(stored) as { sessionId: string };
        if (storedSid !== sessionId) {
          return c.json(
            {
              success: false,
              message: 'Session displaced — your account was signed in from another location.',
              code: 'SESSION_DISPLACED',
            },
            401,
          );
        }
      }
    } catch {
      // KV unavailable — fail open to avoid locking users out of a misconfigured worker
    }
  }

  // 4. Load user roles + departmentId — KV cache first, D1 fallback
  let roles: string[]       = [(payload.user_metadata as any)?.role || 'Staff'];
  let departmentId: string | null = null;

  try {
    const cached = await c.env.SETTINGS.get(`ucache:${userId}`, { cacheTtl: USER_CACHE_TTL });
    if (cached) {
      const parsed = JSON.parse(cached) as { roles: string[]; departmentId: string | null };
      roles = parsed.roles;
      departmentId = parsed.departmentId;
    } else {
      // D1 query — only happens on cold fetch (every 5 min per user)
      const dbUser = await c.env.DB
        .prepare('SELECT roles, department_id FROM users WHERE id = ?')
        .bind(userId)
        .first<{ roles: string; department_id: string | null }>();

      if (dbUser?.roles) roles = JSON.parse(dbUser.roles);
      departmentId = dbUser?.department_id ?? null;

      // Write through to KV
      await c.env.SETTINGS.put(
        `ucache:${userId}`,
        JSON.stringify({ roles, departmentId }),
        { expirationTtl: USER_CACHE_TTL },
      );
    }
  } catch {
    // D1 or KV unavailable — continue with metadata role
  }

  // 5. Populate context
  c.set('user', {
    id: userId,
    email,
    role: roles[0] || 'Staff',
    roles,
    departmentId,
    sessionId,
    ...(payload.user_metadata as object ?? {}),
  });

  await next();
};
