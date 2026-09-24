/**
 * `apps/api` access.
 *
 * Behind the `@noto/sync/api` subpath for the same reason the Supabase client
 * was: an application that has not enabled the cloud must not pull any of it
 * into the bundle a signed-out visitor downloads. Unlike the Supabase client
 * this one is small — it is `fetch` and a refresh — but the boundary is kept
 * so that the loading rules do not change with the backend.
 */

export {
  createApiClient,
  type ApiClient,
  type ApiClientOptions,
  type ApiResponse,
  type RequestOptions,
  type SessionEvent,
  type SessionStore,
  type StoredSession,
} from './client';
export { createBrowserSessionStore } from './browser-store';
