import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { accountRoutes } from './controllers/account.ts';
import { authRoutes } from './controllers/auth.ts';
import { syncRoutes } from './controllers/sync.ts';
import { workspaceRoutes } from './controllers/workspaces.ts';
import type { Env } from './env.ts';
import { type AppContext, type AppEnv, fail } from './http.ts';
import { clientIp, cors, rateLimit, requestId, responseHeaders } from './middleware/index.ts';
import type { ApiDependencies } from './services.ts';

/** The largest sync push accepted. Devices aim for half of it (`@noto/sync`). */
export const SYNC_PUSH_MAX_BYTES = 8 * 1024 * 1024;

/**
 * The Hono app and its middleware chain (plan §7).
 *
 * Built from its dependencies rather than from the environment, so the route
 * tests run the whole chain in-process with `app.request()` — no socket, no
 * port — against a throwaway database.
 */
export function createApp(
  deps: ApiDependencies,
  options: {
    env: Pick<
      Env,
      'NOTO_ALLOWED_ORIGINS' | 'NOTO_ALLOW_LOCALHOST_ORIGINS' | 'NOTO_CLIENT_IP_HEADER'
    >;
    /** The socket's address, for `NOTO_CLIENT_IP_HEADER=none`. Absent in tests. */
    socketAddress?: (c: AppContext) => string | undefined;
    /** Requests per address per minute. */
    requestsPerMinute?: number;
  },
) {
  const app = new Hono<AppEnv>();

  app.use('*', requestId());
  app.use('*', cors(options.env));
  app.use('*', responseHeaders());
  // Attachments go straight to object storage, so 1 MB is generous for
  // anything this API takes — except a sync push, which carries whole
  // documents, up to 200 at a time. Devices split pushes well below its limit.
  const tooLarge = (c: AppContext) =>
    fail(c, { code: 'invalid_input', message: 'That request is too large.' }, { status: 413 });
  const syncPushLimit = bodyLimit({ maxSize: SYNC_PUSH_MAX_BYTES, onError: tooLarge as never });
  const defaultLimit = bodyLimit({ maxSize: 1024 * 1024, onError: tooLarge as never });
  app.use('*', (c, next) =>
    c.req.path === '/v1/sync/push' ? syncPushLimit(c, next) : defaultLimit(c, next),
  );
  app.use(
    '*',
    clientIp(options.env.NOTO_CLIENT_IP_HEADER, options.socketAddress ?? (() => undefined)),
  );

  // Health checks sit before the rate limit so a monitor never trips it.
  app.get('/healthz', (c) => c.json({ ok: true }));
  app.get('/readyz', async (c) =>
    (await deps.ready())
      ? c.json({ ok: true })
      : fail(c, { code: 'storage_unavailable', message: 'The database is not reachable.' }),
  );

  app.use('/v1/*', rateLimit({ limit: options.requestsPerMinute ?? 300, windowSeconds: 60 }));

  app.route('/v1/auth', authRoutes(deps));
  app.route('/v1/account', accountRoutes(deps));
  app.route('/v1/workspaces', workspaceRoutes(deps));
  app.route('/v1/sync', syncRoutes(deps));

  app.notFound((c) => fail(c, { code: 'not_found', message: 'There is nothing here.' }));

  // The last line of defence. A thrown error is a bug — every expected failure
  // is a `Result` — so it is logged with its request id and answered as 500
  // without a word of what went wrong.
  app.onError((error, c) => {
    console.error(
      JSON.stringify({
        requestId: c.get('requestId'),
        unhandled: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }),
    );

    return fail(c, { code: 'unknown', message: 'Something went wrong on our side.' });
  });

  return app;
}
