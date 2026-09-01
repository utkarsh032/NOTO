import { AccountService } from '@noto/backend';
import {
  SupabaseAuditAdapter,
  SupabaseDeviceAdapter,
  SupabaseProfileAdapter,
  SupabaseSettingsAdapter,
} from '@noto/backend/supabase';
import { err } from '@noto/core';

import { resolveCaller, serviceClient } from '../_shared/context.ts';
import { corsHeaders, readJson, respond } from '../_shared/http.ts';

/**
 * `device-register` — the first controller.
 *
 * Read it as the template for the other eight. It does four things and nothing
 * else: reject the wrong method, resolve the caller, hand the body to a
 * service, and turn the `Result` into a response. There is no policy here, and
 * there must not be — every rule this endpoint enforces lives in
 * `AccountService`, where it is tested without a server.
 *
 * Why this is a function at all, rather than a plain insert from the client:
 * the device count is capped by plan, and the location is derived from the
 * request's own address, which the client is not a trustworthy source for.
 */
Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== 'POST') {
    return respond(err('invalid_input', 'This endpoint accepts POST.'), origin);
  }

  const caller = await resolveCaller(request);
  if (!caller) {
    return respond(err('permission_denied', 'Sign in first.'), origin);
  }

  // The caller-scoped client for the write, so RLS still applies; the service
  // client only for the security log, which the user must not be able to forge.
  const service = new AccountService({
    profiles: new SupabaseProfileAdapter(caller.client),
    devices: new SupabaseDeviceAdapter(caller.client),
    settings: new SupabaseSettingsAdapter(caller.client),
    audit: new SupabaseAuditAdapter(serviceClient()),
  });

  const registered = await service.registerDevice(caller.userId, await readJson(request));

  return respond(registered, origin);
});
