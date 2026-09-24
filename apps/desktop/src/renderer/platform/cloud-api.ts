import { createApiClient, type SessionStore, type StoredSession } from '@noto/sync/api';
import * as account from '@noto/sync/api/account';
import type { SecurityState } from '@noto/ui';

import { API_SESSION_KEY, cloudConfig } from './cloud-config';
import { device, deviceId } from './device';

/**
 * The cloud, for the desktop application, on `apps/api`.
 *
 * The operations are `@noto/sync/api/account`, the same ones the web calls.
 * What differs is where the session lives: the tokens go to the main process,
 * which keeps them encrypted by the operating system's keychain, and
 * `localStorage` holds only a marker so that "is there a session to restore"
 * stays a synchronous question.
 *
 * No lock and no watch: the desktop has one application window, so there is
 * no second copy to race a refresh against or to hear a sign-out from.
 *
 * Sign-up is absent, deliberately — see `signUpUrl` in `cloud-config`.
 */

function mark(present: boolean): void {
  try {
    if (present) localStorage.setItem(API_SESSION_KEY, 'keychain');
    else localStorage.removeItem(API_SESSION_KEY);
  } catch {
    // Without the marker the next start opens signed out, which is safe.
  }
}

const keychainStore: SessionStore = {
  async load() {
    const raw = await window.notoSession.load();
    if (!raw) return null;

    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      return null;
    }
  },

  async save(session) {
    // Marked only when it was kept: a marker for a session that is not on
    // disk would open the next start in `restoring` for nothing.
    mark(await window.notoSession.save(JSON.stringify(session)));
  },

  async clear() {
    mark(false);
    await window.notoSession.clear();
  },
};

export const api = createApiClient({ baseUrl: cloudConfig.apiUrl ?? '', store: keychainStore });

/* The profile and the security facts arrive in one response; see the web's copy. */
let lastSecurity: SecurityState | null = null;

export const signIn = (email: string, password: string) =>
  account.signIn(api, email, password, device());

export const resendConfirmation = (email: string) => account.resendConfirmation(api, email);

export const signOut = () => account.signOut(api);

export async function fetchUser() {
  const profile = await account.fetchProfile(api);
  lastSecurity = profile
    ? {
        passwordChangedAt: profile.security.passwordChangedAt,
        twoFactorEnabled: profile.security.twoFactorEnabled,
        recoveryEmail: null,
      }
    : null;

  return profile?.user ?? null;
}

export const fetchSecurity = () => Promise.resolve(lastSecurity);

export const fetchDevices = () => account.fetchDevices(api, deviceId());
export const fetchSessions = () => account.fetchSessions(api);
export const fetchEvents = () => account.fetchEvents(api);
export const revokeDevice = (id: string) => account.revokeDevice(api, id);
export const revokeSession = (id: string) => account.revokeSession(api, id);
export const verifyEmail = (token: string) => account.verifyEmail(api, token);
export const requestPasswordReset = (email: string) => account.requestPasswordReset(api, email);
export const resetPassword = (token: string, password: string) =>
  account.resetPassword(api, token, password);
