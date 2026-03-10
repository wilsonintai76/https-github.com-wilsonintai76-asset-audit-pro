
import { supabase } from './supabase';
import { User } from '../types';

export const authService = {
  login: async (staffId: string, pin: string): Promise<User> => {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      
      // Create a promise that rejects after 30 seconds
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out. Please check your connection.')), 30000);
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
      
      const result = data as any;
      if (result.contact_number) {
        result.contactNumber = result.contact_number;
        delete result.contact_number;
      }
      if (result.is_verified !== undefined) {
        result.isVerified = result.is_verified;
        delete result.is_verified;
      }
      if (result.last_active) {
        result.lastActive = result.last_active;
        delete result.last_active;
      }
      if (result.certification_issued) {
        result.certificationIssued = result.certification_issued;
        delete result.certification_issued;
      }
      if (result.certification_expiry) {
        result.certificationExpiry = result.certification_expiry;
        delete result.certification_expiry;
      }
      if (result.dashboard_config) {
        result.dashboardConfig = result.dashboard_config;
        delete result.dashboard_config;
      }
      if (result.department_id) {
        result.departmentId = result.department_id;
        delete result.department_id;
      }

      return result as User;
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  },

  register: async (userData: Partial<User> & { pin: string }): Promise<User> => {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      
      const payload: any = { ...userData, roles: ['Staff'] };
      if (userData.contactNumber !== undefined) {
        payload.contact_number = userData.contactNumber;
        delete payload.contactNumber;
      }
      if (userData.isVerified !== undefined) {
        payload.is_verified = userData.isVerified;
        delete payload.isVerified;
      }
      if (userData.lastActive !== undefined) {
        payload.last_active = userData.lastActive;
        delete payload.lastActive;
      }
      if (userData.certificationIssued !== undefined) {
        payload.certification_issued = userData.certificationIssued;
        delete payload.certificationIssued;
      }
      if (userData.certificationExpiry !== undefined) {
        payload.certification_expiry = userData.certificationExpiry;
        delete payload.certificationExpiry;
      }
      if (userData.dashboardConfig !== undefined) {
        payload.dashboard_config = userData.dashboardConfig;
        delete payload.dashboardConfig;
      }
      if (userData.departmentId !== undefined) {
        payload.department_id = userData.departmentId;
        delete payload.departmentId;
      }

      const { data, error } = await supabase
        .from('users')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      
      const result = data as any;
      if (result.contact_number) {
        result.contactNumber = result.contact_number;
        delete result.contact_number;
      }
      if (result.is_verified !== undefined) {
        result.isVerified = result.is_verified;
        delete result.is_verified;
      }
      if (result.last_active) {
        result.lastActive = result.last_active;
        delete result.last_active;
      }
      if (result.certification_issued) {
        result.certificationIssued = result.certification_issued;
        delete result.certification_issued;
      }
      if (result.certification_expiry) {
        result.certificationExpiry = result.certification_expiry;
        delete result.certification_expiry;
      }
      if (result.dashboard_config) {
        result.dashboardConfig = result.dashboard_config;
        delete result.dashboard_config;
      }
      if (result.department_id) {
        result.departmentId = result.department_id;
        delete result.department_id;
      }

      return result as User;
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
