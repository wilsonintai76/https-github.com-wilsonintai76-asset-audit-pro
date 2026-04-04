import { Hono } from 'hono';
import { Bindings, Variables } from '../types';

const media = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /api/media/:key - Get image from R2
media.get('/:key', async (c) => {
  const key = c.req.param('key');
  const object = await c.env.MEDIA.get(key);

  if (!object) {
    return c.notFound();
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  return c.body(object.body, 200, Object.fromEntries(headers.entries()));
});

// POST /api/media/upload - Upload image to R2
media.post('/upload', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'] as File;

  if (!file) {
    return c.json({ error: 'No file uploaded' }, 400);
  }

  const key = `${Date.now()}-${file.name}`;
  await c.env.MEDIA.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  return c.json({ key, url: `/api/media/${key}` });
});

// KV Settings Example
media.get('/settings/:key', async (c) => {
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
