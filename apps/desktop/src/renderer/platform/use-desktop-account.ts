import { useCloudAccount, type AccountValue, type CloudGateway } from '@noto/ui';

import {
  clearStoredSession,
  cloudBackend,
  cloudConfigured,
  hasStoredSession,
  signUpUrl,
} from './cloud-config';

/**
 * The desktop application's account.
 *
 * The states themselves are `useCloudAccount`, shared with the web. What is
 * here is what differs: the client is a different module, and this platform
 * cannot complete a sign-up, so instead of a form that would be refused it
 * carries the address of the one place that can.
 *
 * Two backends during the cutover: `apps/api` when `VITE_NOTO_API_URL` is set,
 * Supabase otherwise. The Supabase half goes once the cutover is verified.
 */

async function apiGateway(): Promise<CloudGateway> {
  const cloud = await import('./cloud-api');

  return {
    signIn: cloud.signIn,
    signOut: cloud.signOut,
    fetchUser: cloud.fetchUser,
    fetchDevices: cloud.fetchDevices,
    fetchSecurity: cloud.fetchSecurity,
    fetchSessions: cloud.fetchSessions,
    fetchEvents: cloud.fetchEvents,
    revokeDevice: cloud.revokeDevice,
    revokeSession: cloud.revokeSession,
    resendConfirmation: cloud.resendConfirmation,
    verifyEmail: cloud.verifyEmail,
    requestPasswordReset: cloud.requestPasswordReset,
    resetPassword: cloud.resetPassword,
    // No `signUp`. Turnstile cannot attest to a `file://` origin.

    /*
     * One window, so this is not about following another one. It is about the
     * session ending on its own — a refresh token refused after the application
     * sat open overnight, which the client reports as `ended`.
     */
    watchSession: (listener) => {
      let active = true;

      void cloud.api.hasSession().then((hasSession) => {
        if (active) listener({ kind: 'initial', hasSession });
      });

      const stop = cloud.api.onSessionChange((event) => {
        if (event === 'ended') listener({ kind: 'ended', hasSession: false });
      });

      return () => {
        active = false;
        stop();
      };
    },
  };
}

async function supabaseGateway(): Promise<CloudGateway> {
  const cloud = await import('./cloud');

  return {
    signIn: cloud.signIn,
    signOut: cloud.signOut,
    fetchUser: cloud.fetchUser,
    fetchDevices: cloud.fetchDevices,
    resendConfirmation: cloud.resendConfirmation,
    // No `signUp`. Turnstile cannot attest to a `file://` origin, so a sign-up
    // from here is a request the server is right to refuse.

    watchSession: (listener) => {
      const client = cloud.supabase;
      if (!client) return null;

      const { data } = client.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION') {
          listener({ kind: 'initial', hasSession: session !== null });

          return;
        }

        if (event === 'SIGNED_OUT') listener({ kind: 'ended', hasSession: false });
      });

      return () => data.subscription.unsubscribe();
    },
  };
}

const gateway = cloudBackend === 'api' ? apiGateway : supabaseGateway;

/*
 * Only `apps/api` can revoke devices or send reset emails. "Forgot password?"
 * works from here — it needs no bot check — and its link opens the web app.
 */
const features = { manageDevices: cloudBackend === 'api', recovery: cloudBackend === 'api' };

export function useDesktopAccount(): AccountValue {
  return useCloudAccount({
    configured: cloudConfigured,
    load: gateway,
    features,
    hasStoredSession,
    clearStoredSession,
    // No sitekey is read here at all: a widget rendered from `file://` has no
    // hostname to be checked against, so offering one would be theatre.
    turnstileSiteKey: null,
    signUpUrl,
  });
}
