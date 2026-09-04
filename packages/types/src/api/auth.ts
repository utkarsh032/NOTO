import type { IsoDateTime } from '../common.ts';
import type { DeviceRegistrationDto } from './account.ts';

/** How an account can be signed in to. */
export type AuthProvider = 'google' | 'github' | 'apple';

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export interface SignUpRequest {
  email: string;
  /** Plaintext, over TLS, straight to GoTrue. Noto never stores or logs it. */
  password: string;
  displayName?: string;
  /** Cloudflare Turnstile. Required: sign-up is the cheapest thing to abuse. */
  turnstileToken: string;
  locale?: string;
  marketingOptIn: boolean;
}

export interface SignInRequest {
  email: string;
  password: string;
  /** Only demanded after repeated failures, so the common path stays quiet. */
  turnstileToken?: string;
  device: DeviceRegistrationDto;
}

export interface OAuthStartRequest {
  provider: AuthProvider;
  /** Where the provider returns to: an https URL on web, `noto://` elsewhere. */
  redirectTo: string;
  /** PKCE S256 challenge. The verifier never leaves the device. */
  codeChallenge: string;
}

export interface MagicLinkRequest {
  email: string;
  turnstileToken: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface PasswordResetRequest {
  email: string;
  turnstileToken: string;
}

export interface PasswordUpdateRequest {
  /** Required when signed in; absent when arriving with a `resetToken`. */
  currentPassword?: string;
  newPassword: string;
  resetToken?: string;
  /** Default true. Changing a password because it leaked should end the leak. */
  signOutOtherDevices: boolean;
}

export interface MfaVerifyRequest {
  factorId: string;
  /** Six digits, or a recovery code — exactly one of the two. */
  code?: string;
  recoveryCode?: string;
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AuthSessionDto {
  accessToken: string;
  expiresAt: IsoDateTime;
  /**
   * Rotating. Belongs in the OS keychain on desktop and mobile and in an
   * httpOnly cookie on web — never in `localStorage`, and never in a log.
   */
  refreshToken: string;
  user: UserDto;
  /** True when a second factor is still outstanding; the session is not usable yet. */
  mfaRequired: boolean;
}

/**
 * The result of creating an account.
 *
 * `session` is `null` whenever the address has to be confirmed first, which is
 * the normal case in staging and production. That is a success — the account
 * exists — and it is a separate shape from `AuthSessionDto` precisely so it
 * cannot be mistaken for a failed sign-in, which is what happened when the two
 * shared one return type.
 */
export interface AuthSignUpDto {
  user: UserDto;
  /** `null` when a confirmation email must be answered before signing in. */
  session: AuthSessionDto | null;
  /** True when the person should be told to check their inbox. */
  confirmationRequired: boolean;
}

export interface MfaEnrollDto {
  factorId: string;
  qrCodeSvg: string;
  secret: string;
  /** Shown once, at enrolment, and never retrievable again. */
  recoveryCodes: string[];
}

/**
 * Why a sign-in did not happen.
 *
 * There is deliberately no "unknown email" code. Telling an attacker which
 * addresses have accounts is a free list of targets, so an unknown address and
 * a wrong password produce the same code, the same message and the same timing.
 */
export type AuthFailureCode =
  | 'invalid_credentials'
  | 'rate_limited'
  | 'mfa_required'
  | 'email_unverified'
  | 'weak_password'
  | 'breached_password'
  | 'provider_unavailable';

export interface AuthErrorDto {
  code: AuthFailureCode;
  message: string;
  retryAfterSeconds?: number;
}
