import type { IsoDateTime, NotoErrorCode } from '../common.ts';

/**
 * Shapes that cross the wire.
 *
 * Everything under `api/` is a `type` or an `interface` and nothing else. There
 * is no runtime code here, and there must not be: `@noto/types` is imported by
 * every application, and a signed-out user must not download a byte of the
 * cloud (see the performance budget in `R&D/Backend_Plan.md` §3.3). The Zod
 * schemas that validate these shapes live in `@noto/backend`, which only cloud
 * code paths import.
 *
 * Convention: `camelCase`, timestamps as ISO-8601 strings, and never a password
 * hash, a token, a Stripe identifier or another user's email.
 */

/** Error codes the API can return, on top of the local `NotoErrorCode` set. */
export type ApiErrorCode = NotoErrorCode | 'rate_limited' | 'over_quota' | 'unauthenticated';

/**
 * The single failure shape.
 *
 * `code` deliberately extends `NotoErrorCode` so a server failure lands in the
 * same `Result<T, NotoError>` the rest of Noto already handles, instead of
 * introducing a second error vocabulary that every call site has to translate.
 */
export interface ApiErrorDto {
  code: ApiErrorCode;
  /** Safe to show a user. Never contains a value the caller sent. */
  message: string;
  /** Correlates a user's report with the server log. */
  requestId: string;
  /** Present on `rate_limited`; how long until the next attempt is accepted. */
  retryAfterSeconds?: number;
  /** Field-level validation failures, keyed by DTO field name. */
  fields?: Record<string, string>;
}

/** A page of results, for the few endpoints that return more than one thing. */
export interface PageDto<T> {
  items: T[];
  /** Opaque; pass it back to continue. `null` means this was the last page. */
  nextCursor: string | null;
}

/** What a user has consumed this billing period. */
export interface UsageDto {
  storageBytes: number;
  documentCount: number;
  aiRequests: number;
  periodStart: IsoDateTime;
  periodEnd: IsoDateTime;
}
