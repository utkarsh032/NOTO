import { createApiClient, createBrowserSessionStore } from '@noto/sync/api';
import * as account from '@noto/sync/api/account';
import type { SecurityState } from '@noto/ui';

import { cloudConfig } from './cloud-config.ts';
import { device, deviceId } from './device.ts';

/**
 * The cloud, for the web application, on `apps/api`.
 *
 * The operations are `@noto/sync/api/account`, the same ones the desktop calls.
 * What is here is what only a browser knows: that the session lives in
 * `localStorage`, shared with every other tab — which is why the store has a
 * lock, so that only one tab spends the refresh token at a time.
 *
 * Every import of this module is dynamic, like `./cloud.ts` before it.
 */

export const api = createApiClient({
  baseUrl: cloudConfig.apiUrl ?? '',
  store: createBrowserSessionStore(),
});

/*
 * The profile and the security facts arrive in one response. `fetchSecurity`
 * is asked straight after `fetchUser`, so it answers from that response
 * rather than repeating the request.
 */
let lastSecurity: SecurityState | null = null;

export const signIn = (email: string, password: string) =>
  account.signIn(api, email, password, device());

export const signUp = (input: account.SignUpInput) => account.signUp(api, input);

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
