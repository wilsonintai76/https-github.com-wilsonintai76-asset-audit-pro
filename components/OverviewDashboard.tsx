
import React, { useState, useMemo, useEffect } from 'react';
import { AuditSchedule, DashboardConfig, AuditPhase, KPITier, Department, Location, User, AuditGroup, SystemActivity } from '../types';
import { StatsCards } from './StatsCards';
import { CustomizeDashboardModal } from './CustomizeDashboardModal';
import { KPIStatsWidget } from './KPIStatsWidget';
import { TierDistributionTable } from './TierDistributionTable';
import { Sliders, GraduationCap, Filter, ChevronDown, LayoutDashboard, Trophy } from 'lucide-react';
import { ActiveEntitiesList } from './ActiveEntitiesList';
import { InstitutionalConsolidationView } from './InstitutionalConsolidationView';
import { PageHeader } from './PageHeader';

interface OverviewDashboardProps {
  schedules: AuditSchedule[];
  config: DashboardConfig;
  onUpdateConfig: (config: DashboardConfig) => void;
  phases?: AuditPhase[];
  kpiTiers?: KPITier[];
  departments?: Department[];
  locations?: Location[];
  currentUser: User;
  auditGroups?: AuditGroup[];
  activities?: SystemActivity[];
  maxAssetsPerDay?: number;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ 
  schedules,
  config,
  onUpdateConfig,
  phases = [],
  kpiTiers = [],
  departments = [],
  locations = [],
  currentUser,
  auditGroups = [],
  activities = [],
  maxAssetsPerDay = 500
}) => {
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedBlock, setSelectedBlock] = useState('All');
  const [selectedLevel, setSelectedLevel] = useState('All');

  // Reset child filters
  useEffect(() => {
    setSelectedBlock('All');
    setSelectedLevel('All');
  }, [selectedDept]);

  useEffect(() => {
    setSelectedLevel('All');
  }, [selectedBlock]);

  // Filter Logic
  const filteredLocations = useMemo(() => {
    return locations.filter(l => {
      if (!l.isActive) return false; // Filter out inactive locations
      const dept = departments.find(d => d.id === l.departmentId);
      if (selectedDept !== 'All' && dept?.name !== selectedDept) return false;
      if (selectedBlock !== 'All' && l.building !== selectedBlock) return false;
      if (selectedLevel !== 'All' && l.level !== selectedLevel) return false;
      return true;
    });
  }, [locations, selectedDept, selectedBlock, selectedLevel, departments]);

  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      const loc = locations.find(l => l.id === s.locationId);
      if (loc && !loc.isActive) return false; // Filter out audits for inactive locations
      const dept = departments.find(d => d.id === s.departmentId);
      
      if (selectedDept !== 'All' && dept?.name !== selectedDept) return false;
      if (selectedBlock !== 'All' && loc?.building !== selectedBlock) return false;
      if (selectedLevel !== 'All' && loc?.level !== selectedLevel) return false;
      return true;
    });
  }, [schedules, locations, selectedDept, selectedBlock, selectedLevel, departments]);

  // Dropdown Options
  const availableLocationsForFilters = useMemo(() => {
    if (selectedDept === 'All') return locations;
    const dept = departments.find(d => d.name === selectedDept);
    if (!dept) return [];
    return locations.filter(l => l.departmentId === dept.id);
  }, [selectedDept, locations, departments]);

  const uniqueBlocks = useMemo(() => {
    const blocks = new Set(availableLocationsForFilters.map(l => l.building).filter(Boolean));
    return ['All', ...Array.from(blocks)].sort();
  }, [availableLocationsForFilters]);

  const uniqueLevels = useMemo(() => {
    let filtered = availableLocationsForFilters;
    if (selectedBlock !== 'All') {
      filtered = filtered.filter(l => l.building === selectedBlock);
    }
    const levels = new Set(filtered.map(l => l.level).filter(Boolean));
    return ['All', ...Array.from(levels)].sort();
  }, [availableLocationsForFilters, selectedBlock]);

  const upcomingAudits = [...filteredSchedules]
    .filter(s => s.status !== 'Completed')
    .sort((a: AuditSchedule, b: AuditSchedule) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLocations.forEach(l => {
      const dept = departments.find(d => d.id === l.departmentId);
      const name = dept?.name || l.departmentId;
      counts[name] = (counts[name] || 0) + 1;
    });
    return counts;
  }, [filteredLocations, departments]);

  const sortedDepts = useMemo(() => 
    (Object.entries(deptCounts) as [string, number][]).sort((a, b) => b[1] - a[1])
  , [deptCounts]);

  const activeEntities = useMemo(() => {
    // This logic mimics CrossAuditManagement's entity calculation
    // but simplified for the dashboard's "Ranked by Assets" view.
    const groupedDepts: Record<string, Department[]> = {};
    
    departments.forEach(dept => {
      const key = dept.auditGroupId || 'unassigned_' + dept.id;
      if (!groupedDepts[key]) groupedDepts[key] = [];
      groupedDepts[key].push(dept);
    });

    return Object.entries(groupedDepts).map(([groupId, depts]) => {
      const totalAssets = depts.reduce((sum, d) => sum + (d.totalAssets || 0), 0);
      const name = groupId.startsWith('unassigned_') 
        ? depts[0].name 
        : auditGroups.find(g => g.id === groupId)?.name || 'Unknown Group';
      
      return {
        name,
        assets: totalAssets,
        auditors: 1, // Placeholder
        memberCount: 2, // Placeholder
        isJoint: depts.length > 1,
        id: groupId
      };
    }).sort((a, b) => b.assets - a.assets);
  }, [departments, auditGroups]);

  const activePhase = useMemo(() => {
    const today = new Date();
    return (phases || []).find(p => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return today >= start && today <= end;
    });
  }, [phases]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <PageHeader
        title="Institutional Dashboard"
        description="Real-time compliance monitoring and institutional performance stats."
        icon={LayoutDashboard}
        activePhase={activePhase}
      >
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsCustomizeOpen(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 ${
              activePhase 
                ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' 
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Sliders className={`w-4 h-4 ${activePhase ? 'text-emerald-400' : 'text-blue-500'}`} />
            Customize View
          </button>
          {!activePhase && (
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">System Status</p>
              <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 justify-end">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                All Systems Operational
              </p>
            </div>
          )}
        </div>
      </PageHeader>

      {/* Filters Bar */}
      <div className="bg-white rounded-[32px] p-4 border border-slate-200 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest mb-2 lg:mb-0 lg:mr-4">
                  <Filter className="w-4 h-4" />
                  Filters
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-grow">
                  {/* Department Filter */}
                  <div className="relative">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-1 block">Department</label>
                    <div className="relative">
                        <select
                        className="w-full pl-4 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer hover:bg-white"
                        value={selectedDept}
                        onChange={(e) => setSelectedDept(e.target.value)}
                        >
                        <option value="All">All Departments</option>
                        {departments.map(d => (
                            <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3 pointer-events-none" />
                    </div>
                  </div>

                  {/* Block Filter */}
                  <div className="relative">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-1 block">Block / Building</label>
                    <div className="relative">
                        <select
                        className="w-full pl-4 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer hover:bg-white"
                        value={selectedBlock}
                        onChange={(e) => setSelectedBlock(e.target.value)}
                        >
                        {uniqueBlocks.map(b => (
                            <option key={b} value={b}>{b === 'All' ? 'All Blocks' : b}</option>
                        ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3 pointer-events-none" />
                    </div>
                  </div>

                  {/* Level Filter */}
                  <div className="relative">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-1 block">Level</label>
                    <div className="relative">
                        <select
                        className="w-full pl-4 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer hover:bg-white"
                        value={selectedLevel}
                        onChange={(e) => setSelectedLevel(e.target.value)}
                        >
                        {uniqueLevels.map(l => (
                            <option key={l} value={l}>{l === 'All' ? 'All Levels' : l}</option>
                        ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3 pointer-events-none" />
                    </div>
                  </div>
              </div>
          </div>
      </div>

      {config.showStats && <StatsCards schedules={filteredSchedules} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            
          {/* KPI Widget */}
          {phases?.length > 0 && kpiTiers?.length > 0 && (
            <KPIStatsWidget 
                phases={phases}
                kpiTiers={kpiTiers}
                departments={departments}
                schedules={filteredSchedules}
            />
          )}

          {phases?.length > 0 && kpiTiers?.length > 0 && (
            <TierDistributionTable 
              departments={departments}
              kpiTiers={kpiTiers}
              phases={phases}
              schedules={schedules}
            />
          )}

          {config.showTrends && (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Compliance Trends</h3>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <span className="text-xs font-bold text-slate-500 uppercase">Weekly Goal</span>
                </div>
              </div>
              <div className="h-48 flex items-end gap-3 md:gap-6">
                {[45, 78, 55, 90, 65, 82, 95].map((height, i) => (
                  <div key={i} className="flex-grow flex flex-col items-center group">
                    <div 
                      className={`w-full rounded-t-lg transition-all duration-500 ${i === 6 ? 'bg-blue-600' : 'bg-slate-100 group-hover:bg-slate-200'}`}
                      style={{ height: `${height}%` }}
                    ></div>
                    <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Day 0{i+1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {config.showDeptDistribution && (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Departmental Distribution</h3>
              <div className="space-y-4">
                {sortedDepts.map(([dept, count], idx: number) => (
                  <div key={dept} className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-700">{dept}</span>
                      <span className="text-slate-400">{count} Locations</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 delay-${idx * 100} ${
                          idx % 3 === 0 ? 'bg-blue-500' : idx % 3 === 1 ? 'bg-indigo-500' : 'bg-slate-400'
                        }`}
                        style={{ width: `${(count / (filteredLocations?.length || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-8">
          {/* Active Entities Ranked by Assets */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Active Entities</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ranked by Total Assets</p>
              </div>
            </div>
            <ActiveEntitiesList 
              entities={activeEntities.slice(0, 10)} 
              selectedEntity=""
              onSelect={() => {}}
              megaTargetThreshold={3000}
              minAuditors={2}
            />
          </div>

          {/* Excel-Style Consolidation View */}
          <div className="mt-12 bg-white rounded-[32px] border border-slate-200 shadow-sm p-8">
            <InstitutionalConsolidationView 
              departments={departments}
              auditGroups={auditGroups}
              title="Audit Consolidation Overview"
              subtitle="Consolidated asset tracking by institutional groups (Excel Style)."
            />
          </div>

          {config.showUpcoming && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Upcoming Audits</h3>
              <div className="space-y-4">
                {upcomingAudits.map((audit) => {
                  const loc = locations.find(l => l.id === audit.locationId);
                  const dept = departments.find(d => d.id === audit.departmentId);
                  
                  return (
                    <div key={audit.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-4 hover:border-blue-200 transition-colors group">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[9px] font-black text-blue-600 uppercase">
                          {audit.date ? new Date(audit.date).toLocaleString('default', { month: 'short' }) : 'N/A'}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{audit.date ? audit.date.split('-')[2] : '-'}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                          {loc?.name || audit.locationId}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{dept?.name || audit.departmentId}</p>
                      </div>
                    </div>
                  );
                })}
                {(!upcomingAudits || upcomingAudits.length === 0) && (
                  <div className="text-center py-6">
                    <p className="text-xs text-slate-400 font-medium italic">No upcoming audits scheduled.</p>
                  </div>
                )}
                <button className="w-full py-3 text-xs font-bold text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-50 transition-colors">
                  View Full Calendar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isCustomizeOpen && (
        <CustomizeDashboardModal 
          config={config}
          onClose={() => setIsCustomizeOpen(false)}
          onSave={(newConfig) => {
            onUpdateConfig(newConfig);
            setIsCustomizeOpen(false);
          }}
        />
      )}
    </div>
  );
};
