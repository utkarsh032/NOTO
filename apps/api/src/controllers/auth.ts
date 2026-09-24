import { Hono } from 'hono';

import { type AppEnv, readJson, respond } from '../http.ts';
import { requireAuth } from '../middleware/index.ts';
import { type ApiDependencies, servicesFor } from '../services.ts';

/**
 * `/v1/auth` — 11 routes (plan §6.1).
 *
 * Thin by rule: read the body, call a service, hand the `Result` to
 * `respond`. Every policy — rate limits, the bot check, the audit log, the
 * identical answer for every failed sign-in — lives in `AuthService` and
 * `IdentityService`, where it is tested without a server.
 */
export function authRoutes(deps: ApiDependencies) {
  const routes = new Hono<AppEnv>();
  const signedIn = requireAuth(() => servicesFor(deps, null).identity);

  const anonymous = () => servicesFor(deps, null);
  const client = (c: {
    get: (key: 'ip') => string | undefined;
    req: { header(name: string): string | undefined };
  }) => ({
    ...(c.get('ip') === undefined ? {} : { ip: c.get('ip') }),
    ...(c.req.header('user-agent') === undefined ? {} : { userAgent: c.req.header('user-agent') }),
  });

  routes.post('/signup', async (c) =>
    respond(c, await anonymous().auth.signUp(await readJson(c), client(c))),
  );

  routes.post('/signin', async (c) =>
    respond(c, await anonymous().auth.signIn(await readJson(c), client(c))),
  );

  // A refresh token that has ended, for any reason, is a 401: the client's
  // answer to it is "sign in again", not "show an error".
  routes.post('/refresh', async (c) =>
    respond(c, await anonymous().identity.refresh(await readJson(c)), {
      unauthorized: ['permission_denied'],
    }),
  );

  routes.post('/signout', signedIn, async (c) =>
    respond(c, await servicesFor(deps, c.get('caller')).identity.signOut(c.get('caller'))),
  );

  routes.post('/signout-all', signedIn, async (c) =>
    respond(c, await servicesFor(deps, c.get('caller')).identity.signOutAll(c.get('caller'))),
  );

  routes.get('/session', signedIn, async (c) =>
    respond(c, await servicesFor(deps, c.get('caller')).identity.currentUser(), {
      unauthorized: ['not_found'],
    }),
  );

  routes.post('/verify-email', async (c) =>
    respond(c, await anonymous().identity.verifyEmail(await readJson(c))),
  );

  routes.post('/verify-email/resend', async (c) =>
    respond(c, await anonymous().identity.resendVerification(await readJson(c))),
  );

  routes.post('/password/forgot', async (c) =>
    respond(c, await anonymous().identity.forgotPassword(await readJson(c), client(c))),
  );

  routes.post('/password/reset', async (c) =>
    respond(c, await anonymous().identity.resetPassword(await readJson(c))),
  );

  routes.post('/password/change', signedIn, async (c) =>
    respond(
      c,
      await servicesFor(deps, c.get('caller')).identity.changePassword(
        c.get('caller'),
        await readJson(c),
      ),
    ),
  );

  return routes;
}
