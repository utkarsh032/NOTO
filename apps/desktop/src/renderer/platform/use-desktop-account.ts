import { useCloudAccount, type AccountValue, type CloudGateway } from '@noto/ui';

import { clearStoredSession, cloudConfigured, hasStoredSession, signUpUrl } from './cloud-config';

/**
 * The desktop application's account.
 *
 * The desktop had none at all until now — `App` supplied only
 * `NotoDataContext`, so `useAccount` fell back to the fixture and every account
 * control was inert. Signing in said the build had no account service, which
 * was true, and creating one said it was not open in this build, which was
 * also true and told nobody where it *was* open.
 *
 * The states themselves are `useCloudAccount`, shared with the web. What is
 * here is what differs: the client is a different module, and this platform
 * cannot complete a sign-up, so instead of a form that would be refused it
 * carries the address of the one place that can.
 */

async function gateway(): Promise<CloudGateway> {
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

      /*
       * The desktop is one window rather than many tabs, so this is not about
       * following another one. It is about the session ending on its own — a
       * refresh token that expired while the application sat open overnight,
       * which is a great deal more likely here than in a browser nobody leaves
       * running for a week.
       */
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

export function useDesktopAccount(): AccountValue {
  return useCloudAccount({
    configured: cloudConfigured,
    load: gateway,
    hasStoredSession,
    clearStoredSession,
    // No sitekey is read here at all: a widget rendered from `file://` has no
    // hostname to be checked against, so offering one would be theatre.
    turnstileSiteKey: null,
    signUpUrl,
  });
}
