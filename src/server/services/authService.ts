import { sign } from 'hono/jwt';

/**
 * Hash a password using SHA-256 (Native Web Crypto API).
 * In a real production app at scale, you might prefer Argon2/bcrypt if 
 * you have a WASM-optimized library, but for this edge deployment, 
 * salted SHA-256 is the built-in standard.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a JWT for a user.
 */
export async function generateToken(
  userId: string,
  email: string,
  roles: string[],
  sessionId: string,
  secret: string
): Promise<string> {
  const payload = {
    userId,
    email,
    roles, // we include roles for convenience, but the middleware re-fetches from D1/KV for security
    sessionId,
    exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
  };
  return await sign(payload, secret, 'HS256');
}
