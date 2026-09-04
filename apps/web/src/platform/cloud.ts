import { APP_VERSION } from '@noto/config';
import { createSupabaseClient } from '@noto/sync/supabase';
import type { Device, User } from '@noto/types';

import { cloudConfig } from './cloud-config.ts';

/**
 * The cloud, for the web application.
 *
 * `@noto/backend` is deliberately absent here. Its services run with the
 * service-role key — rate limiting and the security log write to tables no
 * client may touch — so on this side the cloud is two things and nothing more:
 * a Supabase client that holds the session, and one `fetch` to the `auth-signin`
 * Edge Function that owns the rules.
 *
 * Every import of this module is dynamic. It is the boundary the bundle splits
 * on, and importing it statically anywhere would put `@supabase/supabase-js`
 * back into the entry chunk that a signed-out visitor downloads.
 */

const env = {
  VITE_SUPABASE_URL: cloudConfig.url,
  VITE_SUPABASE_ANON_KEY: cloudConfig.anonKey,
};

export const supabase = createSupabaseClient(env);

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

export interface SignInOutcome {
  ok: boolean;
  message?: string;
  fields?: Record<string, string>;
}

/** Pulls the displayable parts out of an `ApiErrorDto`. */
function failureFrom(body: unknown): SignInOutcome {
  const dto = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const fields = dto.fields;

  return {
    ok: false,
    message: typeof dto.message === 'string' ? dto.message : 'That did not work. Try again.',
    ...(typeof fields === 'object' && fields !== null
      ? { fields: fields as Record<string, string> }
      : {}),
  };
}

/**
 * Signs in through the Edge Function, then hands the session to the client.
 *
 * The function returns tokens rather than setting them, because it has no
 * access to this browser's storage — so persisting the session is this side's
 * job, and `setSession` is what makes the sign-in survive a reload.
 */
export async function signIn(email: string, password: string): Promise<SignInOutcome> {
  const client = supabase;
  if (!client) return { ok: false, message: 'This build has no account service configured.' };

  const url = `${cloudConfig.url}/functions/v1/auth-signin`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cloudConfig.anonKey ?? '',
        Authorization: `Bearer ${cloudConfig.anonKey ?? ''}`,
      },
      body: JSON.stringify({
        email,
        password,
        device: {
          id: deviceId(),
          name: browserName(),
          platform: 'web',
          osName: osName(),
          appVersion: APP_VERSION,
        },
      }),
    });
  } catch {
    // Offline, or the function is unreachable. Not a credentials problem, and
    // saying so would send someone to reset a password that is fine.
    return { ok: false, message: 'Could not reach the server. Check your connection.' };
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) return failureFrom(body);

  const session = body as { accessToken?: string; refreshToken?: string };
  if (!session.accessToken || !session.refreshToken) {
    return { ok: false, message: 'The server did not return a usable session.' };
  }

  const { error } = await client.auth.setSession({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });

  if (error) return { ok: false, message: 'Signed in, but the session could not be stored.' };

  return { ok: true };
}

export interface SignUpOutcome extends SignInOutcome {
  /** True when the account exists but the address has to be confirmed first. */
  confirmationRequired?: boolean;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  turnstileToken: string;
}

/**
 * Creates an account through the Edge Function.
 *
 * No session is set here. Email confirmation is on in the cloud project, so a
 * successful sign-up means "check your inbox", not "you are in" — and setting a
 * session for an unconfirmed address would be telling the person otherwise.
 */
export async function signUp(input: SignUpInput): Promise<SignUpOutcome> {
  const url = `${cloudConfig.url}/functions/v1/auth-signup`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cloudConfig.anonKey ?? '',
        Authorization: `Bearer ${cloudConfig.anonKey ?? ''}`,
      },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        displayName: input.displayName,
        turnstileToken: input.turnstileToken,
        marketingOptIn: false,
      }),
    });
  } catch {
    return { ok: false, message: 'Could not reach the server. Check your connection.' };
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) return failureFrom(body);

  const created = body as { confirmationRequired?: boolean };

  return { ok: true, confirmationRequired: created.confirmationRequired === true };
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** The signed-in user's profile, or `null` when there is no session. */
export async function fetchUser(): Promise<User | null> {
  const client = supabase;
  if (!client) return null;

  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await client
    .from('profiles')
    .select('id, email, display_name, avatar_url, created_at, updated_at, deleted_at')
    .eq('id', auth.user.id)
    .maybeSingle<ProfileRow>();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    deletedAt: data.deleted_at,
  };
}

interface DeviceRow {
  id: string;
  name: string;
  platform: Device['platform'];
  os_name: string;
  app_version: string;
  location: string | null;
  last_active_at: string;
}

/** Every installation this account has signed in from. RLS scopes it to them. */
export async function fetchDevices(): Promise<Device[]> {
  const client = supabase;
  if (!client) return [];

  const { data, error } = await client
    .from('devices')
    .select('id, name, platform, os_name, app_version, location, last_active_at')
    .is('deleted_at', null)
    .order('last_active_at', { ascending: false })
    .returns<DeviceRow[]>();

  if (error || !data) return [];

  const current = deviceId();

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    platform: row.platform,
    osName: row.os_name,
    appVersion: row.app_version,
    location: row.location,
    lastActiveAt: row.last_active_at,
    isCurrent: row.id === current,
  }));
}
