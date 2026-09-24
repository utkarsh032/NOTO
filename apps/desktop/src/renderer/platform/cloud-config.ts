import { API_SESSION_KEY, clearStoredSession as clearStoredMarkers } from '@noto/sync/session';

import { WEB_APP_URL } from '../../generated/environment';

/**
 * What the desktop application may know about the cloud before loading it.
 *
 * The same arrangement as the web application's, and for a smaller version of
 * the same reason: a cloud client is a chunk the renderer has no need of until
 * somebody signs in, and whether there is a session to restore has to be
 * answerable without it. The only import is `@noto/sync/session`, which is
 * dependency-free precisely so this file can stay cheap.
 */

export { hasStoredSession } from '@noto/sync/session';

/**
 * Forgets the session on this device, wherever it is kept.
 *
 * On `apps/api` the tokens are in the keychain and `localStorage` holds only a
 * marker, so clearing the marker alone would leave a 30-day refresh token on
 * disk. Both go.
 */
export function clearStoredSession(): void {
  clearStoredMarkers();
  void window.notoSession?.clear().catch(() => {});
}

export { API_SESSION_KEY };

export const cloudConfig = {
  /** `apps/api`. When set, it is the backend, whatever else is configured. */
  apiUrl: import.meta.env.VITE_NOTO_API_URL as string | undefined,
  url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
};

/**
 * Which backend this build signs in to. `api` wins when both are configured;
 * Supabase remains only until the cutover is verified in production.
 */
export const cloudBackend: 'api' | 'supabase' | null = cloudConfig.apiUrl
  ? 'api'
  : cloudConfig.url && cloudConfig.anonKey
    ? 'supabase'
    : null;

/** False in every build packaged without cloud configuration, which is fine. */
export const cloudConfigured = cloudBackend !== null;

/**
 * Where to send somebody who wants to create an account.
 *
 * The desktop cannot do it itself, and this stays a deliberate choice after
 * the move to `apps/api`. Sign-up is behind Cloudflare Turnstile, which issues
 * a token against the hostname the widget was served from, and a packaged
 * renderer is served from `file://` — an opaque origin with no hostname to
 * check. A second, desktop-only bot check would be a second way in to defend;
 * the web application already has a real origin and is the same account.
 * Signing in afterwards works here, because signing in has no bot check to fail.
 *
 * `null` when this build has no cloud at all, in which case there is nowhere
 * to send anyone and the interface should not pretend otherwise.
 */
export const signUpUrl = cloudConfigured ? `${WEB_APP_URL.replace(/\/+$/, '')}/#/login` : null;
