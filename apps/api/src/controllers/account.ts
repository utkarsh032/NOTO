import { profilePatchSchema, validate } from '@noto/backend';
import { Hono } from 'hono';

import { type AppEnv, readJson, respond } from '../http.ts';
import { requireAuth } from '../middleware/index.ts';
import { type ApiDependencies, servicesFor } from '../services.ts';

/**
 * `/v1/account` — the account screen's API (plan §6.1).
 *
 * Every route is signed-in, and every one acts on the caller's own account:
 * the user id comes from the verified token, never from the path or body.
 * The four Phase-3 routes of the plan's table (avatar upload, entitlements,
 * data export, account deletion) arrive with R2 and billing in audit Phase 7.
 *
 * `/sessions` is not in the plan's table; the Account screen's Sessions tab
 * needs it, and it is the natural twin of `/devices`.
 */
export function accountRoutes(deps: ApiDependencies) {
  const routes = new Hono<AppEnv>();

  routes.use(
    '*',
    requireAuth(() => servicesFor(deps, null).identity),
  );

  const services = (c: { get(key: 'caller'): AppEnv['Variables']['caller'] }) =>
    servicesFor(deps, c.get('caller'));

  routes.get('/profile', async (c) =>
    respond(c, await services(c).account.getProfile(c.get('caller').userId)),
  );

  routes.patch('/profile', async (c) => {
    const patch = validate(profilePatchSchema, await readJson(c));
    if (!patch.ok) return respond(c, patch);

    return respond(c, await services(c).account.updateProfile(c.get('caller').userId, patch.value));
  });

  routes.post('/email/change', async (c) =>
    respond(c, await services(c).identity.requestEmailChange(c.get('caller'), await readJson(c))),
  );

  routes.get('/settings', async (c) =>
    respond(c, await services(c).account.getSettings(c.get('caller').userId)),
  );

  routes.put('/settings', async (c) =>
    respond(c, await services(c).account.updateSettings(c.get('caller').userId, await readJson(c))),
  );

  routes.get('/devices', async (c) => {
    const caller = c.get('caller');
    // The token's device, or the header for a session opened before the
    // client registered one.
    const current = caller.deviceId ?? c.req.header('x-noto-device-id') ?? null;

    return respond(c, await services(c).account.listDevices(caller.userId, current));
  });

  routes.post('/devices', async (c) =>
    respond(c, await services(c).account.registerDevice(c.get('caller').userId, await readJson(c))),
  );

  routes.delete('/devices/:deviceId', async (c) => {
    const caller = c.get('caller');

    return respond(
      c,
      await services(c).account.revokeDevice(
        caller.userId,
        c.req.param('deviceId'),
        caller.deviceId,
      ),
    );
  });

  routes.get('/sessions', async (c) =>
    respond(c, await services(c).identity.listSessions(c.get('caller'))),
  );

  routes.delete('/sessions/:sessionId', async (c) =>
    respond(c, await services(c).identity.revokeSession(c.get('caller'), c.req.param('sessionId'))),
  );

  routes.get('/events', async (c) => {
    const limit = Number.parseInt(c.req.query('limit') ?? '50', 10);

    return respond(
      c,
      await services(c).account.listSecurityEvents(
        c.get('caller').userId,
        Number.isFinite(limit) ? limit : 50,
      ),
    );
  });

  return routes;
}
