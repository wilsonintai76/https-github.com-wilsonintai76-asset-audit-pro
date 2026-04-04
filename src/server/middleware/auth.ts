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

    // Verify domain restriction if configured
    if (user.email && !user.email.endsWith('@poliku.edu.my')) {
       // Optional: Log unauthorized attempt
       return c.json({ success: false, message: 'Institutional accounts only' }, 403);
    }

    // Attach user to context
    c.set('user', {
      id: user.id,
      email: user.email || '',
      role: (user.user_metadata?.role as string) || 'Staff',
      ...user.user_metadata
    });

    await next();
  } catch (err) {
    console.error('Middleware Exception:', err);
    return c.json({ success: false, message: 'Internal Server Error' }, 500);
  }
};
