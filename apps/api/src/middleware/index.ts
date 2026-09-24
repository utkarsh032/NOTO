import type { IdentityService } from '@noto/backend';
import type { MiddlewareHandler } from 'hono';
import { cors as honoCors } from 'hono/cors';

import type { Env } from '../env.ts';
import { type AppContext, type AppEnv, bearerToken, fail } from '../http.ts';

/**
 * The middleware chain (plan §7). Order is the specification, and `app.ts` is
 * where it is applied:
 *
 *   requestId → cors → headers → bodyLimit → clientIp → rateLimit → requireAuth → controller
 */

/** A UUID per request, into every error body and log line. Never taken from the request. */
export function requestId(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const id = crypto.randomUUID();
    c.set('requestId', id);
    c.header('X-Request-Id', id);
    await next();
  };
}

/** The production allow-list, carried over verbatim from `_shared/http.ts`. */
export const DEFAULT_ORIGINS = [
  'https://noto.app',
  'https://www.noto.app',
  'https://noto-web.utkarshraj525.workers.dev',
];

const LOCAL_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;

/**
 * One CORS definition, applied before any route exists.
 *
 * The 1.4.1 CORS bug was possible because nine functions each imported the
 * list and each could diverge. Here there is no way to write a route this does
 * not cover. Desktop (`file://`, Electron) and mobile (WebView) send no origin
 * a browser would enforce, so the list is only ever about web pages.
 */
export function cors(
  env: Pick<Env, 'NOTO_ALLOWED_ORIGINS' | 'NOTO_ALLOW_LOCALHOST_ORIGINS'>,
): MiddlewareHandler<AppEnv> {
  const allowed = new Set([...DEFAULT_ORIGINS, ...env.NOTO_ALLOWED_ORIGINS]);

  return honoCors({
    origin: (origin) =>
      allowed.has(origin) || (env.NOTO_ALLOW_LOCALHOST_ORIGINS && LOCAL_ORIGIN.test(origin))
        ? origin
        : null,
    allowHeaders: ['authorization', 'content-type', 'x-noto-device-id'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
  });
}

/** Account data is never cached, and never sniffed into something it is not. */
export function responseHeaders(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
  };
}

/**
 * The caller's address, from the one header this deployment trusts.
 *
 * `cf-connecting-ip` is set by Cloudflare and overwrites whatever a client
 * sent; `x-forwarded-for` is a list whose first entry is the client. With
 * `none`, no header is believed — a rate limit a client can rename itself out
 * of is not a rate limit — and the socket's address is used instead.
 */
export function clientIp(
  header: Env['NOTO_CLIENT_IP_HEADER'],
  socketAddress: (c: AppContext) => string | undefined,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    let ip: string | undefined;

    if (header === 'none') {
      ip = socketAddress(c);
    } else {
      const value = c.req.header(header);
      ip = header === 'x-forwarded-for' ? value?.split(',')[0]?.trim() : value?.trim();
      ip ||= socketAddress(c);
    }

    c.set('ip', ip || undefined);
    await next();
  };
}

/**
 * A coarse per-address limit, in memory, before anything touches the database.
 *
 * Not the security control — the per-account and per-address counters in
 * `auth_attempts` are. This one is a pressure valve: it stops one machine
 * from making the database do a hundred thousand lookups a minute. In memory
 * is right while there is one instance; with two, each allows the limit.
 */
export function rateLimit(options: {
  limit: number;
  windowSeconds: number;
}): MiddlewareHandler<AppEnv> {
  const windows = new Map<string, { startedAt: number; count: number }>();
  let lastSweep = Date.now();

  return async (c, next) => {
    const now = Date.now();
    const windowMs = options.windowSeconds * 1000;

    if (now - lastSweep > windowMs) {
      for (const [key, window] of windows) {
        if (now - window.startedAt >= windowMs) windows.delete(key);
      }
      lastSweep = now;
    }

    const key = c.get('ip') ?? 'unknown';
    const window = windows.get(key);

    if (!window || now - window.startedAt >= windowMs) {
      windows.set(key, { startedAt: now, count: 1 });
    } else if (window.count >= options.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((window.startedAt + windowMs - now) / 1000));
      return fail(
        c,
        { code: 'rate_limited', message: 'Too many requests. Wait a moment and try again.' },
        { retryAfterSeconds },
      );
    } else {
      window.count += 1;
    }

    await next();
  };
}

/**
 * Bearer token → caller, or 401.
 *
 * The same answer for a missing, malformed, expired, forged or revoked token:
 * the difference helps only someone probing.
 */
export function requireAuth(
  identity: () => Pick<IdentityService, 'authenticate'>,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = bearerToken(c);
    const caller = token ? await identity().authenticate(token) : null;

    if (caller && !caller.ok) return fail(c, caller.error);
    if (!caller?.value) {
      c.header('WWW-Authenticate', 'Bearer');
      return fail(c, { code: 'unauthenticated', message: 'Sign in to continue.' }, { status: 401 });
    }

    c.set('caller', caller.value);
    await next();
  };
}
