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

export const getAuthHeaders = async () => {
  if (!supabase) return {};
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
  };
};

export const api = hc<AppType>(getBaseUrl());
