import { describe, expect, it, vi } from 'vitest';

import { createApiClient, type SessionStore, type StoredSession } from './client';

const NOW = Date.parse('2026-09-23T12:00:00Z');
const LATER = new Date(NOW + 10 * 60_000).toISOString();
const PAST = new Date(NOW - 60_000).toISOString();

function memoryStore(initial: StoredSession | null = null) {
  let value = initial;
  const store: SessionStore & {
    value: () => StoredSession | null;
    set: (v: StoredSession) => void;
  } = {
    load: vi.fn(() => Promise.resolve(value)),
    save: vi.fn((next: StoredSession) => {
      value = next;
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      value = null;
      return Promise.resolve();
    }),
    value: () => value,
    set: (next) => {
      value = next;
    },
  };

  return store;
}

function json(status: number, body: unknown): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function fakeFetch(handler: Handler) {
  return vi.fn((input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init ?? {})),
  );
}

const bearer = (init: RequestInit): string | undefined =>
  (init.headers as Record<string, string>).Authorization;

const session = (access: string, refresh: string, expiresAt = LATER): StoredSession => ({
  accessToken: access,
  refreshToken: refresh,
  expiresAt,
});

function client(store: SessionStore, fetch: ReturnType<typeof fakeFetch>) {
  return createApiClient({ baseUrl: 'https://api.test/', store, fetch, now: () => NOW });
}

describe('createApiClient', () => {
  it('sends the access token to the versioned base URL', async () => {
    const fetch = fakeFetch(() => json(200, { hello: 'world' }));
    const api = client(memoryStore(session('a1', 'r1')), fetch);

    const response = await api.request('GET', '/auth/session');

    expect(response).toEqual({ ok: true, status: 200, data: { hello: 'world' } });
    expect(fetch.mock.calls[0]?.[0]).toBe('https://api.test/v1/auth/session');
    expect(bearer(fetch.mock.calls[0]![1]!)).toBe('Bearer a1');
  });

  it('answers 401 without a request when there is no session', async () => {
    const fetch = fakeFetch(() => json(200, {}));
    const api = client(memoryStore(), fetch);

    const response = await api.request('GET', '/account/devices');

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends public routes without a token', async () => {
    const fetch = fakeFetch(() => json(200, {}));
    const api = client(memoryStore(session('a1', 'r1')), fetch);

    await api.request('POST', '/auth/signin', { auth: false, body: { email: 'x' } });

    expect(bearer(fetch.mock.calls[0]![1]!)).toBeUndefined();
  });

  it('reports status 0 when nothing arrives', async () => {
    const fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    const api = createApiClient({
      baseUrl: 'https://api.test',
      store: memoryStore(session('a1', 'r1')),
      fetch,
      now: () => NOW,
    });

    expect(await api.request('GET', '/auth/session')).toEqual({
      ok: false,
      status: 0,
      error: null,
    });
  });

  it('refreshes on 401, retries once, and stores the rotated tokens', async () => {
    const store = memoryStore(session('a1', 'r1'));
    const fetch = fakeFetch((url, init) => {
      if (url.endsWith('/auth/refresh')) {
        expect(JSON.parse(String(init.body))).toEqual({ refreshToken: 'r1' });
        return json(200, { accessToken: 'a2', refreshToken: 'r2', expiresAt: LATER });
      }
      return bearer(init) === 'Bearer a2' ? json(200, { ok: 1 }) : json(401, null);
    });

    const response = await client(store, fetch).request('GET', '/auth/session');

    expect(response.ok).toBe(true);
    expect(store.value()).toEqual(session('a2', 'r2'));
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('refreshes an expired token before sending it', async () => {
    const store = memoryStore(session('a1', 'r1', PAST));
    const fetch = fakeFetch((url, init) => {
      if (url.endsWith('/auth/refresh')) {
        return json(200, { accessToken: 'a2', refreshToken: 'r2', expiresAt: LATER });
      }
      return json(200, { token: bearer(init) });
    });

    const response = await client(store, fetch).request<{ token: string }>('GET', '/x');

    expect(response.ok && response.data.token).toBe('Bearer a2');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('spends a refresh token once, however many requests were refused', async () => {
    const store = memoryStore(session('a1', 'r1'));
    let refreshes = 0;
    const fetch = fakeFetch(async (url, init) => {
      if (url.endsWith('/auth/refresh')) {
        refreshes += 1;
        await Promise.resolve();
        return json(200, { accessToken: 'a2', refreshToken: 'r2', expiresAt: LATER });
      }
      return bearer(init) === 'Bearer a2' ? json(200, {}) : json(401, null);
    });
    const api = client(store, fetch);

    const results = await Promise.all([
      api.request('GET', '/a'),
      api.request('GET', '/b'),
      api.request('GET', '/c'),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
    expect(refreshes).toBe(1);
  });

  it('adopts a token another copy already rotated instead of spending the old one', async () => {
    const store = memoryStore(session('a1', 'r1'));
    const fetch = fakeFetch((url, init) => {
      if (url.endsWith('/auth/refresh')) throw new Error('must not refresh');
      if (bearer(init) === 'Bearer a1') {
        // Another tab rotated while this request was out.
        store.set(session('a9', 'r9'));
        return json(401, null);
      }
      return json(200, {});
    });

    const response = await client(store, fetch).request('GET', '/x');

    expect(response.ok).toBe(true);
    expect(bearer(fetch.mock.calls[1]![1]!)).toBe('Bearer a9');
  });

  it('runs the refresh under the store lock when there is one', async () => {
    const store = memoryStore(session('a1', 'r1', PAST));
    const lock = vi.fn((task: () => Promise<unknown>) => task()) as unknown as NonNullable<
      SessionStore['lock']
    > &
      ReturnType<typeof vi.fn>;
    const fetch = fakeFetch((url) =>
      url.endsWith('/auth/refresh')
        ? json(200, { accessToken: 'a2', refreshToken: 'r2', expiresAt: LATER })
        : json(200, {}),
    );

    await client({ ...store, lock }, fetch).request('GET', '/x');

    expect(lock).toHaveBeenCalledTimes(1);
  });

  it('ends the session when the refresh token is refused', async () => {
    const store = memoryStore(session('a1', 'r1'));
    const fetch = fakeFetch(() => json(401, { code: 'unauthenticated', message: 'no' }));
    const api = client(store, fetch);
    const events: string[] = [];
    api.onSessionChange((event) => events.push(event));

    const response = await api.request('GET', '/x');

    expect(response.status).toBe(401);
    expect(store.value()).toBeNull();
    expect(await api.hasSession()).toBe(false);
    expect(events).toEqual(['ended']);
  });

  it('keeps the session when the refresh could not be sent', async () => {
    const store = memoryStore(session('a1', 'r1'));
    const fetch = vi.fn((input: string | URL | Request) =>
      String(input).endsWith('/auth/refresh')
        ? Promise.reject(new TypeError('offline'))
        : Promise.resolve(json(401, null)),
    );
    const api = createApiClient({ baseUrl: 'https://api.test', store, fetch, now: () => NOW });

    const response = await api.request('GET', '/x');

    expect(response.status).toBe(401);
    expect(store.value()).toEqual(session('a1', 'r1'));
    expect(await api.hasSession()).toBe(true);
  });

  it('reads the expiry from the token when the refresh response has none', async () => {
    const exp = Math.floor((NOW + 15 * 60_000) / 1000);
    const payload = btoa(JSON.stringify({ exp })).replace(/=+$/, '');
    const token = `h.${payload}.s`;
    const store = memoryStore(session('a1', 'r1', PAST));
    const fetch = fakeFetch((url) =>
      url.endsWith('/auth/refresh')
        ? json(200, { accessToken: token, refreshToken: 'r2' })
        : json(200, {}),
    );

    await client(store, fetch).request('GET', '/x');

    expect(store.value()?.expiresAt).toBe(new Date(exp * 1000).toISOString());
  });

  it('follows a sign-out made by another copy', async () => {
    let listener: ((present: boolean) => void) | undefined;
    const store = memoryStore(session('a1', 'r1'));
    const api = client(
      {
        ...store,
        watch: (next) => {
          listener = next;
          return () => {};
        },
      },
      fakeFetch(() => json(200, {})),
    );
    const events: string[] = [];
    api.onSessionChange((event) => events.push(event));

    expect(await api.hasSession()).toBe(true);
    listener?.(false);

    expect(events).toEqual(['ended']);
    expect(await api.hasSession()).toBe(false);
  });

  it('reports a started session', async () => {
    const store = memoryStore();
    const api = client(
      store,
      fakeFetch(() => json(200, {})),
    );
    const events: string[] = [];
    api.onSessionChange((event) => events.push(event));

    await api.startSession(session('a1', 'r1'));

    expect(events).toEqual(['started']);
    expect(store.value()).toEqual(session('a1', 'r1'));
  });
});
