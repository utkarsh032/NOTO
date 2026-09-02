/**
 * What the application may know about the cloud before loading any of it.
 *
 * Deliberately tiny and free of imports. `cloud.ts` pulls in
 * `@supabase/supabase-js`, and Noto's performance budget says a signed-out
 * visitor downloads none of it — so the decision of whether to load that module
 * has to be answerable without loading it.
 */

export const cloudConfig = {
  url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
};

/**
 * The Turnstile sitekey. Public: it is rendered into the sign-up form.
 *
 * `null` disables sign-up in the interface rather than offering a form the
 * server is going to refuse — the Edge Function fails closed on a missing
 * token, so a build without this key cannot create accounts.
 */
export const turnstileSiteKey =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? null;

/** False in every build that ships without Supabase credentials, which is fine. */
export const cloudConfigured = Boolean(cloudConfig.url && cloudConfig.anonKey);

/**
 * Whether a session from a previous visit is sitting in storage.
 *
 * Supabase persists it under `sb-<project-ref>-auth-token`. Matching the key
 * rather than reading it means a visitor who has never signed in never pays for
 * the client: there is nothing to restore, so nothing is fetched.
 */
export function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && /^sb-.+-auth-token$/.test(key)) return true;
    }
  } catch {
    // Private mode, or storage disabled. Treat it as signed out.
    return false;
  }

  return false;
}
