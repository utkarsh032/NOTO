import { createSupabaseClient } from '@noto/sync/supabase';
import * as account from '@noto/sync/supabase/account';
import type { Device, User } from '@noto/types';

import { clearStoredSession, cloudConfig } from './cloud-config.ts';
import { device, deviceId } from './device.ts';

/**
 * The cloud, for the web application, on Supabase.
 *
 * Retired by `./cloud-api.ts`: this module is loaded only in a build with no
 * `VITE_NOTO_API_URL`, and is deleted once the cutover is verified in
 * production (Backend_Node_Plan, appendix).
 *
 * The operations themselves live in `@noto/sync/supabase/account`, because the
 * desktop performs the same ones against the same functions. What is left here
 * is the part only a browser can answer: what this installation is called, what
 * it is running on, and the id that makes it the same device tomorrow.
 *
 * Every import of this module is dynamic. It is the boundary the bundle splits
 * on, and importing it statically anywhere would put `@supabase/supabase-js`
 * back into the entry chunk that a signed-out visitor downloads.
 */

export const supabase = createSupabaseClient({
  VITE_SUPABASE_URL: cloudConfig.url,
  VITE_SUPABASE_ANON_KEY: cloudConfig.anonKey,
});

export type { SignInOutcome, SignUpInput, SignUpOutcome } from '@noto/sync/supabase/account';

/** The endpoint, once the credentials are known to be present. */
function endpoint(): account.CloudEndpoint {
  return { url: cloudConfig.url ?? '', anonKey: cloudConfig.anonKey ?? '' };
}

export async function signIn(email: string, password: string): Promise<account.SignInOutcome> {
  const client = supabase;
  if (!client) return { ok: false, message: 'This build has no account service configured.' };

  return account.signIn(client, endpoint(), email, password, device());
}

export async function signUp(input: account.SignUpInput): Promise<account.SignUpOutcome> {
  return account.signUp(endpoint(), input);
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
