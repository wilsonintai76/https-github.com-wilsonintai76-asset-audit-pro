import { D1Database, R2Bucket, KVNamespace } from '@cloudflare/workers-types';

export type Bindings = {
  DB: D1Database;
  BACKUP: R2Bucket;
  MEDIA: R2Bucket;
  SETTINGS: KVNamespace;
  AI: any;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;
  ALLOWED_DOMAIN: string; // e.g. "poliku.edu.my" — set in wrangler.toml [vars]
};

export type Variables = {
  user?: {
    id: string;
    email: string;
    role: string;
    roles: string[];      // Populated from D1 users table
    departmentId: string | null; // Populated from D1 users table
    [key: string]: any;
  };
};

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
