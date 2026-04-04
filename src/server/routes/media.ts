import { Hono } from 'hono';
import { cache } from 'hono/cache';
import { Bindings, Variables } from '../types';

const media = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /api/media/:key - Get image from R2
// R2 supplies a native httpEtag; we also add Cache-Control for browser + CDN caching.
media.get('/:key', async (c) => {
  const key = c.req.param('key');
  const object = await c.env.MEDIA.get(key);

  if (!object) {
    return c.notFound();
  }

  const headers = new Headers();
  if (object && 'writeHttpMetadata' in object) {
    (object as any).writeHttpMetadata(headers);
  }
  if (object && 'httpEtag' in object) {
    headers.set('etag', (object as any).httpEtag);
  }
  // Images are immutable by name (timestamp-prefixed) — cache aggressively.
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  return c.body((object as any).body, 200, Object.fromEntries(headers.entries()));
});

// POST /api/media/upload - Upload image to R2
media.post('/upload', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'] as File;

  if (!file) {
    return c.json({ error: 'No file uploaded' }, 400);
  }

  const key = `${Date.now()}-${file.name}`;
  await c.env.MEDIA.put(key, file.stream() as any, {
    httpMetadata: { contentType: file.type },
  });

  return c.json({ key, url: `/api/media/${key}` });
});

// KV Settings Example — cache at the edge for 60 s (admin settings rarely change)
media.get('/settings/:key', cache({ cacheName: 'settings', cacheControl: 'public, max-age=60, s-maxage=60' }), async (c) => {
  const key = c.req.param('key');
  const value = await c.env.SETTINGS.get(key);
  return c.json({ [key]: value });
});

media.post('/settings/:key', async (c) => {
  const key = c.req.param('key');
  const { value } = await c.req.json();
  await c.env.SETTINGS.put(key, value);
  return c.json({ success: true });
});

export const mediaRoutes = media;
