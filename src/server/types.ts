import { D1Database, R2Bucket, KVNamespace } from '@cloudflare/workers-types';

export type Bindings = {
  DB: D1Database;
  MEDIA: R2Bucket;
  SETTINGS: KVNamespace;
  AI: any;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string; // Required for JWT verification
};

export type Variables = {
  user?: {
    id: string;
    email: string;
    role: string;
    [key: string]: any;
  };
};

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
