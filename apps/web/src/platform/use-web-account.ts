import { useCloudAccount, type AccountValue, type CloudGateway } from '@noto/ui';

import {
  clearStoredSession,
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
 * Every reference to `./cloud.ts` is behind a dynamic import, and that is the
 * point: `@supabase/supabase-js` is around 120 kB, and a visitor who has never
 * signed in should not download it to be told they are signed out.
 */

/** Loads the client and adapts it to the shape the shared hook expects. */
async function gateway(): Promise<CloudGateway> {
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

export function useWebAccount(): AccountValue {
  return useCloudAccount({
    configured: cloudConfigured,
    load: gateway,
    hasStoredSession,
    clearStoredSession,
    turnstileSiteKey,
    // A browser can complete a sign-up itself, so there is nowhere to send it.
    signUpUrl: null,
  });
}
