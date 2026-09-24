import type { Device, Session, User } from '@noto/types';
import type {
  ApiErrorDto,
  AuthEventDto,
  AuthSessionDto,
  AuthSignUpDto,
  DeviceDto,
  DeviceRegistrationDto,
  SessionDto,
  UserDto,
} from '@noto/types/api';

import type { ApiClient, ApiResponse } from './client';

/**
 * The account operations, against `apps/api`.
 *
 * The same functions `../supabase/account.ts` offered, with the same outcomes,
 * so that the shared account hook cannot tell which backend it is talking to.
 * That module goes when Supabase does; this one is what remains.
 *
 * Every function answers rather than throws, apart from `fetchProfile`, whose
 * caller needs to tell "nobody is signed in" (`null`) apart from "the server
 * could not be asked" (a rejection) — the first ends a session, the second
 * must not.
 */

export type DeviceDescriptor = DeviceRegistrationDto;

export interface SignInOutcome {
  ok: boolean;
  message?: string;
  fields?: Record<string, string>;
  /** The password was right, but the address has not been confirmed yet. */
  unconfirmed?: boolean;
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

export interface SignOutOutcome {
  /** True when the server revoked the session rather than this device merely forgetting it. */
  revoked: boolean;
}

/** The signed-in person, and the parts of their account the Security tab shows. */
export interface Profile {
  user: User;
  security: {
    passwordChangedAt: string | null;
    twoFactorEnabled: boolean;
    emailVerified: boolean;
  };
}

const UNREACHABLE = 'Could not reach the server. Check your connection.';
const GENERIC = 'That did not work. Try again.';

/** A failure, in the terms a form can show. */
function failure(response: ApiResponse<unknown>): SignInOutcome {
  if (response.ok) return { ok: false, message: GENERIC };
  if (response.status === 0) return { ok: false, message: UNREACHABLE };

  const error: ApiErrorDto | null = response.error;

  if (response.status === 423) {
    return {
      ok: false,
      message: error?.message ?? 'Too many attempts. This account is locked for a while.',
    };
  }

  if (!error) return { ok: false, message: GENERIC };

  return {
    ok: false,
    message: error.message,
    ...(error.fields ? { fields: error.fields } : {}),
    // `email_unverified` is an auth failure code rather than an `ApiErrorCode`.
    ...((error.code as string) === 'email_unverified' ? { unconfirmed: true } : {}),
  };
}

/**
 * Signs in, and keeps the session.
 *
 * The device travels with the request, which is what registers it: the account
 * screen's list is a list of installations because of this id.
 */
export async function signIn(
  client: ApiClient,
  email: string,
  password: string,
  device: DeviceDescriptor,
): Promise<SignInOutcome> {
  const response = await client.request<AuthSessionDto>('POST', '/auth/signin', {
    auth: false,
    body: { email, password, device },
  });

  if (!response.ok) return failure(response);

  const session = response.data;
  if (!session?.accessToken || !session.refreshToken) {
    return { ok: false, message: 'The server did not return a usable session.' };
  }

  /*
   * No second factor exists yet (Backend_Node_Plan §4.4). A server that asked
   * for one is newer than this client, and saying so beats a session that
   * every later request would be refused on.
   */
  if (session.mfaRequired) {
    return {
      ok: false,
      message: 'This account needs two-step sign-in, which this version of Noto cannot do yet.',
    };
  }

  await client.startSession({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
  });

  return { ok: true };
}

/**
 * Creates an account.
 *
 * No session is kept even if one comes back: the address has to be confirmed
 * first in every real environment, and the form tells the person to check
 * their inbox.
 */
export async function signUp(client: ApiClient, input: SignUpInput): Promise<SignUpOutcome> {
  const response = await client.request<AuthSignUpDto>('POST', '/auth/signup', {
    auth: false,
    body: {
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      turnstileToken: input.turnstileToken,
      marketingOptIn: false,
    },
  });

  if (!response.ok) return failure(response);

  return { ok: true, confirmationRequired: response.data?.confirmationRequired !== false };
}

/**
 * Sends the confirmation email again. Always quiet: whether an address has an
 * unconfirmed account is not something this should answer.
 */
export async function resendConfirmation(client: ApiClient, email: string): Promise<void> {
  await client.request('POST', '/auth/verify-email/resend', { auth: false, body: { email } });
}

/** Confirms an address with the token from the email link. */
export async function verifyEmail(client: ApiClient, token: string): Promise<SignInOutcome> {
  const response = await client.request('POST', '/auth/verify-email', {
    auth: false,
    body: { token },
  });

  return response.ok ? { ok: true } : failure(response);
}

/** Asks for a reset email. The server answers the same whether or not the address exists. */
export async function requestPasswordReset(
  client: ApiClient,
  email: string,
): Promise<SignInOutcome> {
  const response = await client.request('POST', '/auth/password/forgot', {
    auth: false,
    body: { email },
  });

  return response.ok ? { ok: true } : failure(response);
}

/** Sets a new password with the token from the reset email. Every session ends. */
export async function resetPassword(
  client: ApiClient,
  token: string,
  newPassword: string,
): Promise<SignInOutcome> {
  const response = await client.request('POST', '/auth/password/reset', {
    auth: false,
    body: { token, newPassword },
  });

  return response.ok ? { ok: true } : failure(response);
}

/**
 * Ends the session.
 *
 * The local copy goes whatever the server says. A sign-out that failed offline
 * and left the tokens behind would sign the person straight back in.
 */
export async function signOut(client: ApiClient): Promise<SignOutOutcome> {
  const response = await client.request('POST', '/auth/signout');

  await client.endSession();

  return { revoked: response.ok };
}

function toUser(dto: UserDto): User {
  return {
    id: dto.id,
    email: dto.email,
    displayName: dto.displayName,
    avatarUrl: dto.avatarUrl,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    deletedAt: null,
  };
}

/**
 * Who is signed in. `null` when nobody is — no session, or one the server
 * refused. Rejects when the server could not be asked, which is not the same.
 */
export async function fetchProfile(client: ApiClient): Promise<Profile | null> {
  const response = await client.request<UserDto>('GET', '/auth/session');

  if (response.ok) {
    const dto = response.data;

    return {
      user: toUser(dto),
      security: {
        passwordChangedAt: dto.passwordChangedAt ?? null,
        twoFactorEnabled: dto.mfaEnabled,
        emailVerified: dto.emailVerified,
      },
    };
  }

  if (response.status === 401 || response.status === 403) return null;

  throw new Error(`The account could not be read (${response.status}).`);
}

/** Every installation this account has signed in from, the current one marked. */
export async function fetchDevices(client: ApiClient, currentDeviceId: string): Promise<Device[]> {
  const response = await client.request<DeviceDto[]>('GET', '/account/devices');
  if (!response.ok || !Array.isArray(response.data)) return [];

  return response.data
    .filter((device) => !device.revokedAt)
    .map((device) => ({
      id: device.id,
      name: device.name,
      platform: device.platform,
      osName: device.osName,
      appVersion: device.appVersion,
      location: device.location,
      lastActiveAt: device.lastActiveAt,
      isCurrent: device.id === currentDeviceId,
    }));
}

/** Signs a device out and forgets it. Its sessions end with it. */
export async function revokeDevice(client: ApiClient, deviceId: string): Promise<boolean> {
  const response = await client.request(
    'DELETE',
    `/account/devices/${encodeURIComponent(deviceId)}`,
  );

  return response.ok;
}

/**
 * Where this account is signed in right now. `null` when the server does not
 * offer the list, which the screen shows as nothing to manage rather than as
 * an error.
 */
export async function fetchSessions(client: ApiClient): Promise<Session[] | null> {
  const response = await client.request<SessionDto[]>('GET', '/account/sessions');
  if (!response.ok || !Array.isArray(response.data)) return null;

  return response.data.map((session) => ({ ...session }));
}

/** Ends one other session. The server refuses the current one. */
export async function revokeSession(client: ApiClient, sessionId: string): Promise<boolean> {
  const response = await client.request(
    'DELETE',
    `/account/sessions/${encodeURIComponent(sessionId)}`,
  );

  return response.ok;
}

/** The security log, newest first. */
export async function fetchEvents(client: ApiClient, limit = 20): Promise<AuthEventDto[]> {
  const response = await client.request<AuthEventDto[] | { items?: AuthEventDto[] }>(
    'GET',
    `/account/events?limit=${limit}`,
  );
  if (!response.ok) return [];

  const data = response.data;
  if (Array.isArray(data)) return data;

  return Array.isArray(data?.items) ? data.items : [];
}
