import type { Device, User } from '@noto/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { showToast } from '../components/toast-store';
import { MOCK_PLAN, MOCK_SECURITY } from '../mock/account';
import type { AccountSignInResult, AccountSignUpInput, AccountValue } from './account-context';

/**
 * The account, for any platform with a cloud behind it.
 *
 * Web and desktop sign in to the same project, through the same Edge
 * Functions, and reach the same four states. Only three things genuinely
 * differ: which module holds the client, whether this build can create an
 * account at all, and where a session is stored. Those arrive as arguments.
 *
 * The rest is here because it is subtle and was expensive to get right —
 * `restoring` having to resolve down every path, a sign-in that succeeded
 * without a profile not counting as a sign-in, telling a session that expired
 * apart from one the person ended. A second copy of that on the desktop would
 * be a second copy to keep correct, and the bug this all started from was two
 * halves of signing out that nobody could see at once.
 *
 * Nothing here imports `@supabase/supabase-js`, and nothing here may:
 * `@noto/ui` is downloaded by every signed-out visitor. `CloudGateway` is the
 * seam — an interface each application implements against its own client.
 */

/** What happened to the session, in terms that need no Supabase types. */
export interface CloudSessionEvent {
  /**
   * `initial` is the session as it stood when watching began — a reload with
   * something in storage, or the moment after a fresh sign-in. `ended` is it
   * stopping: a sign-out here, in another tab, or a refresh token that ran out.
   */
  kind: 'initial' | 'ended';
  hasSession: boolean;
}

/** One platform's cloud, as this hook needs it. */
export interface CloudGateway {
  signIn(email: string, password: string): Promise<AccountSignInResult>;
  /** `revoked` is false when the session was dropped locally without the server. */
  signOut(): Promise<{ revoked: boolean }>;
  fetchUser(): Promise<User | null>;
  fetchDevices(): Promise<Device[]>;
  resendConfirmation(email: string): Promise<void>;
  /**
   * Follows the session. Returns `null` when no client could be built, which
   * is a state `restoring` has to be able to resolve out of.
   */
  watchSession(listener: (event: CloudSessionEvent) => void): (() => void) | null;
  /** Absent where this build cannot create an account. */
  signUp?(input: AccountSignUpInput): Promise<AccountSignInResult>;
}

export interface CloudAccountOptions {
  /** False in a build with no credentials, which is a supported product. */
  configured: boolean;
  /** Loads the cloud module. Called only when there is a reason to. */
  load(): Promise<CloudGateway>;
  hasStoredSession(): boolean;
  clearStoredSession(): void;
  /** Rendered into the sign-up form. `null` where sign-up is not offered. */
  turnstileSiteKey: string | null;
  /** Where to create an account when this build cannot. `null` where it can. */
  signUpUrl: string | null;
}

export function useCloudAccount(options: CloudAccountOptions): AccountValue {
  const { configured, turnstileSiteKey, signUpUrl } = options;

  /*
   * The callbacks and predicates are module-scope functions in every caller, so
   * they are stable — but nothing here should depend on that being true, and an
   * effect that re-subscribed whenever an options object was rebuilt would
   * re-subscribe on every render. The ref is what makes the effects depend on
   * the state they care about rather than on the caller's render count.
   *
   * Kept up to date from an effect rather than during render: a render can be
   * thrown away or replayed, and a ref written on one that never commits is a
   * value nothing asked for. This effect is declared before the subscribing one
   * so that effects run in the order that leaves the ref current first.
   */
  const gateway = useRef(options);

  useEffect(() => {
    gateway.current = options;
  });

  /*
   * A stored session opens as `restoring`, not as `signed-out`.
   *
   * Bringing it back takes a round trip, and calling that signed out is a lie
   * that lasts long enough to act on: the avatar flashes "Sign in", and a route
   * guard reading the same value throws the person off their own account screen
   * on every restart.
   */
  const [status, setStatus] = useState<AccountValue['status']>(() => {
    if (!options.configured) return 'unavailable';

    return options.hasStoredSession() ? 'restoring' : 'signed-out';
  });

  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);

  /*
   * Whether to listen for the client's own view of the session.
   *
   * True from the start when storage holds one, and true from the moment a
   * sign-in succeeds. That second case is not an optimisation: somebody who
   * signed in with nothing in storage was never being listened for, so a
   * sign-out elsewhere and an expired refresh token both went unnoticed.
   */
  const [watching, setWatching] = useState(() => options.configured && options.hasStoredSession());

  /*
   * Whether there is somebody to lose.
   *
   * `signOut` clears this before it asks for anything, so the `ended` that
   * follows a deliberate sign-out reads as nothing lost — while the same event
   * arriving from another tab, or from a token that ran out, still finds it
   * true and is worth telling somebody about.
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
      const cloud = await gateway.current.load();

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
    // No credentials, or nobody has ever signed in here. Either way there is
    // nothing to restore and no reason to fetch the client.
    if (!configured || !watching) return;

    let cancelled = false;
    let unsubscribe = (): void => {};

    void gateway.current
      .load()
      .then((cloud) => {
        if (cancelled) return;

        const stop = cloud.watchSession((event) => {
          if (event.kind === 'initial') {
            /* No session behind the key in storage — expired, or cleared while
               this was closed. `restoring` has to resolve either way. */
            if (!event.hasSession) {
              reset();

              return;
            }

            /* Already loaded. This subscription starts after a sign-in as well
               as on a restart, and `signIn` has fetched the profile by then;
               fetching it again would be the same request twice. */
            if (!wasSignedIn.current) void load();

            return;
          }

          const lost = wasSignedIn.current;

          reset();

          /* Somebody else ended it: another tab, or a refresh token that ran
             out. Saying so is the difference between "Noto forgot me" and "my
             session expired". */
          if (lost) showToast('Your session ended. Sign in again to keep syncing.');
        });

        /*
         * Configured, but no client could be built — a malformed URL, or a
         * chunk that did not arrive. `restoring` has to end somewhere, and a
         * status nothing resolves would leave the account route waiting on a
         * session that is never coming.
         */
        if (!stop) {
          reset();

          return;
        }

        unsubscribe = stop;
      })
      .catch(() => {
        if (!cancelled) reset();
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [configured, watching, load, reset]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setStatus('signing-in');

      const cloud = await gateway.current.load();
      const outcome = await cloud.signIn(email, password);

      if (!outcome.ok) {
        setStatus('signed-out');

        return outcome;
      }

      /*
       * The credentials were right, and that is not the same as being signed
       * in: without a profile there is no name, no email and nothing for the
       * account screen to show. Reporting success here would send somebody to a
       * screen that then had to explain itself.
       *
       * The session is left in storage on purpose. The next start resolves it
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
       * There is a session now, so this window starts following it. After the
       * load rather than before, so the `initial` event the new subscription
       * receives finds the profile already in hand.
       */
      setWatching(true);

      return { ok: true };
    },
    [load],
  );

  const signUp = useCallback(async (input: AccountSignUpInput) => {
    const cloud = await gateway.current.load();

    // No session follows a sign-up: the address has to be confirmed first, so
    // the account state does not change here.
    return cloud.signUp?.(input) ?? { ok: false, message: 'Sign-up is not open in this build.' };
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const cloud = await gateway.current.load();
    await cloud.resendConfirmation(email);
  }, []);

  /**
   * Ends the session.
   *
   * The account is cleared before anything is awaited, so the moment this is
   * called there is no name, no email and no device list left for a screen to
   * render — regardless of how long the server takes to revoke the token, or
   * whether it answers at all. The gateway's `signOut` guarantees the stored
   * session goes with it.
   */
  const signOut = useCallback(async () => {
    reset();

    try {
      const cloud = await gateway.current.load();
      const { revoked } = await cloud.signOut();

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
      // spending another restart on this device.
      gateway.current.clearStoredSession();
    }
  }, [reset]);

  /** True only where the build can actually complete a sign-up. */
  const canSignUp = configured && turnstileSiteKey !== null;

  return useMemo<AccountValue>(
    () => ({
      status,
      user,
      devices,
      sessions: [],
      // Plan and security remain fixtures: nothing behind a subscription or a
      // second factor exists yet to read.
      plan: MOCK_PLAN,
      security: MOCK_SECURITY,
      signIn: configured ? signIn : null,
      // Sign-up needs a bot check. Without a sitekey the server would refuse
      // every attempt, so the form is not offered at all.
      signUp: canSignUp ? signUp : null,
      signOut: configured ? signOut : null,
      resendConfirmation: configured ? resendConfirmation : null,
      turnstileSiteKey,
      signUpUrl,
    }),
    [
      status,
      user,
      devices,
      configured,
      canSignUp,
      signIn,
      signUp,
      signOut,
      resendConfirmation,
      turnstileSiteKey,
      signUpUrl,
    ],
  );
}
