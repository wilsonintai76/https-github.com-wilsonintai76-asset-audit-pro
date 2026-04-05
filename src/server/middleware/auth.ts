import { Context, Next } from 'hono';
import { Bindings, Variables } from '../types';

// ─── KV key prefixes ──────────────────────────────────────────────────────────
// sess:{userId}   → { sessionId: string }   — single-session registry (24h TTL)
// ucache:{userId} → { roles, departmentId } — user-role cache (5min TTL)
// ─────────────────────────────────────────────────────────────────────────────
const USER_CACHE_TTL = 300;        // 5 minutes — roles rarely change mid-session
const SESSION_TTL    = 86_400;     // 24 hours  — refreshed on every token renew

// ─── Embedded Supabase ES256 public key (P-256) ──────────────────────────────
// kid: db069a95-cddc-4d89-ba17-d069611907aa
const SUPABASE_JWK: JsonWebKey = {
  kty: 'EC', crv: 'P-256', alg: 'ES256',
  x: '7DQTDIFuZB3YwEDUSl7ILk5MBw_0VDCb12geHCZBvCM',
  y: 'NaccbHTfagGztZCVmorQoykjZCH9y8JbVhIQBChRUZQ',
  key_ops: ['verify'],
};
const SUPABASE_JWK_KID = 'db069a95-cddc-4d89-ba17-d069611907aa';

// Lazily imported once per isolate lifetime
let _es256Key: CryptoKey | null = null;
async function getEs256Key(): Promise<CryptoKey> {
  if (!_es256Key) {
    _es256Key = await crypto.subtle.importKey(
      'jwk', SUPABASE_JWK,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false, ['verify'],
    );
  }
  return _es256Key;
}

function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

/**
 * Verifies a Supabase JWT — supports both:
 *   ES256 (new projects, P-256 ECC)  — verified via embedded public key
 *   HS256 (legacy projects)          — verified via base64-decoded JWT secret
 */
export async function verifySupabaseJwt(
  token: string,
  secret: string,
  supabaseUrl?: string,
): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/'))) as { alg?: string; kid?: string };
    const alg = header.alg ?? 'HS256';
    const sig = b64urlToBytes(signatureB64);
    const sigInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

    let valid = false;

    if (alg === 'ES256') {
      // New Supabase: asymmetric P-256 — use embedded public key
      const cryptoKey = await getEs256Key();
      valid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        cryptoKey,
        sig,
        sigInput,
      );
    } else if (alg === 'HS256') {
      // Legacy Supabase: symmetric HS256 — base64-decode secret → key bytes
      const keyBytes = Uint8Array.from(atob(secret), c => c.charCodeAt(0));
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['verify'],
      );
      valid = await crypto.subtle.verify('HMAC', cryptoKey, sig, sigInput);
    } else {
      return null;
    }

    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload as Record<string, unknown>;
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

  // 1. JWT verification — ES256 via JWKS or HS256 via secret
  const payload = await verifySupabaseJwt(token, c.env.SUPABASE_JWT_SECRET, c.env.SUPABASE_URL);
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
