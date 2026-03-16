
import { supabase } from './supabase';
import { User } from '../types';

export const authService = {
  loginWithGoogle: async (): Promise<void> => {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error("[Auth] Google login failed:", error);
      throw error;
    }
  },

  logout: async () => {
    localStorage.removeItem('audit_pro_session');
    if (supabase) await supabase.auth.signOut();
  },

  getCurrentUser: async (): Promise<User | null> => {
    const timeout = (ms: number) => new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), ms)
    );

    try {
      if (!supabase) return null;
      
      console.log("[Auth] Checking current auth user...");
      const { data: { user: authUser }, error: userError } = await Promise.race([
        supabase.auth.getUser(),
        timeout(60000)
      ]) as any;

      if (userError || !authUser) {
        console.log("[Auth] No authenticated user found");
        return null;
      }

      // STRICT DOMAIN CHECK
      const allowedDomain = 'poliku.edu.my';
      const userEmail = authUser.email || '';
      
      // Allow the developer/admin email for testing if needed, 
      // but for production we enforce the domain.
      // We'll allow wilsonintai76@gmail.com for now so you don't get locked out.
      const isAllowedEmail = userEmail.endsWith(`@${allowedDomain}`) || userEmail === 'wilsonintai76@gmail.com';

      if (!isAllowedEmail) {
        console.warn("[Auth] Domain not allowed:", userEmail);
        await supabase.auth.signOut();
        alert(`Access restricted. Please use your @${allowedDomain} email account.`);
        return null;
      }

      console.log("[Auth] Getting profile for:", authUser.id);

      const { data: profile, error: profileError } = await Promise.race([
        supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle(),
        timeout(60000)
      ]) as any;

      if (profileError) {
        console.error("[Auth] getCurrentUser profile error:", profileError);
        return null;
      }
      
      if (!profile) {
        console.warn("[Auth] No profile found for authenticated user:", authUser.id);
        
        // Auto-create profile if it doesn't exist
        const newProfile = {
          id: authUser.id,
          email: authUser.email,
          name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
          roles: ['Staff'],
          status: 'Active',
          is_verified: true,
          department_id: 'DEPT-001'
        };
        
        const { data: createdProfile, error: createError } = await supabase
          .from('users')
          .insert([newProfile])
          .select()
          .single();
          
        if (createError) {
           console.error("[Auth] getCurrentUser profile creation failed:", createError);
           return null;
        }
        
        return mapProfileToUser(createdProfile);
      }

      return mapProfileToUser(profile);
    } catch (error: any) {
      if (error.message === 'Timeout') {
         console.warn("[Auth] getCurrentUser timed out. Falling back to local session.");
      } else {
         console.error("[Auth] getCurrentUser failed:", error.message || error);
      }
      return null;
    }
  }
};

// Helper to map DB snake_case to Frontend camelCase
function mapProfileToUser(profile: any): User {
  const result = { ...profile };
  
  if (result.contact_number) result.contactNumber = result.contact_number;
  if (result.is_verified !== undefined) result.isVerified = result.is_verified;
  if (result.last_active) result.lastActive = result.last_active;
  if (result.certification_issued) result.certificationIssued = result.certification_issued;
  if (result.certification_expiry) result.certificationExpiry = result.certification_expiry;
  if (result.dashboard_config) result.dashboardConfig = result.dashboard_config;
  if (result.department_id) result.departmentId = result.department_id;

  return result as User;
}
