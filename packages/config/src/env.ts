/**
 * Cloud configuration.
 *
 * Each platform reads environment variables differently (Vite uses
 * `import.meta.env`, Electron main uses `process.env`, Expo uses
 * `process.env.EXPO_PUBLIC_*`), so this module takes an already-read record
 * rather than reaching for globals itself.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/** `apps/api`. The only thing a client needs to know about it is where it is. */
export interface ApiConfig {
  url: string;
}

export interface CloudConfig {
  /** `null` unless `NOTO_API_URL` is set. Preferred over Supabase when both are. */
  api: ApiConfig | null;
  /**
   * `null` while Noto is running purely local-first. Kept only until the
   * cutover to `apps/api` is verified in production; see Backend_Node_Plan's
   * appendix for when it goes.
   */
  supabase: SupabaseConfig | null;
}

export type EnvRecord = Record<string, string | undefined>;

/**
 * Builds cloud config from a platform-supplied environment record. Missing
 * credentials are not an error: Noto is designed to run fully offline, and the
 * cloud layer stays disabled until both values are present.
 */
export function readCloudConfig(env: EnvRecord): CloudConfig {
  const apiUrl = env.NOTO_API_URL ?? env.VITE_NOTO_API_URL ?? env.EXPO_PUBLIC_NOTO_API_URL;
  const api = apiUrl ? { url: apiUrl } : null;

  const url = env.NOTO_SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey =
    env.NOTO_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { api, supabase: null };
  }

  return { api, supabase: { url, anonKey } };
}
