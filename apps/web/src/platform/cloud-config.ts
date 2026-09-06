/**
 * What the application may know about the cloud before loading any of it.
 *
 * Deliberately tiny. `cloud.ts` pulls in `@supabase/supabase-js`, and Noto's
 * performance budget says a signed-out visitor downloads none of it — so the
 * decision of whether to load that module has to be answerable without loading
 * it. The one import here is `@noto/sync/session`, which is a dependency-free
 * module for exactly that reason.
 */

export { clearStoredSession, hasStoredSession } from '@noto/sync/session';

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
