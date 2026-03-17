
import { AuditSchedule, User, Department, Location, CrossAuditPermission, AuditPhase, KPITier, KPITierTarget, DepartmentMapping, SystemActivity, AuditGroup } from '../types';
import { supabase } from './supabase';
import { localDB } from './localDB'; 
import { INITIAL_DEPARTMENTS, INITIAL_LOCATIONS, INITIAL_AUDITS, CURRENT_USER, INITIAL_NOTIFICATIONS } from '../constants';

class DataGateway {
  private isDemoMode: boolean = false;
  
  constructor() {}
  
  private mapDepartmentToDB(dept: Partial<Department>) {
    const payload: any = {};
    if (dept.name !== undefined) payload.name = dept.name;
    if (dept.abbr !== undefined) payload.abbr = dept.abbr;
    if (dept.description !== undefined) payload.description = dept.description;
    if (dept.auditGroupId !== undefined) payload.audit_group_id = dept.auditGroupId;
    if (dept.totalAssets !== undefined) payload.total_assets = dept.totalAssets;
    if (dept.headOfDeptId !== undefined) {
      payload.head_of_dept_id = (dept.headOfDeptId && dept.headOfDeptId !== "") ? dept.headOfDeptId : null;
    }
    return payload;
  }

  private mapLocationToDB(loc: Partial<Location>) {
    const payload: any = {};
    if (loc.name !== undefined) payload.name = loc.name;
    if (loc.abbr !== undefined) payload.abbr = loc.abbr;
    if (loc.building !== undefined) payload.building = loc.building;
    if (loc.level !== undefined) payload.level = loc.level;
    if (loc.description !== undefined) payload.description = loc.description;
    if (loc.contact !== undefined) payload.contact = loc.contact;
    if (loc.totalAssets !== undefined) payload.total_assets = loc.totalAssets;
    if (loc.isActive !== undefined) payload.is_active = loc.isActive;
    
    if (loc.departmentId !== undefined) {
      payload.department_id = (loc.departmentId && loc.departmentId !== "") ? loc.departmentId : null;
    }
    if (loc.supervisorId !== undefined) {
      payload.supervisor_id = (loc.supervisorId && loc.supervisorId !== "") ? loc.supervisorId : null;
    }
    return payload;
  }

  private mapUserToDB(user: Partial<User>) {
    const payload: any = {};
    if (user.id !== undefined) payload.id = user.id;
    if (user.name !== undefined) payload.name = user.name;
    if (user.email !== undefined) payload.email = user.email;
    if (user.pin !== undefined) payload.pin = user.pin;
    if (user.roles !== undefined) payload.roles = user.roles;
    if (user.designation !== undefined) payload.designation = user.designation;
    if (user.status !== undefined) payload.status = user.status;
    if (user.isVerified !== undefined) payload.is_verified = user.isVerified;
    if (user.mustChangePIN !== undefined) payload.must_change_pin = user.mustChangePIN;
    if (user.dashboardConfig !== undefined) payload.dashboard_config = user.dashboardConfig;
    
    if (user.departmentId !== undefined) {
      payload.department_id = (user.departmentId && user.departmentId !== "") ? user.departmentId : null;
    }
    if (user.contactNumber !== undefined) payload.contact_number = user.contactNumber;
    if (user.lastActive !== undefined) {
      if (user.lastActive === 'Just now') {
        payload.last_active = new Date().toISOString();
      } else {
        payload.last_active = user.lastActive;
      }
    }
    if (user.certificationIssued !== undefined) payload.certification_issued = user.certificationIssued;
    if (user.certificationExpiry !== undefined) payload.certification_expiry = user.certificationExpiry;
    
    return payload;
  }

  private mapAuditToDB(audit: Partial<AuditSchedule>) {
    const payload: any = {};
    if (audit.status !== undefined) payload.status = audit.status;
    if (audit.date !== undefined) payload.date = (audit.date === "" ? null : audit.date);
    
    if (audit.departmentId !== undefined) {
      payload.department_id = (audit.departmentId && audit.departmentId !== "") ? audit.departmentId : null;
    }
    if (audit.locationId !== undefined) {
      payload.location_id = (audit.locationId && audit.locationId !== "") ? audit.locationId : null;
    }
    if (audit.supervisorId !== undefined) {
      payload.supervisor_id = (audit.supervisorId && audit.supervisorId !== "") ? audit.supervisorId : null;
    }
    if (audit.auditor1Id !== undefined) {
      payload.auditor1_id = (audit.auditor1Id && audit.auditor1Id !== "") ? audit.auditor1Id : null;
    }
    if (audit.auditor2Id !== undefined) {
      payload.auditor2_id = (audit.auditor2Id && audit.auditor2Id !== "") ? audit.auditor2Id : null;
    }
    if (audit.phaseId !== undefined) {
      payload.phase_id = (audit.phaseId && audit.phaseId !== "") ? audit.phaseId : null;
    }
    return payload;
  }

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
      const payload = this.mapAuditToDB(audit);
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
      const payloads = audits.map(a => this.mapAuditToDB(a));
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
      const payload = this.mapAuditToDB(updates);
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
      const payload = this.mapUserToDB(user);
      
      // Use upsert with email as the conflict target to handle potential ID changes/clashes
      const { data, error } = await supabase.from('users').upsert([payload], { onConflict: 'email' }).select().single();
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
      const payload = this.mapUserToDB(updates);
      // Try updating by ID first
      const { data, error } = await supabase.from('users').update(payload).eq('id', id).select();
      
      // If no rows were affected and we have an email, try updating by email as a fallback
      // (This handles cases where the user's ID changed but email remained the same)
      if (!error && (!data || data.length === 0) && updates.email) {
        await supabase.from('users').update(payload).eq('email', updates.email);
      } else if (error) {
        throw error;
      }
      return;
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
        auditGroupId: d.audit_group_id,
        totalAssets: d.total_assets
      })) as Department[];
    }
    return [];
  }

  async addDepartment(dept: Omit<Department, 'id'>): Promise<Department> {
    if (supabase) {
      const payload = this.mapDepartmentToDB(dept);
      const { data, error } = await supabase.from('departments').insert([payload]).select().single();
      if (error) throw error;
      
      const result = data as any;
      return {
        ...result,
        headOfDeptId: result.head_of_dept_id,
        auditGroupId: result.audit_group_id,
        totalAssets: result.total_assets
      } as Department;
    }
    throw new Error("Supabase client not initialized");
  }

  async updateDepartment(id: string, updates: Partial<Department>) {
    if (supabase) {
      const payload = this.mapDepartmentToDB(updates);
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
      const payload = this.mapLocationToDB(loc);

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
      const payloads = locations.map(loc => this.mapLocationToDB(loc));

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
      const payload = this.mapLocationToDB(updates);
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
      const { data, error } = await supabase.from('department_mappings').upsert({
        source_name: mapping.sourceName,
        target_department_id: mapping.targetDepartmentId
      }, { onConflict: 'source_name' }).select().single();
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

  async clearDepartmentMappings(): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from('department_mappings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      return;
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
      // Prefer joined targets when the relationship exists (new schema).
      // Fallback to plain select when the join/table doesn't exist yet in the deployed DB.
      let data: any[] | null = null;
      let error: any = null;
      const joined = await supabase
        .from('kpi_tiers')
        .select('*, kpi_tier_targets(phase_id, target_percentage)');
      data = joined.data as any;
      error = joined.error as any;

      if (error) {
        const msg = String(error?.message || error);
        const hint = String(error?.hint || '');
        const details = String(error?.details || '');
        const combined = `${msg} ${hint} ${details}`.toLowerCase();

        // Common cases during rollout: missing table, missing relationship, legacy schema
        if (combined.includes('kpi_tier_targets') || combined.includes('does not exist') || combined.includes('relationship')) {
          const fallback = await supabase.from('kpi_tiers').select('*');
          if (fallback.error) throw fallback.error;
          data = fallback.data as any;
        } else {
          throw error;
        }
      }

      return (data || []).map((t: any) => ({
        ...t,
        minAssets: t.min_assets,
        maxAssets: t.max_assets,
        targets: (t.kpi_tier_targets || []).reduce((acc: Record<string, number>, row: any) => {
          if (row?.phase_id) acc[row.phase_id] = row.target_percentage ?? 0;
          return acc;
        }, {})
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

  // --- KPI TIER TARGETS ---
  async getKPITierTargets(): Promise<KPITierTarget[]> {
    if (supabase) {
      const { data, error } = await supabase.from('kpi_tier_targets').select('*');
      if (error) {
        const msg = String(error?.message || error).toLowerCase();
        // Allow app to load on DBs that haven't deployed the new table yet
        if (msg.includes('kpi_tier_targets') && msg.includes('does not exist')) return [];
        if (String(error?.code || '') === '42P01') return []; // undefined_table
        throw error;
      }
      return (data || []).map((t: any) => ({
        id: t.id,
        tierId: t.tier_id,
        phaseId: t.phase_id,
        targetPercentage: t.target_percentage
      })) as KPITierTarget[];
    }
    return [];
  }

  async setKPITierTarget(tierId: string, phaseId: string, percentage: number): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from('kpi_tier_targets').upsert({
        tier_id: tierId,
        phase_id: phaseId,
        target_percentage: percentage
      }, { onConflict: 'tier_id,phase_id' });
      if (error) {
        const msg = String(error?.message || error).toLowerCase();
        if ((msg.includes('kpi_tier_targets') && msg.includes('does not exist')) || String(error?.code || '') === '42P01') {
          throw new Error("KPI targets table is not deployed yet. Please run the latest SUPABASE_SETUP.sql (kpi_tier_targets).");
        }
        throw error;
      }
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async deleteKPITierTarget(id: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from('kpi_tier_targets').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  // --- AUDIT GROUPS ---
  async getAuditGroups(): Promise<AuditGroup[]> {
    if (supabase) {
      const { data, error } = await supabase.from('audit_groups').select('*').order('name');
      if (error) throw error;
      return data || [];
    }
    return [];
  }

  async addAuditGroup(group: Omit<AuditGroup, 'id'>): Promise<AuditGroup> {
    if (supabase) {
      const { data, error } = await supabase.from('audit_groups').insert([group]).select().single();
      if (error) throw error;
      return data;
    }
    throw new Error("Supabase client not initialized");
  }

  async updateAuditGroup(id: string, updates: Partial<AuditGroup>): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from('audit_groups').update(updates).eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async deleteAuditGroup(id: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from('audit_groups').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }
}

export const gateway = new DataGateway();
