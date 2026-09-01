import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { bearerToken, deviceId } from './http.ts';

/**
 * Who is calling, and a client that can act only as them.
 *
 * The important line is the `Authorization` header passed into `createClient`.
 * It makes every query the function runs subject to the same RLS policies the
 * user's own device would face, so a bug in a function cannot read another
 * user's rows — the database refuses, not the code.
 *
 * The service-role client is a separate, deliberate call. Reaching for it
 * should feel like reaching for something sharp.
 */

export interface CallerContext {
  userId: string;
  deviceId: string | null;
  /** Scoped to the caller. RLS applies. Use this by default. */
  client: SupabaseClient;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured for this function.`);

  return value;
}

/**
 * Resolves the caller, or returns `null` when there is no valid session.
 *
 * The token is verified by asking GoTrue rather than by decoding the JWT here.
 * Verifying a signature by hand is a well-known way to accidentally accept
 * `alg: none`, and it would also miss a token revoked seconds ago.
 */
export async function resolveCaller(request: Request): Promise<CallerContext | null> {
  const token = bearerToken(request);
  if (!token) return null;

  const client = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;

  return { userId: data.user.id, deviceId: deviceId(request), client };
}

/**
 * A client that bypasses RLS.
 *
 * For the handful of operations that are legitimately not the user's: writing
 * the security log, applying a Stripe webhook, counting rate limits. Never for
 * convenience, and never with data the caller supplied as the row filter.
 */
export function serviceClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
