import { requestFromNative } from './bridge';

/*
 * The shapes `createApiClient` in `@noto/sync/api` takes. Declared here until
 * that module lands with the Phase 3 cutover; then these two go, and the store
 * below is typed with the imported ones. They are structurally identical, so
 * nothing else changes.
 */

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  /** ISO-8601; when the access token expires. */
  expiresAt: string;
}

export interface SessionStore {
  load(): Promise<StoredSession | null>;
  save(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

/** The value the native side answered with, if it is a session. */
export function parseStoredSession(value: unknown): StoredSession | null {
  if (typeof value !== 'object' || value === null) return null;
  const { accessToken, refreshToken, expiresAt } = value as Record<string, unknown>;

  if (typeof accessToken !== 'string' || accessToken === '') return null;
  if (typeof refreshToken !== 'string' || refreshToken === '') return null;
  if (typeof expiresAt !== 'string' || Number.isNaN(Date.parse(expiresAt))) return null;

  return { accessToken, refreshToken, expiresAt };
}

/**
 * The session store on a phone: the Keychain or Android Keystore, reached
 * across the bridge (`apps/mobile/src/platform/session-store.ts`).
 *
 * Tokens never touch localStorage here. `save` and `clear` resolve only once
 * the native side has written, and reject if it could not — the API client
 * then keeps the session in memory for this run, which is the right failure:
 * signed in now, asked again next launch.
 *
 * There is one WebView and so one copy of the client, which is why this has
 * no `lock` or `watch`: those exist for browser tabs sharing one store.
 */
export const secureSessionStore: SessionStore = {
  async load() {
    return parseStoredSession(await requestFromNative<unknown>('session.load'));
  },

  async save(session) {
    await requestFromNative<null>('session.save', session);
  },

  async clear() {
    await requestFromNative<null>('session.clear');
  },
};
