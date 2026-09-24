import { validate } from '@noto/backend';
import { Hono } from 'hono';

import { type AppContext, type AppEnv, readJson, respond } from '../http.ts';
import { requireAuth } from '../middleware/index.ts';
import { type ApiDependencies, servicesFor } from '../services.ts';
import { pullSchema, pushSchema } from '../sync/schemas.ts';
import { authorizeDevice, pull, push, syncState } from '../sync/store.ts';

/**
 * `/v1/sync` — the three routes that carry every document, folder, file and
 * memory item in the product (Node plan §6, §6.3, §9.6).
 *
 * Signed in, email verified, on a device of the caller's own. The device is
 * the token's when the session was opened on one; otherwise the body names
 * it, and it must be the caller's and not signed out.
 */
export function syncRoutes(deps: ApiDependencies) {
  const routes = new Hono<AppEnv>();

  routes.use(
    '*',
    requireAuth(() => servicesFor(deps, null).identity),
  );

  routes.post('/push', async (c) => {
    const input = validate(pushSchema, await readJson(c));
    if (!input.ok) return respond(c, input);

    const caller = await authorizeDevice(deps.db, c.get('caller'), input.value.deviceId);
    if (!caller.ok) return respond(c, caller);

    return respond(
      c,
      await push(deps.db, caller.value, input.value.workspaceId, input.value.changes),
    );
  });

  routes.post('/pull', async (c) => {
    const input = validate(pullSchema, await readJson(c));
    if (!input.ok) return respond(c, input);

    const caller = await authorizeDevice(deps.db, c.get('caller'), input.value.deviceId);
    if (!caller.ok) return respond(c, caller);

    return respond(
      c,
      await pull(
        deps.db,
        caller.value,
        input.value.workspaceId,
        input.value.sinceSeq,
        input.value.limit,
      ),
    );
  });

  routes.get('/state', async (c) => {
    const workspaceId = c.req.query('workspaceId') ?? '';
    const deviceId = deviceIdOf(c);
    if (!isUuid(workspaceId) || !isUuid(deviceId)) {
      return respond(c, {
        ok: false,
        error: { code: 'invalid_input', message: 'Name a workspace and a device.' },
      });
    }

    const caller = await authorizeDevice(deps.db, c.get('caller'), deviceId);
    if (!caller.ok) return respond(c, caller);

    return respond(c, await syncState(deps.db, caller.value, workspaceId));
  });

  return routes;
}

/** The token's device, or the header a client sends for one opened before it registered. */
export function deviceIdOf(c: AppContext): string {
  return c.get('caller').deviceId ?? c.req.header('x-noto-device-id') ?? '';
}

export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
