import { hc } from 'hono/client';
import { AppType } from '../src/server';
import { supabase } from './supabase';

const getBaseUrl = () => {
  if (import.meta.env.MODE === 'development') {
    return 'http://localhost:3000'; // Or whatever port wrangler runs on
  }
  return window.location.origin;
};

export const getAuthHeaders = async () => {
  if (!supabase) return {};
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
  };
};

export const api = hc<AppType>(getBaseUrl());
