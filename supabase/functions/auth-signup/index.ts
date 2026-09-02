import { AuthService } from '@noto/backend';
import {
  CloudflareTurnstile,
  SupabaseAuditAdapter,
  SupabaseAuthAdapter,
  SupabaseDeviceAdapter,
  SupabaseRateLimitAdapter,
} from '@noto/backend/supabase';
import { err } from '@noto/core';

import { anonClient, requireEnv, serviceClient } from '../_shared/context.ts';
import { clientIp, corsHeaders, readJson, respond } from '../_shared/http.ts';

/**
 * `auth-signup` — a new account, if a human asked for one.
 *
 * The sibling of `auth-signin`, and unauthenticated for the same reason, so it
 * carries the same `verify_jwt = false`. What it adds is the bot check: sign-up
 * is the cheapest endpoint in Noto to abuse, because it costs an attacker one
 * request and costs us a row, an email and a place in the free tier's quota.
 *
 * The Turnstile secret is read here and nowhere else. It never reaches a
 * client, and the token a browser sends is worthless without it.
 */
Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== 'POST') {
    return respond(err('invalid_input', 'This endpoint accepts POST.'), origin);
  }

  const service = serviceClient();

  const auth = new AuthService({
    auth: new SupabaseAuthAdapter(anonClient()),
    devices: new SupabaseDeviceAdapter(service),
    audit: new SupabaseAuditAdapter(service),
    rateLimit: new SupabaseRateLimitAdapter(service),
    turnstile: new CloudflareTurnstile({
      secret: requireEnv('TURNSTILE_SECRET'),
      // Must match `data-action` on the widget. Without it, a token minted by
      // the same sitekey on any other form would be accepted here.
      expectedAction: 'signup',
      expectedHostnames: requireEnv('TURNSTILE_HOSTNAMES')
        .split(',')
        .map((hostname) => hostname.trim())
        .filter(Boolean),
    }),
  });

  /*
   * The address is taken from the request, never from the body. It is what the
   * per-IP sign-up limit counts against, and a client that could name its own
   * IP would not have a limit.
   */
  const created = await auth.signUp(await readJson(request), { ip: clientIp(request) });

  return respond(created, origin);
});
