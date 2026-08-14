import { type EnvRecord, readCloudConfig } from '@noto/config';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';

/**
 * Supabase access.
 *
 * This module is behind the `@noto/sync/supabase` subpath so that an app which
 * has not enabled the cloud never pulls the client into its bundle. Callers get
 * `null` when credentials are absent, which is the normal local-first state
 * rather than an error.
 */

export type NotoSupabaseClient = SupabaseClient;

export function createSupabaseClient(env: EnvRecord): NotoSupabaseClient | null {
  const { supabase } = readCloudConfig(env);
  if (!supabase) return null;

  return createClient(supabase.url, supabase.anonKey, {
    auth: {
      // Noto persists its own session; auto-refresh is enabled once the user signs in.
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export function isCloudConfigured(env: EnvRecord): boolean {
  return readCloudConfig(env).supabase !== null;
}
