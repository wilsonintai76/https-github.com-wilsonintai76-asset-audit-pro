import { hc } from 'hono/client';
import { AppType } from '../src/server';
import { supabase } from './supabase';

const getBaseUrl = () => {
  let base = window.location.origin;
  if (import.meta.env.MODE === 'development') {
    base = 'http://localhost:3000';
  }
  return `${base}/api`;
};

// ─── Token Cache ─────────────────────────────────────────────────────────────
// Supabase access tokens expire in 1 hour. Cache the token and refresh it
// 4 minutes before expiry so we never fire a getSession() round-trip for
// every single API call.
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0; // Unix ms

if (supabase) {
  // Invalidate immediately when the user signs in or out.
  supabase.auth.onAuthStateChange((_event, session) => {
    _cachedToken = session?.access_token ?? null;
    _tokenExpiresAt = session?.expires_at
      ? session.expires_at * 1000 - 4 * 60 * 1000 // refresh 4 min early
      : 0;
  });
}

export const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const now = Date.now();
  if (_cachedToken && now < _tokenExpiresAt) {
    return { Authorization: `Bearer ${_cachedToken}` };
  }
  if (!supabase) return {};
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    _cachedToken = session.access_token;
    _tokenExpiresAt = session.expires_at
      ? session.expires_at * 1000 - 4 * 60 * 1000
      : now + 56 * 60 * 1000; // fallback: 56-minute window
    return { Authorization: `Bearer ${_cachedToken}` };
  }
  _cachedToken = null;
  _tokenExpiresAt = 0;
  return {};
};

/** Invalidate the cached token immediately (e.g. on sign-out). */
export const clearAuthCache = () => {
  _cachedToken = null;
  _tokenExpiresAt = 0;
};
// ─────────────────────────────────────────────────────────────────────────────

export const api = hc<AppType>(getBaseUrl());
