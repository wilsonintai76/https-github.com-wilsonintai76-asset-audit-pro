import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { Bindings, Variables } from '../types';

const ai = new Hono<{ Bindings: Bindings, Variables: Variables }>();

const analyzeSchema = z.object({
  imageUrl: z.string().url().optional(),
  text: z.string().optional(),
});

ai.post('/analyze', zValidator('json', analyzeSchema), async (c) => {
  const { imageUrl, text } = c.req.valid('json');

  // Using Cloudflare Workers AI (Llama 3 or Vision model)
  // Note: For vision, we might need a specific model like @cf/assistant/vision
  // Here we use a general text model as a placeholder or Llama-3-8b
  
  const response = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
    messages: [
      { role: 'system', content: 'You are an asset inspection assistant.' },
      { role: 'user', content: text || 'Analyze this inspection data.' }
    ]
  });

  return c.json(response);
});

export const aiRoutes = ai;
