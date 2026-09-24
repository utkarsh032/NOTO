import type { SyncPullRequest, SyncPullResult, SyncPushRequest, SyncPushResult } from '@noto/types';

/** How the engine reaches the server. One implementation per wire; tests use a fake. */
export interface SyncTransport {
  push(request: SyncPushRequest): Promise<SyncPushResult>;
  pull(request: SyncPullRequest): Promise<SyncPullResult>;
}

/** A request that did not succeed. `status` 0 means nothing came back at all. */
export class SyncTransportError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = 'SyncTransportError';
  }

  /** Offline, unreachable or timed out: worth waiting for the network, not reporting. */
  get offline(): boolean {
    return this.status === 0;
  }
}

/**
 * The part of the API client sync uses.
 *
 * Structural, so `createApiClient()` from `@noto/sync`'s `api` module fits it
 * as it is: it attaches the access token and refreshes it, and this module
 * never sees either.
 */
export interface SyncApiClient {
  request<T>(
    method: string,
    path: string,
    options?: { body?: unknown },
  ): Promise<
    | { ok: true; status: number; data: T }
    | { ok: false; status: number; error: { code?: string; message?: string } | null }
  >;
}

/** `POST /v1/sync/push` and `POST /v1/sync/pull` through an API client. */
export function createHttpSyncTransport(client: SyncApiClient): SyncTransport {
  const post = async <T>(path: string, body: unknown): Promise<T> => {
    const response = await client.request<T>('POST', path, { body });
    if (response.ok) return response.data;

    throw new SyncTransportError(
      response.error?.message ??
        (response.status === 0 ? 'The server could not be reached.' : 'Sync failed.'),
      response.status,
      response.error?.code ?? null,
    );
  };

  return {
    push: (request) => post<SyncPushResult>('/v1/sync/push', request),
    pull: (request) => post<SyncPullResult>('/v1/sync/pull', request),
  };
}
