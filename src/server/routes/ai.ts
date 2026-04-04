import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { Bindings, Variables } from '../types';

const ai = new Hono<{ Bindings: Bindings, Variables: Variables }>();

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

// Strip markdown code fences that some models wrap JSON in
const stripFences = (text: string) => text.trim().replace(/^```json\n?|\n?```$/g, '').trim();

ai.post('/analyze', zValidator('json', z.object({ schedules: z.array(z.any()) })), async (c) => {
  const { schedules } = c.req.valid('json');
  const activeSchedules = schedules.filter((s: any) => s.status !== 'Completed');
  const scheduleText = activeSchedules.map((s: any) =>
    `- [${s.date || 'Unscheduled'}] ${s.departmentId} (${s.locationId}): ${
      !s.auditor1Id && !s.auditor2Id ? 'NO AUDITORS' :
      (s.auditor1Id ? '1' : '0') + (s.auditor2Id ? '+1' : '') + ' assigned'
    }`
  ).join('\n');

  try {
    const result = await c.env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: 'You are a Movable Asset Inspection Analyst. Respond with valid JSON only, no markdown fences.' },
        { role: 'user', content: `Analyze the following inspection schedule (Pending/In Progress). Today is ${new Date().toISOString().split('T')[0]}.

Identify:
1. Immediate Risks: Unassigned slots for upcoming dates.
2. Bottlenecks: Departments with disproportionately high pending counts.
3. Compliance Gaps: Locations with zero inspecting officers assigned.

Return ONLY a JSON object:
{ "summary": "<1-sentence risk level summary>", "recommendations": ["<action 1>", "<action 2>", "<action 3>"] }

Data:
${scheduleText}` }
      ]
    }) as { response: string };

    const parsed = JSON.parse(stripFences(result.response));
    return c.json({
      summary: parsed.summary || 'Analysis complete.',
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
    });
  } catch {
    return c.json({
      summary: 'The AI assistant is currently offline.',
      recommendations: ['Check manual schedule for conflicts.', 'Ensure all high-priority locations have auditors.', 'Verify certification status of team members.']
    });
  }
});

ai.post('/search', zValidator('json', z.object({ query: z.string(), validDepartments: z.array(z.string()) })), async (c) => {
  const { query, validDepartments } = c.req.valid('json');

  try {
    const result = await c.env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: 'You are a search query parser. Respond with valid JSON only, no markdown fences.' },
        { role: 'user', content: `Map this search query to filters.

Query: "${query}"
Valid departments: ${JSON.stringify(validDepartments)}

Rules:
- department: match exactly one from the list or "All"
- status: "Pending", "In Progress", "Completed", or "All"
- text: any specific name or location mentioned

Return ONLY: { "department": "...", "status": "...", "text": "..." }` }
      ]
    }) as { response: string };

    return c.json(JSON.parse(stripFences(result.response)));
  } catch {
    return c.json({ department: 'All', status: 'All', text: query });
  }
});

ai.post('/report', zValidator('json', z.object({ audit: z.any() })), async (c) => {
  const { audit } = c.req.valid('json');

  try {
    const result = await c.env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: 'You are a formal document writer for government asset inspections. Use plain text only, no markdown.' },
        { role: 'user', content: `Generate a formal "Movable Asset Inspection Report" for this completed inspection.

Context:
- Location: ${audit.locationId}
- Department: ${audit.departmentId}
- Date Completed: ${audit.date}
- Auditors: ${audit.auditor1Id || 'N/A'} and ${audit.auditor2Id || 'N/A'}
- Supervisor (Site): ${audit.supervisorId}
- ID: ${audit.id}

Format:
- Start with "OFFICIAL MOVABLE ASSET INSPECTION RECORD" as the header.
- Include a "Certification Statement" declaring the assets verified.
- Include a "Scope of Verification" section.
- End with a "Digital Signature" placeholder.
- Highly professional, bureaucratic tone. Plain text only, no bold or italics.` }
      ]
    }) as { response: string };

    return c.json({ report: result.response || 'Report generation failed.' });
  } catch (err) {
    console.error('Report generation failed:', err);
    return c.json({ report: 'Error: Could not generate report at this time.' }, 500);
  }
});

export const aiRoutes = ai;
