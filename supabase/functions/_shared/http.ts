/**
 * The HTTP layer every Edge Function shares.
 *
 * This is the only place in the backend that knows what a `Request` is. A
 * controller's job is to turn HTTP into a call and a `Result` back into HTTP,
 * and nothing else — the moment a rule appears in a function handler it has
 * escaped the service layer, where it could have been tested without a server.
 */

import { isValidationFailure } from '@noto/backend';
import type { NotoError, Result } from '@noto/types';
import type { ApiErrorDto } from '@noto/types/api';

/**
 * Origins allowed to call a function from a browser.
 *
 * An allow-list rather than `*`, because these endpoints act on a signed-in
 * user's account. `noto://` is the desktop and mobile deep link; it is not a
 * browser origin and never appears here.
 */
const ALLOWED_ORIGINS = ['https://noto.app', 'https://www.noto.app'];

/**
 * Any port on the developer's own machine.
 *
 * Vite is configured with `strictPort: false`, so a second `pnpm dev:web` moves
 * to 5174 without saying so, and a fixed list of ports turns that into a CORS
 * failure the browser reports as "could not reach the server". `localhost` and
 * `127.0.0.1` are the same machine as the person running Noto; an attacker who
 * can serve a page from there has already won by an easier route.
 */
const LOCAL_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;

function isAllowed(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin) || LOCAL_ORIGIN.test(origin);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && isAllowed(origin) ? origin : ALLOWED_ORIGINS[0]!;

  return {
    'Access-Control-Allow-Origin': allowed,
    // `apikey` is not optional: every Supabase endpoint expects it, so the
    // browser sends it on these calls and a preflight that does not name it
    // fails before the request is made.
    'Access-Control-Allow-Headers':
      'apikey, authorization, content-type, x-client-info, x-noto-device-id',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    Vary: 'Origin',
  };
}

/** Correlates a user's report with a log line. Never derived from the request. */
export function requestId(): string {
  return crypto.randomUUID();
}

export function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(origin),
    },
  });
}

/** The HTTP status for a `NotoError` code. */
export function statusFor(error: NotoError): number {
  switch (error.code) {
    case 'invalid_input':
      return 400;
    case 'permission_denied':
      return 403;
    case 'not_found':
      return 404;
    case 'conflict':
      return 409;
    case 'storage_unavailable':
      return 503;
    default:
      return 500;
  }
}

/**
 * Turns a `Result` into a response.
 *
 * Every function ends here, so the error shape is identical across all nine of
 * them and a client needs one branch rather than nine.
 */
export function respond<T>(result: Result<T, NotoError>, origin: string | null): Response {
  const id = requestId();

  if (result.ok) return json(result.value, 200, origin);

  const body: ApiErrorDto = {
    code: result.error.code,
    message: result.error.message,
    requestId: id,
    // Per-field detail is the difference between "something was wrong" and a
    // message under the input that was wrong. It is generated from the schema,
    // never from the value the caller sent, so it leaks nothing back.
    ...(isValidationFailure(result.error) ? { fields: result.error.fields } : {}),
  };

  // The cause holds the provider's original error, which is exactly the sort of
  // thing that ends up quoting a connection string to a stranger. Logged, never
  // returned.
  console.error(
    JSON.stringify({ requestId: id, code: result.error.code, cause: result.error.cause }),
  );

  return json(body, statusFor(result.error), origin);
}

/** Reads a JSON body without throwing on malformed input. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * The bearer token, if there is one.
 *
 * Extracting is all this does. Verifying is the client's job — a Supabase
 * client built with the caller's token has exactly the caller's permissions,
 * which is a stronger guarantee than a function checking a claim by hand.
 */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;

  return header.slice('Bearer '.length).trim() || null;
}

/** The caller's device id, when the client sent one. */
export function deviceId(request: Request): string | null {
  return request.headers.get('x-noto-device-id');
}

/**
 * The caller's address, as the edge saw it.
 *
 * `x-forwarded-for` is a list; the first entry is the client and the rest are
 * proxies. Taken from the header the platform sets, never from the body — a
 * rate limit a client can rename itself out of is not a rate limit.
 */
export function clientIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();

  return first && first.length > 0 ? first : undefined;
}
