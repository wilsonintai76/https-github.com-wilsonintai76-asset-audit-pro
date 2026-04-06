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

// ─── Single-Session Registration ─────────────────────────────────────────────
// Called on SIGNED_IN and TOKEN_REFRESHED so the server always has the
// current session_id (Supabase JWT claim) stored in KV.  Any parallel
// session on another device that already wrote a different session_id will
// be displaced (SESSION_DISPLACED 401) on its next request.
async function registerSession(accessToken: string): Promise<void> {
  try {
    const hint = `${navigator.userAgent.slice(0, 60)} @ ${new Date().toISOString()}`;
    await fetch(`${getBaseUrl()}/auth/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ deviceHint: hint }),
    });
  } catch {
    // Non-fatal — single-session enforcement is best-effort during network errors
  }
}

// Tracks the in-flight registerSession promise so App.tsx can await it
// before firing loadAllData(), preventing SESSION_DISPLACED 401s.
let _sessionRegistrationPromise: Promise<void> = Promise.resolve();

/** Await this before calling loadAllData() to ensure the KV session entry is written. */
export function awaitSessionRegistered(): Promise<void> {
  return _sessionRegistrationPromise;
}

if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    _cachedToken     = session?.access_token ?? null;
    _tokenExpiresAt  = session?.expires_at
      ? session.expires_at * 1000 - 4 * 60 * 1000 // refresh 4 min early
      : 0;

    if (session?.access_token && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
      // Store the promise so App.tsx can await it before loading data
      _sessionRegistrationPromise = registerSession(session.access_token);
    }
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
    _cachedToken     = session.access_token;
    _tokenExpiresAt  = session.expires_at
      ? session.expires_at * 1000 - 4 * 60 * 1000
      : now + 56 * 60 * 1000; // fallback: 56-minute window
    return { Authorization: `Bearer ${_cachedToken}` };
  }
  _cachedToken     = null;
  _tokenExpiresAt  = 0;
  return {};
};

/** Invalidate the cached token immediately (e.g. on sign-out). */
export const clearAuthCache = () => {
  _cachedToken    = null;
  _tokenExpiresAt = 0;
};

/**
 * Calls the server-side DELETE /api/auth/session to evict the KV session entry
 * and clear the role cache BEFORE the Supabase token is revoked.
 * Must be called while the access token is still valid.
 */
export const serverLogout = async (): Promise<void> => {
  const token = _cachedToken;
  if (!token) return;
  try {
    await fetch(`${getBaseUrl()}/auth/session`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Non-fatal — Supabase signOut will still invalidate the refresh token
  }
};
// ─────────────────────────────────────────────────────────────────────────────

export const api = hc<AppType>(getBaseUrl());
