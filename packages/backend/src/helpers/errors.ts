import { err } from '@noto/core';
import type { NotoError, Result } from '@noto/types';
import type { ApiErrorCode, ApiErrorDto } from '@noto/types/api';

/**
 * Turning somebody else's failure into ours.
 *
 * Provider errors arrive as strings with wording that changes between releases
 * and occasionally leaks more than it should. Everything is funnelled through
 * here so that call sites branch on a code we control, and so that the one
 * message a user ever sees is one we wrote.
 */

/**
 * GoTrue's own error codes.
 *
 * Mapped to our wording rather than passed through: the provider's phrasing
 * changes between releases, and "Email address \"x@y.z\" is invalid" quotes
 * the caller's input back at them, which is how a message ends up in a log it
 * should not be in.
 */
const AUTH_ERROR_MESSAGES: Record<string, { code: 'invalid_input' | 'conflict'; message: string }> =
  {
    email_address_invalid: {
      code: 'invalid_input',
      message: 'That email address was not accepted. Use a real address you can receive mail at.',
    },
    email_exists: { code: 'conflict', message: 'An account already exists for that address.' },
    user_already_exists: {
      code: 'conflict',
      message: 'An account already exists for that address.',
    },
    weak_password: { code: 'invalid_input', message: 'That password is not strong enough.' },
    signup_disabled: { code: 'invalid_input', message: 'New accounts are not being accepted.' },
    validation_failed: { code: 'invalid_input', message: 'Some of what was sent is not valid.' },
  };

/** Postgres error codes we act on rather than merely report. */
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_INSUFFICIENT_PRIVILEGE = '42501';
const PG_RLS_VIOLATION = '42501';

interface ProviderError {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

/**
 * Maps a Supabase or Postgres error onto a `NotoError`.
 *
 * The default is `unknown` rather than something more specific: a failure we
 * have not seen before should look unfamiliar in the logs, not be quietly
 * filed under the nearest plausible code.
 */
export function fromProviderError<T = never>(
  error: unknown,
  context: string,
): Result<T, NotoError> {
  const provider = (error ?? {}) as ProviderError;
  const status = provider.status ?? 0;
  const code = provider.code ?? '';

  const known = AUTH_ERROR_MESSAGES[code];
  if (known) return err(known.code, known.message, error);

  if (code === PG_UNIQUE_VIOLATION) {
    return err('conflict', `${context}: that already exists.`, error);
  }

  if (code === PG_FOREIGN_KEY_VIOLATION) {
    return err('invalid_input', `${context}: referred to something that does not exist.`, error);
  }

  if (code === PG_INSUFFICIENT_PRIVILEGE || code === PG_RLS_VIOLATION || status === 403) {
    return err('permission_denied', `${context}: not allowed.`, error);
  }

  if (status === 401) {
    return err('permission_denied', `${context}: not signed in.`, error);
  }

  if (status === 404) {
    return err('not_found', `${context}: not found.`, error);
  }

  if (status === 429) {
    return err('unknown', `${context}: too many requests.`, error);
  }

  /*
   * A 400 the provider did not name is still the caller's fault, not a fault
   * in Noto. Reporting it as `unknown` sent it to a 500 and told the person
   * "unexpected failure", which is both wrong and unactionable.
   */
  if (status === 400 || status === 422) {
    return err('invalid_input', `${context}: that request was not accepted.`, error);
  }

  // A network failure is the normal state of a local-first application, not an
  // exception. It is reported as `storage_unavailable` so the sync layer can
  // treat it as "try later" rather than "this change is bad".
  if (isNetworkFailure(error)) {
    return err('storage_unavailable', `${context}: no connection.`, error);
  }

  return err('unknown', `${context}: unexpected failure.`, error);
}

function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return (
    error.name === 'TypeError' ||
    error.name === 'AbortError' ||
    /fetch|network|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(error.message)
  );
}

/**
 * The wire form of a failure.
 *
 * `cause` is deliberately dropped: it holds the provider's original error,
 * which is exactly the sort of thing that ends up quoting a connection string
 * in a response body.
 */
export function toApiError(
  error: NotoError,
  requestId: string,
  extra?: { retryAfterSeconds?: number; fields?: Record<string, string> },
): ApiErrorDto {
  return {
    code: error.code as ApiErrorCode,
    message: error.message,
    requestId,
    ...(extra?.retryAfterSeconds === undefined
      ? {}
      : { retryAfterSeconds: extra.retryAfterSeconds }),
    ...(extra?.fields === undefined ? {} : { fields: extra.fields }),
  };
}

/** The HTTP status an error code should be answered with. */
export function statusForCode(code: ApiErrorCode): number {
  switch (code) {
    case 'invalid_input':
      return 400;
    case 'unauthenticated':
      return 401;
    case 'permission_denied':
      return 403;
    case 'not_found':
      return 404;
    case 'conflict':
      return 409;
    case 'over_quota':
      return 409;
    case 'rate_limited':
      return 429;
    case 'storage_unavailable':
      return 503;
    case 'sync_failed':
    case 'unknown':
      return 500;
    default:
      return 500;
  }
}
