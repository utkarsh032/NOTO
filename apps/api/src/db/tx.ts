import type { PostgresDatabase, Schema } from '@noto/backend/postgres';
import { type Kysely, sql } from 'kysely';

/**
 * The two doors into the database (plan §3).
 *
 * `asUser` opens a transaction on the `noto_api` pool and names the caller in
 * it; every RLS policy reads that name back through `current_user_id()`.
 * `asService` opens one on the `noto_service` pool, which bypasses RLS.
 */
export function createDatabase(pools: {
  api: Kysely<Schema>;
  service: Kysely<Schema>;
}): PostgresDatabase {
  return {
    asUser: (userId, work) =>
      pools.api.transaction().execute(async (tx) => {
        // SET LOCAL, never SET: `set_config(…, true)` is scoped to this
        // transaction, so a pooled connection cannot carry one request's
        // identity into the next one. This is the single most important line
        // in the backend.
        await sql`select set_config('app.user_id', ${userId}, true)`.execute(tx);
        return work(tx);
      }),

    asService: (work) => pools.service.transaction().execute((tx) => work(tx)),
  };
}
