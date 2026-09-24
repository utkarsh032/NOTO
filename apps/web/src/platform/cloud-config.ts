/**
 * What the application may know about the cloud before loading any of it.
 *
 * Deliberately tiny. The cloud modules pull in a client, and Noto's performance
 * budget says a signed-out visitor downloads none of it — so the decision of
 * whether to load one has to be answerable without loading it. The one import
 * here is `@noto/sync/session`, which is a dependency-free module for exactly
 * that reason.
 */

export { clearStoredSession, hasStoredSession } from '@noto/sync/session';

export const cloudConfig = {
  /** `apps/api`. When set, it is the backend, whatever else is configured. */
  apiUrl: import.meta.env.VITE_NOTO_API_URL as string | undefined,
  url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
};

/**
 * Which backend this build signs in to.
 *
 * `api` wins when both are configured: that is the cutover, and it needs only
 * the variable set in the build. Supabase remains as the fallback until the
 * cutover is verified in production, after which it and this branch go
 * (Backend_Node_Plan, appendix).
 */
export const cloudBackend: 'api' | 'supabase' | null = cloudConfig.apiUrl
  ? 'api'
  : cloudConfig.url && cloudConfig.anonKey
    ? 'supabase'
    : null;

/**
 * The Turnstile sitekey. Public: it is rendered into the sign-up form.
 *
 * `null` disables sign-up in the interface rather than offering a form the
 * server is going to refuse — the server fails closed on a missing token, so a
 * build without this key cannot create accounts.
 */
export const turnstileSiteKey =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? null;

/** False in every build that ships without cloud configuration, which is fine. */
export const cloudConfigured = cloudBackend !== null;
