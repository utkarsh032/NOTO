import { isValidationFailure, statusForCode, toApiError } from '@noto/backend';
import type { CallerIdentity } from '@noto/backend';
import type { NotoError, Result } from '@noto/types';
import type { ApiErrorCode } from '@noto/types/api';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * The HTTP layer's shared vocabulary: the per-request variables, and the one
 * function every controller ends with.
 *
 * The port of `supabase/functions/_shared/http.ts`. It is the only place that
 * turns a `Result` into a `Response`, so the error shape is identical on every
 * route and a client needs one branch rather than fifty.
 */

export interface AppEnv {
  Variables: {
    requestId: string;
    /** The caller's address, from the header `NOTO_CLIENT_IP_HEADER` names. */
    ip: string | undefined;
    /** Set by `requireAuth`; present on every route mounted behind it. */
    caller: CallerIdentity;
  };
}

export type AppContext = Context<AppEnv>;

/** Answers with an `ApiErrorDto`. The cause is logged, never returned. */
export function fail(
  c: AppContext,
  error: NotoError | { code: ApiErrorCode; message: string; cause?: unknown },
  options: { status?: number; retryAfterSeconds?: number } = {},
): Response {
  const requestId = c.get('requestId');
  const code = error.code as ApiErrorCode;
  const body = toApiError(error as NotoError, requestId, {
    ...(options.retryAfterSeconds === undefined
      ? {}
      : { retryAfterSeconds: options.retryAfterSeconds }),
    ...(isValidationFailure(error as NotoError)
      ? { fields: (error as NotoError & { fields: Record<string, string> }).fields }
      : {}),
  });

  const status = options.status ?? statusForCode(code);

  // Server faults are worth a line with their cause; a wrong password is not.
  if (status >= 500) {
    console.error(
      JSON.stringify({ requestId, code, message: error.message, cause: describe(error.cause) }),
    );
  }

  if (options.retryAfterSeconds !== undefined) {
    c.header('Retry-After', String(options.retryAfterSeconds));
  }

  return c.json(body, status as ContentfulStatusCode);
}

/**
 * Turns a service's `Result` into a response.
 *
 * `unauthorized` names the failure codes that mean "your credentials are no
 * good" on this route — a refresh token that has ended is a 401, not the 403 a
 * wrong password on sign-in is.
 */
export function respond<T>(
  c: AppContext,
  result: Result<T, NotoError>,
  options: { unauthorized?: NotoError['code'][] } = {},
): Response {
  if (result.ok) return c.json((result.value ?? { ok: true }) as object, 200);

  if (options.unauthorized?.includes(result.error.code)) {
    return fail(c, { code: 'unauthenticated', message: result.error.message }, { status: 401 });
  }

  return fail(c, result.error);
}

/** The body as JSON, or `null` — a malformed body is a validation failure, not a crash. */
export async function readJson(c: AppContext): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

/** The bearer token, if there is one. Extracting is all this does. */
export function bearerToken(c: AppContext): string | null {
  const header = c.req.header('authorization');
  if (!header?.startsWith('Bearer ')) return null;

  return header.slice('Bearer '.length).trim() || null;
}

/** An `Error` reduced to what a log line can carry without a stack of objects. */
function describe(cause: unknown): unknown {
  if (cause instanceof Error) {
    return { name: cause.name, message: cause.message, code: (cause as { code?: string }).code };
  }

  return cause;
}
