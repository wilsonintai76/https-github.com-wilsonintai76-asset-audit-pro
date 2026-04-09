import { Hono } from 'hono';
import { Bindings, Variables } from '../types';

const pub = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * GET /api/public/stats
 *
 * Unauthenticated endpoint that returns aggregated stats for the landing page.
 * Responses are edge-cached by Cloudflare for 5 minutes (300 s) so D1 is
 * queried at most once per 5 minutes regardless of traffic — zero auth overhead,
 * negligible Worker CPU cost.
 */
pub.get('/stats', async (c) => {
  try {
    const db = c.env.DB;

    // Run all queries in parallel via D1 batch
    const [
      assetsRow,
      auditsRow,
      phasesResult,
      activitiesResult,
      deptAuditsResult,
    ] = await db.batch([
      // Total assets across all non-exempted departments
      db.prepare(`
        SELECT COALESCE(SUM(l.total_assets), 0) AS total 
        FROM locations l
        JOIN departments d ON l.department_id = d.id
      `),
      // Audit compliance counts
      db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed FROM audit_schedules`),
      // All phases ordered by start date
      db.prepare(`SELECT id, name, start_date, end_date FROM audit_phases ORDER BY start_date ASC LIMIT 10`),
      // 5 most recent system activity messages (column is `timestamp`, not `created_at`)
      db.prepare(`SELECT type, message, timestamp FROM system_activities ORDER BY timestamp DESC LIMIT 5`),
      // Per-department audit compliance for top performers
      db.prepare(`
        SELECT d.name,
               COUNT(a.id)                                                         AS total,
               SUM(CASE WHEN a.status = 'Completed' THEN 1 ELSE 0 END)            AS completed,
               (SELECT COALESCE(SUM(l.total_assets), 0) FROM locations l WHERE l.department_id = d.id) AS real_total_assets
        FROM departments d
        LEFT JOIN audit_schedules a ON a.department_id = d.id
        WHERE d.is_exempted = 0 
        GROUP BY d.id, d.name
        HAVING total > 0 AND real_total_assets > 0
        ORDER BY (CAST(completed AS REAL) / total) DESC, total DESC
        LIMIT 3
      `),
    ]);

    const totalAssets = (assetsRow.results?.[0] as any)?.total ?? 0;

    const auditRow = auditsRow.results?.[0] as any;
    const totalAudits = auditRow?.total ?? 0;
    const completedAudits = auditRow?.completed ?? 0;
    const complianceProgress = totalAudits > 0 ? Math.round((completedAudits / totalAudits) * 100) : 0;

    const phases = (phasesResult.results ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      startDate: p.start_date,
      endDate: p.end_date,
    }));

    const activities = (activitiesResult.results ?? []).map((a: any) => ({
      type: a.type,
      message: a.message,
      createdAt: a.timestamp,
    }));

    const topDepartments = (deptAuditsResult.results ?? []).map((d: any) => ({
      name: d.name,
      compliance: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
    }));

    // Edge cache: Cloudflare caches this response for 5 minutes across all
    // requests hitting the same CF datacenter, so D1 is rarely queried.
    c.header('Cache-Control', 'public, max-age=300, s-maxage=300');

    return c.json({
      totalAssets,
      totalPhases: phases.length,
      complianceProgress,
      phases,
      activities,
      topDepartments,
    });
  } catch (err: any) {
    console.error('[Public Stats] Error:', err);
    // Return empty payload so the landing page still renders gracefully
    return c.json({
      totalAssets: 0,
      totalPhases: 0,
      complianceProgress: 0,
      phases: [],
      activities: [],
      topDepartments: [],
    });
  }
});

export { pub as publicRoutes };
