import type { DevicePlatform, Device, User } from '@noto/types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The account operations, for every platform that has a cloud.
 *
 * These used to live in the web application, which was fine while the web
 * application was the only thing that could sign in. It is not any more, and
 * two copies of a sign-out is exactly the arrangement that let sign-out stop
 * working in the first place — one caller navigated, the other ended the
 * session, and nobody could see both at once.
 *
 * What stays out here is everything a platform genuinely knows better: where
 * its session is stored, what this device is called, and which operating
 * system it is. Those arrive as arguments. Everything else — the shape of the
 * request, which failures are safe to describe, what a successful sign-in has
 * to do before it can claim to be one — is the same on a browser and on a
 * desktop, so it is written once.
 *
 * `@noto/backend` is deliberately absent. Its services run with the
 * service-role key, and rate limiting and the security log write to tables no
 * client may touch. From this side the cloud is a client that holds a session
 * and a `fetch` to the Edge Function that owns the rules.
 */

/** Where the Edge Functions live, and the public key that admits a caller. */
export interface CloudEndpoint {
  url: string;
  anonKey: string;
}

/**
 * How an installation describes itself when it signs in.
 *
 * The id is the installation's, not the session's — signing out and back in is
 * the same device, a reinstall is a new one — which is what makes the account
 * screen's list a list of devices rather than of logins.
 */
export interface DeviceDescriptor {
  id: string;
  name: string;
  platform: DevicePlatform;
  osName: string;
  appVersion: string;
}

export interface SignInOutcome {
  ok: boolean;
  message?: string;
  fields?: Record<string, string>;
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
 * Calls an Edge Function.
 *
 * The `apikey` and `Authorization` headers are what every Supabase endpoint
 * expects; sending the anon key as both is what the client library does and
 * what the functions' CORS policy is written for.
 */
async function callFunction(
  endpoint: CloudEndpoint,
  name: string,
  body: unknown,
): Promise<Response | null> {
  try {
    return await fetch(`${endpoint.url}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: endpoint.anonKey,
        Authorization: `Bearer ${endpoint.anonKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    /*
     * Offline, unreachable — or refused by the browser before it was sent,
     * which is what a CORS preflight failure looks like from here. `fetch`
     * cannot tell them apart and neither can this, so the message says what is
     * certain: nothing arrived.
     */
    return null;
  }
}

const UNREACHABLE = 'Could not reach the server. Check your connection.';

/**
 * Signs in through the Edge Function, then hands the session to the client.
 *
 * The function returns tokens rather than setting them — it has no access to
 * this device's storage — so persisting the session is this side's job, and
 * `setSession` is what makes the sign-in survive a restart.
 */
export async function signIn(
  client: SupabaseClient,
  endpoint: CloudEndpoint,
  email: string,
  password: string,
  device: DeviceDescriptor,
): Promise<SignInOutcome> {
  const response = await callFunction(endpoint, 'auth-signin', { email, password, device });
  if (!response) return { ok: false, message: UNREACHABLE };

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

/**
 * Creates an account through the Edge Function.
 *
 * No session is set here. Email confirmation is on, so a successful sign-up
 * means "check your inbox", not "you are in" — and setting a session for an
 * unconfirmed address would be telling the person otherwise.
 */
export async function signUp(endpoint: CloudEndpoint, input: SignUpInput): Promise<SignUpOutcome> {
  const response = await callFunction(endpoint, 'auth-signup', {
    email: input.email,
    password: input.password,
    displayName: input.displayName,
    turnstileToken: input.turnstileToken,
    marketingOptIn: false,
  });

  if (!response) return { ok: false, message: UNREACHABLE };

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) return failureFrom(body);

  const created = body as { confirmationRequired?: boolean };

  return { ok: true, confirmationRequired: created.confirmationRequired === true };
}

/**
 * Sends the confirmation email again.
 *
 * Straight to GoTrue rather than through a function: it needs no secret, and it
 * is rate-limited by Supabase on its own. Always reports success — whether an
 * address has an unconfirmed account is not something this should answer, and
 * the person who owns the inbox learns the truth from it either way.
 */
export async function resendConfirmation(client: SupabaseClient, email: string): Promise<void> {
  await client.auth.resend({ type: 'signup', email });
}

/** Whether signing out reached the server, or only cleared this device. */
export interface SignOutOutcome {
  /** True when the token was revoked rather than merely abandoned locally. */
  revoked: boolean;
}

/**
 * Ends the session.
 *
 * `supabase.auth.signOut()` asks the server to revoke the token and, when that
 * request fails, returns the error *without* clearing local storage — so an
 * offline sign-out would leave the session on the device and sign the person
 * straight back in on the next start. `clearStored` is the guarantee against
 * that: whatever the server said, the copy here goes.
 */
export async function signOut(
  client: SupabaseClient,
  clearStored: () => void,
): Promise<SignOutOutcome> {
  try {
    const { error } = await client.auth.signOut();
    if (!error) return { revoked: true };
  } catch {
    // Treated the same as a returned error: the local session still has to go.
  }

  clearStored();

  return { revoked: false };
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
export async function fetchUser(client: SupabaseClient): Promise<User | null> {
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
  platform: DevicePlatform;
  os_name: string;
  app_version: string;
  location: string | null;
  last_active_at: string;
}

/** Every installation this account has signed in from. RLS scopes it to them. */
export async function fetchDevices(
  client: SupabaseClient,
  currentDeviceId: string,
): Promise<Device[]> {
  const { data, error } = await client
    .from('devices')
    .select('id, name, platform, os_name, app_version, location, last_active_at')
    .is('deleted_at', null)
    .order('last_active_at', { ascending: false })
    .returns<DeviceRow[]>();

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    platform: row.platform,
    osName: row.os_name,
    appVersion: row.app_version,
    location: row.location,
    lastActiveAt: row.last_active_at,
    isCurrent: row.id === currentDeviceId,
  }));
}
