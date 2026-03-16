
import { AuditSchedule, User, Department, Location, CrossAuditPermission, AuditPhase, KPITier, DepartmentMapping, SystemActivity } from '../types';
import { supabase } from './supabase';
import { localDB } from './localDB'; 
import { INITIAL_DEPARTMENTS, INITIAL_LOCATIONS, INITIAL_AUDITS, CURRENT_USER, INITIAL_NOTIFICATIONS } from '../constants';

class DataGateway {
  private isDemoMode: boolean = false;
  
  constructor() {}

  private generateId(): string {
    return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;
  }

  setDemoMode(enabled: boolean) {
    this.isDemoMode = enabled;
  }

  // --- AUDITS ---
  async getAudits(): Promise<AuditSchedule[]> {
    if (supabase) {
      const { data, error } = await supabase.from('audits').select('*');
      if (error) throw error;
      return (data || []).map((a: any) => ({
        ...a,
        departmentId: a.department_id,
        locationId: a.location_id,
        supervisorId: a.supervisor_id,
        auditor1Id: a.auditor1_id,
        auditor2Id: a.auditor2_id,
        phaseId: a.phase_id
      })) as AuditSchedule[];
    }
    return [];
  }

  async addAudit(audit: Omit<AuditSchedule, 'id'>): Promise<AuditSchedule> {
    if (supabase) {
      const payload: any = { ...audit };
      if (audit.departmentId !== undefined) payload.department_id = audit.departmentId;
      if (audit.locationId !== undefined) payload.location_id = audit.locationId;
      if (audit.supervisorId !== undefined) payload.supervisor_id = audit.supervisorId;
      if (audit.auditor1Id !== undefined) payload.auditor1_id = audit.auditor1Id;
      if (audit.auditor2Id !== undefined) payload.auditor2_id = audit.auditor2Id;
      if (audit.phaseId !== undefined) payload.phase_id = audit.phaseId;

      delete payload.departmentId;
      delete payload.locationId;
      delete payload.supervisorId;
      delete payload.auditor1Id;
      delete payload.auditor2Id;
      delete payload.phaseId;
      if (payload.date === "") payload.date = null;
      const { data, error } = await supabase.from('audits').insert([payload]).select().single();
      if (error) throw error;
      return { 
        ...data, 
        departmentId: data.department_id,
        locationId: data.location_id,
        supervisorId: data.supervisor_id,
        auditor1Id: data.auditor1_id,
        auditor2Id: data.auditor2_id,
        phaseId: data.phase_id 
      } as AuditSchedule;
    }
    throw new Error("Supabase client not initialized");
  }
  
  async bulkAddAudits(audits: Omit<AuditSchedule, 'id'>[]): Promise<AuditSchedule[]> {
    if (supabase) {
      const payloads = audits.map(a => {
        const p: any = { ...a };
        if (a.departmentId !== undefined) p.department_id = a.departmentId;
        if (a.locationId !== undefined) p.location_id = a.locationId;
        if (a.supervisorId !== undefined) p.supervisor_id = a.supervisorId;
        if (a.auditor1Id !== undefined) p.auditor1_id = a.auditor1Id;
        if (a.auditor2Id !== undefined) p.auditor2_id = a.auditor2Id;
        if (a.phaseId !== undefined) p.phase_id = a.phaseId;

        delete p.departmentId;
        delete p.locationId;
        delete p.supervisorId;
        delete p.auditor1Id;
        delete p.auditor2Id;
        delete p.phaseId;
        if (p.date === "") p.date = null;
        return p;
      });
      const { data, error } = await supabase.from('audits').insert(payloads).select();
      if (error) throw error;
      return (data || []).map((a: any) => ({
        ...a,
        departmentId: a.department_id,
        locationId: a.location_id,
        supervisorId: a.supervisor_id,
        auditor1Id: a.auditor1_id,
        auditor2Id: a.auditor2_id,
        phaseId: a.phase_id
      })) as AuditSchedule[];
    }
    throw new Error("Supabase client not initialized");
  }

  async updateAudit(id: string, updates: Partial<AuditSchedule>) {
    if (supabase) {
      const payload: any = { ...updates };
      if (updates.departmentId !== undefined) payload.department_id = updates.departmentId;
      if (updates.locationId !== undefined) payload.location_id = updates.locationId;
      if (updates.supervisorId !== undefined) payload.supervisor_id = updates.supervisorId;
      if (updates.auditor1Id !== undefined) payload.auditor1_id = updates.auditor1Id;
      if (updates.auditor2Id !== undefined) payload.auditor2_id = updates.auditor2Id;
      if (updates.phaseId !== undefined) payload.phase_id = updates.phaseId;

      delete payload.departmentId;
      delete payload.locationId;
      delete payload.supervisorId;
      delete payload.auditor1Id;
      delete payload.auditor2Id;
      delete payload.phaseId;
      if (payload.date === "") payload.date = null;
      const { error } = await supabase.from('audits').update(payload).eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async deleteAudit(id: string) {
    if (supabase) {
      const { error } = await supabase.from('audits').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  // --- USERS ---
  async getUsers(): Promise<User[]> {
    if (supabase) {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      return data.map((u: any) => ({
        ...u,
        departmentId: u.department_id,
        contactNumber: u.contact_number,
        isVerified: u.is_verified,
        lastActive: u.last_active,
        certificationIssued: u.certification_issued,
        certificationExpiry: u.certification_expiry,
        dashboardConfig: u.dashboard_config,
      })) as User[];
    }
    return [];
  }

  async addUser(user: User): Promise<User> {
    if (supabase) {
      const payload: any = { ...user };
      if (user.departmentId !== undefined) { payload.department_id = user.departmentId; delete payload.departmentId; }
      if (user.contactNumber !== undefined) { payload.contact_number = user.contactNumber; delete payload.contactNumber; }
      if (user.isVerified !== undefined) { payload.is_verified = user.isVerified; delete payload.isVerified; }
      if (user.lastActive !== undefined) { payload.last_active = user.lastActive; delete payload.lastActive; }
      if (user.certificationIssued !== undefined) { payload.certification_issued = user.certificationIssued; delete payload.certificationIssued; }
      if (user.certificationExpiry !== undefined) { payload.certification_expiry = user.certificationExpiry; delete payload.certificationExpiry; }
      if (user.dashboardConfig !== undefined) { payload.dashboard_config = user.dashboardConfig; delete payload.dashboardConfig; }
      
      const { data, error } = await supabase.from('users').upsert([payload]).select().single();
      if (error) throw error;
      
      const result = data as any;
      return {
        ...result,
        departmentId: result.department_id,
        contactNumber: result.contact_number,
        isVerified: result.is_verified,
        lastActive: result.last_active,
        certificationIssued: result.certification_issued,
        certificationExpiry: result.certification_expiry,
        dashboardConfig: result.dashboard_config
      } as User;
    }
    throw new Error("Supabase client not initialized");
  }

  async verifyUser(id: string): Promise<User> {
    if (supabase) {
      const { data, error } = await supabase.from('users').update({ is_verified: true, status: 'Active' }).eq('id', id).select().single();
      if (error) throw error;
      
      const result = data as any;
      return {
        ...result,
        departmentId: result.department_id,
        contactNumber: result.contact_number,
        isVerified: result.is_verified,
        lastActive: result.last_active,
        certificationIssued: result.certification_issued,
        certificationExpiry: result.certification_expiry,
        dashboardConfig: result.dashboard_config
      } as User;
    }
    throw new Error("Supabase client not initialized");
  }

  async updateUser(id: string, updates: Partial<User>) {
    if (supabase) {
      const payload: any = { ...updates };
      if (updates.departmentId !== undefined) { payload.department_id = updates.departmentId; delete payload.departmentId; }
      if (updates.contactNumber !== undefined) { payload.contact_number = updates.contactNumber; delete payload.contactNumber; }
      if (updates.isVerified !== undefined) { payload.is_verified = updates.isVerified; delete payload.isVerified; }
      if (updates.lastActive !== undefined) { payload.last_active = updates.lastActive; delete payload.lastActive; }
      if (updates.certificationIssued !== undefined) { payload.certification_issued = updates.certificationIssued; delete payload.certificationIssued; }
      if (updates.certificationExpiry !== undefined) { payload.certification_expiry = updates.certificationExpiry; delete payload.certificationExpiry; }
      if (updates.dashboardConfig !== undefined) { payload.dashboard_config = updates.dashboardConfig; delete payload.dashboardConfig; }

      const { error } = await supabase.from('users').update(payload).eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async deleteUser(id: string) {
    if (supabase) {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async enableDemoMode() {
      // Demo mode disabled - strictly using Supabase
      console.warn("Demo mode is disabled. Using Supabase backend.");
  }

  // --- DEPARTMENTS ---
  async getDepartments(): Promise<Department[]> {
    if (supabase) {
      const { data, error } = await supabase.from('departments').select('*');
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        headOfDeptId: d.head_of_dept_id,
        auditGroup: d.audit_group
      })) as Department[];
    }
    return [];
  }

  async addDepartment(dept: Omit<Department, 'id'>): Promise<Department> {
    if (supabase) {
      const payload: any = { ...dept };
      if (dept.headOfDeptId !== undefined) { payload.head_of_dept_id = dept.headOfDeptId; }
      delete payload.headOfDeptId;
      if (dept.auditGroup !== undefined) { payload.audit_group = dept.auditGroup; }
      delete payload.auditGroup;

      const { data, error } = await supabase.from('departments').insert([payload]).select().single();
      if (error) throw error;
      
      const result = data as any;
      return {
        ...result,
        headOfDeptId: result.head_of_dept_id,
        auditGroup: result.audit_group
      } as Department;
    }
    throw new Error("Supabase client not initialized");
  }

  async updateDepartment(id: string, updates: Partial<Department>) {
    if (supabase) {
      const payload: any = { ...updates };
      if (updates.headOfDeptId !== undefined) { payload.head_of_dept_id = updates.headOfDeptId; }
      delete payload.headOfDeptId;
      if (updates.auditGroup !== undefined) { payload.audit_group = updates.auditGroup; }
      delete payload.auditGroup;

      const { error } = await supabase.from('departments').update(payload).eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async deleteDepartment(id: string) {
    if (supabase) {
      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  // --- LOCATIONS ---
  async getLocations(): Promise<Location[]> {
    if (supabase) {
      const { data, error } = await supabase.from('locations').select('*');
      if (error) throw error;
      return (data || []).map((l: any) => ({
        ...l,
        departmentId: l.department_id,
        supervisorId: l.supervisor_id,
        totalAssets: l.total_assets,
        isActive: l.is_active ?? true
      })) as Location[];
    }
    return [];
  }

  async addLocation(loc: Omit<Location, 'id'>): Promise<Location> {
    if (supabase) {
      const payload: any = { ...loc };
      if (loc.departmentId !== undefined) { payload.department_id = loc.departmentId; delete payload.departmentId; }
      if (loc.supervisorId !== undefined) { payload.supervisor_id = loc.supervisorId; delete payload.supervisorId; }
      if (loc.totalAssets !== undefined) { payload.total_assets = loc.totalAssets; delete payload.totalAssets; }
      if (loc.isActive !== undefined) { payload.is_active = loc.isActive; delete payload.isActive; }

      const { data, error } = await supabase.from('locations').insert([payload]).select().single();
      if (error) throw error;
      
      const result = data as any;
      return {
        ...result,
        departmentId: result.department_id,
        supervisorId: result.supervisor_id,
        totalAssets: result.total_assets,
        isActive: result.is_active
      } as Location;
    }
    throw new Error("Supabase client not initialized");
  }

  async bulkAddLocations(locations: Omit<Location, 'id'>[]): Promise<Location[]> {
    if (supabase) {
      const payloads = locations.map(loc => {
        const payload: any = { ...loc };
        if (loc.departmentId !== undefined) { payload.department_id = loc.departmentId; delete payload.departmentId; }
        if (loc.supervisorId !== undefined) { payload.supervisor_id = loc.supervisorId; delete payload.supervisorId; }
        if (loc.totalAssets !== undefined) { payload.total_assets = loc.totalAssets; delete payload.totalAssets; }
        if (loc.isActive !== undefined) { payload.is_active = loc.isActive; delete payload.isActive; }
        return payload;
      });

      const { data, error } = await supabase.from('locations').insert(payloads).select();
      if (error) throw error;
      return (data || []).map((l: any) => ({
        ...l,
        departmentId: l.department_id,
        supervisorId: l.supervisor_id,
        totalAssets: l.total_assets,
        isActive: l.is_active
      })) as Location[];
    }
    throw new Error("Supabase client not initialized");
  }

  async updateLocation(id: string, updates: Partial<Location>) {
    if (supabase) {
      const payload: any = { ...updates };
      if (updates.departmentId !== undefined) { payload.department_id = updates.departmentId; delete payload.departmentId; }
      if (updates.supervisorId !== undefined) { payload.supervisor_id = updates.supervisorId; delete payload.supervisorId; }
      if (updates.totalAssets !== undefined) { payload.total_assets = updates.totalAssets; delete payload.totalAssets; }
      if (updates.isActive !== undefined) { payload.is_active = updates.isActive; delete payload.isActive; }

      const { error } = await supabase.from('locations').update(payload).eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async deleteLocation(id: string) {
    if (supabase) {
      const { error } = await supabase.from('locations').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async forceDeleteLocation(id: string) {
    if (supabase) {
      const { error } = await supabase.rpc('force_delete_location', { loc_id: id });
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async forceDeleteDepartment(id: string) {
    if (supabase) {
      const { error } = await supabase.rpc('force_delete_department', { dept_id: id });
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async clearAllLocations() {
    if (supabase) {
      const { error } = await supabase.rpc('clear_all_locations');
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async clearAllDepartments(currentUserId?: string) {
    if (supabase) {
      const { error } = await supabase.rpc('clear_all_departments', { keep_user_id: currentUserId });
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  // --- DEPARTMENT MAPPINGS ---
  async getDepartmentMappings(): Promise<DepartmentMapping[]> {
    if (supabase) {
      const { data, error } = await supabase.from('department_mappings').select('*');
      if (error) throw error;
      return (data || []).map((m: any) => ({
        ...m,
        sourceName: m.source_name,
        targetDepartmentId: m.target_department_id
      })) as DepartmentMapping[];
    }
    return [];
  }

  async addDepartmentMapping(mapping: Omit<DepartmentMapping, 'id'>): Promise<DepartmentMapping> {
    if (supabase) {
      const { data, error } = await supabase.from('department_mappings').insert({
        source_name: mapping.sourceName,
        target_department_id: mapping.targetDepartmentId
      }).select().single();
      if (error) throw error;
      
      const result = data as any;
      return {
        ...result,
        sourceName: result.source_name,
        targetDepartmentId: result.target_department_id
      } as DepartmentMapping;
    }
    throw new Error("Supabase client not initialized");
  }

  async deleteDepartmentMapping(id: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from('department_mappings').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  // --- ACTIVITIES ---
  async getActivities(): Promise<SystemActivity[]> {
    if (supabase) {
      const { data, error } = await supabase.from('system_activities').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((a: any) => ({
        ...a,
        userId: a.user_id,
        auditId: a.audit_id,
        timestamp: a.created_at
      })) as SystemActivity[];
    }
    return [];
  }

  async addActivity(activity: Omit<SystemActivity, 'id'>): Promise<SystemActivity> {
    if (supabase) {
      const { data, error } = await supabase.from('system_activities').insert({
        type: activity.type,
        user_id: activity.userId,
        audit_id: activity.auditId,
        message: activity.message,
        metadata: activity.metadata
      }).select().single();
      if (error) throw error;
      
      const result = data as any;
      return {
        ...result,
        userId: result.user_id,
        auditId: result.audit_id,
        timestamp: result.created_at
      } as SystemActivity;
    }
    throw new Error("Supabase client not initialized");
  }

  // --- PERMISSIONS ---
  async getPermissions(): Promise<CrossAuditPermission[]> {
    if (supabase) {
      const { data, error } = await supabase.from('cross_audits').select('*');
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        auditorDeptId: p.auditor_dept_id,
        targetDeptId: p.target_dept_id,
        isActive: p.is_active,
        isMutual: p.is_mutual,
      })) as CrossAuditPermission[];
    }
    return [];
  }

  async addPermission(perm: Omit<CrossAuditPermission, 'id'>) {
    if (supabase) {
      const payload: any = { ...perm };
      if (perm.auditorDeptId) { payload.auditor_dept_id = perm.auditorDeptId; delete payload.auditorDeptId; }
      if (perm.targetDeptId) { payload.target_dept_id = perm.targetDeptId; delete payload.targetDeptId; }
      if (perm.isActive !== undefined) { payload.is_active = perm.isActive; delete payload.isActive; }
      if (perm.isMutual !== undefined) { payload.is_mutual = perm.isMutual; delete payload.isMutual; }

      const { error } = await supabase.from('cross_audits').insert([payload]);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async deletePermission(id: string) {
    if (supabase) {
      const { error } = await supabase.from('cross_audits').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async updatePermission(id: string, updates: Partial<CrossAuditPermission>) {
    if (supabase) {
      const payload: any = { ...updates };
      if (updates.auditorDeptId) { payload.auditor_dept_id = updates.auditorDeptId; delete payload.auditorDeptId; }
      if (updates.targetDeptId) { payload.target_dept_id = updates.targetDeptId; delete payload.targetDeptId; }
      if (updates.isActive !== undefined) { payload.is_active = updates.isActive; delete payload.isActive; }
      if (updates.isMutual !== undefined) { payload.is_mutual = updates.isMutual; delete payload.isMutual; }

      const { error } = await supabase.from('cross_audits').update(payload).eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  // --- AUDIT PHASES ---
  async getAuditPhases(): Promise<AuditPhase[]> {
    if (supabase) {
      const { data, error } = await supabase.from('audit_phases').select('*');
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        startDate: p.start_date,
        endDate: p.end_date,
      })) as AuditPhase[];
    }
    return [];
  }

  async addAuditPhase(phase: Omit<AuditPhase, 'id'>): Promise<AuditPhase> {
    if (supabase) {
      const payload: any = { ...phase };
      if (phase.startDate) { payload.start_date = phase.startDate; delete payload.startDate; }
      if (phase.endDate) { payload.end_date = phase.endDate; delete payload.endDate; }

      const { data, error } = await supabase.from('audit_phases').insert([payload]).select().single();
      if (error) throw error;
      return {
        ...data,
        startDate: data.start_date,
        endDate: data.end_date,
      } as AuditPhase;
    }
    throw new Error("Supabase client not initialized");
  }

  async updateAuditPhase(id: string, updates: Partial<AuditPhase>) {
    if (supabase) {
      const payload: any = { ...updates };
      if (updates.startDate) { payload.start_date = updates.startDate; delete payload.startDate; }
      if (updates.endDate) { payload.end_date = updates.endDate; delete payload.endDate; }

      const { error } = await supabase.from('audit_phases').update(payload).eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async deleteAuditPhase(id: string) {
    if (supabase) {
      const { error } = await supabase.from('audit_phases').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  // --- KPI TIERS ---
  async getKPITiers(): Promise<KPITier[]> {
    if (supabase) {
      const { data, error } = await supabase.from('kpi_tiers').select('*');
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        minAssets: t.min_assets,
        maxAssets: t.max_assets,
      })) as KPITier[];
    }
    return [];
  }

  async addKPITier(tier: Omit<KPITier, 'id'>) {
    if (supabase) {
      const payload: any = { ...tier };
      if (tier.minAssets !== undefined) { payload.min_assets = tier.minAssets; delete payload.minAssets; }
      if (tier.maxAssets !== undefined) { payload.max_assets = tier.maxAssets; delete payload.maxAssets; }

      const { error } = await supabase.from('kpi_tiers').insert([payload]);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async updateKPITier(id: string, updates: Partial<KPITier>) {
    if (supabase) {
      const payload: any = { ...updates };
      if (updates.minAssets !== undefined) { payload.min_assets = updates.minAssets; delete payload.minAssets; }
      if (updates.maxAssets !== undefined) { payload.max_assets = updates.maxAssets; delete payload.maxAssets; }

      const { error } = await supabase.from('kpi_tiers').update(payload).eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async deleteKPITier(id: string) {
    if (supabase) {
      const { error } = await supabase.from('kpi_tiers').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }
}

export const gateway = new DataGateway();
