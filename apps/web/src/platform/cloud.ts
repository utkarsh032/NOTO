import { APP_VERSION } from '@noto/config';
import { createSupabaseClient } from '@noto/sync/supabase';
import * as account from '@noto/sync/supabase/account';
import type { Device, User } from '@noto/types';

import { clearStoredSession, cloudConfig } from './cloud-config.ts';

/**
 * The cloud, for the web application.
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

const DEVICE_ID_KEY = 'noto.device.id';

/**
 * This installation's id.
 *
 * Generated here and kept in local storage, so signing out and back in is the
 * same device while a reinstall is a new one. That is what makes the device
 * list on the account screen a list of installations rather than of sessions.
 */
function deviceId(): string {
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;

  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, created);

  return created;
}

/** A readable name for this browser. Coarse on purpose; it is a label, not a fingerprint. */
function browserName(): string {
  const agent = navigator.userAgent;
  if (agent.includes('Edg/')) return 'Edge';
  if (agent.includes('Chrome/') && !agent.includes('Chromium')) return 'Chrome';
  if (agent.includes('Firefox/')) return 'Firefox';
  if (agent.includes('Safari/')) return 'Safari';

  return 'Browser';
}

function osName(): string {
  const agent = navigator.userAgent;
  if (agent.includes('Windows')) return 'Windows';
  if (agent.includes('Mac OS X')) return 'macOS';
  if (agent.includes('Android')) return 'Android';
  if (agent.includes('Linux')) return 'Linux';

  return 'Unknown';
}

/** This browser, as the account screen will list it. */
function device(): account.DeviceDescriptor {
  return {
    id: deviceId(),
    name: browserName(),
    platform: 'web',
    osName: osName(),
    appVersion: APP_VERSION,
  };
}

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
