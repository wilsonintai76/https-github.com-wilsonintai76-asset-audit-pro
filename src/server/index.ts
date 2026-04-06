import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { requestId } from 'hono/request-id';
import { timing } from 'hono/timing';
import { dbRoutes } from './routes/db';
import { aiRoutes } from './routes/ai';
import { mediaRoutes } from './routes/media';
import { computeRoutes } from './routes/compute';
import { authRoutes } from './routes/auth';
import { publicRoutes } from './routes/public';
import { Bindings, Variables } from './types';
import { authMiddleware } from './middleware/auth';
import { domainGuard } from './middleware/domainGuard';
import { backupD1ToR2 } from './services/backupService';

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>().basePath('/api');

// ─── Global Middleware ───────────────────────────────────────────────────────
app.use('*', requestId());
app.use('*', logger());
app.use('*', timing());
app.use('*', secureHeaders());
app.use('*', cors({
  origin: (origin) => {
    const allowed = [
      'https://inspect-able.pages.dev',
      'http://localhost:5173',
      'http://localhost:3000',
    ];
    return allowed.includes(origin) ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposeHeaders: ['X-Request-Id', 'Server-Timing'],
  credentials: true,
  maxAge: 600,
}));
// ────────────────────────────────────────────────────────────────────────────

// ─── Global Error Handlers ───────────────────────────────────────────────────
app.onError((err, c) => {
  const requestIdVal = c.get('requestId' as any);
  console.error(`[Error] requestId=${requestIdVal}`, err);
  return c.json({ success: false, error: err.message }, 500);
});

app.notFound((c) => c.json({ success: false, error: 'Route not found' }, 404));
// ────────────────────────────────────────────────────────────────────────────

// Public routes (no auth required)
app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));
app.route('/public', publicRoutes);

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

// Protected routes — auth → domain guard applied in order
app.use('/db/*', authMiddleware, domainGuard);
app.use('/ai/*', authMiddleware, domainGuard);
app.use('/compute/*', authMiddleware, domainGuard);

const routes = app.route('/db', dbRoutes)
  .route('/ai', aiRoutes)
  .route('/media', mediaRoutes)
  .route('/compute', computeRoutes)
  .route('/auth', authRoutes)
  .route('/public', publicRoutes);

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
