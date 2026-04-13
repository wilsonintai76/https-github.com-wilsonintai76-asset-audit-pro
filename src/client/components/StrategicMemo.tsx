import React from 'react';
import { X, Printer, Archive, ArrowRightLeft, ArrowRight, Loader2, CheckCircle, Boxes, Layers, CheckCircle2, AlertCircle, MinusCircle, Zap } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GlobalStats {
  totalInstitutionAssets: number;
  targetPercentage: number;
  totalAuditors?: number;
  totalLocations?: number;
}

interface Entity {
  id: string;
  name: string;
  assets: number;
  auditors: number;
  locations: number;
  isJoint?: boolean;
  members?: any[];
}

interface EntityPermission {
  auditorEntityId: string;
  targetEntityId: string;
  isMutual: boolean;
}

export interface StrategicMemoProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: () => void;
  onArchive: () => Promise<void>;
  isArchiving?: boolean;

  institutionName: string;
  year: number;
  globalStats: GlobalStats;
  feasibility: any;
  entities: Entity[];
  entityPermissions: EntityPermission[];
  signatures: { approver: string; supporter: string };
  auditGroups: any[];
  departments: any[];
  phases: any[];
  kpiTiers: any[];
  kpiTierTargets: any[];
  locations: any[];
  schedules?: any[];
  maxAssetsPerDay?: number;
  maxLocationsPerDay?: number;
  onRebalance?: () => Promise<void>;
  isRebalancing?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString();
const pct = (n: number) => `${n.toFixed(1)}%`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 border-b border-slate-100 pb-2 mb-5">{title}</h3>
      {children}
    </section>
  );
}

function StatBox({ label, value, color = 'text-slate-900', border = 'border-slate-100' }: {
  label: string; value: string; color?: string; border?: string;
}) {
  return (
    <div className={`p-5 rounded-2xl border-2 bg-white ${border}`}>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function MemoTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-slate-300 italic text-xs">No data</td></tr>
          ) : rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-slate-50/50 transition-colors">
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-3 text-slate-700 font-medium">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const StrategicMemo: React.FC<StrategicMemoProps> = ({
  isOpen,
  onClose,
  onPrint,
  onArchive,
  isArchiving = false,
  institutionName,
  year,
  globalStats,
  feasibility,
  entities,
  entityPermissions,
  signatures,
  auditGroups,
  departments,
  phases,
  kpiTiers,
  kpiTierTargets,
  locations,
  schedules = [],
  maxAssetsPerDay = 1000,
  maxLocationsPerDay = 5,
  onRebalance,
  isRebalancing = false
}) => {
  const [archived, setArchived] = React.useState(false);

  const handleArchive = async () => {
    await onArchive();
    setArchived(true);
    setTimeout(() => setArchived(false), 3000);
  };

  // Reset archived state when modal opens
  React.useEffect(() => { if (isOpen) setArchived(false); }, [isOpen]);

  // ── Derived Data ────────────────────────────────────────────────────────────

  const sortedPhases = React.useMemo(() => [...(phases || [])].sort((a, b) => a.startDate.localeCompare(b.startDate)), [phases]);
  const sortedTiers = React.useMemo(() => [...(kpiTiers || [])].sort((a, b) => (a.minAssets || 0) - (b.minAssets || 0)), [kpiTiers]);

  const kpiPhasePlanData = React.useMemo(() => {
    if (!isOpen) return []; 
    const institutionTotalAssets = departments.reduce((sum, d) => sum + (d.totalAssets || 0), 0);

    // Optimization: Group data by department for O(1) lookup
    const schedulesByDept = new Map<string, any[]>();
    schedules.forEach(s => {
      const list = schedulesByDept.get(s.departmentId) || [];
      list.push(s);
      schedulesByDept.set(s.departmentId, list);
    });

    const locationsByDept = new Map<string, any[]>();
    locations.forEach(l => {
      const list = locationsByDept.get(l.departmentId) || [];
      list.push(l);
      locationsByDept.set(l.departmentId, list);
    });

    return departments.map(dept => {
      const deptPercentage = institutionTotalAssets > 0 ? ((dept.totalAssets || 0) / institutionTotalAssets) * 100 : 0;
      const tier = sortedTiers
        .filter(t => deptPercentage >= t.minAssets)
        .sort((a,b) => b.minAssets - a.minAssets)[0];
      
      const deptAudits = schedulesByDept.get(dept.id) || [];
      const deptLocs = locationsByDept.get(dept.id) || [];
      const deptLocIds = new Set(deptLocs.map(l => l.id));
      const scheduledLocIds = new Set(deptAudits.map(a => a.locationId));
      const allLocsScheduled = deptLocIds.size > 0 && Array.from(deptLocIds).every(lid => scheduledLocIds.has(lid));

      const phaseStatus = sortedPhases.reduce<{
        phaseId: string; hasAudit: boolean; isRequired: boolean;
        isCompleted: boolean; targetPct: number; targetAssets: number;
      }[]>((acc, phase) => {
        const hasAuditDirect = deptAudits.some(a => a.phaseId === phase.id);
        const targetPct = tier
          ? (kpiTierTargets.find((kt: any) => kt.tierId === tier.id && kt.phaseId === phase.id)?.targetPercentage
             ?? (tier as any).targets?.[phase.id]
             ?? 0)
          : 0;
        const prevReached100 = acc.some(p => p.targetPct >= 100);
        const isRequired = (dept.totalAssets || 0) > 0 && targetPct > 0 && !prevReached100;
        const hasAudit = hasAuditDirect || (isRequired && allLocsScheduled);
        const isCompleted = deptAudits.some(a => a.phaseId === phase.id && a.status === 'Completed');
        const targetAssets = Math.ceil((dept.totalAssets || 0) * targetPct / 100);

        acc.push({ phaseId: phase.id, hasAudit, isRequired, isCompleted, targetPct, targetAssets });
        return acc;
      }, []);

      const hasNoAssets = (dept.totalAssets || 0) === 0;
      const isFullyScheduled = !hasNoAssets && (
        deptLocIds.size > 0 ? allLocsScheduled : phaseStatus.every(p => !p.isRequired || p.hasAudit)
      );
      
      return {
        ...dept,
        tierName: tier?.name || 'Unassigned',
        phaseStatus,
        isFullyScheduled,
        hasNoAssets
      };
    }).sort((a, b) => (b.totalAssets || 0) - (a.totalAssets || 0));
  }, [departments, sortedTiers, sortedPhases, schedules, locations, isOpen]);

  const overallAuditors = departments.reduce((s, d) => s + (d.auditorCount || 0), 0);

  const consolidatedPairings = React.useMemo(() => {
    // Optimization: Index entities for fast lookup
    const entityMap = new Map(entities.map(e => [e.id, e]));

    return entityPermissions.map(p => {
      const aud = entityMap.get(p.auditorEntityId) as any;
      const tgt = entityMap.get(p.targetEntityId) as any;
      return {
        auditor: aud?.name || '?',
        target: tgt?.name || '?',
        assets: aud?.assets || 0,
        targetAssets: tgt?.assets || 0,
        isMutual: p.isMutual,
      };
    });
  }, [entityPermissions, entities]);

  // Helper: detect task force by any naming convention
  const isTaskForceDept = (d: any) =>
    d.isTaskForce || d.is_task_force === 1 || d.is_task_force === true ||
    d.abbr === 'UPKK' || (d.name && (d.name.includes('UPKK') || d.name.includes('PENGURUSAN KOLEJ KEDIAMAN')));

  // Internal Audit = explicitly designated via "Internal Audit Mode" switch (isExempted)
  const internalAuditDepts = departments.filter(d => d.isExempted || (d as any).is_exempted === 1 || (d as any).is_exempted === true);

  const taskForceDepts = departments.filter(d => {
    const isIntAudit = d.isExempted || (d as any).is_exempted === 1 || (d as any).is_exempted === true;
    return !isIntAudit && isTaskForceDept(d);
  });

  const groupedDistribution = React.useMemo(() => {
    if (!isOpen) return [];
    const groupsMap: Record<string, { name: string; departments: any[]; totalAssets: number; totalAuditors: number }> = {};
    
    // Group departments
    departments.forEach(d => {
      const gId = d.auditGroupId || 'standalone';
      if (!groupsMap[gId]) {
        const groupObj = auditGroups.find(g => g.id === gId);
        groupsMap[gId] = {
          name: groupObj?.name || (gId === 'standalone' ? 'Standalone / Ungrouped Units' : 'Group'),
          departments: [],
          totalAssets: 0,
          totalAuditors: 0
        };
      }
      groupsMap[gId].departments.push(d);
      groupsMap[gId].totalAssets += (d.totalAssets || 0);
      groupsMap[gId].totalAuditors += (d.auditorCount || 0);
    });

    return Object.values(groupsMap).sort((a, b) => {
      if (a.name.includes('Standalone')) return 1;
      if (b.name.includes('Standalone')) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [departments, auditGroups, isOpen]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100/80 backdrop-blur-md">

      {/* Sticky Header */}
      <div className="bg-white/95 backdrop-blur-sm border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-base font-black text-slate-900">Strategic Audit Plan Approval Memo</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{institutionName} · Cycle {year}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleArchive}
            disabled={isArchiving || archived}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all disabled:opacity-60"
          >
            {archived
              ? <><CheckCircle className="w-4 h-4 text-emerald-500" /> Archived</>
              : isArchiving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Archiving…</>
              : <><Archive className="w-4 h-4" /> Archive to R2</>
            }
          </button>
          <button
            onClick={onPrint}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black transition-all"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-all">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Scrollable Memo Body */}
      <div className="flex-1 overflow-y-auto py-10 px-6">
        <div className="max-w-5xl mx-auto bg-white rounded-[32px] shadow-2xl shadow-slate-900/10 border border-slate-100 p-12">

          {/* Memo Header */}
          <div className="flex items-start justify-between mb-10 pb-8 border-b-2 border-slate-100">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.25em] text-indigo-500 mb-2">Official Strategic Record</div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Strategic Audit Plan<br/>Approval Memo</h1>
              <p className="text-sm font-bold text-slate-400">Cycle Year: {year} &nbsp;·&nbsp; Target Compliance: {pct(globalStats.targetPercentage)}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-slate-900">{institutionName}</div>
              <div className={`inline-block mt-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                feasibility?.riskLevel === 'Low' ? 'bg-emerald-100 text-emerald-600' :
                feasibility?.riskLevel === 'Medium' ? 'bg-amber-100 text-amber-600' :
                'bg-rose-100 text-rose-600'
              }`}>
                {feasibility?.riskLevel || 'N/A'} Risk · {feasibility?.score || 0}%
              </div>
            </div>
          </div>

          {/* 4 Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <StatBox label="Institutional Assets" value={fmt(globalStats.totalInstitutionAssets)} />
            <StatBox label="Resource Pool" value={`${overallAuditors} Officers`} />
            <StatBox label="Total Locations" value={fmt(locations.length)} />
            <StatBox
              label="Feasibility Score"
              value={`${feasibility?.score || 0}%`}
              color={feasibility?.riskLevel === 'Low' ? 'text-emerald-600' : 'text-amber-500'}
              border={feasibility?.riskLevel === 'Low' ? 'border-emerald-200' : 'border-amber-200'}
            />
          </div>

          {/* Audit Group Composition */}
          {auditGroups.length > 0 && (
            <div className="mb-10">
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 border-b border-slate-100 pb-2 mb-5">Audit Group Composition</h3>
              <div className="grid grid-cols-1 gap-3">
                {auditGroups.map((g, i) => {
                  const members = departments.filter(d => d.auditGroupId === g.id);
                  const totalAssets = members.reduce((s, d) => s + (typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0)), 0);
                  const totalAuditors = members.reduce((s, d) => s + (d.auditorCount || 0), 0);
                  return (
                    <div key={g.id} className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-colors">
                      <div className="shrink-0 w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-sm text-slate-900 mb-1">{g.name}</div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {members.length === 0 ? (
                            <span className="text-[9px] text-slate-300 italic">No departments assigned</span>
                          ) : members.map((d, di) => (
                            <span key={di} className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-bold text-slate-600">{d.name}</span>
                          ))}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-black text-slate-800">{fmt(totalAssets)}</div>
                        <div className="text-[9px] font-bold text-slate-400">assets</div>
                        <div className="text-[9px] font-bold text-indigo-400 mt-1">{totalAuditors} officers</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 1: Phase Timeline & KPI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            <Section title="1. Phase Execution Timeline">
              {phases.length === 0 ? (
                <p className="text-xs text-slate-300 italic">No phase schedule defined.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {phases.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-xs font-black text-slate-800">{p.name}</span>
                        {p.status && (
                          <span className={`ml-2 px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                            p.status === 'Active' ? 'bg-emerald-100 text-emerald-600' :
                            p.status === 'Completed' ? 'bg-slate-100 text-slate-500' :
                            'bg-amber-100 text-amber-600'
                          }`}>{p.status}</span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{p.startDate} – {p.endDate}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="2. KPI Inspection Plan">
              <div className="space-y-3">
                {kpiTiers.length === 0 ? (
                  <p className="text-xs text-slate-300 italic">No KPI tiers configured.</p>
                ) : kpiTiers.map((tier, i) => {
                  const target = kpiTierTargets.find(t => t.tierId === tier.id);
                  const deptCount = departments.filter(d => {
                    const assets = typeof d.totalAssets === 'string' ? parseInt(d.totalAssets) : (d.totalAssets || 0);
                    return assets >= (tier.minAssets || 0);
                  }).length;
                  return (
                    <div key={i} className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-slate-800">{tier.name}</span>
                        <span className="text-sm font-black text-indigo-600">{target?.targetPercentage || 0}%</span>
                      </div>
                      <div className="flex gap-3 text-[9px] font-bold text-slate-500">
                        <span>Min assets: <strong className="text-slate-700">{fmt(tier.minAssets || 0)}</strong></span>
                        <span>·</span>
                        <span>Eligible depts: <strong className="text-slate-700">{deptCount}</strong></span>
                      </div>
                      {/* KPI progress bar */}
                      <div className="mt-2 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: `${Math.min(target?.targetPercentage || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-1 flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest border-t border-slate-100">
                  <span>Institutional Target</span>
                  <span className="text-indigo-600">{pct(globalStats.targetPercentage)}</span>
                </div>

                {/* Schedule: KPI × Phase matrix */}
                {phases.length > 0 && kpiTiers.length > 0 && (
                  <div className="mt-3 border border-slate-100 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400">KPI × Phase Schedule</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[9px]">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="px-3 py-2 text-left font-black text-slate-500">Tier</th>
                            {phases.map((p, pi) => (
                              <th key={pi} className="px-3 py-2 text-center font-black text-slate-500">{p.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {kpiTiers.map((tier, ti) => {
                            const target = kpiTierTargets.find(t => t.tierId === tier.id);
                            const perPhase = target ? Math.round((target.targetPercentage || 0) / phases.length) : 0;
                            return (
                              <tr key={ti}>
                                <td className="px-3 py-2 font-black text-slate-700">{tier.name}</td>
                                {phases.map((_, pi) => (
                                  <td key={pi} className="px-3 py-2 text-center">
                                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-black">{perPhase}%</span>
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Internal Audit Dept Schedule */}
                {phases.length > 0 && internalAuditDepts.length > 0 && (
                  <div className="mt-3 border border-amber-100 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-amber-50 text-[9px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                      Internal Audit Inspection Schedule
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[9px]">
                        <thead>
                          <tr className="border-b border-amber-50 bg-amber-50/40">
                            <th className="px-3 py-2 text-left font-black text-slate-500">Department</th>
                            {phases.map((p, pi) => (
                              <th key={pi} className="px-3 py-2 text-center font-black text-slate-500">{p.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-50">
                          {internalAuditDepts.map((d, di) => {
                            // Distribute the inspection evenly across phases
                            // Assign primary phase based on dept index (round-robin)
                            const primaryPhaseIdx = di % phases.length;
                            return (
                              <tr key={di}>
                                <td className="px-3 py-2 font-black text-slate-700">
                                  {d.name}
                                  {d.abbr && <span className="ml-1 text-amber-400 font-bold">({d.abbr})</span>}
                                </td>
                                {phases.map((_, pi) => (
                                  <td key={pi} className="px-3 py-2 text-center">
                                    {pi === primaryPhaseIdx ? (
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-black">Scheduled</span>
                                    ) : (
                                      <span className="text-slate-200">—</span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          </div>

          <Section title="3. KPI Phase Inspection Plan">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex-1 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-[10px] font-medium text-indigo-700">
                Required inspection phases per department based on their KPI tier. Each milestone shows the cumulative asset coverage target.
              </div>
              {onRebalance && (
                <button
                  onClick={onRebalance}
                  disabled={isRebalancing}
                  className="shrink-0 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg active:scale-95"
                >
                  {isRebalancing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 text-emerald-400" />
                  )}
                  {isRebalancing ? 'Rebalancing...' : 'Rebalance Schedule'}
                </button>
              )}
            </div>
            <MemoTable
              headers={['Department', 'Assets / Tier', ...sortedPhases.map(p => p.name), 'Status']}
              rows={kpiPhasePlanData.map(row => [
                <div>
                  <div className="font-black text-slate-800">{row.name}</div>
                  <div className="text-[9px] text-slate-400">{row.abbr}</div>
                </div>,
                <div>
                  <div className="font-bold text-slate-700">{fmt(row.totalAssets || 0)}</div>
                  <div className="inline-flex px-1.5 py-0.5 mt-0.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase rounded border border-blue-100 italic">
                    {row.tierName}
                  </div>
                </div>,
                ...row.phaseStatus.map(ps => (
                  ps.isRequired ? (
                    <div className="flex flex-col items-center">
                      <div className={`inline-flex flex-col items-center justify-center w-12 py-1 rounded-lg border-2 transition-all ${
                        ps.isCompleted 
                          ? 'bg-emerald-500 border-emerald-500 text-white' 
                          : ps.hasAudit 
                          ? 'bg-blue-50 border-blue-200 text-blue-600' 
                          : 'bg-rose-50 border-rose-100 text-rose-400 border-dashed opacity-50'
                      }`}>
                         <span className="text-[9px] font-black leading-none">{ps.targetPct}%</span>
                         <span className="text-[7px] font-bold opacity-70 mt-0.5">{fmt(ps.targetAssets)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                    </div>
                  )
                )),
                <div className="text-right">
                  {row.hasNoAssets ? (
                    <span className="text-[9px] font-black text-slate-300 uppercase italic">Exempt</span>
                  ) : row.isFullyScheduled ? (
                    <span className="text-[9px] font-black text-emerald-600 uppercase">Ready</span>
                  ) : (
                    <span className="text-[9px] font-black text-amber-500 uppercase">Incomplete</span>
                  )}
                </div>
              ])}
            />
          </Section>

          {/* Section 4: Grouped Resource Distribution */}
          <Section title="4. Institutional Group & Unit Detail">
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-slate-400">Group / Department</th>
                    <th className="px-4 py-3 text-center font-black uppercase tracking-widest text-slate-400">Abbr.</th>
                    <th className="px-4 py-3 text-right font-black uppercase tracking-widest text-slate-400">Assets</th>
                    <th className="px-4 py-3 text-right font-black uppercase tracking-widest text-slate-400">Auditors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {groupedDistribution.map((group, gi) => (
                    <React.Fragment key={gi}>
                      <tr className="bg-slate-50/50">
                        <td colSpan={2} className="px-4 py-2.5 font-black text-slate-900 border-l-4 border-indigo-500">{group.name}</td>
                        <td className="px-4 py-2.5 text-right font-black text-slate-900">{fmt(group.totalAssets)}</td>
                        <td className="px-4 py-2.5 text-right font-black text-slate-900">{fmt(group.totalAuditors)}</td>
                      </tr>
                      {group.departments.map((d, di) => {
                        const locCount = locations.filter(l => l.departmentId === d.id).length;
                        return (
                          <tr key={di} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-8 py-2 text-slate-600 font-medium">{d.name}</td>
                            <td className="px-4 py-2 text-center text-slate-400 font-bold uppercase tracking-tighter">{d.abbr}</td>
                            <td className="px-4 py-2 text-right text-slate-500 font-bold">{fmt(d.totalAssets || 0)}</td>
                            <td className="px-4 py-2 text-right text-slate-500 font-bold">{fmt(d.auditorCount || 0)}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Section 5: Internal Audit Department */}
          <Section title="5. Internal Audit Department">
            {internalAuditDepts.length === 0 ? (
              <p className="text-xs text-slate-300 italic">No departments designated as Internal Audit.</p>
            ) : (
              <MemoTable
                headers={['#', 'Unit / Department', 'Total Assets', 'Locations', 'Personnel', 'Mode']}
                rows={internalAuditDepts.map((d, i) => {
                  const locCount = locations.filter(l => l.departmentId === d.id).length;
                  return [
                    <span className="text-slate-400">{i + 1}</span>,
                    <div>
                      <div className="font-black text-slate-800">{d.name}</div>
                      {d.abbr && <div className="text-[9px] text-slate-400">{d.abbr}</div>}
                    </div>,
                    <span className="font-bold">{fmt(d.totalAssets || 0)}</span>,
                    <span className="font-bold text-center block">{locCount}</span>,
                    <span className="font-bold text-center block">{d.auditorCount || 0}</span>,
                    <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-50 text-amber-600">Internal Audit</span>,
                  ];
                })}
              />
            )}
          </Section>

          {/* Section 6: Task Force Units (if any) */}
          {taskForceDepts.length > 0 && (
            <Section title="6. Special Task Force Units">
              <div className="mb-3 p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-[10px] font-medium text-blue-700">
                These departments carry significant operational scale and are designated as Special Task Force units within the cross-audit structure.
              </div>
              <MemoTable
                headers={['#', 'Unit / Department', 'Total Assets', 'Locations', 'Personnel', 'Auditor Load']}
                rows={taskForceDepts.map((d, i) => {
                  const locCount = locations.filter(l => l.departmentId === d.id).length;
                  const ratio = d.auditorCount > 0 ? Math.round((d.totalAssets || 0) / d.auditorCount) : (d.totalAssets || 0);
                  return [
                    <span className="text-slate-400">{i + 1}</span>,
                    <div>
                      <div className="font-black text-slate-800">{d.name}</div>
                      {d.abbr && <div className="text-[9px] text-blue-400">{d.abbr} ⚡</div>}
                    </div>,
                    <span className="font-bold">{fmt(d.totalAssets || 0)}</span>,
                    <span className="font-bold text-center block">{locCount}</span>,
                    <span className="font-bold text-center block">{d.auditorCount || 0}</span>,
                    <span className={`font-black ${ratio > 200 ? 'text-rose-500' : 'text-emerald-500'}`}>{fmt(ratio)} assets/staff</span>,
                  ];
                })}
              />
            </Section>
          )}

          {/* Section 6/7: Strategic Audit Pairing */}
          <Section title={`${taskForceDepts.length > 0 ? '7' : '6'}. Strategic Audit Pairing`}>
            <div className="space-y-2">
              {consolidatedPairings.length === 0 ? (
                <p className="text-xs text-slate-300 italic">No audit pairings generated.</p>
              ) : consolidatedPairings.map((p, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-100 transition-colors">
                  <span className="text-[9px] font-black text-slate-300 w-5 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-sm text-slate-800 truncate">{p.auditor}</div>
                    <div className="text-[10px] font-bold text-indigo-400">{fmt(p.assets)} assets</div>
                  </div>
                  <div className="flex flex-col items-center shrink-0 w-24">
                    <div className={`p-1.5 rounded-lg ${p.isMutual ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                      {p.isMutual ? <ArrowRightLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                    </div>
                    <span className={`text-[8px] font-black uppercase mt-1 ${p.isMutual ? 'text-emerald-500' : 'text-indigo-400'}`}>
                      {p.isMutual ? 'Mutual' : 'One-Way'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="font-black text-sm text-slate-800 truncate">{p.target}</div>
                    <div className="text-[10px] font-bold text-emerald-500">{fmt(p.targetAssets)} assets</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Section 6: Integrity Protocols */}
          <div className="mb-8 p-6 rounded-2xl border border-orange-100 bg-orange-50/50">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-3">{taskForceDepts.length > 0 ? '8' : '7'}. Integrity Protocols</h3>
            <ul className="space-y-1.5 text-xs font-medium text-orange-700">
              <li><strong>Self-Audit Prevention:</strong> System locks prevent any department from auditing itself.</li>
              <li><strong>Conflict of Interest:</strong> Site Supervisors are strictly prohibited from inspecting their own sites.</li>
              <li><strong>Social Sensitivity:</strong> AI recommendations account for gender sensitivity at specialized facilities.</li>
            </ul>
          </div>

          {/* Section 7: Policy Exceptions (conditional) */}
          {feasibility?.exemptionRecommendations?.length > 0 && (
            <Section title={`${taskForceDepts.length > 0 ? '9' : '8'}. Proposed Policy Exceptions`}>
              <MemoTable
                headers={['#', 'Unit / Department', 'Justification (AI Suggested)']}
                rows={feasibility.exemptionRecommendations.map((ex: any, i: number) => [
                  <span className="text-slate-400">{i + 1}</span>,
                  <span className="font-black text-slate-800">{ex.unit}</span>,
                  <span className="text-slate-600">{ex.reason}</span>,
                ])}
              />
            </Section>
          )}

          {/* Approval Signatures */}
          <Section title={`${feasibility?.exemptionRecommendations?.length > 0 ? '8' : '7'}. Recommendation & Approval`}>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 border border-slate-200 rounded-2xl bg-slate-50">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-6">Supported By</p>
                <div className="h-10 border-b border-dashed border-slate-300 mb-3" />
                <p className="font-black text-sm text-slate-800">({signatures.supporter})</p>
                <p className="text-[10px] text-slate-400 mt-1">Deputy Director / Unit Head</p>
                <p className="text-[10px] text-slate-400 mt-3">Date: .......................................</p>
              </div>
              <div className="p-6 border-2 border-slate-900 rounded-2xl">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4">Director's Decision</p>
                <div className="space-y-2 mb-4">
                  {['Approved', 'Amendment Required', 'Rejected'].map(opt => (
                    <div key={opt} className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-slate-300 rounded" />
                      <span className="text-xs font-bold text-slate-600">{opt}</span>
                    </div>
                  ))}
                </div>
                <div className="h-8 border-b border-dashed border-slate-300 mb-3" />
                <p className="font-black text-sm text-slate-800">({signatures.approver})</p>
                <p className="text-[10px] text-slate-400 mt-1">Director</p>
              </div>
            </div>
            <div className="mt-5 p-5 border border-slate-100 rounded-2xl">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Comments / Catatan</p>
              <div className="h-16" />
            </div>
          </Section>

          {/* Footer */}
          <div className="mt-10 pt-6 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 font-medium">
              Document generated digitally by the <strong className="text-slate-600">Inspect-able</strong> AI Strategy Engine.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
