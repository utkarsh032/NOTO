import { useCloudAccount, type AccountValue, type CloudGateway } from '@noto/ui';

import {
  clearStoredSession,
  cloudBackend,
  cloudConfigured,
  hasStoredSession,
  turnstileSiteKey,
} from './cloud-config.ts';

/**
 * The web application's account.
 *
 * Supplies `AccountContext`, so the shared screens read a real profile and a
 * real device list without importing a line of Supabase themselves.
 *
 * The states and their transitions are `useCloudAccount`, shared with the
 * desktop — this file is only the part that is genuinely the web's: which
 * module holds the client, and that a browser, having a real origin, can pass
 * a Turnstile check and therefore create an account itself.
 *
 * Every reference to a cloud module is behind a dynamic import, and that is the
 * point: a visitor who has never signed in should not download a client to be
 * told they are signed out.
 *
 * Two backends during the cutover: `apps/api` when `VITE_NOTO_API_URL` is set,
 * Supabase otherwise. The Supabase half goes once the cutover is verified.
 */

/** `apps/api`, adapted to the shape the shared hook expects. */
async function apiGateway(): Promise<CloudGateway> {
  const cloud = await import('./cloud-api.ts');

  return {
    signIn: cloud.signIn,
    signUp: cloud.signUp,
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

    /*
     * `initial` once, from what is stored; `ended` whenever the session stops —
     * a sign-out here or in another tab, or a refresh token the server refused.
     * A sign-in in this tab needs no event: `signIn` loads the profile itself.
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

/** Supabase, adapted to the shape the shared hook expects. */
async function supabaseGateway(): Promise<CloudGateway> {
  const cloud = await import('./cloud.ts');

  return {
    signIn: cloud.signIn,
    signUp: cloud.signUp,
    signOut: cloud.signOut,
    fetchUser: cloud.fetchUser,
    fetchDevices: cloud.fetchDevices,
    resendConfirmation: cloud.resendConfirmation,

    /*
     * Supabase's own view of the session, translated.
     *
     * `SIGNED_IN` is deliberately dropped: `signIn` has already loaded the
     * profile by the time it arrives, and reporting both would fetch it twice
     * for every sign-in. The session lives in storage every tab shares, so a
     * sign-out in one of them arrives here as `SIGNED_OUT` — the same way a
     * refresh token that stopped working does.
     */
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

/** Only `apps/api` can revoke devices or send verification and reset links. */
const features = { manageDevices: cloudBackend === 'api', recovery: cloudBackend === 'api' };

export function useWebAccount(): AccountValue {
  return useCloudAccount({
    configured: cloudConfigured,
    load: gateway,
    features,
    hasStoredSession,
    clearStoredSession,
    turnstileSiteKey,
    // A browser can complete a sign-up itself, so there is nowhere to send it.
    signUpUrl: null,
  });
}
