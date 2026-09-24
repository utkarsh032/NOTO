import type {
  DeviceRegistrationDto,
  MagicLinkRequest,
  PasswordResetRequest,
  PasswordUpdateRequest,
  SignInRequest,
  SignUpRequest,
} from '@noto/types/api';
import { z } from 'zod';

import { MAXIMUM_PASSWORD_LENGTH, MINIMUM_PASSWORD_LENGTH } from '../helpers/password.ts';

/**
 * The runtime half of the API contract.
 *
 * The types live in `@noto/types/api` and carry no runtime code, because every
 * application imports that package and a signed-out user must not download the
 * cloud. The schemas live here, in a package only cloud code paths import.
 *
 * Each schema is checked against its type with `satisfies`, so a field added to
 * one and forgotten in the other fails to compile rather than failing in
 * production.
 */

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .pipe(z.email({ message: 'Enter a valid email address.' }));

const password = z
  .string()
  .min(MINIMUM_PASSWORD_LENGTH, {
    message: `Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
  })
  .max(MAXIMUM_PASSWORD_LENGTH * 2, { message: 'That password is too long.' });

const turnstileToken = z.string().min(1, { message: 'Bot check failed. Try again.' }).max(2048);

/**
 * Where a provider is allowed to send someone back to.
 *
 * An open redirect in an OAuth flow hands an attacker the authorization code,
 * so this is an allow-list of exact origins, compared after parsing. Any
 * `https://` URL used to pass, which is an open redirect with extra steps, and
 * a prefix test on `http://localhost` also passed `http://localhost.evil.test`.
 *
 * `noto://` is the desktop and mobile deep link. Localhost is the developer's
 * own machine, on any port, by exact host name.
 */
export const REDIRECT_ORIGINS: readonly string[] = [
  'https://noto.app',
  'https://www.noto.app',
  'https://noto-web.utkarshraj525.workers.dev',
];

export function isAllowedRedirect(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol === 'noto:') return true;
  if (url.protocol === 'https:') return REDIRECT_ORIGINS.includes(url.origin);
  if (url.protocol === 'http:') return url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  return false;
}

export const redirectUrl = z
  .string()
  .url()
  .refine(isAllowedRedirect, { message: 'That redirect target is not allowed.' });

export const deviceRegistrationSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  platform: z.enum(['windows', 'macos', 'linux', 'ios', 'android', 'web']),
  osName: z.string().trim().min(1).max(120),
  appVersion: z.string().trim().min(1).max(40),
}) satisfies z.ZodType<DeviceRegistrationDto>;

export const signUpSchema = z.object({
  email,
  password,
  displayName: z.string().trim().min(1).max(80).optional(),
  turnstileToken,
  locale: z.string().trim().min(2).max(12).optional(),
  marketingOptIn: z.boolean(),
}) satisfies z.ZodType<SignUpRequest>;

export const signInSchema = z.object({
  email,
  // Not `password`: an existing account may predate a rule change, and refusing
  // to *check* a password because it is too short would lock out the very
  // people who need to be told to change it.
  password: z.string().min(1).max(512),
  turnstileToken: turnstileToken.optional(),
  device: deviceRegistrationSchema,
}) satisfies z.ZodType<SignInRequest>;

export const magicLinkSchema = z.object({
  email,
  turnstileToken,
}) satisfies z.ZodType<MagicLinkRequest>;

export const passwordResetSchema = z.object({
  email,
  turnstileToken,
}) satisfies z.ZodType<PasswordResetRequest>;

export const passwordUpdateSchema = z.object({
  currentPassword: z.string().min(1).max(512).optional(),
  newPassword: password,
  resetToken: z.string().min(1).max(2048).optional(),
  signOutOtherDevices: z.boolean(),
}) satisfies z.ZodType<PasswordUpdateRequest>;

export const oauthStartSchema = z.object({
  provider: z.enum(['google', 'github', 'apple']),
  redirectTo: redirectUrl,
  codeChallenge: z.string().min(43).max(128),
});

export const settingsPatchSchema = z.object({
  appearance: z.record(z.string(), z.unknown()).optional(),
  editor: z.record(z.string(), z.unknown()).optional(),
  updates: z.record(z.string(), z.unknown()).optional(),
  syncEnabled: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// The Noto API's own identity routes (apps/api). GoTrue handled these before.
// ---------------------------------------------------------------------------

/** A mailed or refresh token: opaque, bounded, never parsed. */
const opaqueToken = z.string().trim().min(16).max(512);

export const refreshSchema = z.object({ refreshToken: opaqueToken });

export const emailTokenSchema = z.object({ token: opaqueToken });

export const emailOnlySchema = z.object({ email });

export const passwordResetConfirmSchema = z.object({
  token: opaqueToken,
  newPassword: password,
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(512),
  newPassword: password,
  signOutOtherDevices: z.boolean().default(true),
});

export const emailChangeSchema = z.object({
  newEmail: email,
  password: z.string().min(1).max(512),
});

export const profilePatchSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    locale: z.string().trim().min(2).max(12).optional(),
    marketingOptIn: z.boolean().optional(),
  })
  .strict();
