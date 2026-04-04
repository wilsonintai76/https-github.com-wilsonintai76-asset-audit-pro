import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { Bindings, Variables } from '../types';
import { requirePermission } from '../middleware/rbac';

const compute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolves the KPI tier for a department by its % share of institution total assets. */
function resolveTier(
  deptTotalAssets: number,
  institutionTotalAssets: number,
  sortedTiers: { id: string; minAssets: number }[],
): { id: string; minAssets: number } | null {
  if (institutionTotalAssets === 0) return null;
  const pct = (deptTotalAssets / institutionTotalAssets) * 100;
  return (
    [...sortedTiers].filter((t) => pct >= t.minAssets).sort((a, b) => b.minAssets - a.minAssets)[0] ?? null
  );
}

/** Returns true when an audit_schedule is "locked" (date + at least one auditor set). */
function isLocked(a: { date: string | null; auditor1_id: string | null; auditor2_id: string | null }) {
  return !!(a.date && (a.auditor1_id || a.auditor2_id));
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/compute/kpi
// Computes KPI progress stats server-side (previously done in KPIStatsWidget.tsx
// via multiple useMemo hooks over data already fetched to the browser).
// Returns globalStats + tierStats for the current active phase.
// ─────────────────────────────────────────────────────────────────────────────
compute.get('/kpi', async (c) => {
  const db = c.env.DB;
  const today = new Date().toISOString().split('T')[0];

  // Fetch all required tables in parallel
  const [deptsResult, locsResult, schedulesResult, tiersResult, tierTargetsResult, phasesResult, instKPIsResult] =
    await Promise.all([
      db.prepare('SELECT id, name, total_assets FROM departments').all(),
      db.prepare('SELECT id, department_id, total_assets FROM locations').all(),
      db.prepare('SELECT location_id, department_id, phase_id, status FROM audit_schedules').all(),
      db.prepare('SELECT id, name, min_assets FROM kpi_tiers ORDER BY min_assets ASC').all(),
      db.prepare('SELECT tier_id, phase_id, target_percentage FROM kpi_tier_targets').all(),
      db.prepare('SELECT id, name, start_date, end_date FROM audit_phases ORDER BY start_date ASC').all(),
      db.prepare('SELECT phase_id, target_percentage FROM institution_kpi_targets').all(),
    ]);

  const depts = (deptsResult.results || []) as any[];
  const locs = (locsResult.results || []) as any[];
  const schedules = (schedulesResult.results || []) as any[];
  const tiers = (tiersResult.results || []) as any[];
  const tierTargets = (tierTargetsResult.results || []) as any[];
  const phases = (phasesResult.results || []) as any[];
  const instKPIs = (instKPIsResult.results || []) as any[];

  if (phases.length === 0) return c.json({ globalStats: null, tierStats: [], activePhase: null });

  // 1. Active phase = first phase whose date window contains today, else first chronologically
  const activePhase =
    phases.find((p: any) => p.start_date <= today && p.end_date >= today) ?? phases[0];

  // 2. Pre-compute lookup tables
  const locAssets: Record<string, number> = {};
  for (const l of locs) locAssets[l.id] = l.total_assets || 0;

  const institutionTotalAssets = depts.reduce((s: number, d: any) => s + (d.total_assets || 0), 0);

  // 3. Tier stats
  const tierStats = tiers.map((tier: any, idx: number) => {
    const deptsInTier = depts.filter((d: any) => {
      const assigned = resolveTier(d.total_assets || 0, institutionTotalAssets, tiers);
      return assigned?.id === tier.id;
    });

    const targetPct =
      tierTargets.find((kt: any) => kt.tier_id === tier.id && kt.phase_id === activePhase.id)?.target_percentage ?? 0;

    const deptDetails = deptsInTier.map((d: any) => {
      const total = d.total_assets || 0;
      const completedLocIds = schedules
        .filter((s: any) => s.department_id === d.id && s.phase_id === activePhase.id && s.status === 'Completed')
        .map((s: any) => s.location_id);
      const inspected = completedLocIds.reduce((sum: number, lid: string) => sum + (locAssets[lid] || 0), 0);
      const isZero = total === 0;
      const pct = isZero ? 100 : Math.round((inspected / total) * 100);
      return {
        id: d.id,
        name: d.name,
        assets: total,
        inspectedAssets: inspected,
        percentage: pct,
        status: isZero || pct >= targetPct ? 'On Track' : 'At Risk',
      };
    }).sort((a: any, b: any) => a.percentage - b.percentage);

    const totalTierAssets = deptsInTier.reduce((s: number, d: any) => s + (d.total_assets || 0), 0);
    const inspectedTierAssets = deptDetails.reduce((s: number, d: any) => s + d.inspectedAssets, 0);
    const actualPct = totalTierAssets > 0 ? Math.round((inspectedTierAssets / totalTierAssets) * 100) : 0;

    return {
      id: tier.id,
      name: tier.name,
      minAssets: tier.min_assets,
      isHighestTier: idx === tiers.length - 1,
      nextMin: tiers[idx + 1]?.min_assets ?? 100,
      departments: deptDetails,
      deptCount: deptsInTier.length,
      actualPercentage: actualPct,
      targetPercentage: targetPct,
      status: actualPct >= targetPct ? 'On Track' : 'At Risk',
    };
  });

  // 4. Global institutional stats
  const instTarget = instKPIs.find((k: any) => k.phase_id === activePhase.id)?.target_percentage ?? 0;
  const targetAssets = Math.ceil(institutionTotalAssets * instTarget / 100);
  const completedLocIds = new Set(
    schedules.filter((s: any) => s.phase_id === activePhase.id && s.status === 'Completed').map((s: any) => s.location_id),
  );
  const inspectedAssets = locs
    .filter((l: any) => completedLocIds.has(l.id))
    .reduce((sum: number, l: any) => sum + (l.total_assets || 0), 0);
  const actualGlobalPct =
    institutionTotalAssets > 0 ? Math.round((inspectedAssets / institutionTotalAssets) * 100) : 0;

  const globalStats = {
    totalInstitutionAssets: institutionTotalAssets,
    inspectedAssets,
    targetAssets,
    actualPercentage: actualGlobalPct,
    targetPercentage: instTarget,
    isOnTrack: actualGlobalPct >= instTarget,
  };

  return c.json({
    activePhase: { id: activePhase.id, name: activePhase.name, startDate: activePhase.start_date, endDate: activePhase.end_date },
    globalStats,
    tierStats,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/compute/rebalance
// Greedy phase-allocation scheduling algorithm (previously handleRebalanceSchedule
// in App.tsx — made 1 gateway call per dept per location, running entirely in browser).
// Reads all needed data from D1 in one pass, then writes results in D1 batch.
// ─────────────────────────────────────────────────────────────────────────────
compute.post(
  '/rebalance',
  requirePermission('manage:system'),
  async (c) => {
    const db = c.env.DB;

    const [deptsRes, locsRes, schedulesRes, tiersRes, tierTargetsRes, phasesRes] = await Promise.all([
      db.prepare('SELECT * FROM departments').all(),
      db.prepare('SELECT * FROM locations ORDER BY total_assets DESC').all(),
      db.prepare('SELECT * FROM audit_schedules').all(),
      db.prepare('SELECT * FROM kpi_tiers ORDER BY min_assets ASC').all(),
      db.prepare('SELECT * FROM kpi_tier_targets').all(),
      db.prepare('SELECT * FROM audit_phases ORDER BY start_date ASC').all(),
    ]);

    const depts = (deptsRes.results || []) as any[];
    const allLocs = (locsRes.results || []) as any[];
    const allAudits = (schedulesRes.results || []) as any[];
    const tiers = (tiersRes.results || []) as any[];
    const tierTargets = (tierTargetsRes.results || []) as any[];
    const phases = (phasesRes.results || []) as any[];

    const institutionTotalAssets = depts.reduce((s: number, d: any) => s + (d.total_assets || 0), 0) || 1;

    const newAuditRows: any[] = [];
    const phaseUpdates: { id: string; phaseId: string }[] = [];

    for (const dept of depts) {
      const totalAssets = dept.total_assets || 0;
      if (totalAssets === 0) continue;

      const tier = resolveTier(totalAssets, institutionTotalAssets, tiers);
      if (!tier) continue;

      // Incremental per-phase allocation targets from cumulative KPI %
      const phaseTargets = phases
        .map((p: any, idx: number) => {
          const kt = tierTargets.find((k: any) => k.tier_id === tier.id && k.phase_id === p.id);
          const cumulativePct = kt?.target_percentage ?? 0;
          const prevPhase = phases[idx - 1];
          const prevKt = prevPhase ? tierTargets.find((k: any) => k.tier_id === tier.id && k.phase_id === prevPhase.id) : null;
          const prevCumulativePct = prevKt?.target_percentage ?? 0;
          const incrementalPct = Math.max(0, cumulativePct - prevCumulativePct);
          return {
            phaseId: p.id,
            incrementalPct,
            targetAssets: Math.ceil(totalAssets * incrementalPct / 100),
          };
        })
        .filter((pt: any) => pt.incrementalPct > 0);

      if (phaseTargets.length === 0) continue;

      const deptLocs = allLocs.filter((l: any) => l.department_id === dept.id);
      if (deptLocs.length === 0) continue;

      const sumLocAssets = deptLocs.reduce((s: number, l: any) => s + (l.total_assets || 0), 0);
      const fallbackWeight = sumLocAssets === 0 ? Math.ceil(totalAssets / deptLocs.length) : 0;
      const locWeight = (l: any) => Math.max(1, (l.total_assets || 0) || fallbackWeight);

      const deptAudits = allAudits.filter((a: any) => a.department_id === dept.id);
      const lockedLocIds = new Set(deptAudits.filter((a: any) => isLocked(a)).map((a: any) => a.location_id));
      const unlockedLocs = deptLocs.filter((l: any) => !lockedLocIds.has(l.id));

      // Greedy phase fill
      const phaseHeld: Record<string, number> = {};
      const phaseAssignments: Record<string, string[]> = {};
      for (const pt of phaseTargets) { phaseHeld[pt.phaseId] = 0; phaseAssignments[pt.phaseId] = []; }

      for (const loc of unlockedLocs) {
        let assigned = false;
        for (const pt of phaseTargets) {
          if (phaseHeld[pt.phaseId] < pt.targetAssets) {
            phaseAssignments[pt.phaseId].push(loc.id);
            phaseHeld[pt.phaseId] += locWeight(loc);
            assigned = true;
            break;
          }
        }
        if (!assigned) {
          const last = phaseTargets[phaseTargets.length - 1];
          phaseAssignments[last.phaseId].push(loc.id);
        }
      }

      for (const [phaseId, locIds] of Object.entries(phaseAssignments)) {
        for (const locId of locIds) {
          const loc = allLocs.find((l: any) => l.id === locId);
          const existing = deptAudits.find((a: any) => a.location_id === locId && !isLocked(a));
          if (existing) {
            if (existing.phase_id !== phaseId) phaseUpdates.push({ id: existing.id, phaseId });
          } else {
            newAuditRows.push({
              id: crypto.randomUUID(),
              department_id: dept.id,
              location_id: locId,
              supervisor_id: loc?.supervisor_id || null,
              phase_id: phaseId,
              status: 'Pending',
              auditor1_id: null,
              auditor2_id: null,
              date: null,
            });
          }
        }
      }
    }

    // Write all changes in D1 batches
    const statements: any[] = [];

    for (const r of newAuditRows) {
      statements.push(
        db.prepare(
          `INSERT INTO audit_schedules (id, department_id, location_id, supervisor_id, auditor1_id, auditor2_id, date, status, phase_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(r.id, r.department_id, r.location_id, r.supervisor_id, r.auditor1_id, r.auditor2_id, r.date, r.status, r.phase_id),
      );
    }

    for (const u of phaseUpdates) {
      statements.push(
        db.prepare('UPDATE audit_schedules SET phase_id = ? WHERE id = ?').bind(u.phaseId, u.id),
      );
    }

    if (statements.length > 0) {
      // D1 batch limit is 100 statements — chunk if needed
      const CHUNK = 100;
      for (let i = 0; i < statements.length; i += CHUNK) {
        await db.batch(statements.slice(i, i + CHUNK));
      }
    }

    return c.json({
      createdCount: newAuditRows.length,
      updatedCount: phaseUpdates.length,
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/compute/consolidate
// Greedy threshold-based department grouping (previously handleAutoConsolidate
// in App.tsx — ran N*M sequential DB calls, all in the browser).
// Purges old auto-groups, re-runs the algorithm, writes new groups + dept links.
// ─────────────────────────────────────────────────────────────────────────────
const consolidateSchema = z.object({
  threshold: z.number().int().positive(),
  excludedDeptIds: z.array(z.string()).default([]),
  minAuditors: z.number().int().min(0).default(2),
});

compute.post(
  '/consolidate',
  requirePermission('manage:system'),
  zValidator('json', consolidateSchema),
  async (c) => {
    const { threshold, excludedDeptIds, minAuditors } = c.req.valid('json');
    const db = c.env.DB;

    // 1. Purge existing auto-generated groups (names that start with 'Group ')
    const { results: existingGroups } = await db.prepare("SELECT id FROM audit_groups WHERE name LIKE 'Group %'").all();
    const oldGroupIds = ((existingGroups || []) as any[]).map((g) => g.id);

    if (oldGroupIds.length > 0) {
      // Unlink departments first to avoid FK issues
      const unlinkStmts = oldGroupIds.map((id: string) =>
        db.prepare('UPDATE departments SET audit_group_id = NULL WHERE audit_group_id = ?').bind(id),
      );
      await db.batch(unlinkStmts);
      const deleteStmts = oldGroupIds.map((id: string) =>
        db.prepare('DELETE FROM audit_groups WHERE id = ?').bind(id),
      );
      await db.batch(deleteStmts);
    }

    // 2. Fetch fresh department data
    const { results: freshDepts } = await db.prepare('SELECT * FROM departments').all();
    const depts = (freshDepts || []) as any[];

    // 3. Separate standalones (excluded) from pool (needs grouping)
    const eligible = depts
      .filter(
        (d: any) =>
          !excludedDeptIds.includes(d.id) && d.is_exempted !== 1 && (d.total_assets || 0) > 0,
      )
      .sort((a: any, b: any) => (a.total_assets || 0) - (b.total_assets || 0));

    if (eligible.length === 0) {
      return c.json({ groups: [], ungrouped: [], standaloneCount: excludedDeptIds.length, createdCount: 0 });
    }

    // 4. Greedy grouping: accumulate until threshold is met
    const bundles: (typeof eligible)[] = [];
    let current: typeof eligible = [];
    let runningAssets = 0;

    for (const dept of eligible) {
      current.push(dept);
      runningAssets += dept.total_assets || 0;

      if (runningAssets >= threshold) {
        // Check leftover: if next dept would produce a tiny final group, absorb it
        const leftoverAssets = (eligible
          .slice(eligible.indexOf(dept) + 1)
          .reduce((s: number, d: any) => s + (d.total_assets || 0), 0));
        if (leftoverAssets > 0 && leftoverAssets < threshold * 0.7) {
          continue; // absorb remainder into this group
        }
        bundles.push([...current]);
        current = [];
        runningAssets = 0;
      }
    }
    // Remaining departments: merge into last bundle or start new one
    if (current.length > 0) {
      if (bundles.length > 0) {
        bundles[bundles.length - 1].push(...current);
      } else {
        bundles.push(current);
      }
    }

    // 5. Create audit_groups A, B, C … and link departments
    const createdGroups: { name: string; id: string; departments: string[] }[] = [];
    const writeStmts: any[] = [];

    for (let i = 0; i < bundles.length; i++) {
      const groupName = `Group ${String.fromCharCode(65 + i)}`; // A, B, C …
      const groupId = crypto.randomUUID();

      writeStmts.push(
        db.prepare('INSERT INTO audit_groups (id, name) VALUES (?, ?)').bind(groupId, groupName),
      );
      for (const dept of bundles[i]) {
        writeStmts.push(
          db.prepare('UPDATE departments SET audit_group_id = ? WHERE id = ?').bind(groupId, dept.id),
        );
      }
      createdGroups.push({
        name: groupName,
        id: groupId,
        departments: bundles[i].map((d: any) => d.id),
      });
    }

    if (writeStmts.length > 0) {
      const CHUNK = 100;
      for (let i = 0; i < writeStmts.length; i += CHUNK) {
        await db.batch(writeStmts.slice(i, i + CHUNK));
      }
    }

    return c.json({
      groups: createdGroups,
      ungrouped: excludedDeptIds,
      standaloneCount: excludedDeptIds.length,
      createdCount: createdGroups.length,
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/compute/cross-audit/generate
// Automatic cross-audit pairing (previously the "Run Simulator + Commit" flow
// in CrossAuditManagement.tsx — generates pairings and optionally persists them).
//
// mode: 'assets'          — pair by asset count only (round-robin)
//       'assets_auditors' — pair only depts with enough certified auditors
//
// simulate: true  → dry-run, returns plan without touching cross_audit_permissions
//           false → commits pairings to cross_audit_permissions
// ─────────────────────────────────────────────────────────────────────────────
const crossAuditSchema = z.object({
  mode: z.enum(['assets', 'assets_auditors']).default('assets'),
  minAuditors: z.number().int().min(1).default(2),
  strictAuditorRule: z.boolean().default(false),
  autoPairingMutual: z.boolean().default(false),
  respectManualPairings: z.boolean().default(false),
  simulate: z.boolean().default(true),
});

compute.post(
  '/cross-audit/generate',
  requirePermission('manage:system'),
  zValidator('json', crossAuditSchema),
  async (c) => {
    const { mode, minAuditors, strictAuditorRule, autoPairingMutual, respectManualPairings, simulate } =
      c.req.valid('json');
    const db = c.env.DB;

    const [deptsRes, usersRes, instKPIsRes, permsRes] = await Promise.all([
      db.prepare('SELECT id, name, total_assets, is_exempted FROM departments').all(),
      // Use json_each to filter eligible auditors in SQL — avoids JSON.parse() for every row in JS.
      db.prepare(`
        SELECT DISTINCT u.id, u.department_id, u.certification_expiry, u.roles
        FROM users u
        WHERE u.status = 'Active'
          AND u.department_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM json_each(u.roles) je
            WHERE je.value IN ('Auditor', 'Supervisor', 'Staff')
          )
      `).all(),
      db.prepare('SELECT phase_id, target_percentage FROM institution_kpi_targets').all(),
      db.prepare('SELECT * FROM cross_audit_permissions WHERE is_active = 1').all(),
    ]);

    const depts = (deptsRes.results || []) as any[];
    const users = (usersRes.results || []) as any[];
    const instKPIs = (instKPIsRes.results || []) as any[];
    const existingPerms = (permsRes.results || []) as any[];

    // Per-dept auditor counts (certified only — role already filtered in SQL)
    const today = new Date().toISOString().split('T')[0];
    const auditorCountByDept: Record<string, number> = {};
    for (const u of users) {
      if (!u.department_id) continue;
      const hasCert = u.certification_expiry && u.certification_expiry >= today;
      if (hasCert) {
        auditorCountByDept[u.department_id] = (auditorCountByDept[u.department_id] || 0) + 1;
      }
    }

    // Build entity list (non-exempted, has assets)
    const entities = depts
      .filter((d: any) => !d.is_exempted && (d.total_assets || 0) > 0)
      .map((d: any) => ({
        id: d.id,
        name: d.name,
        assets: d.total_assets || 0,
        auditors: auditorCountByDept[d.id] || 0,
      }))
      .sort((a, b) => b.assets - a.assets);

    const overallTotalAssets = entities.reduce((s, e) => s + e.assets, 0);
    const targetKPIPct = instKPIs.length > 0
      ? Math.max(...instKPIs.map((k: any) => k.target_percentage || 0))
      : 30;

    const minAuditorsRequired = strictAuditorRule ? 2 : minAuditors;

    // Determine effective mode
    const hasQualifiedAuditors = entities.some((e) => e.auditors >= minAuditorsRequired);
    const effectiveMode = mode === 'assets_auditors' && !hasQualifiedAuditors ? 'assets' : mode;
    const modeFallback = mode === 'assets_auditors' && !hasQualifiedAuditors;

    const newPairings: { auditorDeptId: string; targetDeptId: string; isMutual: boolean }[] = [];
    const strategicPlan: { targetId: string; targetName: string; auditorId: string; auditorName: string; auditorDeptAssets: number }[] = [];
    const usedTargetIds = new Set<string>();

    if (effectiveMode === 'assets') {
      // Round-robin asset-based pairing
      const auditorPool = entities.filter((e) => e.assets > 0);
      const finalTargets = respectManualPairings
        ? entities.filter((e) => e.assets > 0 && !existingPerms.some((p: any) => p.target_dept_id === e.id))
        : entities.filter((e) => e.assets > 0);

      let poolIdx = 0;
      for (const target of finalTargets) {
        if (usedTargetIds.has(target.id)) continue;
        let picked: typeof entities[0] | null = null;
        let attempts = 0;
        while (attempts < auditorPool.length) {
          const candidate = auditorPool[poolIdx % auditorPool.length];
          poolIdx++;
          attempts++;
          if (candidate.id !== target.id) { picked = candidate; break; }
        }
        if (!picked) continue;
        newPairings.push({ auditorDeptId: picked.id, targetDeptId: target.id, isMutual: autoPairingMutual });
        if (autoPairingMutual) {
          newPairings.push({ auditorDeptId: target.id, targetDeptId: picked.id, isMutual: true });
        }
        strategicPlan.push({ targetId: target.id, targetName: target.name, auditorId: picked.id, auditorName: picked.name, auditorDeptAssets: picked.assets });
        usedTargetIds.add(target.id);
      }
    } else {
      // Asset + auditor capacity matching
      const auditors = entities.filter((e) => e.auditors >= minAuditorsRequired);
      const capacityMap = new Map<string, number>();
      auditors.forEach((a) => {
        capacityMap.set(a.id, Math.floor(a.auditors / minAuditorsRequired));
      });

      const finalTargets = respectManualPairings
        ? entities.filter((e) => e.assets > 0 && !existingPerms.some((p: any) => p.target_dept_id === e.id))
        : entities.filter((e) => e.assets > 0);

      for (const target of finalTargets) {
        if (usedTargetIds.has(target.id)) continue;
        // Find auditor with remaining capacity, excluding self
        const candidate = auditors.find((a) => a.id !== target.id && (capacityMap.get(a.id) || 0) > 0);
        if (!candidate) continue;
        capacityMap.set(candidate.id, (capacityMap.get(candidate.id) || 0) - 1);
        newPairings.push({ auditorDeptId: candidate.id, targetDeptId: target.id, isMutual: autoPairingMutual });
        if (autoPairingMutual) {
          newPairings.push({ auditorDeptId: target.id, targetDeptId: candidate.id, isMutual: true });
        }
        strategicPlan.push({ targetId: target.id, targetName: target.name, auditorId: candidate.id, auditorName: candidate.name, auditorDeptAssets: candidate.assets });
        usedTargetIds.add(target.id);
      }
    }

    // Projected KPI after these pairings
    const allActivePerms = simulate
      ? [...existingPerms.map((p: any) => p.target_dept_id), ...newPairings.map((p) => p.targetDeptId)]
      : newPairings.map((p) => p.targetDeptId);
    const auditedTargets = new Set(allActivePerms);
    const projectedAssetsMet = Array.from(auditedTargets).reduce((sum, tid) => {
      const e = entities.find((e) => e.id === tid);
      return sum + (e?.assets || 0);
    }, 0);
    const projectedKPIPct = overallTotalAssets > 0 ? (projectedAssetsMet / overallTotalAssets) * 100 : 0;

    // Persist if not a simulation
    if (!simulate && newPairings.length > 0) {
      const insertStmts = newPairings.map((p) =>
        db.prepare(
          'INSERT INTO cross_audit_permissions (id, auditor_dept_id, target_dept_id, is_active, is_mutual) VALUES (?, ?, ?, 1, ?)'
        ).bind(crypto.randomUUID(), p.auditorDeptId, p.targetDeptId, p.isMutual ? 1 : 0),
      );
      const CHUNK = 100;
      for (let i = 0; i < insertStmts.length; i += CHUNK) {
        await db.batch(insertStmts.slice(i, i + CHUNK));
      }
    }

    return c.json({
      simulate,
      effectiveMode,
      modeFallback,
      pairingsCount: newPairings.length,
      pairings: newPairings,
      strategicPlan,
      projectedKPIPercentage: Math.round(projectedKPIPct * 10) / 10,
      targetKPIPercentage: targetKPIPct,
      isKPIMet: projectedKPIPct >= targetKPIPct,
    });
  },
);

export const computeRoutes = compute;
