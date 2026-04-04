/// <reference types="@cloudflare/workers-types" />
import { AuditSchedule, User, Department, Location, CrossAuditPermission, AuditPhase, KPITier, KPITierTarget, InstitutionKPITarget, DepartmentMapping, SystemActivity, AuditGroup, Building, SystemSetting } from '../types';
import { api, getAuthHeaders } from './honoClient';

class DataGateway {
  constructor() {}
  
  private generateId(): string {
    return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;
  }

  async getAdminSettings(): Promise<any> {
    const res = await (api as any).media.settings[':key'].$get({
      param: { key: 'admin_settings' }
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) return {};
    const data = await res.json() as any;
    return JSON.parse(data.value || '{}');
  }

  async saveAdminSettings(settings: any): Promise<void> {
    await (api as any).media.settings[':key'].$post({
      param: { key: 'admin_settings' },
      json: { value: JSON.stringify(settings) }
    }, {
      headers: await getAuthHeaders()
    });
  }

  async uploadImage(file: File): Promise<string> {
    const res = await (api as any).media.upload.$post({
      form: {
        file: file
      }
    }, {
      headers: await getAuthHeaders()
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Upload failed');
    }

    const { url } = await res.json() as { url: string };
    return url;
  }

  // --- AUDITS ---
  async getAudits(): Promise<AuditSchedule[]> {
    const res = await (api as any).db.audits.$get({}, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to fetch audits');
    }
    return await res.json() as AuditSchedule[];
  }

  async addAudit(audit: Omit<AuditSchedule, 'id'>): Promise<AuditSchedule> {
    const res = await (api as any).db.audits.$post({
      json: audit as any
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to add audit');
    }
    return await res.json() as AuditSchedule;
  }
  
  async bulkAddAudits(audits: Omit<AuditSchedule, 'id'>[]): Promise<AuditSchedule[]> {
    const res = await (api as any).db.audits.bulk.$post({
      json: audits as any
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to bulk add audits');
    }
    return await res.json() as AuditSchedule[];
  }

  async updateAudit(id: string, updates: Partial<AuditSchedule>): Promise<void> {
    const res = await (api as any).db.audits[':id'].$patch({
      param: { id },
      json: updates as any
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to update audit');
    }
  }

  async deleteAudit(id: string): Promise<void> {
    const res = await (api as any).db.audits[':id'].$delete({
      param: { id }
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to delete audit');
    }
  }

  // --- USERS ---
  async getUsers(): Promise<User[]> {
    const res = await (api as any).db.users.$get({}, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to fetch users');
    }
    return await res.json() as User[];
  }

  async addUser(user: Omit<User, 'id'>): Promise<User> {
    const res = await (api as any).db.users.$post({
      json: user as any
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to add user');
    }
    return await res.json() as User;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    const res = await (api as any).db.users[':id'].$patch({
      param: { id },
      json: updates as any
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to update user');
    }
  }

  async verifyUser(id: string): Promise<User> {
    const res = await (api as any).db.users[':id'].verify.$post({
      param: { id }
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to verify user');
    }
    return await res.json() as User;
  }

  async deleteUser(id: string): Promise<void> {
    const res = await (api as any).db.users[':id'].$delete({
      param: { id }
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to delete user');
    }
  }

  // --- DEPARTMENTS ---
  async getDepartments(): Promise<Department[]> {
    const res = await (api as any).db.departments.$get({}, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to fetch departments');
    }
    return await res.json() as Department[];
  }

  async addDepartment(dept: Omit<Department, 'id'>): Promise<Department> {
    const res = await (api as any).db.departments.$post({
      json: dept as any
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to add department');
    }
    return await res.json() as Department;
  }

  async updateDepartment(id: string, updates: Partial<Department>): Promise<void> {
    const res = await (api as any).db.departments[':id'].$patch({
      param: { id },
      json: updates as any
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to update department');
    }
  }

  async deleteDepartment(id: string): Promise<void> {
    const res = await (api as any).db.departments[':id'].$delete({
      param: { id }
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to delete department');
    }
  }

  async analyzeImage(imageUrl?: string, text?: string): Promise<any> {
    const res = await (api as any).ai.analyze.$post({
      json: { imageUrl, text }
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'AI Analysis failed');
    }
    return await res.json();
  }

  // --- LOCATIONS ---
  async getLocations(): Promise<Location[]> {
    const res = await (api as any).db.locations.$get({}, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to fetch locations');
    }
    return await res.json() as Location[];
  }

  async addLocation(loc: Omit<Location, 'id'>): Promise<Location> {
    const res = await (api as any).db.locations.$post({
      json: loc as any
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to add location');
    }
    return await res.json() as Location;
  }

  async bulkAddLocations(locations: Omit<Location, 'id'>[]): Promise<Location[]> {
    const res = await (api as any).db.locations.bulk.$post({
      json: locations as any
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to bulk add locations');
    }
    return await res.json() as Location[];
  }

  async updateLocation(id: string, updates: Partial<Location>): Promise<void> {
    const res = await (api as any).db.locations[':id'].$patch({
      param: { id },
      json: updates as any
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to update location');
    }
  }

  async deleteLocation(id: string): Promise<void> {
    const res = await (api as any).db.locations[':id'].$delete({
      param: { id }
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to delete location');
    }
  }

  async forceDeleteLocation(id: string) {
    const res = await (api as any).db.locations[':id'].force.$delete({
      param: { id }
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to force delete location');
  }

  async forceDeleteDepartment(id: string) {
    const res = await (api as any).db.departments[':id'].force.$delete({
      param: { id }
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to force delete department');
  }

  async clearAllLocations() {
    const res = await (api as any).db.locations.clear.$post({}, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to clear locations');
  }

  async clearAllDepartments(currentUserId?: string) {
    const res = await (api as any).db.departments.clear.$post({
      json: { keep_user_id: currentUserId }
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to clear departments');
  }

  // --- DEPARTMENT MAPPINGS ---
  async getDepartmentMappings(): Promise<DepartmentMapping[]> {
    const res = await (api as any).db['department-mappings'].$get({}, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) return [];
    return await res.json() as DepartmentMapping[];
  }

  async addDepartmentMapping(mapping: Omit<DepartmentMapping, 'id'>): Promise<DepartmentMapping> {
    const res = await (api as any).db['department-mappings'].$post({
      json: mapping as any
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to add mapping');
    return await res.json() as DepartmentMapping;
  }

  async clearDepartmentMappings(): Promise<void> {
    const res = await (api as any).db['department-mappings'].clear.$post({}, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to clear mappings');
  }

  async deleteDepartmentMapping(id: string): Promise<void> {
    const res = await (api as any).db['department-mappings'][':id'].$delete({
      param: { id }
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete mapping');
  }

  // --- ACTIVITIES ---
  async getSystemActivity(): Promise<SystemActivity[]> {
    const res = await (api as any).db.activity.$get({}, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) return [];
    return await res.json() as SystemActivity[];
  }

  async addSystemActivity(activity: Omit<SystemActivity, 'id'>): Promise<void> {
    await (api as any).db.activity.$post({
      json: activity as any
    }, {
      headers: await getAuthHeaders()
    });
  }

  async addPermission(perm: Omit<CrossAuditPermission, 'id'>) {
    await (api as any).db.permissions.$post({
      json: perm as any
    }, {
      headers: await getAuthHeaders()
    });
  }

  async bulkAddPermissions(perms: Omit<CrossAuditPermission, 'id'>[]) {
    await (api as any).db.permissions.bulk.$post({
      json: perms as any
    }, {
      headers: await getAuthHeaders()
    });
  }

  async deletePermission(id: string) {
    await (api as any).db.permissions[':id'].$delete({
      param: { id }
    }, {
      headers: await getAuthHeaders()
    });
  }

  async bulkDeletePermissions(ids: string[]) {
    await (api as any).db.permissions.bulk.$delete({
      json: { ids }
    }, {
      headers: await getAuthHeaders()
    });
  }

  async updatePermission(id: string, updates: Partial<CrossAuditPermission>) {
    await (api as any).db.permissions[':id'].$patch({
      param: { id },
      json: updates as any
    }, {
      headers: await getAuthHeaders()
    });
  }

  // --- AUDIT PHASES ---
  async getAuditPhases(): Promise<AuditPhase[]> {
    const res = await (api as any).db['audit-phases'].$get({}, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) return [];
    return await res.json() as AuditPhase[];
  }

  async addAuditPhase(phase: Omit<AuditPhase, 'id'>): Promise<AuditPhase> {
    const res = await (api as any).db['audit-phases'].$post({
      json: phase as any
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to add audit phase');
    return await res.json() as AuditPhase;
  }

  async updateAuditPhase(id: string, updates: Partial<AuditPhase>) {
    await (api as any).db['audit-phases'][':id'].$patch({
      param: { id },
      json: updates as any
    }, {
      headers: await getAuthHeaders()
    });
  }

  async deleteAuditPhase(id: string) {
    await (api as any).db['audit-phases'][':id'].$delete({
      param: { id }
    }, {
      headers: await getAuthHeaders()
    });
  }

  // --- KPI TIERS ---
  async getKPITiers(): Promise<KPITier[]> {
    const res = await (api as any).db['kpi-tiers'].$get({}, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) return [];
    return await res.json() as KPITier[];
  }

  async addKPITier(tier: Omit<KPITier, 'id'>) {
    await (api as any).db['kpi-tiers'].$post({
      json: tier as any
    }, {
      headers: await getAuthHeaders()
    });
  }

  async updateKPITier(id: string, updates: Partial<KPITier>) {
    await (api as any).db['kpi-tiers'][':id'].$patch({
      param: { id },
      json: updates as any
    }, {
      headers: await getAuthHeaders()
    });
  }

  async deleteKPITier(id: string) {
    await (api as any).db['kpi-tiers'][':id'].$delete({
      param: { id }
    }, {
      headers: await getAuthHeaders()
    });
  }

  // --- KPI TIER TARGETS ---
  async getKPITierTargets(): Promise<KPITierTarget[]> {
    const res = await (api as any).db['kpi-tier-targets'].$get({}, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) return [];
    return await res.json() as KPITierTarget[];
  }

  async setKPITierTarget(tierId: string, phaseId: string, percentage: number): Promise<void> {
    await (api as any).db['kpi-tier-targets'].$post({
      json: { tierId, phaseId, targetPercentage: percentage }
    }, {
      headers: await getAuthHeaders()
    });
  }

  async deleteKPITierTarget(id: string): Promise<void> {
    await (api as any).db['kpi-tier-targets'][':id'].$delete({
      param: { id }
    }, {
      headers: await getAuthHeaders()
    });
  }

  // --- AUDIT GROUPS ---
  async getAuditGroups(): Promise<AuditGroup[]> {
    const res = await (api as any).db['audit-groups'].$get({}, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) return [];
    return await res.json() as AuditGroup[];
  }

  async addAuditGroup(group: Omit<AuditGroup, 'id'>): Promise<AuditGroup> {
    const res = await (api as any).db['audit-groups'].$post({
      json: group as any
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to add audit group');
    return await res.json() as AuditGroup;
  }

  async updateAuditGroup(id: string, updates: Partial<AuditGroup>): Promise<void> {
    await (api.db as any)['audit-groups'][':id'].$patch({
      param: { id },
      json: updates as any
    }, {
      headers: await getAuthHeaders()
    });
  }

  async deleteAuditGroup(id: string): Promise<void> {
    await (api.db as any)['audit-groups'][':id'].$delete({
      param: { id }
    }, {
      headers: await getAuthHeaders()
    });
  }

  async getInstitutionKPIs(): Promise<InstitutionKPITarget[]> {
    const res = await (api.db as any)['institution-kpi-targets'].$get({}, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) return [];
    return await res.json() as InstitutionKPITarget[];
  }

  async updateInstitutionKPI(phaseId: string, percentage: number): Promise<void> {
    await (api.db as any)['institution-kpi-targets'].$post({
      json: { phaseId, targetPercentage: percentage }
    }, {
      headers: await getAuthHeaders()
    });
  }

  // --- BUILDINGS ---
  async getBuildings(): Promise<Building[]> {
    const res = await (api.db as any).buildings.$get({}, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) return [];
    return await res.json() as Building[];
  }

  async updateBuilding(building: Partial<Building>): Promise<Building> {
    const res = await (api.db as any).buildings.$post({
      json: building as any
    }, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to update building');
    return await res.json() as Building;
  }

  async deleteBuilding(id: string): Promise<void> {
    await (api.db as any).buildings[':id'].$delete({
      param: { id }
    }, {
      headers: await getAuthHeaders()
    });
  }

  async getSystemSettings(): Promise<SystemSetting[]> {
    const res = await (api.db as any)['system-settings'].$get({}, {
      headers: await getAuthHeaders()
    });
    if (!res.ok) return [];
    return await res.json() as SystemSetting[];
  }

  async updateSystemSetting(id: string, value: any): Promise<void> {
    await (api.db as any)['system-settings'][':id'].$post({
      param: { id },
      json: { value }
    }, {
      headers: await getAuthHeaders()
    });
  }
}

export const gateway = new DataGateway();
