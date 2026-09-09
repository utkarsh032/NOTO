import { APP_VERSION } from '@noto/config';
import { createSupabaseClient } from '@noto/sync/supabase';
import * as account from '@noto/sync/supabase/account';
import type { Device, DevicePlatform, User } from '@noto/types';

import { clearStoredSession, cloudConfig } from './cloud-config';

/**
 * The cloud, for the desktop application.
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

const DEVICE_ID_KEY = 'noto.device.id';

/**
 * This installation's id.
 *
 * In the renderer's localStorage, which Electron keeps in the application's
 * user-data directory — so it survives signing out, and a reinstall that clears
 * that directory is honestly a new device.
 */
function deviceId(): string {
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;

  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, created);

  return created;
}

/**
 * Which desktop this is.
 *
 * Read from the user agent rather than asked of the main process: Electron's
 * renderer reports the real platform there, and one synchronous string beats an
 * IPC round trip for something that cannot change while the window is open.
 */
function platform(): DevicePlatform {
  const agent = navigator.userAgent;
  if (agent.includes('Windows')) return 'windows';
  if (agent.includes('Mac OS X')) return 'macos';

  return 'linux';
}

function osName(): string {
  switch (platform()) {
    case 'windows':
      return 'Windows';
    case 'macos':
      return 'macOS';
    default:
      return 'Linux';
  }
}

/** This computer, as the account screen will list it. */
function device(): account.DeviceDescriptor {
  return {
    id: deviceId(),
    name: `${osName()} desktop`,
    platform: platform(),
    osName: osName(),
    appVersion: APP_VERSION,
  };
}

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
