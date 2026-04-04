import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { dbRoutes } from './routes/db';
import { aiRoutes } from './routes/ai';
import { mediaRoutes } from './routes/media';
import { Bindings, Variables } from './types';
import { authMiddleware } from './middleware/auth';

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>().basePath('/api');

// Public routes
app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

// Protected routes
app.use('/db/*', authMiddleware);
app.use('/ai/*', authMiddleware);

const routes = app.route('/db', dbRoutes)
  .route('/ai', aiRoutes)
  .route('/media', mediaRoutes);

export type AppType = typeof routes;

// Heartbeat for Supabase (Cron Trigger)
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    console.log('Running Supabase heartbeat...');
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Simple query to keep the DB alive
    const { data, error } = await supabase.from('_heartbeat').select('*').limit(1);
    if (error && error.code !== 'PGRST116') { // Ignore "no rows" errors
      console.error('Heartbeat failed:', error);
    } else {
      console.log('Heartbeat successful');
    }
  },
};
