import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { Bindings, Variables } from '../types';
import { requirePermission } from '../middleware/rbac';

const compute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const stripFences = (text: string) => text.trim().replace(/^```json\n?|\n?```$/g, '').trim();

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
  const locAssetsByDept: Record<string, number> = {};
  for (const l of locs) {
    locAssets[l.id] = l.total_assets || 0;
    locAssetsByDept[l.department_id] = (locAssetsByDept[l.department_id] || 0) + (l.total_assets || 0);
  }

  // Effective dept assets = MAX(dept.total_assets stored, SUM of its location assets)
  // This mirrors the frontend departmentsWithAssets memo.
  const deptEffective = (d: any) =>
    Math.max(d.total_assets || 0, locAssetsByDept[d.id] || 0);

  const institutionTotalAssets = depts.reduce((s: number, d: any) => s + deptEffective(d), 0);

  // 3. Tier stats
  const tierStats = tiers.map((tier: any, idx: number) => {
    const deptsInTier = depts.filter((d: any) => {
      const assigned = resolveTier(deptEffective(d), institutionTotalAssets, tiers);
      return assigned?.id === tier.id;
    });

    const targetPct =
      tierTargets.find((kt: any) => kt.tier_id === tier.id && kt.phase_id === activePhase.id)?.target_percentage ?? 0;

    const deptDetails = deptsInTier.map((d: any) => {
      const total = deptEffective(d);
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

    const totalTierAssets = deptsInTier.reduce((s: number, d: any) => s + deptEffective(d), 0);
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

    const institutionTotalAssets = (() => {
      // Effective dept assets = MAX(dept.total_assets stored, SUM of its location assets)
      // Mirrors frontend departmentsWithAssets memo and the /kpi route.
      const locSumPerDept: Record<string, number> = {};
      for (const l of allLocs) locSumPerDept[l.department_id] = (locSumPerDept[l.department_id] || 0) + (l.total_assets || 0);
      return depts.reduce((s: number, d: any) => s + Math.max(d.total_assets || 0, locSumPerDept[d.id] || 0), 0) || 1;
    })();

    // Recompute effective assets per dept for use inside loop
    const locSumPerDept: Record<string, number> = {};
    for (const l of allLocs) locSumPerDept[l.department_id] = (locSumPerDept[l.department_id] || 0) + (l.total_assets || 0);

    const newAuditRows: any[] = [];
    const phaseUpdates: { id: string; phaseId: string }[] = [];

    for (const dept of depts) {
      const totalAssets = Math.max(dept.total_assets || 0, locSumPerDept[dept.id] || 0);
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
  threshold: z.number().int().min(0).default(1000), // Standalone Asset Threshold
  excludedDeptIds: z.array(z.string()).default([]),
  minAuditors: z.number().int().min(1).default(2),
  pairingStrategy: z.enum(['mutual', 'asymmetric']).default('asymmetric'),
  useAI: z.boolean().default(false),
});

compute.post(
  '/consolidate',
  requirePermission('manage:system'),
  zValidator('json', consolidateSchema),
  async (c) => {
    const { threshold, excludedDeptIds, minAuditors, pairingStrategy, useAI } = c.req.valid('json');
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

    // 2. Fetch fresh department data, auditor counts, and location counts
    const [freshDeptsRes, usersRes, locCountsRes] = await Promise.all([
      db.prepare('SELECT * FROM departments').all(),
      db.prepare(`
        SELECT department_id, certification_expiry FROM users 
        WHERE status = 'Active' 
          AND (
            JSON_EXTRACT(roles, '$') LIKE '%Auditor%'
            OR JSON_EXTRACT(roles, '$') LIKE '%Supervisor%'
            OR JSON_EXTRACT(roles, '$') LIKE '%Staff%'
          )
      `).all(),
      db.prepare('SELECT department_id, count(*) as count FROM locations GROUP BY department_id').all()
    ]);
    
    const depts = (freshDeptsRes.results || []) as any[];
    const users = (usersRes.results || []) as any[];
    const locCounts = (locCountsRes.results || []) as any[];
    const today = new Date().toISOString().split('T')[0];
    
    const auditorCountByDept: Record<string, number> = {};
    for (const u of users) {
      if (!u.department_id) continue;
      if (u.certification_expiry && u.certification_expiry >= today) {
        auditorCountByDept[u.department_id] = (auditorCountByDept[u.department_id] || 0) + 1;
      }
    }

    const locationCountByDept: Record<string, number> = {};
    for (const l of locCounts) {
      if (l.department_id) locationCountByDept[l.department_id] = l.count;
    }

    // --- LOGIC REFINEMENT: Burden Score & Parity ---
    // Outlier Safeguard: Kolej Kediaman (Hostels) is always exempted due to extreme density
    const HOSTEL_DEPT_NAME = 'UNIT PENGURUSAN KOLEJ KEDIAMAN';
    
    // 3. Separate standalones from pool
    // STANDALONE: >= 1000 assets OR >= 15 locations OR explicitly excluded AND meets min auditors
    const standaloneDepts = depts.filter(d => {
      if (d.name === HOSTEL_DEPT_NAME) return false; // Hostels are exempted, not standalone entities in this logic
      if (d.is_exempted) return false;
      const isLarge = (d.total_assets || 0) >= threshold || (locationCountByDept[d.id] || 0) >= 15;
      const isExplicit = excludedDeptIds.includes(d.id);
      return (isLarge || isExplicit) && (auditorCountByDept[d.id] || 0) >= minAuditors;
    });

    const pool = depts.filter(d => 
      !d.is_exempted && 
      d.name !== HOSTEL_DEPT_NAME &&
      ((d.total_assets || 0) > 0 || (locationCountByDept[d.id] || 0) > 0) && 
      !standaloneDepts.some(s => s.id === d.id)
    );

    // 4. Calculate Balanced Burden Index (BBI) & Target Bins
    // BBI Formula: (Assets * 0.5) + (Locations * 100) + (Staff * 300)
    // Target Magnitude for a full-day audit: 1,500 BBI
    const getBBI = (d: any) => 
      (d.total_assets || 0) * 0.5 + 
      (locationCountByDept[d.id] || 0) * 100 + 
      (auditorCountByDept[d.id] || 0) * 300;

    const recommendations: { deptId: string; reason: string; action: 'exempt' | 'merge' }[] = [];
    
    // Identify Auto-Exemption Recommendations
    const filteredPool: any[] = [];
    for (const d of pool) {
      const bbi = getBBI(d);
      if (bbi < 300) {
        recommendations.push({ deptId: d.id, reason: `Ultra-low workload (BBI: ${Math.round(bbi)}). Logistically inefficient for cross-audit.`, action: 'exempt' });
        filteredPool.push(d); // Still in pool until user accepts, but flagged
      } else if (bbi > 10000) {
        recommendations.push({ deptId: d.id, reason: `Mega-unit workload (BBI: ${Math.round(bbi)}). Overwhelms standard pairs.`, action: 'exempt' });
        filteredPool.push(d);
      } else {
        filteredPool.push(d);
      }
    }

    const totalPoolBBI = filteredPool.reduce((sum, d) => sum + getBBI(d), 0);
    
    // Target Bins based on total staff capacity (Min 2 per group)
    const totalAuditors = filteredPool.reduce((sum, d) => sum + (auditorCountByDept[d.id] || 0), 0);
    let targetBins = Math.max(1, Math.floor(totalAuditors / minAuditors));
    // Also respect BBI density: dont make groups too huge
    const bbiTargetBins = Math.ceil(totalPoolBBI / 1500);
    targetBins = Math.min(targetBins, bbiTargetBins);
    
    // PARITY ENFORCEMENT: (Standalone + Bins) must be EVEN
    // We aim for even total entities to ensure every unit has a cross-audit partner
    if ((standaloneDepts.length + targetBins) % 2 !== 0) {
      if (targetBins > 1) {
        targetBins--;
      } else if (targetBins === 1 && pool.length > 0) {
        // If 1 bin makes it odd, try to push a standalone into the pool if possible, 
        // but only if we have pool items to merge with.
        if (standaloneDepts.length > 0) {
           const smallestIdx = standaloneDepts.reduce((min, d, i, a) => 
             (d.total_assets || 0) < (a[min].total_assets || 0) ? i : min, 0);
           const pulledDept = standaloneDepts.splice(smallestIdx, 1)[0];
           pool.push(pulledDept);
           targetBins = 1;
        } else {
           // If 0 standalones and 1 bin, we stay at 1. Parity will be odd but we MUST form the group.
           targetBins = 1;
        }
      } else {
        targetBins++; 
      }
    }

    // AI-Categorization (Optional) - Refined for balanced sizes
    let aiCategories: Record<string, string> = {};
    if (useAI && pool.length > 0) {
      const MODEL = '@cf/meta/llama-3.1-8b-instruct';
      const prompt = `Categorize these departments into semantic clusters. 
Aim for exactly ${targetBins} balanced groups of roughly 1,000 asset-units each.
      Departments: ${pool.map(d => `${d.name} (BBI: ${Math.round(getBBI(d))})`).join(', ')}

Return ONLY a JSON mapping: { "Dept Name": "Cluster Name" }`;

      try {
        const result = await c.env.AI.run(MODEL, {
          messages: [{ role: 'user', content: prompt }]
        }) as { response: string };
        aiCategories = JSON.parse(stripFences(result.response));
      } catch (err) { console.error('AI Categorization failed:', err); }
    }

    // 5. 'Anchor-Orphan' Bin Distribution
    // ANCHORS: Units with >= minAuditors. 
    // ORPHANS: Units with < minAuditors (must be merged).
    const anchors = filteredPool.filter(d => (auditorCountByDept[d.id] || 0) >= minAuditors);
    const orphans = filteredPool.filter(d => (auditorCountByDept[d.id] || 0) < minAuditors);

    // Initial bins from anchors
    const bins: any[][] = anchors.map(a => [a]);
    const binAuditors = anchors.map(a => auditorCountByDept[a.id] || 0);
    const binBBIs = anchors.map(a => getBBI(a));

    // If no anchors, start with one empty bin
    if (bins.length === 0 && orphans.length > 0) {
      bins.push([]);
      binAuditors.push(0);
      binBBIs.push(0);
    }

    // Distribute orphans into bins to satisfy minAuditors and balance BBI
    for (const orphan of orphans) {
      const oBBI = getBBI(orphan);
      const oAuditors = auditorCountByDept[orphan.id] || 0;

      // Find bin that MOST needs this orphan (lowest BBI) 
      // but prioritize satisfaction of minAuditors first
      let bestBinIdx = -1;
      let minAudCount = Infinity;

      for (let i = 0; i < bins.length; i++) {
        if (binAuditors[i] < minAudCount) {
          minAudCount = binAuditors[i];
          bestBinIdx = i;
        }
      }

      // If all bins are at least at minAuditors, just pick lowest BBI
      if (minAudCount >= minAuditors) {
        let minBBIValue = Infinity;
        for (let i = 0; i < bins.length; i++) {
          if (binBBIs[i] < minBBIValue) {
            minBBIValue = binBBIs[i];
            bestBinIdx = i;
          }
        }
      }

      bins[bestBinIdx].push(orphan);
      binAuditors[bestBinIdx] += oAuditors;
      binBBIs[bestBinIdx] += oBBI;
    }

    // Final Validation: Merge bins that STILL don't meet the minAuditors policy
    let finalBundles = bins.filter(b => b.length > 0);

    // --- PARITY SAFEGUARD (POST-BINNING) ---
    // Ensure (Standalone + Groups) is ALWAYS even.
    let totalEntities = standaloneDepts.length + finalBundles.length;
    if (totalEntities % 2 !== 0 && finalBundles.length > 0) {
      // If we are odd, merge the smallest bundle into the second smallest 
      finalBundles.sort((a, b) => {
        const bbiA = a.reduce((sum, d) => sum + getBBI(d), 0);
        const bbiB = b.reduce((sum, d) => sum + getBBI(d), 0);
        return bbiA - bbiB;
      });
      
      if (finalBundles.length >= 2) {
        const orphan = finalBundles.shift()!;
        finalBundles[0] = [...finalBundles[0], ...orphan];
      } else if (standaloneDepts.length > 0) {
        const orphan = finalBundles.shift()!;
        const smallestStandaloneIdx = standaloneDepts.reduce((minIdx, d, idx, arr) => 
          (d.total_assets || 0) < (arr[minIdx].total_assets || 0) ? idx : minIdx, 0);
        finalBundles = [[standaloneDepts[smallestStandaloneIdx], ...orphan]];
        standaloneDepts.splice(smallestStandaloneIdx, 1);
      }
      // If finalBundles.length === 1 and standaloneDepts.length === 0, we remain odd (1).
      // We do NOT discard the group.
    }
    // Re-verify strictly even
    if ((standaloneDepts.length + finalBundles.length) % 2 !== 0) {
      console.warn('Parity could not be automatically enforced. Pairing might fail.');
    }
    
    // 6. Create audit_groups and link departments
    const createdGroups: { name: string; id: string; departments: string[]; totalAssets: number; totalLocations: number; auditors: number; burden: number }[] = [];
    const writeStmts: any[] = [];

    for (let i = 0; i < finalBundles.length; i++) {
      const groupName = `Group ${String.fromCharCode(65 + i)}`;
      const groupId = crypto.randomUUID();
      const bundle = finalBundles[i];
      
      const gAssets = bundle.reduce((s, d) => s + (d.total_assets || 0), 0);
      const gLocs = bundle.reduce((s, d) => s + (locationCountByDept[d.id] || 0), 0);
      const gAuditors = bundle.reduce((s, d) => s + (auditorCountByDept[d.id] || 0), 0);
      const gBBI = bundle.reduce((s, d) => s + getBBI(d), 0);

      writeStmts.push(db.prepare('INSERT INTO audit_groups (id, name) VALUES (?, ?)').bind(groupId, groupName));
      for (const dept of bundle) {
        writeStmts.push(db.prepare('UPDATE departments SET audit_group_id = ? WHERE id = ?').bind(groupId, dept.id));
      }

      createdGroups.push({
        name: groupName,
        id: groupId,
        departments: bundle.map((d: any) => d.id),
        totalAssets: gAssets,
        totalLocations: gLocs,
        auditors: gAuditors,
        burden: Math.round(gBBI) // Keep 'burden' as the key for compatibility, but use BBI value
      });
    }

    if (writeStmts.length > 0) {
      const CHUNK = 100;
      for (let i = 0; i < writeStmts.length; i += CHUNK) { await db.batch(writeStmts.slice(i, i + CHUNK)); }
    }

    return c.json({
      groups: createdGroups,
      ungrouped: standaloneDepts.map(s => s.id),
      createdCount: createdGroups.length,
      recommendations,
      isParityEven: (standaloneDepts.length + createdGroups.length) % 2 === 0
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
  mode: z.enum(['assets', 'assets_auditors', 'strict_mutual']).default('assets'),
  minAuditors: z.number().int().min(1).default(2),
  strictAuditorRule: z.boolean().default(false),
  autoPairingMutual: z.boolean().default(false),
  respectManualPairings: z.boolean().default(false),
  simulate: z.boolean().default(true),
  useAI: z.boolean().default(false),
});

compute.post(
  '/cross-audit/generate',
  requirePermission('manage:system'),
  zValidator('json', crossAuditSchema),
  async (c) => {
    const { mode, minAuditors, strictAuditorRule, autoPairingMutual, respectManualPairings, simulate, useAI } =
      c.req.valid('json');
    const db = c.env.DB;

    const [deptsRes, usersRes, instKPIsRes, permsRes, locCountsRes] = await Promise.all([
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
      db.prepare('SELECT department_id, count(*) as count FROM locations GROUP BY department_id').all()
    ]);

    const depts = (deptsRes.results || []) as any[];
    const users = (usersRes.results || []) as any[];
    const instKPIs = (instKPIsRes.results || []) as any[];
    const existingPerms = (permsRes.results || []) as any[];
    const locCounts = (locCountsRes.results || []) as any[];

    const locCountByDept: Record<string, number> = {};
    for (const l of locCounts) {
      if (l.department_id) locCountByDept[l.department_id] = l.count;
    }

    // Per-dept auditor counts (certified only)
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
      .map((d: any) => {
        const assets = d.total_assets || 0;
        const auditors = auditorCountByDept[d.id] || 0;
        const locs = locCountByDept[d.id] || 0;
        // BBI Formula: (Assets * 0.5) + (Locations * 100) + (Staff * 300)
        const bbi = (assets * 0.5) + (locs * 100) + (auditors * 300);

        return {
          id: d.id,
          name: d.name,
          assets,
          auditors,
          bbi: Math.round(bbi)
        };
      })
      .sort((a, b) => b.bbi - a.bbi);

    // 4. AI Strategic Insights (Optional)
    let aiPairingSuggestions: { auditorId: string; targetId: string }[] = [];
    if (useAI && entities.length > 2) {
       const MODEL = '@cf/meta/llama-3.1-8b-instruct';
       const prompt = `Task: Strategic Cross-Audit Matchmaking (Resource-Aware)
Analyze these departments and suggest the 5 most "Logically Compatible" pairings.

Rules:
1. Technical Affinity: Pair Dept A and B if they have similar equipment or technical processes.
2. Resource Equity: Use the Balanced Burden Index (BBI) to detect "High-Strain" departments.
   BBI = (Assets * 0.5) + (Locations * 100) + (Staff * 300). Target BBI is ~1200.
3. Asymmetric Delegation: If a department has a high BBI relative to its auditors, prioritize a ONE-WAY delegation where a stable department audits them.
4. Social Sensitivity: If a department involves Hostels/Kediaman, prioritize gender-appropriate officer assignments.

Available Depts (BBI includes Assets, Locations, and Staff):
${entities.map((e, idx) => `${idx}. ${e.name}: ${e.assets} units, ${e.auditors} auditors, BBI: ${e.bbi}`).join('\n')}

Return ONLY a JSON array of best pairs based on THEIR INDEX in the names list (avoid self-auditing):
[ { "auditorIdx": 0, "targetIdx": 1 }, ... ]`;

        try {
          const result = await c.env.AI.run(MODEL, {
             messages: [
               { role: 'system', content: 'You are an Audit Strategy AI. You optimize pairs for technical affinity and resource feasibility. Respond with valid JSON only.' },
               { role: 'user', content: prompt }
             ]
          }) as { response: string };
          const suggestions = JSON.parse(stripFences(result.response)) as { auditorIdx: number; targetIdx: number }[];
          aiPairingSuggestions = suggestions
            .map(s => ({ 
              auditorId: entities[s.auditorIdx]?.id, 
              targetId: entities[s.targetIdx]?.id 
            }))
            .filter(s => s.auditorId && s.targetId && s.auditorId !== s.targetId);
        } catch (err) {
          console.error('AI Strategic Pairing failed:', err);
        }
    }

    const overallTotalAssets = entities.reduce((s, e) => s + e.assets, 0);
    const targetKPIPct = instKPIs.length > 0
      ? Math.max(...instKPIs.map((k: any) => k.target_percentage || 0))
      : 30;

    const minAuditorsRequired = strictAuditorRule ? 2 : minAuditors;

    // Determine effective mode
    const hasQualifiedAuditors = entities.some((e) => e.auditors >= minAuditorsRequired);
    const effectiveMode = (mode === 'assets_auditors' || mode === 'strict_mutual') && !hasQualifiedAuditors ? 'assets' : mode;
    const modeFallback = (mode === 'assets_auditors' || mode === 'strict_mutual') && !hasQualifiedAuditors;

    const newPairings: { auditorDeptId: string; targetDeptId: string; isMutual: boolean; burdenScore?: number }[] = [];
    const strategicPlan: any[] = [];
    const usedTargetIds = new Set<string>();
    const usedAuditorIds = new Set<string>();

    if (effectiveMode === 'strict_mutual') {
      // 1:1 Mutual Pairing Logic
      const pool = entities.filter(e => e.assets > 0 && (e.auditors >= minAuditorsRequired || !strictAuditorRule));
      const poolIds = pool.map(e => e.id);
      
      // Separate already paired if respectManualPairings is true
      const availableIds = respectManualPairings 
        ? poolIds.filter(id => !existingPerms.some((p: any) => p.target_dept_id === id || p.auditor_dept_id === id))
        : [...poolIds];
      
      // Sort available by assets to pair similar sizes
      const sortedAvailable = pool.filter(e => availableIds.includes(e.id)).sort((a,b) => b.bbi - a.bbi);
      
      const pairs: [string, string][] = [];
      let cycle3: [string, string, string] | null = null;
      
      const workList = [...sortedAvailable];
      
      // If odd, extract a 3-way cycle from the end (smallest entities)
      if (workList.length % 2 !== 0 && workList.length >= 3) {
        const c1 = workList.pop()!;
        const c2 = workList.pop()!;
        const c3 = workList.pop()!;
        cycle3 = [c1.id, c2.id, c3.id];
      }
      
      // Pair the rest 1:1
      while (workList.length >= 2) {
        const a = workList.shift()!;
        const b = workList.shift()!;
        pairs.push([a.id, b.id]);
      }
      
      // Apply pairs
      for (const [idA, idB] of pairs) {
        const entA = pool.find(e => e.id === idA);
        const entB = pool.find(e => e.id === idB);
        if (!entA || !entB) continue;
        
        // A audits B
        newPairings.push({ 
          auditorDeptId: idA, 
          targetDeptId: idB, 
          isMutual: true, 
          burdenScore: Math.round(entB.assets / entA.auditors) 
        });
        // B audits A
        newPairings.push({ 
          auditorDeptId: idB, 
          targetDeptId: idA, 
          isMutual: true, 
          burdenScore: Math.round(entA.assets / entB.auditors) 
        });
        
        strategicPlan.push({ 
          targetId: idB, targetName: entB.name, 
          auditorId: idA, auditorName: entA.name, 
          auditorDeptAssets: entA.assets,
          isMutual: true,
          burdenScore: Math.round(entB.assets / entA.auditors)
        });
        strategicPlan.push({ 
          targetId: idA, targetName: entA.name, 
          auditorId: idB, auditorName: entB.name, 
          auditorDeptAssets: entB.assets,
          isMutual: true,
          burdenScore: Math.round(entA.assets / entB.auditors)
        });
      }
      
      // Apply 3-way cycle: A -> B, B -> C, C -> A
      if (cycle3) {
        const [idA, idB, idC] = cycle3;
        const entA = pool.find(e => e.id === idA)!;
        const entB = pool.find(e => e.id === idB)!;
        const entC = pool.find(e => e.id === idC)!;
        
        const cycle = [[entA, entB], [entB, entC], [entC, entA]];
        for (const [aud, tgt] of cycle) {
          newPairings.push({ 
            auditorDeptId: aud.id, 
            targetDeptId: tgt.id, 
            isMutual: false, // In a cycle it's not mutual 1:1
            burdenScore: Math.round(tgt.assets / aud.auditors) 
          });
          strategicPlan.push({ 
            targetId: tgt.id, targetName: tgt.name, 
            auditorId: aud.id, auditorName: aud.name, 
            auditorDeptAssets: aud.assets,
            auditorBBI: aud.bbi,
            targetBBI: tgt.bbi,
            isCycle: true,
            burdenScore: Math.round(tgt.assets / aud.auditors)
          });
        }
      }
      
    } else if (effectiveMode === 'assets') {
      const auditorPool = entities.filter((e) => e.auditors > 0);
      const finalTargets = respectManualPairings
        ? entities.filter((e) => e.bbi > 0 && !existingPerms.some((p: any) => p.target_dept_id === e.id))
        : entities.filter((e) => e.bbi > 0);

      const capacityMap = new Map<string, number>();
      auditorPool.forEach(a => {
        // Minimum 2 auditors per "slot"
        const slots = Math.max(1, Math.floor(a.auditors / 2)); 
        capacityMap.set(a.id, slots);
      });

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
        strategicPlan.push({ 
          targetId: target.id, targetName: target.name, 
          auditorId: picked.id, auditorName: picked.name, 
          auditorDeptAssets: picked.assets,
          auditorBBI: picked.bbi,
          targetBBI: target.bbi
        });
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
        strategicPlan.push({ 
          targetId: target.id, targetName: target.name, 
          auditorId: candidate.id, auditorName: candidate.name, 
          auditorDeptAssets: candidate.assets,
          auditorBBI: candidate.bbi,
          targetBBI: target.bbi
        });
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/compute/auto-tier-targets
// Given the global institution KPI targets (per phase), auto-calculates
// tier-specific per-phase % targets using the "Completion Phase" approach:
//   • Tier 1 (Small)  → must be 100% by Phase 1 (finishes earliest)
//   • Tier 2 (Medium) → must be 100% by Phase 2
//   • Tier 3 (Large)  → must be 100% by Phase 3 (gets breathing room)
// ALL tiers contribute a non-zero target in every phase they haven't
// completed yet; locked tiers stay at 100%. Weighted sum of tier targets
// matches the institution global target for each phase.
// Persists results to kpi_tier_targets and returns the computed matrix.
// ─────────────────────────────────────────────────────────────────────────────
compute.post(
  '/auto-tier-targets',
  requirePermission('manage:system'),
  async (c) => {
    const db = c.env.DB;

    // 1. Fetch all required data (including location sums for effective asset calc)
    const [deptsRes, tiersRes, phasesRes, instKPIsRes, locSumsRes] = await Promise.all([
      db.prepare('SELECT id, total_assets, is_exempted FROM departments').all(),
      db.prepare('SELECT id, name, min_assets FROM kpi_tiers ORDER BY min_assets ASC').all(),
      db.prepare('SELECT id, name, start_date, end_date FROM audit_phases ORDER BY start_date ASC').all(),
      db.prepare('SELECT phase_id, target_percentage FROM institution_kpi_targets').all(),
      db.prepare('SELECT department_id, SUM(total_assets) AS loc_sum FROM locations GROUP BY department_id').all(),
    ]);

    const depts = (deptsRes.results || []) as any[];
    const tiers = (tiersRes.results || []) as any[];
    const phases = (phasesRes.results || []) as any[];
    const instKPIs = (instKPIsRes.results || []) as any[];

    if (tiers.length === 0 || phases.length === 0) {
      return c.json({ error: 'Tiers and phases must be configured first' }, 400);
    }

    // Build location-sum lookup (mirrors frontend departmentsWithAssets memo)
    const locSumByDept: Record<string, number> = {};
    for (const ls of (locSumsRes.results || []) as any[]) {
      locSumByDept[ls.department_id] = ls.loc_sum || 0;
    }
    // Effective dept assets = MAX(stored dept.total_assets, SUM of location assets)
    const effectiveAssets = (d: any) =>
      Math.max(d.total_assets || 0, locSumByDept[d.id] || 0);

    const institutionTotal = depts.reduce((s: number, d: any) => s + effectiveAssets(d), 0);
    if (institutionTotal === 0) {
      return c.json({ error: 'No department asset data available' }, 400);
    }

    // 2. Compute how many assets live in each tier
    const tierAssets: Record<string, number> = {};
    for (const tier of tiers) tierAssets[tier.id] = 0;

    for (const dept of depts) {
      if (dept.is_exempted) continue;
      const assets = effectiveAssets(dept);
      if (assets === 0) continue;
      const assigned = resolveTier(assets, institutionTotal, tiers);
      if (assigned) tierAssets[assigned.id] += assets;
    }

    // 3. Compute tier weights (fraction of total institution assets)
    const tierWeights: Record<string, number> = {};
    for (const tier of tiers) {
      tierWeights[tier.id] = institutionTotal > 0 ? tierAssets[tier.id] / institutionTotal : 0;
    }

    // 4. Build the global target per phase (sorted chronologically)
    const globalTargets: Record<string, number> = {};
    for (const phase of phases) {
      const inst = instKPIs.find((k: any) => k.phase_id === phase.id);
      globalTargets[phase.id] = inst?.target_percentage ?? 0;
    }

    // 5. Fetch audit constraints for capacity estimation
    const constraintRow = await db.prepare(
      "SELECT value FROM system_settings WHERE id = 'audit_constraints'"
    ).first<{ value: string }>();
    const constraints = constraintRow ? JSON.parse(constraintRow.value) : {};
    const minAuditorsPerLocation = constraints.minAuditorsPerLocation ?? 2;
    const dailyInspectionCapacity = constraints.dailyInspectionCapacity ?? 150;

    // ──────────────────────────────────────────────────────────────────
    //  AUTO-CALCULATE TIER TARGETS — "Completion Phase" approach
    //
    //  Rule: Tier i (0=smallest) MUST reach 100% by Phase i.
    //  After a tier hits 100%, it stops contributing — the remaining
    //  (larger) tiers share the load for later phases.
    //
    //  For each phase pi:
    //    • "Locked" tiers (completionPhase <= pi) → target = 100%
    //    • "Flex" tiers (completionPhase > pi) → each gets the same %
    //      so that Σ(w_i × t_i) = globalTarget
    //
    //  Example (3 tiers, 3 phases, G = 30/65/100):
    //   Phase 1: Small=100%, Med+Large share rest → flexPct
    //   Phase 2: Small+Med=100%, Large covers rest
    //   Phase 3: All=100%
    //
    //  If numTiers ≠ numPhases, tiers are mapped proportionally
    //  to phases so that smaller tiers finish earlier.
    // ──────────────────────────────────────────────────────────────────
    const numTiers = tiers.length;
    const numPhases = phases.length;

    // Map each tier to its "completion phase" index
    // Tier 0 (smallest) completes at Phase 0 (earliest)
    // Tier N-1 (largest) completes at Phase N-1 (latest)
    const completionPhase: number[] = tiers.map((_: any, ti: number) => {
      if (numTiers === 1) return numPhases - 1;
      return Math.min(numPhases - 1, Math.round(ti * (numPhases - 1) / (numTiers - 1)));
    });

    const tierTargetMatrix: Record<string, Record<string, number>> = {};
    for (const tier of tiers) tierTargetMatrix[tier.id] = {};

    // 6. For each phase, compute tier targets
    //
    //  Two cases per flex tier (tiers that haven't completed yet):
    //
    //  Case A — locked tiers don't cover G yet (remaining > 0):
    //    All flex tiers share: flexPct = remaining / flexWeight
    //    This ensures Σ(w_i × t_i) = G exactly.
    //
    //  Case B — locked tiers alone already exceed G (remaining ≤ 0):
    //    This happens when small-tier departments collectively own more
    //    assets than the global target %. In this case we can't push
    //    their combined contribution below G, so we fall back to a
    //    "natural ramp" for flex tiers:
    //      naturalPct[ti] = 100 × (pi+1) / (completionPhase[ti]+1)
    //    This ensures every tier is always non-zero and reaches 100%
    //    exactly by its completion phase.
    for (let pi = 0; pi < numPhases; pi++) {
      const phase = phases[pi];
      const G = globalTargets[phase.id] || 0;

      if (G === 0) {
        for (const tier of tiers) tierTargetMatrix[tier.id][phase.id] = 0;
        continue;
      }

      // Split tiers into locked (done) vs flex (still in progress)
      let lockedContribution = 0;
      let flexWeight = 0;
      for (let ti = 0; ti < numTiers; ti++) {
        const w = tierWeights[tiers[ti].id] || 0;
        if (completionPhase[ti] <= pi) {
          lockedContribution += w * 100;
        } else {
          flexWeight += w;
        }
      }

      const remaining = G - lockedContribution;

      // Case A: normal — there is room for flex tiers to contribute
      // Case B: locked tiers already exceed G — use natural ramp instead
      const useNaturalRamp = remaining <= 0;
      const sharedFlexPct = (!useNaturalRamp && flexWeight > 0)
        ? Math.min(100, Math.max(1, Math.round(remaining / flexWeight)))
        : null;

      for (let ti = 0; ti < numTiers; ti++) {
        if (completionPhase[ti] <= pi) {
          // Tier has reached its completion phase — lock at 100%
          tierTargetMatrix[tiers[ti].id][phase.id] = 100;
        } else if (sharedFlexPct !== null) {
          // Case A: shared flex percentage
          tierTargetMatrix[tiers[ti].id][phase.id] = sharedFlexPct;
        } else {
          // Case B: natural linear ramp toward 100% by completion phase
          // e.g. Large (ci=2) in Phase 1 of 3: 100 × 1/3 = 33%
          const natural = Math.round(100 * (pi + 1) / (completionPhase[ti] + 1));
          tierTargetMatrix[tiers[ti].id][phase.id] = Math.min(99, Math.max(1, natural));
        }
      }
    }

    // 7. Enforce monotonically non-decreasing across phases per tier
    for (let ti = 0; ti < numTiers; ti++) {
      const tier = tiers[ti];
      let prev = 0;
      for (let pi = 0; pi < numPhases; pi++) {
        const phase = phases[pi];
        tierTargetMatrix[tier.id][phase.id] = Math.max(prev, tierTargetMatrix[tier.id][phase.id]);
        prev = tierTargetMatrix[tier.id][phase.id];
      }
    }

    // 9. Capacity estimation per phase (informational)
    //    working days ≈ phase duration in calendar days × 5/7
    //    capacity per phase = dailyCapacity × workingDays × numAuditorPairs
    //    where each location needs minAuditorsPerLocation auditors
    const capacityWarnings: string[] = [];
    for (let pi = 0; pi < numPhases; pi++) {
      const phase = phases[pi];
      const start = new Date(phase.start_date);
      const end = new Date(phase.end_date);
      const calendarDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
      const workingDays = Math.round(calendarDays * 5 / 7);

      // Assets to inspect this phase (incremental)
      const prevGlobal = pi > 0 ? (globalTargets[phases[pi - 1].id] || 0) : 0;
      const thisGlobal = globalTargets[phase.id] || 0;
      const incrementalPct = Math.max(0, thisGlobal - prevGlobal);
      const assetsThisPhase = Math.ceil(institutionTotal * incrementalPct / 100);

      // Capacity for one auditor pair
      const pairCapacity = dailyInspectionCapacity * workingDays;
      const pairsNeeded = pairCapacity > 0 ? Math.ceil(assetsThisPhase / pairCapacity) : 0;
      const auditorsNeeded = pairsNeeded * minAuditorsPerLocation;

      if (assetsThisPhase > 0) {
        capacityWarnings.push(
          `${phase.name}: ~${assetsThisPhase.toLocaleString()} assets over ${workingDays} working days → needs ~${pairsNeeded} teams (${auditorsNeeded} auditors @ ${minAuditorsPerLocation}/location, ${dailyInspectionCapacity} assets/day)`
        );
      }
    }

    // 9. Persist to kpi_tier_targets (upsert)
    const stmts: any[] = [];
    const resultMatrix: { tierId: string; tierName: string; phaseId: string; phaseName: string; targetPercentage: number }[] = [];

    for (const tier of tiers) {
      for (const phase of phases) {
        const pct = tierTargetMatrix[tier.id][phase.id] || 0;
        stmts.push(
          db.prepare(`
            INSERT INTO kpi_tier_targets (id, tier_id, phase_id, target_percentage)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(tier_id, phase_id) DO UPDATE SET target_percentage = excluded.target_percentage
          `).bind(crypto.randomUUID(), tier.id, phase.id, pct),
        );
        resultMatrix.push({
          tierId: tier.id,
          tierName: tier.name,
          phaseId: phase.id,
          phaseName: phase.name,
          targetPercentage: pct,
        });
      }
    }

    if (stmts.length > 0) {
      const CHUNK = 100;
      for (let i = 0; i < stmts.length; i += CHUNK) {
        await db.batch(stmts.slice(i, i + CHUNK));
      }
    }

    return c.json({
      tierTargets: resultMatrix,
      tierWeights: Object.fromEntries(tiers.map(t => [t.id, Math.round(tierWeights[t.id] * 1000) / 10])),
      globalTargets,
      capacityWarnings,
      constraints: { minAuditorsPerLocation, dailyInspectionCapacity },
      message: 'Tier targets auto-calculated and saved',
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/compute/feasibility
// AI-Driven Strategic Check for KPI targets based on actual staff headcount.
// ─────────────────────────────────────────────────────────────────────────────
compute.post(
  '/feasibility',
  requirePermission('manage:system'),
  async (c) => {
    const db = c.env.DB;
    const MODEL = '@cf/meta/llama-3-8b-instruct';

    const [deptsRes, usersRes, phasesRes, instKPIsRes, settingRes, locCountsRes] = await Promise.all([
      db.prepare('SELECT id, name, total_assets FROM departments WHERE is_exempted = 0').all(),
      db.prepare("SELECT id, department_id, certification_expiry FROM users WHERE status = 'Active'").all(),
      db.prepare('SELECT id, name, start_date, end_date FROM audit_phases ORDER BY start_date ASC').all(),
      db.prepare('SELECT phase_id, target_percentage FROM institution_kpi_targets').all(),
      db.prepare("SELECT value FROM system_settings WHERE id = 'audit_constraints'").first<{ value: string }>(),
      db.prepare('SELECT department_id, count(*) as count FROM locations GROUP BY department_id').all()
    ]);
 
    const depts = (deptsRes.results || []) as any[];
    const users = (usersRes.results || []) as any[];
    const phases = (phasesRes.results || []) as any[];
    const instKPIs = (instKPIsRes.results || []) as any[];
    const locCounts = (locCountsRes.results || []) as any[];
    const constraints = settingRes ? JSON.parse(settingRes.value) : {};

    const locationCountByDept: Record<string, number> = {};
    for (const l of locCounts) {
      if (l.department_id) locationCountByDept[l.department_id] = l.count;
    }
 
    const today = new Date().toISOString().split('T')[0];
    const auditorCountByDept: Record<string, number> = {};
    users.forEach(u => {
      if (u.certification_expiry && u.certification_expiry >= today) {
        auditorCountByDept[u.department_id] = (auditorCountByDept[u.department_id] || 0) + 1;
      }
    });

    const certifiedAuditors = Object.values(auditorCountByDept).reduce((a, b) => a + b, 0);

    const institutionTotalAssets = depts.reduce((sum, d) => sum + (d.total_assets || 0), 0);
    
    const phaseData = phases.map(p => {
      const target = instKPIs.find(k => k.phase_id === p.id)?.target_percentage || 0;
      const start = new Date(p.start_date);
      const end = new Date(p.end_date);
      const workDays = Math.round(Math.max(1, (end.getTime() - start.getTime()) / 86400000) * 5 / 7);
      return { name: p.name, target, workDays };
    });

    const activeUnits = depts.filter(d => (d.total_assets || 0) > 0 || (auditorCountByDept[d.id] || 0) > 0);

    // --- MATHEMATICAL PRE-CALCULATION ---
    const activeUnitStats = activeUnits.map(d => ({
      name: d.name,
      assets: d.total_assets || 0,
      locations: locationCountByDept[d.id] || 0,
      auditors: auditorCountByDept[d.id] || 0,
      burden: (d.total_assets || 0) * 0.7 + (locationCountByDept[d.id] || 0) * 100,
      capacityRatio: (auditorCountByDept[d.id] || 0) > 0 
        ? Math.round(((d.total_assets || 0) + (locationCountByDept[d.id] || 0) * 10) / (auditorCountByDept[d.id] || 0)) 
        : 'INF'
    }));

    const globalAvgBurden = Math.round(activeUnitStats.reduce((s, u) => s + (typeof u.capacityRatio === 'number' ? u.capacityRatio : 0), 0) / activeUnits.length);

    const aiPrompt = `Analyze the Strategic Feasibility of this audit plan. Provide two distinct perspectives:

Perspective 1: MATHEMATICAL BALANCE (The "Math")
Focus on Load vs Capacity. Identify units where the workload (Assets + Locations) is disproportionate to the Auditor headcount.
- Global Avg Load/Auditor: ${globalAvgBurden} units
- High Burden Threshold: > 800 units/auditor

Perspective 2: THEMATIC SYNERGY (The "Theme")
Focus on Functional Affinity. Evaluate if the grouping of these departments makes sense (e.g., Tech with Tech, Admin with Admin).

Infrastructure Stats:
- Total Certified auditors: ${certifiedAuditors}
- Total Assets: ${institutionTotalAssets}

Unit Breakdown:
${activeUnitStats.slice(0, 20).map(u => `- ${u.name}: ${u.assets} assets, ${u.locations} locs, ${u.auditors} auds (Load Index: ${u.capacityRatio})`).join('\n')}

CRITICAL: Return ONLY a raw JSON object matching this schema. NO TEXT BEFORE OR AFTER.
{
  "score": number,
  "riskLevel": "Low"|"Medium"|"High"|"Critical",
  "mathematicalAnalysis": {
    "summary": string,
    "logisticalRisks": string[],
    "loadBalanceScore": number
  },
  "thematicAnalysis": {
    "summary": string,
    "synergyObservations": string[],
    "affinityScore": number
  },
  "bottlenecks": string[],
  "recommendations": string[],
  "exemptionRecommendations": []
}
`;

    let result: any = null;
    try {
      result = await c.env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: 'You are an Audit Strategy AI. You analyze resource constraints and logistical complexity vs goals. Respond with valid JSON only. The "score" field must be an integer from 0 to 100 representing feasibility percentage.' },
          { role: 'user', content: aiPrompt }
        ],
        max_tokens: 1024
      });

      // Robust extraction: Handle if result is { response: string }, { result: string }, or raw string
      let rawResponse = '';
      if (typeof result === 'string') {
        rawResponse = result;
      } else if (result && typeof result === 'object') {
        // AI models sometimes wrap the answer in 'response' or 'result' fields
        const obj = result as any;
        rawResponse = obj.response || obj.result || JSON.stringify(result);
      }

      // Regex to find the widest possible JSON block {...}
      let jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      
      // If the extracted content itself was a stringified JSON (common in double-wrapped responses), 
      // try to parse the whole thing first
      let parsed: any = null;
      try {
        // Case 1: The response is already the object we want
        if (typeof result === 'object' && result.score !== undefined) {
          parsed = result;
        } 
        // Case 2: The response is a string that is perfect JSON
        else if (jsonMatch) {
          const extracted = jsonMatch[0];
          parsed = JSON.parse(extracted);
          
          // Re-check for nested 'response' inside the parsed string 
          // (Handles the {"response": "{\"score\":...}"} case in the user screenshot)
          if (parsed.response && typeof parsed.response === 'string' && parsed.response.includes('{')) {
            const nestedMatch = parsed.response.match(/\{[\s\S]*\}/);
            if (nestedMatch) parsed = JSON.parse(nestedMatch[0]);
          }
        }
      } catch (e) {
        console.error('Initial parse failed, falling back to regex match');
      }

      if (!parsed && jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (e) {
          throw new Error('AI response did not contain a valid JSON block.');
        }
      }

      if (!parsed) {
        throw new Error('AI response did not contain a valid JSON block.');
      }
      
      // Normalize score to 0-100 range if it comes back as 0-1
      if (typeof parsed.score === 'number' && parsed.score <= 1 && parsed.score > 0) {
        parsed.score = Math.round(parsed.score * 100);
      } else if (typeof parsed.score === 'number') {
        parsed.score = Math.round(parsed.score);
      }

      return c.json(parsed);
    } catch (err: any) {
      console.error('AI Feasibility failed:', err);
      return c.json({ 
        score: 0, 
        riskLevel: 'System Error', 
        bottlenecks: [`Analysis failed: ${err.message}`], 
        recommendations: ['Check Cloudflare AI quota/binding', 'Ensure all departments have asset data'], 
        projections: {},
        rawText: `[Type: ${typeof result}] ` + (typeof result === 'string' ? result : JSON.stringify(result))?.substring(0, 800) || 'No response captured'
      });
    }
  }
);

export const computeRoutes = compute;
