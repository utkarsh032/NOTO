import type { User } from '@noto/types';
import { useMemo } from 'react';

import { MOCK_PLAN } from '../mock/account.ts';
import { type AccountValue, useAccountContext } from './account-context.ts';

export type {
  AccountPlan,
  AccountSignInResult,
  AccountValue,
  SecurityEvent,
  SecurityState,
} from './account-context.ts';

/**
 * Who is signed in, and on what.
 *
 * Reads the account an application provided, and falls back to the fixture when
 * none has — which is every platform that has not been wired to the cloud yet,
 * and every build with no Supabase credentials. The screens do not branch on
 * it: they render an account, and whether it came from a server is not their
 * concern.
 */
export function useAccount(): AccountValue {
  const provided = useAccountContext();

  const fallback = useMemo<AccountValue>(
    () => ({
      status: 'unavailable',
      user: null,
      devices: [],
      sessions: [],
      // The plan remains a fixture until billing exists (Phase 7). It
      // describes the product, not a person, so it is safe to state before
      // anyone signs in.
      plan: MOCK_PLAN,
      security: null,
      events: [],
      signIn: null,
      signUp: null,
      signOut: null,
      resendConfirmation: null,
      revokeDevice: null,
      revokeSession: null,
      verifyEmail: null,
      requestPasswordReset: null,
      resetPassword: null,
      turnstileSiteKey: null,
      signUpUrl: null,
    }),
    [],
  );

  return provided ?? fallback;
}

/** The name to greet someone by: their first name, or the whole thing. */
export function firstNameOf(user: User): string {
  return user.displayName.trim().split(/\s+/)[0] ?? user.displayName;
}
