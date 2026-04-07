import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { Bindings, Variables } from '../types';
import { verifyNativeJwt } from '../middleware/auth';
import { hashPassword, generateToken } from '../services/authService';

// ─── Constants ────────────────────────────────────────────────────────────────
const SESSION_TTL  = 86_400; // 24 hours
const FORCE_LOGOUT = '__force_logout__';
// ─────────────────────────────────────────────────────────────────────────────

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Helper ───────────────────────────────────────────────────────────────────
async function requireJwt(c: any): Promise<{ userId: string; sessionId: string; roles: string[] } | null> {
  const token = c.req.header('Authorization')?.slice(7);
  if (!token) return null;
  const payload = await verifyNativeJwt(token, c.env.JWT_SECRET);
  if (!payload) return null;
  
  const userId = payload.userId as string;
  const sessionId = (payload.sessionId as string) || '';
  
  // Try to read roles from cache or DB
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
 * POST /api/auth/register
 * Institutional user registration.
 */
auth.post(
  '/register',
  zValidator('json', z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
  })),
  async (c) => {
    const { email, password, name } = c.req.valid('json');
    const normalizedEmail = email.toLowerCase();

    // 1. Domain Check (with explicit whitelist for the primary admin)
    const isWhitelisted = normalizedEmail === 'wilsonintai76@gmail.com';
    if (c.env.ALLOWED_DOMAIN && !normalizedEmail.endsWith(`@${c.env.ALLOWED_DOMAIN.toLowerCase()}`) && !isWhitelisted) {
      return c.json({ success: false, message: `Only accounts with @${c.env.ALLOWED_DOMAIN} are allowed.` }, 403);
    }

    // 2. Check if user already exists
    const existing = await c.env.DB
      .prepare('SELECT id, password_hash FROM users WHERE email = ?')
      .bind(normalizedEmail)
      .first<{ id: string; password_hash: string | null }>();
    
    // If user exists and already has a password, block registration
    if (existing && existing.password_hash) {
      return c.json({ success: false, message: 'An account with this email already exists.' }, 400);
    }

    // 3. Hash Password & Create/Update User
    const passwordHash = await hashPassword(password);
    const userId = existing?.id || crypto.randomUUID();
    const sessionId = crypto.randomUUID();

    // Auto-grant Admin roles if this is the very first user (bootstrapping)
    const { count } = (await c.env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE password_hash IS NOT NULL').first() as any) || { count: 0 };
    const shouldBeAdmin = count === 0 || normalizedEmail.includes('wilsonintai') || normalizedEmail.includes('admin');
    
    const roles = shouldBeAdmin 
      ? ['Admin', 'Coordinator', 'Supervisor', 'Staff'] 
      : ['Staff'];

    try {
      if (existing) {
        // Upgrade existing Supabase record to Native Auth
        await c.env.DB.prepare(
          'UPDATE users SET name = ?, password_hash = ?, roles = ?, status = ?, is_verified = ? WHERE id = ?'
        ).bind(
          name,
          passwordHash,
          JSON.stringify(roles),
          'Active',
          1,
          existing.id
        ).run();
      } else {
        // Create brand new record
        await c.env.DB.prepare(
          'INSERT INTO users (id, name, email, password_hash, roles, status, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          userId,
          name,
          normalizedEmail,
          passwordHash,
          JSON.stringify(roles),
          'Active',
          1
        ).run();
      }
    } catch (e: any) {
      return c.json({ success: false, message: 'Registration failed.', error: e.message }, 500);
    }

    // 4. Generate Token
    const token = await generateToken(userId, normalizedEmail, roles, sessionId, c.env.JWT_SECRET);

    // 5. Register Session
    await c.env.SETTINGS.put(
      `sess:${userId}`,
      JSON.stringify({ sessionId, registeredAt: new Date().toISOString(), device: 'native-reg' }),
      { expirationTtl: SESSION_TTL },
    );

    return c.json({
      success: true,
      token,
      user: { id: userId, email: normalizedEmail, name, roles }
    });
  }
);

/**
 * POST /api/auth/login
 * Native credential authentication.
 */
auth.post(
  '/login',
  zValidator('json', z.object({
    email: z.string().email(),
    password: z.string(),
  })),
  async (c) => {
    const { email, password } = c.req.valid('json');
    const normalizedEmail = email.toLowerCase();

    // 1. Fetch User Record
    const user = await c.env.DB
      .prepare('SELECT id, name, password_hash, roles, status FROM users WHERE email = ?')
      .bind(normalizedEmail)
      .first<{ id: string; name: string; password_hash: string; roles: string; status: string }>();

    if (!user || user.status === 'Suspended') {
      return c.json({ success: false, message: 'Invalid credentials or account suspended.' }, 401);
    }

    // 2. Verify Password
    const loginHash = await hashPassword(password);
    if (loginHash !== user.password_hash) {
      return c.json({ success: false, message: 'Invalid credentials.' }, 401);
    }

    // 3. Generate New Session & Token
    const sessionId = crypto.randomUUID();
    const roles = JSON.parse(user.roles);
    const token = await generateToken(user.id, normalizedEmail, roles, sessionId, c.env.JWT_SECRET);

    // 4. Register Session in KV
    await c.env.SETTINGS.put(
      `sess:${user.id}`,
      JSON.stringify({ sessionId, registeredAt: new Date().toISOString(), device: 'native-login' }),
      { expirationTtl: SESSION_TTL },
    );

    return c.json({
      success: true,
      token,
      user: { id: user.id, email: normalizedEmail, name: user.name, roles }
    });
  }
);

/**
 * PATCH /api/auth/password-reset
 * Admin-only: Force reset a staff member's password.
 */
auth.patch(
  '/password-reset',
  zValidator('json', z.object({
    userId: z.string(),
    newPassword: z.string().min(8),
  })),
  async (c) => {
    const info = await requireJwt(c);
    if (!info || !info.roles.includes('Admin')) {
      return c.json({ success: false, message: 'Forbidden: Admin only' }, 403);
    }

    const { userId, newPassword } = c.req.valid('json');
    const passwordHash = await hashPassword(newPassword);

    await c.env.DB
      .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .bind(passwordHash, userId)
      .run();

    // Force displacement of all active sessions for this user
    await c.env.SETTINGS.put(
      `sess:${userId}`,
      JSON.stringify({ sessionId: FORCE_LOGOUT, forcedAt: new Date().toISOString(), by: info.userId }),
      { expirationTtl: SESSION_TTL },
    );

    return c.json({ success: true, message: 'Password reset successfully.' });
  }
);

/**
 * POST /api/auth/session
 * Keep compatibility for session management logic.
 */
auth.post(
  '/session',
  zValidator('json', z.object({ deviceHint: z.string().max(128).optional() })),
  async (c) => {
    const info = await requireJwt(c);
    if (!info) return c.json({ success: false, message: 'Unauthorized' }, 401);

    const { userId, sessionId } = info;
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
 * GET /api/auth/me
 * Returns the current user profile.
 */
auth.get('/me', async (c) => {
  const info = await requireJwt(c);
  if (!info) return c.json({ success: false, message: 'Unauthorized' }, 401);

  const user = await c.env.DB
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(info.userId)
    .first();

  if (!user) return c.json({ success: false, message: 'User not found' }, 404);

  return c.json({ success: true, user });
});

export { auth as authRoutes };
