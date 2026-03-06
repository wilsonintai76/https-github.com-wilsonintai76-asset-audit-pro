
import { supabase } from './supabase';
import { User } from '../types';

export const authService = {
  login: async (staffId: string, pin: string): Promise<User> => {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      
      // Create a promise that rejects after 15 seconds
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out. Please check your connection.')), 15000);
      });

      const loginPromise = supabase
        .from('users')
        .select('*')
        .eq('pin', pin)
        .or(`id.eq.${staffId},email.eq.${staffId}`)
        .single();

      // Race the login against the timeout
      const { data, error } = await Promise.race([loginPromise, timeoutPromise]) as any;

      if (error || !data) throw new Error('Invalid Staff ID or PIN');

      const u = data as any;
      return {
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
      } as User;
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  },

  register: async (userData: Partial<User> & { pin: string }): Promise<User> => {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      
      const payload = {
        id:                   userData.id,
        name:                 userData.name,
        email:                userData.email,
        pin:                  userData.pin,
        roles:                userData.roles,
        picture:              userData.picture,
        department_id:        userData.departmentId,
        contact_number:       userData.contactNumber,
        permissions:          userData.permissions,
        last_active:          userData.lastActive,
        certification_issued: userData.certificationIssued,
        certification_expiry: userData.certificationExpiry,
        status:               userData.status,
        is_verified:          false, // self-registered users always require admin approval
        dashboard_config:     userData.dashboardConfig,
      };

      const { data, error } = await supabase
        .from('users')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      const u = data as any;
      return {
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
      } as User;
    } catch (error) {
      console.error("Registration failed:", error);
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('audit_pro_session');
    if (supabase) supabase.auth.signOut();
  }
};
