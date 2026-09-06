import type { Device, User } from '@noto/types';
import {
  MOCK_PLAN,
  MOCK_SECURITY,
  showToast,
  type AccountSignUpInput,
  type AccountValue,
} from '@noto/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
 * Every reference to `./cloud.ts` below is a dynamic import, and that is the
 * point: `@supabase/supabase-js` is around 120 kB, and a visitor who has never
 * signed in should not download it to be told they are signed out. The module
 * loads when there is a session to restore, or when somebody submits the form.
 *
 * Plan and security are still the fixture, and honestly so: phase 1 shipped
 * `profiles`, `devices`, `auth_events` and `user_settings`, and nothing behind
 * a subscription or a second factor exists yet to read.
 */
export function useWebAccount(): AccountValue {
  /*
   * A stored session opens as `restoring`, not as `signed-out`.
   *
   * Bringing it back takes a round trip, and calling that signed out is a lie
   * that lasts long enough to act on: the header flashes "Sign in", and a
   * route guard reading the same value throws the person off their own account
   * screen on every reload.
   */
  const [status, setStatus] = useState<AccountValue['status']>(() => {
    if (!cloudConfigured) return 'unavailable';

    return hasStoredSession() ? 'restoring' : 'signed-out';
  });

  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);

  /*
   * Whether to listen for Supabase's own view of the session.
   *
   * True from the start when storage holds a session, and true from the moment
   * a sign-in succeeds. That second case used to be missing, and it mattered:
   * somebody who signed in on a browser with nothing stored was never being
   * listened for, so a sign-out in another tab and an expired refresh token
   * both went unnoticed until the next reload.
   */
  const [watching, setWatching] = useState(() => cloudConfigured && hasStoredSession());

  /*
   * Whether there is somebody to lose.
   *
   * `signOut` clears this before it asks Supabase for anything, so the
   * `SIGNED_OUT` that follows a deliberate sign-out reads as nothing lost —
   * while the same event arriving from another tab, or from a refresh token
   * that ran out, still finds it true and is worth telling somebody about.
   */
  const wasSignedIn = useRef(false);

  const reset = useCallback(() => {
    wasSignedIn.current = false;
    setUser(null);
    setDevices([]);
    setStatus('signed-out');
  }, []);

  /** Reads the profile behind the current session. False when there is none. */
  const load = useCallback(async (): Promise<boolean> => {
    try {
      const cloud = await import('./cloud.ts');

      const profile = await cloud.fetchUser();
      if (!profile) {
        reset();

        return false;
      }

      wasSignedIn.current = true;
      setUser(profile);
      setDevices(await cloud.fetchDevices());
      setStatus('signed-in');

      return true;
    } catch {
      /*
       * The profile could not be read — offline, or the session is no longer
       * good. Either way this ends as signed out rather than stuck in
       * `restoring`, which nothing downstream would ever resolve.
       */
      reset();

      return false;
    }
  }, [reset]);

  useEffect(() => {
    // No credentials, or nobody has ever signed in on this browser. Either way
    // there is nothing to restore and no reason to fetch the client.
    if (!cloudConfigured || !watching) return;

    let cancelled = false;
    let unsubscribe = (): void => {};

    void import('./cloud.ts')
      .then((cloud) => {
        const client = cloud.supabase;
        if (cancelled) return;

        /*
         * Configured, but the client could not be built — a malformed URL, or a
         * chunk that did not arrive. `restoring` has to end somewhere, and a
         * status nothing ever resolves would leave the account route waiting on
         * a session that is never coming.
         */
        if (!client) {
          reset();

          return;
        }

        /*
         * Restores a session left by a previous visit, and follows every later
         * change to it — including the ones this tab did not make. The session
         * lives in storage every tab shares, and a refresh token that stops
         * working ends the same way a sign-out does.
         *
         * `SIGNED_IN` is deliberately not handled: `signIn` has already loaded
         * the profile by the time that event arrives, and reacting to both would
         * fetch it twice for every sign-in.
         */
        const { data } = client.auth.onAuthStateChange((event, session) => {
          if (event === 'INITIAL_SESSION') {
            /* No session behind the key in storage — expired, or cleared while
             this tab was closed. `restoring` has to resolve either way. */
            if (!session) {
              reset();

              return;
            }

            /* Already loaded. This subscription starts after a sign-in as well
             as on a reload, and `signIn` has fetched the profile by then;
             fetching it again would be the same request twice. */
            if (!wasSignedIn.current) void load();

            return;
          }

          if (event === 'SIGNED_OUT') {
            const lost = wasSignedIn.current;

            reset();

            /* Somebody else ended it: another tab, or a refresh token that ran
             out. Saying so is the difference between "Noto forgot me" and
             "my session expired". */
            if (lost) showToast('Your session ended. Sign in again to keep syncing.');
          }
        });

        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch(() => {
        if (!cancelled) reset();
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [watching, load, reset]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setStatus('signing-in');

      const cloud = await import('./cloud.ts');
      const outcome = await cloud.signIn(email, password);

      if (!outcome.ok) {
        setStatus('signed-out');

        return outcome;
      }

      /*
       * The credentials were right, and that is not the same as being signed
       * in: without a profile there is no name, no email and nothing for the
       * account screen to show. Reporting success here would send somebody to
       * a screen that then had to explain itself.
       *
       * The session is left in storage on purpose. The next visit resolves it
       * the same way a reload does, so a moment of bad network costs a retry
       * rather than the sign-in.
       */
      if (!(await load())) {
        return {
          ok: false,
          message: 'Signed in, but your profile could not be loaded. Check your connection.',
        };
      }

      /*
       * There is a session now, so this tab starts following it — a browser
       * with nothing in storage a moment ago was not being listened to, which
       * is how a sign-out in another tab used to go unnoticed here.
       *
       * After the load rather than before, so the `INITIAL_SESSION` the new
       * subscription receives finds the profile already in hand.
       */
      setWatching(true);

      return { ok: true };
    },
    [load],
  );

  const signUp = useCallback(async (input: AccountSignUpInput) => {
    const cloud = await import('./cloud.ts');

    // No session follows a sign-up: the address has to be confirmed first, so
    // the account state does not change here.
    return cloud.signUp(input);
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const cloud = await import('./cloud.ts');
    await cloud.resendConfirmation(email);
  }, []);

  /**
   * Ends the session.
   *
   * The account is cleared before anything is awaited, so the moment this is
   * called there is no name, no email and no device list left for a screen to
   * render — regardless of how long the server takes to revoke the token, or
   * whether it answers at all. `cloud.signOut` guarantees the stored session
   * goes with it.
   */
  const signOut = useCallback(async () => {
    reset();

    try {
      const cloud = await import('./cloud.ts');
      const revoked = await cloud.signOut();

      /* Signed out here either way. But "sign out" is usually taken to mean
         everywhere, and a token the server never heard about stays good on the
         other devices until it expires — so that difference gets said. */
      if (!revoked) {
        showToast(
          'Signed out on this device. The server was not reached, so other devices may still be signed in.',
        );
      }
    } catch {
      // The client itself could not be loaded. The session is still not
      // spending another reload in this browser.
      clearStoredSession();
    }
  }, [reset]);

  return useMemo<AccountValue>(
    () => ({
      status,
      user,
      devices,
      sessions: [],
      plan: MOCK_PLAN,
      security: MOCK_SECURITY,
      signIn: cloudConfigured ? signIn : null,
      // Sign-up needs a bot check. Without a sitekey the server would refuse
      // every attempt, so the form is not offered at all.
      signUp: cloudConfigured && turnstileSiteKey ? signUp : null,
      signOut: cloudConfigured ? signOut : null,
      resendConfirmation: cloudConfigured ? resendConfirmation : null,
      turnstileSiteKey,
    }),
    [status, user, devices, signIn, signUp, signOut, resendConfirmation],
  );
}
