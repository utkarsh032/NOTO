import type { Device, Session, User } from '@noto/types';
import { createContext, useContext } from 'react';

/**
 * The seam between the shared shell and an identity service.
 *
 * The same shape as `NotoDataContext`, and for the same reason: the shell
 * renders an account but never learns who provides it. Web supplies an
 * implementation backed by the `auth-signin` Edge Function; desktop and mobile
 * have none yet and get the fixture.
 *
 * Nothing here imports `@noto/backend` or `@supabase/supabase-js`, and nothing
 * here may. `@noto/ui` is downloaded by every signed-out visitor, and the cloud
 * is not something they asked for — the application injects it, the interface
 * only describes it.
 */

/** Presentation shape of the plan. Not the billing record. */
export interface AccountPlan {
  name: string;
  description: string;
  /** Bytes included with the plan. */
  storageLimitBytes: number;
  renewsOn: string | null;
}

export interface SecurityState {
  passwordChangedAt: string;
  twoFactorEnabled: boolean;
  recoveryEmail: string | null;
}

/**
 * Why a sign-in did not happen, in the only terms a screen needs.
 *
 * Deliberately not the server's error code. `AuthService` answers an unknown
 * address and a wrong password identically on purpose, and a UI that tried to
 * tell them apart would be inventing a distinction the backend refuses to make.
 */
export interface AccountSignInResult {
  ok: boolean;
  /** Safe to show. Present when `ok` is false. */
  message?: string;
  /**
   * Field name to message, when the server rejected specific inputs.
   *
   * Without this a form can only say "something was wrong", which is the least
   * useful thing it could say to somebody who has just filled it in.
   */
  fields?: Record<string, string>;
}

export interface AccountSignUpInput {
  email: string;
  password: string;
  displayName: string;
  /** From the Turnstile widget. The server rejects a sign-up without one. */
  turnstileToken: string;
}

export interface AccountValue {
  /**
   * `unavailable` is not an error: it is Noto with no cloud configured, which
   * is the normal state for a local-first application and for every build that
   * ships without Supabase credentials.
   */
  status: 'unavailable' | 'signed-out' | 'signing-in' | 'signed-in';

  user: User;
  devices: Device[];
  sessions: Session[];
  plan: AccountPlan;
  security: SecurityState;

  /** `null` when `status` is `unavailable`. */
  signIn: ((email: string, password: string) => Promise<AccountSignInResult>) | null;
  /** `null` when sign-up is not open in this build. */
  signUp: ((input: AccountSignUpInput) => Promise<AccountSignInResult>) | null;
  /** `null` when `status` is `unavailable`. */
  signOut: (() => Promise<void>) | null;

  /**
   * The public Turnstile sitekey, or `null` when no bot check is configured.
   *
   * Public by design — it is rendered into the page. The secret that makes a
   * token mean anything lives only in the Edge Function.
   */
  turnstileSiteKey: string | null;
}

/**
 * `null` when no application has provided one, which is how `useAccount` knows
 * to fall back to the fixture rather than render an empty screen.
 */
export const AccountContext = createContext<AccountValue | null>(null);

export function useAccountContext(): AccountValue | null {
  return useContext(AccountContext);
}
