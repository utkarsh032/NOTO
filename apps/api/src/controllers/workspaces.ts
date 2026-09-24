import { validate } from '@noto/backend';
import { Hono } from 'hono';

import { type AppEnv, readJson, respond } from '../http.ts';
import { requireAuth } from '../middleware/index.ts';
import { type ApiDependencies, servicesFor } from '../services.ts';
import { claimSchema } from '../sync/schemas.ts';
import { authorizeDevice, claimWorkspace, listWorkspaces } from '../sync/store.ts';
import { deviceIdOf, isUuid } from './sync.ts';

/**
 * `/v1/workspaces` — the two routes sync needs before it can start (Node plan
 * §6, §9.5): which workspaces the account has, and adopting one a device made
 * offline. Members, invitations and deletion are Phase 9's.
 */
export function workspaceRoutes(deps: ApiDependencies) {
  const routes = new Hono<AppEnv>();

  routes.use(
    '*',
    requireAuth(() => servicesFor(deps, null).identity),
  );

  routes.get('/', async (c) => respond(c, await listWorkspaces(deps.db, c.get('caller').userId)));

  // Signing in never uploads anything by itself: a device claims its workspace
  // only once the person has said yes (plan §9.5, step 6).
  routes.post('/:workspaceId/claim', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    if (!isUuid(workspaceId)) {
      return respond(c, {
        ok: false,
        error: { code: 'not_found', message: 'There is no such workspace.' },
      });
    }

    const input = validate(claimSchema, await readJson(c));
    if (!input.ok) return respond(c, input);

    const caller = await authorizeDevice(deps.db, c.get('caller'), deviceIdOf(c));
    if (!caller.ok) return respond(c, caller);

    return respond(c, await claimWorkspace(deps.db, caller.value, workspaceId, input.value));
  });

  return routes;
}
