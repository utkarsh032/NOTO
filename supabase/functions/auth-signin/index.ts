import { AuthService } from '@noto/backend';
import {
  SupabaseAuditAdapter,
  SupabaseAuthAdapter,
  SupabaseDeviceAdapter,
  SupabaseRateLimitAdapter,
} from '@noto/backend/supabase';
import { err } from '@noto/core';

import { anonClient, serviceClient } from '../_shared/context.ts';
import { corsHeaders, readJson, respond } from '../_shared/http.ts';

/**
 * `auth-signin` — email and password, exchanged for a session.
 *
 * Why this is a function rather than a `signInWithPassword` call from the
 * browser: `AuthService.signIn` rate-limits by address, writes the security log
 * and pads every attempt to a constant duration. All three need to reach tables
 * a client must never touch — `record_attempt` and `count_recent_attempts` are
 * granted to `service_role` alone, and `auth_events` has no insert policy at
 * all (see `20260901120600_rls.sql`). A client holding the keys to its own rate
 * limit does not have one.
 *
 * Unauthenticated by definition, so it is registered with `verify_jwt = false`
 * in `config.toml`. That makes it the one public write path in the backend, and
 * the reason the rate limit inside `AuthService` is not optional.
 */
Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== 'POST') {
    return respond(err('invalid_input', 'This endpoint accepts POST.'), origin);
  }

  // Three clients, on purpose.
  //
  // The GoTrue call runs on the anon client, exactly as a device would make it,
  // so a bug here cannot grant a session the caller could not have obtained
  // itself. The rate limiter and the audit log run as `service_role` because
  // they must: they are the two things the caller is not allowed to influence.
  //
  // Devices are written with the service client too, but the `user_id` comes
  // from the session GoTrue just verified — never from the request body — so
  // the row cannot be attributed to somebody else.
  const service = serviceClient();

  const auth = new AuthService({
    auth: new SupabaseAuthAdapter(anonClient()),
    devices: new SupabaseDeviceAdapter(service),
    audit: new SupabaseAuditAdapter(service),
    rateLimit: new SupabaseRateLimitAdapter(service),
  });

  return respond(await auth.signIn(await readJson(request)), origin);
});
