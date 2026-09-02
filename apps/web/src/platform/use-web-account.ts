import type { Device, User } from '@noto/types';
import {
  MOCK_PLAN,
  MOCK_SECURITY,
  MOCK_USER,
  type AccountSignUpInput,
  type AccountValue,
} from '@noto/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { cloudConfigured, hasStoredSession, turnstileSiteKey } from './cloud-config.ts';

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
  const [status, setStatus] = useState<AccountValue['status']>(
    cloudConfigured ? 'signed-out' : 'unavailable',
  );
  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);

  const reset = useCallback(() => {
    setUser(null);
    setDevices([]);
    setStatus('signed-out');
  }, []);

  const load = useCallback(async () => {
    const cloud = await import('./cloud.ts');

    const profile = await cloud.fetchUser();
    if (!profile) {
      reset();

      return;
    }

    setUser(profile);
    setDevices(await cloud.fetchDevices());
    setStatus('signed-in');
  }, [reset]);

  useEffect(() => {
    // No credentials, or nobody has ever signed in on this browser. Either way
    // there is nothing to restore and no reason to fetch the client.
    if (!cloudConfigured || !hasStoredSession()) return;

    let cancelled = false;
    let unsubscribe = (): void => {};

    void import('./cloud.ts').then((cloud) => {
      const client = cloud.supabase;
      if (cancelled || !client) return;

      /*
       * Restores a session left by a previous visit, and follows a sign-out
       * that happened in another tab — the session lives in storage this tab
       * shares.
       *
       * `SIGNED_IN` is deliberately not handled: `signIn` has already loaded
       * the profile by the time that event arrives, and reacting to both would
       * fetch it twice for every sign-in.
       */
      const { data } = client.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION' && session) void load();
        if (event === 'SIGNED_OUT') reset();
      });

      unsubscribe = () => data.subscription.unsubscribe();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [load, reset]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setStatus('signing-in');

      const cloud = await import('./cloud.ts');
      const outcome = await cloud.signIn(email, password);

      if (!outcome.ok) {
        setStatus('signed-out');

        return outcome;
      }

      await load();

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

  const signOut = useCallback(async () => {
    const cloud = await import('./cloud.ts');
    await cloud.signOut();
    reset();
  }, [reset]);

  return useMemo<AccountValue>(
    () => ({
      status,
      // The fixture stands in until somebody signs in. Every screen that greets
      // a user renders signed out too, and a half-empty account screen would be
      // a worse answer than a placeholder one.
      user: user ?? MOCK_USER,
      devices,
      sessions: [],
      plan: MOCK_PLAN,
      security: MOCK_SECURITY,
      signIn: cloudConfigured ? signIn : null,
      // Sign-up needs a bot check. Without a sitekey the server would refuse
      // every attempt, so the form is not offered at all.
      signUp: cloudConfigured && turnstileSiteKey ? signUp : null,
      signOut: cloudConfigured ? signOut : null,
      turnstileSiteKey,
    }),
    [status, user, devices, signIn, signUp, signOut],
  );
}
