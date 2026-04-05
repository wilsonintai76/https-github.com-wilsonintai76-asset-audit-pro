import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { Bindings, Variables } from '../types';
import { verifySupabaseJwt } from '../middleware/auth';

// ─── Constants ────────────────────────────────────────────────────────────────
const SESSION_TTL  = 86_400; // 24 hours — refreshed on every TOKEN_REFRESHED event
const FORCE_LOGOUT = '__force_logout__';
// ─────────────────────────────────────────────────────────────────────────────

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Helper ───────────────────────────────────────────────────────────────────
async function requireJwt(c: any): Promise<{ userId: string; sessionId: string; roles: string[] } | null> {
  const token = c.req.header('Authorization')?.slice(7);
  if (!token) return null;
  const payload = await verifySupabaseJwt(token, c.env.SUPABASE_JWT_SECRET);
  if (!payload) return null;
  const userId = payload.sub as string;
  const sessionId = (payload.session_id as string) || '';
  // Try to read roles from ucache for admin check (best-effort)
  let roles: string[] = [];
  try {
    const cached = await c.env.SETTINGS.get(`ucache:${userId}`);
    if (cached) roles = (JSON.parse(cached) as { roles: string[] }).roles;
    else {
      const dbUser = await c.env.DB
        .prepare('SELECT roles FROM users WHERE id = ?')
        .bind(userId)
        .first() as { roles: string } | null;
      if (dbUser?.roles) roles = JSON.parse(dbUser.roles);
    }
  } catch { /* ignore */ }
  return { userId, sessionId, roles };
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/session
 * Called by the client immediately after SIGNED_IN and TOKEN_REFRESHED events.
 * Registers the current session_id in KV — any other device with a different
 * session_id will be served SESSION_DISPLACED on their next request.
 */
auth.post(
  '/session',
  zValidator('json', z.object({ deviceHint: z.string().max(128).optional() })),
  async (c) => {
    const info = await requireJwt(c);
    if (!info) return c.json({ success: false, message: 'Unauthorized' }, 401);

    const { userId, sessionId } = info;
    if (!sessionId) {
      // JWT has no session_id — cannot enforce single-session. Return 200 gracefully.
      return c.json({ success: true, enforced: false });
    }

    const { deviceHint } = c.req.valid('json');

    await c.env.SETTINGS.put(
      `sess:${userId}`,
      JSON.stringify({ sessionId, registeredAt: new Date().toISOString(), device: deviceHint ?? 'unknown' }),
      { expirationTtl: SESSION_TTL },
    );

    return c.json({ success: true, enforced: true });
  },
);

/**
 * DELETE /api/auth/session
 * Self-logout: removes the caller's session from KV and invalidates their
 * role cache so any stale data is evicted.
 * Called by the client as part of the logout flow BEFORE supabase.auth.signOut().
 */
auth.delete('/session', async (c) => {
  const info = await requireJwt(c);
  if (!info) return c.json({ success: false, message: 'Unauthorized' }, 401);

  const { userId } = info;
  await Promise.allSettled([
    c.env.SETTINGS.delete(`sess:${userId}`),
    c.env.SETTINGS.delete(`ucache:${userId}`),
  ]);

  return c.json({ success: true });
});

/**
 * DELETE /api/auth/session/:userId
 * Admin force-logout: writes a poison session_id for the target user, which
 * will cause their next authenticated request to return SESSION_DISPLACED.
 * Their session resets normally when they sign in again.
 */
auth.delete('/session/:userId', async (c) => {
  const info = await requireJwt(c);
  if (!info) return c.json({ success: false, message: 'Unauthorized' }, 401);
  if (!info.roles.includes('Admin')) {
    return c.json({ success: false, message: 'Forbidden: Admin only' }, 403);
  }

  const targetUserId = c.req.param('userId');
  if (!targetUserId) return c.json({ success: false, message: 'Missing userId' }, 400);

  await Promise.allSettled([
    // Poison value — won't match any real Supabase session_id UUID
    c.env.SETTINGS.put(
      `sess:${targetUserId}`,
      JSON.stringify({ sessionId: FORCE_LOGOUT, forcedAt: new Date().toISOString(), by: info.userId }),
      { expirationTtl: SESSION_TTL },
    ),
    // Evict role cache so re-login fetches fresh roles from D1
    c.env.SETTINGS.delete(`ucache:${targetUserId}`),
  ]);

  return c.json({ success: true });
});

export { auth as authRoutes };
