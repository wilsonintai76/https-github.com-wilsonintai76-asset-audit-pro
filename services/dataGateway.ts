
import { AuditSchedule, User, Department, Location, CrossAuditPermission, AuditPhase, KPITier, AuditGroup } from '../types';
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
        id:           a.id,
        departmentId: a.department_id,
        locationId:   a.location_id,
        supervisorId: a.supervisor_id,
        auditor1Id:   a.auditor1_id,
        auditor2Id:   a.auditor2_id,
        date:         a.date,
        status:       a.status,
        building:     a.building,
        phaseId:      a.phase_id,
      })) as AuditSchedule[];
    }
    return [];
  }

  async addAudit(audit: Omit<AuditSchedule, 'id'>): Promise<AuditSchedule> {
    if (supabase) {
      const payload = {
        department_id: audit.departmentId,
        location_id:   audit.locationId,
        supervisor_id: audit.supervisorId || null,
        auditor1_id:   audit.auditor1Id,
        auditor2_id:   audit.auditor2Id,
        date:          audit.date || null,
        status:        audit.status,
        building:      audit.building,
        phase_id:      audit.phaseId,
      };
      const { data, error } = await supabase.from('audits').insert([payload]).select().single();
      if (error) throw error;
      return {
        id:           data.id,
        departmentId: data.department_id,
        locationId:   data.location_id,
        supervisorId: data.supervisor_id,
        auditor1Id:   data.auditor1_id,
        auditor2Id:   data.auditor2_id,
        date:         data.date,
        status:       data.status,
        building:     data.building,
        phaseId:      data.phase_id,
      } as AuditSchedule;
    }
    throw new Error("Supabase client not initialized");
  }
  
  async bulkAddAudits(audits: Omit<AuditSchedule, 'id'>[]): Promise<AuditSchedule[]> {
    if (supabase) {
      const payloads = audits.map(a => ({
        department_id: a.departmentId,
        location_id:   a.locationId,
        supervisor_id: a.supervisorId || null,
        auditor1_id:   a.auditor1Id,
        auditor2_id:   a.auditor2Id,
        date:          a.date || null,
        status:        a.status,
        building:      a.building,
        phase_id:      a.phaseId,
      }));
      const { data, error } = await supabase.from('audits').insert(payloads).select();
      if (error) throw error;
      return (data || []).map((a: any) => ({
        id:           a.id,
        departmentId: a.department_id,
        locationId:   a.location_id,
        supervisorId: a.supervisor_id,
        auditor1Id:   a.auditor1_id,
        auditor2Id:   a.auditor2_id,
        date:         a.date,
        status:       a.status,
        building:     a.building,
        phaseId:      a.phase_id,
      })) as AuditSchedule[];
    }
    throw new Error("Supabase client not initialized");
  }

  async updateAudit(id: string, updates: Partial<AuditSchedule>) {
    if (supabase) {
      const payload: Record<string, any> = {};
      if (updates.departmentId !== undefined) payload.department_id = updates.departmentId;
      if (updates.locationId   !== undefined) payload.location_id   = updates.locationId;
      if (updates.supervisorId !== undefined) payload.supervisor_id = updates.supervisorId;
      if (updates.auditor1Id   !== undefined) payload.auditor1_id   = updates.auditor1Id;
      if (updates.auditor2Id   !== undefined) payload.auditor2_id   = updates.auditor2Id;
      if (updates.date         !== undefined) payload.date          = updates.date || null;
      if (updates.status       !== undefined) payload.status        = updates.status;
      if (updates.building     !== undefined) payload.building      = updates.building;
      if (updates.phaseId      !== undefined) payload.phase_id      = updates.phaseId;
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
      return (data || []).map((u: any) => ({
        id:                  u.id,
        name:                u.name,
        email:               u.email,
        pin:                 u.pin,
        roles:               u.roles,
        picture:             u.picture,
        departmentId:        u.department_id,
        contactNumber:       u.contact_number,
        permissions:         u.permissions,
        lastActive:          u.last_active,
        certificationIssued: u.certification_issued,
        certificationExpiry: u.certification_expiry,
        status:              u.status,
        isVerified:          u.is_verified,
        dashboardConfig:     u.dashboard_config,
      })) as User[];
    }
    return [];
  }

  async addUser(user: User): Promise<User> {
    if (supabase) {
      const payload: Record<string, any> = {
        id:                   user.id,
        name:                 user.name,
        email:                user.email,
        pin:                  user.pin ?? '1234',
        roles:                user.roles,
        status:               user.status,
        is_verified:          user.isVerified ?? false,
      };
      if (user.picture             !== undefined) payload.picture              = user.picture;
      if (user.departmentId        !== undefined) payload.department_id        = user.departmentId;
      if (user.contactNumber       !== undefined) payload.contact_number       = user.contactNumber;
      if (user.permissions         !== undefined) payload.permissions          = user.permissions;
      if (user.lastActive          !== undefined) payload.last_active          = user.lastActive;
      if (user.certificationIssued !== undefined) payload.certification_issued = user.certificationIssued;
      if (user.certificationExpiry !== undefined) payload.certification_expiry = user.certificationExpiry;
      if (user.dashboardConfig     !== undefined) payload.dashboard_config     = user.dashboardConfig;
      const { data, error } = await supabase.from('users').upsert([payload]).select().single();
      if (error) throw error;
      return {
        id:                  data.id,
        name:                data.name,
        email:               data.email,
        pin:                 data.pin,
        roles:               data.roles,
        picture:             data.picture,
        departmentId:        data.department_id,
        contactNumber:       data.contact_number,
        permissions:         data.permissions,
        lastActive:          data.last_active,
        certificationIssued: data.certification_issued,
        certificationExpiry: data.certification_expiry,
        status:              data.status,
        isVerified:          data.is_verified,
        dashboardConfig:     data.dashboard_config,
      } as User;
    }
    throw new Error("Supabase client not initialized");
  }

  async verifyUser(id: string): Promise<User> {
    if (supabase) {
      const { data, error } = await supabase.from('users').update({ is_verified: true }).eq('id', id).select().single();
      if (error) throw error;
      return {
        id:                  data.id,
        name:                data.name,
        email:               data.email,
        pin:                 data.pin,
        roles:               data.roles,
        picture:             data.picture,
        departmentId:        data.department_id,
        contactNumber:       data.contact_number,
        permissions:         data.permissions,
        lastActive:          data.last_active,
        certificationIssued: data.certification_issued,
        certificationExpiry: data.certification_expiry,
        status:              data.status,
        isVerified:          data.is_verified,
        dashboardConfig:     data.dashboard_config,
      } as User;
    }
    throw new Error("Supabase client not initialized");
  }

  async updateUser(id: string, updates: Partial<User>) {
    if (supabase) {
      const payload: Record<string, any> = {};
      if (updates.name                !== undefined) payload.name                 = updates.name;
      if (updates.email               !== undefined) payload.email                = updates.email;
      if (updates.pin                 !== undefined) payload.pin                  = updates.pin;
      if (updates.roles               !== undefined) payload.roles                = updates.roles;
      if (updates.picture             !== undefined) payload.picture              = updates.picture;
      if (updates.departmentId        !== undefined) payload.department_id        = updates.departmentId;
      if (updates.contactNumber       !== undefined) payload.contact_number       = updates.contactNumber;
      if (updates.permissions         !== undefined) payload.permissions          = updates.permissions;
      if (updates.lastActive          !== undefined) payload.last_active          = updates.lastActive;
      if (updates.certificationIssued !== undefined) payload.certification_issued = updates.certificationIssued;
      if (updates.certificationExpiry !== undefined) payload.certification_expiry = updates.certificationExpiry;
      if (updates.status              !== undefined) payload.status               = updates.status;
      if (updates.isVerified          !== undefined) payload.is_verified          = updates.isVerified;
      if (updates.dashboardConfig     !== undefined) payload.dashboard_config     = updates.dashboardConfig;
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
        id:            d.id,
        name:          d.name,
        abbr:          d.abbr,
        headOfDeptId:  d.head_of_dept_id,
        description:   d.description,
        auditGroup:    d.audit_group,
      })) as Department[];
    }
    return [];
  }

  async addDepartment(dept: Omit<Department, 'id'>) {
    if (supabase) {
      const payload: Record<string, any> = {
        name:        dept.name,
        abbr:        dept.abbr,
        description: dept.description,
        audit_group: dept.auditGroup,
      };
      if (dept.headOfDeptId) payload.head_of_dept_id = dept.headOfDeptId;
      const { error } = await supabase.from('departments').insert([payload]);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async updateDepartment(id: string, updates: Partial<Department>) {
    if (supabase) {
      const payload: Record<string, any> = {};
      if (updates.name         !== undefined) payload.name            = updates.name;
      if (updates.abbr         !== undefined) payload.abbr            = updates.abbr;
      if (updates.headOfDeptId !== undefined) payload.head_of_dept_id = updates.headOfDeptId;
      if (updates.description  !== undefined) payload.description     = updates.description;
      if (updates.auditGroup   !== undefined) payload.audit_group     = updates.auditGroup;
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
        id:           l.id,
        name:         l.name,
        abbr:         l.abbr,
        departmentId: l.department_id,
        building:     l.building,
        level:        l.level,
        description:  l.description,
        supervisorId: l.supervisor_id,
        contact:      l.contact,
        totalAssets:  l.total_assets,
      })) as Location[];
    }
    return [];
  }

  async addLocation(loc: Omit<Location, 'id'>): Promise<Location> {
    if (supabase) {
      const payload = {
        name:          loc.name,
        abbr:          loc.abbr,
        department_id: loc.departmentId,
        building:      loc.building,
        level:         loc.level,
        description:   loc.description,
        supervisor_id: loc.supervisorId || null,
        contact:       loc.contact,
        total_assets:  loc.totalAssets,
      };
      const { data, error } = await supabase.from('locations').insert([payload]).select().single();
      if (error) throw error;
      return {
        id:           data.id,
        name:         data.name,
        abbr:         data.abbr,
        departmentId: data.department_id,
        building:     data.building,
        level:        data.level,
        description:  data.description,
        supervisorId: data.supervisor_id,
        contact:      data.contact,
        totalAssets:  data.total_assets,
      } as Location;
    }
    throw new Error("Supabase client not initialized");
  }

  async bulkAddLocations(locations: Omit<Location, 'id'>[]): Promise<Location[]> {
    if (supabase) {
      const payloads = locations.map(loc => ({
        name:          loc.name,
        abbr:          loc.abbr,
        department_id: loc.departmentId,
        building:      loc.building,
        level:         loc.level,
        description:   loc.description,
        supervisor_id: loc.supervisorId || null,
        contact:       loc.contact,
        total_assets:  loc.totalAssets,
      }));
      const { data, error } = await supabase.from('locations').insert(payloads).select();
      if (error) throw error;
      return (data || []).map((l: any) => ({
        id:           l.id,
        name:         l.name,
        abbr:         l.abbr,
        departmentId: l.department_id,
        building:     l.building,
        level:        l.level,
        description:  l.description,
        supervisorId: l.supervisor_id,
        contact:      l.contact,
        totalAssets:  l.total_assets,
      })) as Location[];
    }
    throw new Error("Supabase client not initialized");
  }

  async updateLocation(id: string, updates: Partial<Location>) {
    if (supabase) {
      const payload: Record<string, any> = {};
      if (updates.name         !== undefined) payload.name          = updates.name;
      if (updates.abbr         !== undefined) payload.abbr          = updates.abbr;
      if (updates.departmentId !== undefined) payload.department_id = updates.departmentId;
      if (updates.building     !== undefined) payload.building      = updates.building;
      if (updates.level        !== undefined) payload.level         = updates.level;
      if (updates.description  !== undefined) payload.description   = updates.description;
      if (updates.supervisorId !== undefined) payload.supervisor_id = updates.supervisorId;
      if (updates.contact      !== undefined) payload.contact       = updates.contact;
      if (updates.totalAssets  !== undefined) payload.total_assets  = updates.totalAssets;
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

  async forceDeleteLocation(id: string, _name: string) {
    if (supabase) {
      // audits.location_id is ON DELETE RESTRICT → delete audits first
      await supabase.from('audits').delete().eq('location_id', id);
      // locations.supervisor_id ON DELETE SET NULL → no action needed for users
      const { error } = await supabase.from('locations').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async forceDeleteDepartment(id: string, _name: string) {
    if (supabase) {
      // 1. Break circular FK: clear head_of_dept_id on this department
      //    (departments.head_of_dept_id → users(id) DEFERRABLE SET NULL)
      await supabase.from('departments').update({ head_of_dept_id: null }).eq('id', id);

      // 2. Collect locations in this department so we can delete their audits
      const { data: locs } = await supabase.from('locations').select('id').eq('department_id', id);
      if (locs && locs.length > 0) {
        const locIds = locs.map((l: any) => l.id);
        // audits.location_id ON DELETE RESTRICT → delete before locations
        await supabase.from('audits').delete().in('location_id', locIds);
      }

      // 3. Delete audits whose department_id matches (ON DELETE RESTRICT)
      await supabase.from('audits').delete().eq('department_id', id);

      // 4. Delete locations in this department (ON DELETE RESTRICT)
      await supabase.from('locations').delete().eq('department_id', id);

      // 5. Delete the department
      //    → cross_audits rows auto-deleted      (ON DELETE CASCADE)
      //    → users.department_id auto-set NULL   (ON DELETE SET NULL)
      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async clearAllLocations() {
    if (supabase) {
      // audits.location_id ON DELETE RESTRICT → must delete audits before locations
      const { error: errAudits } = await supabase.from('audits').delete().gte('date', '1900-01-01');
      if (errAudits) throw errAudits;
      const { error } = await supabase.from('locations').delete().gte('name', '');
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async clearAllDepartments(currentUserId?: string) {
    if (supabase) {
      // 1. Delete all audits  (audits.department_id / location_id ON DELETE RESTRICT)
      const { error: e1 } = await supabase.from('audits').delete().gte('date', '1900-01-01');
      if (e1) throw e1;

      // 2. Delete all locations (locations.department_id ON DELETE RESTRICT)
      const { error: e2 } = await supabase.from('locations').delete().gte('name', '');
      if (e2) throw e2;

      // 3. Clear head_of_dept_id on all departments (break circular FK before deleting users)
      const { error: e3 } = await supabase.from('departments').update({ head_of_dept_id: null }).gte('name', '');
      if (e3) throw e3;

      // 4. Delete non-current users
      //    departments.head_of_dept_id ON DELETE SET NULL is now safe
      if (currentUserId) {
        await supabase.from('users').delete().neq('id', currentUserId);
        // Reset current user's department link
        await supabase.from('users').update({ department_id: null }).eq('id', currentUserId);
      } else {
        await supabase.from('users').delete().gte('id', '');
      }

      // 5. Delete all departments
      //    → cross_audits auto-deleted    (ON DELETE CASCADE)
      //    → users.department_id auto-NULL (ON DELETE SET NULL)
      const { error: e5 } = await supabase.from('departments').delete().gte('name', '');
      if (e5) throw e5;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  // --- PERMISSIONS ---
  async getPermissions(): Promise<CrossAuditPermission[]> {
    if (supabase) {
      const { data, error } = await supabase.from('cross_audits').select('*');
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id:            p.id,
        auditorDeptId: p.auditor_dept_id,
        targetDeptId:  p.target_dept_id,
        isActive:      p.is_active,
        isMutual:      p.is_mutual,
      })) as CrossAuditPermission[];
    }
    return [];
  }

  async addPermission(perm: Omit<CrossAuditPermission, 'id'>) {
    if (supabase) {
      const payload = {
        auditor_dept_id: perm.auditorDeptId,
        target_dept_id:  perm.targetDeptId,
        is_active:       perm.isActive,
        is_mutual:       perm.isMutual,
      };
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
      const payload: Record<string, any> = {};
      if (updates.auditorDeptId !== undefined) payload.auditor_dept_id = updates.auditorDeptId;
      if (updates.targetDeptId  !== undefined) payload.target_dept_id  = updates.targetDeptId;
      if (updates.isActive      !== undefined) payload.is_active       = updates.isActive;
      if (updates.isMutual      !== undefined) payload.is_mutual       = updates.isMutual;
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
        id:        p.id,
        name:      p.name,
        startDate: p.start_date,
        endDate:   p.end_date,
      })) as AuditPhase[];
    }
    return [];
  }

  async addAuditPhase(phase: Omit<AuditPhase, 'id'>) {
    if (supabase) {
      const payload = {
        name:       phase.name,
        start_date: phase.startDate,
        end_date:   phase.endDate,
      };
      const { error } = await supabase.from('audit_phases').insert([payload]);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async updateAuditPhase(id: string, updates: Partial<AuditPhase>) {
    if (supabase) {
      const payload: Record<string, any> = {};
      if (updates.name      !== undefined) payload.name       = updates.name;
      if (updates.startDate !== undefined) payload.start_date = updates.startDate;
      if (updates.endDate   !== undefined) payload.end_date   = updates.endDate;
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
        id:        t.id,
        name:      t.name,
        minAssets: t.min_assets,
        maxAssets: t.max_assets,
        targets:   t.targets,
      })) as KPITier[];
    }
    return [];
  }

  async addKPITier(tier: Omit<KPITier, 'id'>) {
    if (supabase) {
      const payload = {
        name:       tier.name,
        min_assets: tier.minAssets,
        max_assets: tier.maxAssets,
        targets:    tier.targets,
      };
      const { error } = await supabase.from('kpi_tiers').insert([payload]);
      if (error) throw error;
      return;
    }
    throw new Error("Supabase client not initialized");
  }

  async updateKPITier(id: string, updates: Partial<KPITier>) {
    if (supabase) {
      const payload: Record<string, any> = {};
      if (updates.name      !== undefined) payload.name       = updates.name;
      if (updates.minAssets !== undefined) payload.min_assets = updates.minAssets;
      if (updates.maxAssets !== undefined) payload.max_assets = updates.maxAssets;
      if (updates.targets   !== undefined) payload.targets    = updates.targets;
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

  // --- AUDIT GROUPS ---
  async getAuditGroups(): Promise<AuditGroup[]> {
    if (supabase) {
      const { data, error } = await supabase.from('audit_groups').select('*').order('name');
      if (error) throw error;
      return (data || []).map((g: any) => ({ id: g.id, name: g.name, description: g.description }));
    }
    return [];
  }

  async addAuditGroup(group: Omit<AuditGroup, 'id'>): Promise<AuditGroup> {
    if (supabase) {
      const { data, error } = await supabase.from('audit_groups').insert([{ name: group.name, description: group.description || null }]).select().single();
      if (error) throw error;
      return { id: data.id, name: data.name, description: data.description };
    }
    throw new Error("Supabase client not initialized");
  }

  async updateAuditGroup(id: string, updates: Partial<AuditGroup>): Promise<void> {
    if (supabase) {
      const payload: Record<string, any> = {};
      if (updates.name        !== undefined) payload.name        = updates.name;
      if (updates.description !== undefined) payload.description = updates.description;
      const { error } = await supabase.from('audit_groups').update(payload).eq('id', id);
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
