import { createSupabaseClient } from '@noto/sync/supabase';
import * as account from '@noto/sync/supabase/account';
import type { Device, User } from '@noto/types';

import { clearStoredSession, cloudConfig } from './cloud-config';
import { device, deviceId } from './device';

/**
 * The cloud, for the desktop application, on Supabase.
 *
 * Retired by `./cloud-api.ts`: loaded only in a build with no
 * `VITE_NOTO_API_URL`, and deleted once the cutover is verified in production.
 *
 * The operations are `@noto/sync/supabase/account`, the same ones the web
 * application calls against the same Edge Functions. What differs is only what
 * this installation is: a computer rather than a browser tab, named after the
 * operating system it is running on.
 *
 * Sign-up is absent, and deliberately so — see `signUpUrl` in `cloud-config`.
 * A `signUp` here would be a function that cannot succeed.
 *
 * Every import of this module is dynamic, as on the web. The reason is weaker
 * on a desktop, where the bundle is already on disk, but the shape is worth
 * keeping identical: one of these two files having a different loading rule
 * from the other is how they start to drift.
 */

export const supabase = createSupabaseClient({
  VITE_SUPABASE_URL: cloudConfig.url,
  VITE_SUPABASE_ANON_KEY: cloudConfig.anonKey,
});

export type { SignInOutcome } from '@noto/sync/supabase/account';

function endpoint(): account.CloudEndpoint {
  return { url: cloudConfig.url ?? '', anonKey: cloudConfig.anonKey ?? '' };
}

export async function signIn(email: string, password: string): Promise<account.SignInOutcome> {
  const client = supabase;
  if (!client) return { ok: false, message: 'This build has no account service configured.' };

  return account.signIn(client, endpoint(), email, password, device());
}

export async function resendConfirmation(email: string): Promise<void> {
  const client = supabase;
  if (!client) return;

  await account.resendConfirmation(client, email);
}

export async function signOut(): Promise<account.SignOutOutcome> {
  const client = supabase;
  if (!client) {
    clearStoredSession();

    return { revoked: false };
  }

  return account.signOut(client, clearStoredSession);
}

export async function fetchUser(): Promise<User | null> {
  const client = supabase;
  if (!client) return null;

  return account.fetchUser(client);
}

export async function fetchDevices(): Promise<Device[]> {
  const client = supabase;
  if (!client) return [];

  return account.fetchDevices(client, deviceId());
}
