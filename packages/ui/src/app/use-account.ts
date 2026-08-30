import type { Device, Session, User } from '@noto/types';
import { useMemo } from 'react';

import {
  MOCK_DEVICES,
  MOCK_PLAN,
  MOCK_SECURITY,
  MOCK_SESSIONS,
  MOCK_USER,
  type AccountPlan,
  type SecurityState,
} from '../mock/account';

export interface AccountValue {
  user: User;
  devices: Device[];
  sessions: Session[];
  plan: AccountPlan;
  security: SecurityState;
}

/**
 * Who is signed in, and on what.
 *
 * The seam between the screens and an identity service. Noto has none yet — it
 * is local-first and works signed out — so this returns the fixture, and every
 * screen that greets the user or lists their devices reads it from here rather
 * than importing the fixture directly. When accounts arrive, this hook changes
 * and nothing else does.
 */
export function useAccount(): AccountValue {
  return useMemo(
    () => ({
      user: MOCK_USER,
      devices: MOCK_DEVICES,
      sessions: MOCK_SESSIONS,
      plan: MOCK_PLAN,
      security: MOCK_SECURITY,
    }),
    [],
  );
}

/** The name to greet someone by: their first name, or the whole thing. */
export function firstNameOf(user: User): string {
  return user.displayName.trim().split(/\s+/)[0] ?? user.displayName;
}
