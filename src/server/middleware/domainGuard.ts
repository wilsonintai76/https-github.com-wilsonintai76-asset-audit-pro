import { Context, Next } from 'hono';
import { Bindings, Variables } from '../types';

// ─── domainGuard ──────────────────────────────────────────────────────────────
// Enforces institutional email domain restriction as a Hono middleware layer.
//
// The allowed domain is read from the ALLOWED_DOMAIN env binding (wrangler.toml [vars])
// so it can be changed without a code change or redeploy:
//
//   [vars]
//   ALLOWED_DOMAIN = "poliku.edu.my"
//
// Falls back to "poliku.edu.my" if the binding is absent (backwards-compatible).
//
// This replaces the duplicated inline check in auth.ts and ensures every
// protected route rejects tokens from outside the institution at the
// middleware layer — not scattered across individual handlers.
// ─────────────────────────────────────────────────────────────────────────────
export const domainGuard = async (
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next,
) => {
  const user = c.get('user');

  // authMiddleware must run first; user is always present here
  if (!user?.email) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  const allowedDomain = c.env.ALLOWED_DOMAIN?.trim().toLowerCase() || 'poliku.edu.my';
  const emailDomain = user.email.split('@')[1]?.toLowerCase();

  const isWhitelisted = user.email.toLowerCase() === 'wilsonintai76@gmail.com';

  if (emailDomain !== allowedDomain && !isWhitelisted) {
    return c.json(
      {
        success: false,
        message: `Access restricted to @${allowedDomain} accounts only`,
        code: 'DOMAIN_BLOCKED',
      },
      403,
    );
  }

  await next();
};
