/**
 * Supabase Client configuration
 * Uses native fetch to connect to Supabase PostgREST & Auth APIs.
 */

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  import.meta.env.VITE_USE_MOCK !== 'true'
);

