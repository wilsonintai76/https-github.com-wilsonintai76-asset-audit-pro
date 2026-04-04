import { Context, Next } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings, Variables } from '../types';

/**
 * Middleware to verify Supabase JWT
 */
export const authMiddleware = async (c: Context<{ Bindings: Bindings, Variables: Variables }>, next: Next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, message: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('Auth Error:', error);
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    // Domain check is enforced by domainGuard middleware — see middleware/domainGuard.ts
    // Keeping a last-resort check here only for the /admin/backup route which bypasses domainGuard
    if (user.email && c.env.ALLOWED_DOMAIN && !user.email.toLowerCase().endsWith(`@${c.env.ALLOWED_DOMAIN.toLowerCase()}`)) {
      return c.json({ success: false, message: 'Institutional accounts only' }, 403);
    }

    // Fetch real roles + departmentId from D1 (source of truth)
    let roles: string[] = [user.user_metadata?.role || 'Staff'];
    let departmentId: string | null = null;
    try {
      const dbUser = await c.env.DB.prepare('SELECT roles, department_id FROM users WHERE id = ?')
        .bind(user.id)
        .first<{ roles: string; department_id: string | null }>();
      if (dbUser?.roles) {
        roles = JSON.parse(dbUser.roles);
      }
      departmentId = dbUser?.department_id ?? null;
    } catch {
      // If D1 query fails, fall back to metadata role — still authenticated
    }

    // Attach user to context
    c.set('user', {
      id: user.id,
      email: user.email || '',
      role: roles[0] || 'Staff',
      roles,
      departmentId,
      ...user.user_metadata
    });

    await next();
  } catch (err) {
    console.error('Middleware Exception:', err);
    return c.json({ success: false, message: 'Internal Server Error' }, 500);
  }
};
