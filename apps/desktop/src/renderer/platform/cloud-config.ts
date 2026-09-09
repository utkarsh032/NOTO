import { WEB_APP_URL } from '../../generated/environment';

/**
 * What the desktop application may know about the cloud before loading it.
 *
 * The same arrangement as the web application's, and for a smaller version of
 * the same reason: `@supabase/supabase-js` is a chunk the renderer has no need
 * of until somebody signs in, and whether there is a session to restore has to
 * be answerable without it. The only import is `@noto/sync/session`, which is
 * dependency-free precisely so this file can stay cheap.
 */

export { clearStoredSession, hasStoredSession } from '@noto/sync/session';

export const cloudConfig = {
  url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
};

/** False in every build packaged without Supabase credentials, which is fine. */
export const cloudConfigured = Boolean(cloudConfig.url && cloudConfig.anonKey);

/**
 * Where to send somebody who wants to create an account.
 *
 * The desktop cannot do it itself. Sign-up is behind Cloudflare Turnstile,
 * which issues a token against the hostname the widget was served from, and a
 * packaged renderer is served from `file://` — an opaque origin with no
 * hostname to check. There is nothing to configure around that: the widget has
 * nothing to attest to.
 *
 * So the browser does it, on the web application, which has a real origin and
 * is already the same account. Signing in afterwards works here, because
 * signing in has no bot check to fail.
 *
 * `null` when this build has no cloud at all, in which case there is nowhere
 * to send anyone and the interface should not pretend otherwise.
 */
export const signUpUrl = cloudConfigured ? `${WEB_APP_URL.replace(/\/+$/, '')}/#/login` : null;
