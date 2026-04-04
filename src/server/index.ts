import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { dbRoutes } from './routes/db';
import { aiRoutes } from './routes/ai';
import { mediaRoutes } from './routes/media';
import { Bindings, Variables } from './types';
import { authMiddleware } from './middleware/auth';
import { backupD1ToR2 } from './services/backupService';

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>().basePath('/api');

// Public routes
app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

// Manual backup trigger (Admin only)
app.post('/admin/backup', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!user?.roles?.includes('Admin') && !['Admin'].some(r => user?.role === r)) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  try {
    const result = await backupD1ToR2({ db: c.env.DB, bucket: c.env.BACKUP });
    return c.json({ success: true, ...result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Protected routes
app.use('/db/*', authMiddleware);
app.use('/ai/*', authMiddleware);

const routes = app.route('/db', dbRoutes)
  .route('/ai', aiRoutes)
  .route('/media', mediaRoutes);

export type AppType = typeof routes;

// Scheduled cron: Daily backup D1 → R2 at 02:00 UTC
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    console.log('[Cron] Starting D1 → R2 backup...');
    ctx.waitUntil(
      backupD1ToR2({ db: env.DB, bucket: env.BACKUP }).then((result) => {
        console.log(`[Cron] Backup complete: ${result.tablesSync} tables, ${result.rowsSync} rows → R2 key: ${result.key}`);
        if (result.errors.length > 0) {
          console.error('[Cron] Backup errors:', result.errors.join('; '));
        }
      }).catch((err) => {
        console.error('[Cron] Backup failed:', err);
      })
    );
  },
};
