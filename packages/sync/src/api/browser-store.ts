import { API_SESSION_KEY } from '../session';
import type { SessionStore, StoredSession } from './client';

/**
 * The session, kept in a browser's `localStorage`.
 *
 * Every tab of the web application shares it, which is the reason for the two
 * optional halves of `SessionStore` being filled in here: `lock` so that only
 * one tab spends the refresh token at a time (a second spend of a rotated token
 * reads as theft to the server, and signs the person out everywhere), and
 * `watch` so that signing out in one tab ends the session in the others.
 *
 * `localStorage` is the same exposure the Supabase client had. An httpOnly
 * cookie would be narrower, and is the direction `AuthSessionDto` points; it
 * needs the API to set one, so it is a server decision rather than this file's.
 */

/** The slice of `window` this needs; `@noto/sync` does not compile against the DOM. */
interface StorageEventTarget {
  addEventListener(type: 'storage', listener: (event: { key: string | null }) => void): void;
  removeEventListener(type: 'storage', listener: (event: { key: string | null }) => void): void;
}

function isStoredSession(value: unknown): value is StoredSession {
  const record = value as Partial<StoredSession> | null;

  return (
    typeof record?.accessToken === 'string' &&
    typeof record.refreshToken === 'string' &&
    typeof record.expiresAt === 'string'
  );
}

function read(key: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);

    return isStoredSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function createBrowserSessionStore(key: string = API_SESSION_KEY): SessionStore {
  return {
    load: () => Promise.resolve(read(key)),

    save: (session) => {
      try {
        localStorage.setItem(key, JSON.stringify(session));
      } catch {
        // Private mode or a full quota: the session lives for this tab only.
      }

      return Promise.resolve();
    },

    clear: () => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Nothing readable is nothing stored.
      }

      return Promise.resolve();
    },

    lock: (task) => {
      const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
      if (!locks) return task();

      return locks.request(`${key}:refresh`, task);
    },

    watch: (listener) => {
      const target = (globalThis as { window?: StorageEventTarget }).window;
      if (!target) return () => {};

      const handler = (event: { key: string | null }): void => {
        // `key` is null when another tab called `localStorage.clear()`.
        if (event.key === key || event.key === null) listener(read(key) !== null);
      };

      target.addEventListener('storage', handler);

      return () => target.removeEventListener('storage', handler);
    },
  };
}
