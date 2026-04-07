import { supabase } from './supabase';
import { clearAuthCache, serverLogout } from './honoClient';
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
    try {
      // 1. Evict the server-side KV session WHILE the token is still valid.
      //    This immediately invalidates the session for any other browser/tab.
      await serverLogout();

      // 2. Clear all local and session storage to prevent data leakage,
      //    but preserve app-state keys that should survive logout/login cycles.
      const PERSIST_KEYS = [
        'cross_audit_simulator_active',
        'cross_audit_simulator_pairings',
        'group_builder_threshold',
        'group_builder_standalone_cutoff',
        'pairing_lock_active',
        'pairing_lock_info',
        'cross_audit_pairing_mode',
        'cross_audit_respect_manual',
        'cross_audit_simulate_staff',
        'cross_audit_mutual',
      ];
      const preserved: Record<string, string> = {};
      for (const key of PERSIST_KEYS) {
        const val = localStorage.getItem(key);
        if (val !== null) preserved[key] = val;
      }
      localStorage.clear();
      for (const [key, val] of Object.entries(preserved)) {
        localStorage.setItem(key, val);
      }
      sessionStorage.clear();

      // 3. Clear the in-memory token cache
      clearAuthCache();

      if (supabase) {
        // We use a promise with a timeout for signOut to ensure it doesn't hang the app
        const signOutPromise = supabase.auth.signOut();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('SignOut Timeout')), 3000));
        await Promise.race([signOutPromise, timeoutPromise]);
      }
    } catch (error) {
      console.warn("[Auth] Logout warning (Supabase signOut may have failed or timed out):", error);
      // Even if Supabase signOut fails, we already cleared the local storage.
    }
  },

  getCurrentUser: async (): Promise<User | null> => {
    const timeout = (ms: number) => new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), ms)
    );

    try {
      if (!supabase) return null;
      
      console.log("[Auth] Checking current auth user...");
      // Use getSession() instead of getUser() — getSession reads from local storage
      // and does NOT make a blocking network call (avoids Cloudflare Workers timeout).
      const { data: { session }, error: sessionError } = await Promise.race([
        supabase.auth.getSession(),
        timeout(4000)
      ]) as any;

      const authUser = session?.user ?? null;

      if (sessionError || !authUser) {
        console.log("[Auth] No authenticated session found");
        return null;
      }

      // STRICT DOMAIN CHECK (Temporarily disabled for testing)
      const allowedDomain = 'poliku.edu.my';
      const userEmail = authUser.email?.toLowerCase() || '';
      
      console.log("[Auth] Validating email:", userEmail);
      
      /*
      const isAllowedEmail = userEmail.endsWith(`@${allowedDomain}`);

      if (!isAllowedEmail) {
        console.warn("[Auth] Domain not allowed:", userEmail);
        try { localStorage.setItem('auth_domain_error', JSON.stringify({ email: userEmail, domain: allowedDomain })); } catch { // ignore }
        await supabase.auth.signOut();
        return null;
      }
      */

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
        console.warn("[Auth] No profile found in D1 for authenticated user:", authUser.id);
        // We return null here. The app will usually reload or show a 'Limited Access' state, 
        // but since we added 'Silent Registration' to the backend, the NEXT request 
        // (which happens immediately on loadAllData) will have already created the user.
        return null;
      }

      return mapProfileToUser(profile);

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
  
  // Always ensure roles is a valid array — DB can return null for new users
  result.roles = Array.isArray(result.roles) && result.roles.length > 0 ? result.roles : ['Staff'];

  if (result.contact_number) result.contactNumber = result.contact_number;
  if (result.is_verified !== undefined) result.isVerified = result.is_verified;
  if (result.last_active) result.lastActive = result.last_active;
  if (result.certification_issued) result.certificationIssued = result.certification_issued;
  if (result.certification_expiry) result.certificationExpiry = result.certification_expiry;
  if (result.renewal_requested !== undefined) result.renewalRequested = result.renewal_requested;
  if (result.dashboard_config) result.dashboardConfig = result.dashboard_config;
  if (result.department_id) result.departmentId = result.department_id;

  return result as User;
}
