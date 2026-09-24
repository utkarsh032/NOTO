import type { ApiErrorDto } from '@noto/types/api';

/**
 * The client for `apps/api`.
 *
 * What replaces `@supabase/supabase-js`: a `fetch` wrapper that attaches the
 * access token and, when the server answers 401, refreshes once and retries.
 * Everything a platform knows better — where a session is kept, and how two
 * copies of the application avoid refreshing at the same moment — arrives as a
 * `SessionStore`.
 *
 * The refresh is the part worth reading carefully. `apps/api` rotates refresh
 * tokens and treats a token presented twice as stolen (Backend_Node_Plan §9.3):
 * every session for the account is revoked. So two tabs that each noticed an
 * expired access token and each refreshed with the same refresh token would
 * sign the person out everywhere. Refreshing is therefore done once per client
 * (`inflight`), under the store's lock when it has one, and only after
 * re-reading the store — if another tab rotated the token in the meantime, its
 * result is adopted instead of spending the old one.
 */

/** The tokens a sign-in or a refresh produces. */
export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  /** When the access token stops working. ISO-8601. */
  expiresAt: string;
}

/** Where a platform keeps the session between runs. */
export interface SessionStore {
  load(): Promise<StoredSession | null>;
  save(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
  /**
   * Runs `task` while no other copy of the application is refreshing.
   *
   * Absent where there is only ever one copy (the desktop's single window),
   * in which case the client's own in-flight guard is enough.
   */
  lock?<T>(task: () => Promise<T>): Promise<T>;
  /**
   * Follows changes made by another copy of the application — a sign-out in
   * another tab. `present` is whether a session is stored afterwards.
   */
  watch?(listener: (present: boolean) => void): () => void;
}

export type ApiResponse<T> =
  | { ok: true; status: number; data: T }
  /**
   * `status` 0 means nothing arrived: offline, unreachable, timed out, or
   * refused before sending (a CORS failure looks the same from here).
   */
  | { ok: false; status: number; error: ApiErrorDto | null };

export interface RequestOptions {
  body?: unknown;
  /** Default true. False for the public routes: sign-in, sign-up, reset. */
  auth?: boolean;
}

export type SessionEvent = 'started' | 'ended';

export interface ApiClient {
  request<T>(method: string, path: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  /** Adopts the tokens a sign-in returned. */
  startSession(session: StoredSession): Promise<void>;
  /** Forgets the session on this device. No request is made. */
  endSession(): Promise<void>;
  hasSession(): Promise<boolean>;
  onSessionChange(listener: (event: SessionEvent) => void): () => void;
}

export interface ApiClientOptions {
  /** The API's origin, e.g. `https://api.noto.app`. `/v1` is added here. */
  baseUrl: string;
  store: SessionStore;
  fetch?: typeof fetch;
  /** Milliseconds before a request is abandoned. Default 15 s. */
  timeoutMs?: number;
  now?: () => number;
}

/** An access token is refreshed this long before it expires, to absorb clock skew. */
const EXPIRY_MARGIN_MS = 30_000;

/** Used when a refresh response carries no expiry and the token cannot be read. */
const FALLBACK_LIFETIME_MS = 14 * 60_000;

type RefreshOutcome = 'refreshed' | 'rejected' | 'unreachable';

/** The `exp` claim of a JWT, in milliseconds. `null` when it cannot be read. */
function tokenExpiry(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;

    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function isApiError(value: unknown): value is ApiErrorDto {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown }).code === 'string' &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const base = `${options.baseUrl.replace(/\/+$/, '')}/v1`;
  const send = options.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? 15_000;
  const now = options.now ?? Date.now;
  const { store } = options;

  const listeners = new Set<(event: SessionEvent) => void>();

  /** `undefined` until the store has been read once. */
  let session: StoredSession | null | undefined;
  let inflight: Promise<RefreshOutcome> | null = null;

  const emit = (event: SessionEvent): void => {
    for (const listener of listeners) listener(event);
  };

  async function current(): Promise<StoredSession | null> {
    if (session === undefined) session = await store.load().catch(() => null);

    return session;
  }

  /*
   * Another tab signed out, or signed in. The copy in memory follows, so this
   * tab stops sending a token the server has already revoked.
   */
  store.watch?.((present) => {
    if (present) {
      session = undefined;

      return;
    }

    if (session) {
      session = null;
      emit('ended');
    }
  });

  async function raw(
    method: string,
    path: string,
    body: unknown,
    accessToken: string | null,
  ): Promise<ApiResponse<unknown>> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let response: Response;
    try {
      response = await send(`${base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : null,
      });
    } catch {
      return { ok: false, status: 0, error: null };
    }

    const parsed: unknown =
      response.status === 204 ? null : await response.json().catch(() => null);

    if (response.ok) return { ok: true, status: response.status, data: parsed };

    return { ok: false, status: response.status, error: isApiError(parsed) ? parsed : null };
  }

  async function adopt(next: StoredSession): Promise<void> {
    session = next;
    await store.save(next).catch(() => {
      // Kept in memory for this run. Losing it on restart costs a sign-in, not data.
    });
  }

  async function forget(): Promise<void> {
    const had = Boolean(session);
    session = null;
    await store.clear().catch(() => {});
    if (had) emit('ended');
  }

  async function performRefresh(): Promise<RefreshOutcome> {
    const known = await current();
    if (!known) return 'rejected';

    /* Another copy may have rotated the token while this one waited. Its result
       is the live one; spending the old token now would be reuse. */
    const stored = await store.load().catch(() => null);
    if (stored && stored.refreshToken !== known.refreshToken) {
      session = stored;

      return 'refreshed';
    }

    const response = await raw('POST', '/auth/refresh', { refreshToken: known.refreshToken }, null);

    if (response.ok) {
      const data = response.data as Partial<StoredSession> | null;
      if (!data?.accessToken || !data.refreshToken) return 'unreachable';

      const expiresAt =
        data.expiresAt ??
        new Date(tokenExpiry(data.accessToken) ?? now() + FALLBACK_LIFETIME_MS).toISOString();

      await adopt({ accessToken: data.accessToken, refreshToken: data.refreshToken, expiresAt });

      return 'refreshed';
    }

    /*
     * Only a definite "no" ends the session. A server error or no answer at all
     * leaves it in place: being offline is not being signed out, and the next
     * request tries again.
     */
    if (response.status === 401 || response.status === 403) {
      await forget();

      return 'rejected';
    }

    return 'unreachable';
  }

  function refresh(): Promise<RefreshOutcome> {
    inflight ??= (store.lock ? store.lock(performRefresh) : performRefresh()).finally(() => {
      inflight = null;
    });

    return inflight;
  }

  function expired(value: StoredSession): boolean {
    const at = Date.parse(value.expiresAt);

    return Number.isFinite(at) && at - EXPIRY_MARGIN_MS <= now();
  }

  const unauthenticated: ApiResponse<never> = {
    ok: false,
    status: 401,
    error: null,
  };

  return {
    async request<T>(method: string, path: string, requestOptions: RequestOptions = {}) {
      const { body, auth = true } = requestOptions;

      if (!auth) return (await raw(method, path, body, null)) as ApiResponse<T>;

      let active = await current();
      if (!active) return unauthenticated;

      if (expired(active)) {
        const outcome = await refresh();
        if (outcome === 'rejected') return unauthenticated;

        active = (await current()) ?? active;
      }

      const first = await raw(method, path, body, active.accessToken);
      if (first.ok || first.status !== 401) return first as ApiResponse<T>;

      const outcome = await refresh();
      if (outcome !== 'refreshed') return first as ApiResponse<T>;

      const renewed = await current();
      if (!renewed) return unauthenticated;

      return (await raw(method, path, body, renewed.accessToken)) as ApiResponse<T>;
    },

    async startSession(next) {
      await adopt(next);
      emit('started');
    },

    endSession: forget,

    async hasSession() {
      return (await current()) !== null;
    },

    onSessionChange(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
  };
}
