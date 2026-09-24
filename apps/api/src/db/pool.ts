import type { Schema } from '@noto/backend/postgres';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

/**
 * THE ONLY FILE IN THE REPOSITORY THAT MAY IMPORT `pg` (plan §1.1).
 *
 * Everything else reaches the database through the Kysely instances made here.
 * Keeping the driver behind one file is what keeps a move to Workers +
 * Hyperdrive a change to this file and a deploy config, rather than a rewrite.
 * A controller that reaches for a pool has broken the rule and should fail
 * review.
 */

// `bigint` (int8) stays a string: a JavaScript number cannot hold every value,
// and the only int8 columns are identifiers nobody does arithmetic on.
// `count(*)` is int8 as well; callers wrap it in Number().

export interface DatabaseOptions {
  connectionString: string;
  max?: number;
  /**
   * Run every connection as this role (`SET ROLE`). Tests use it to act as
   * `noto_api` and `noto_service` through one superuser URL; deployments
   * connect as the roles themselves and leave it unset.
   */
  role?: string;
  applicationName?: string;
}

export function createKysely(options: DatabaseOptions): Kysely<Schema> {
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    max: options.max ?? 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: options.applicationName ?? 'noto-api',
    ...(options.role === undefined ? {} : { options: `-c role=${options.role}` }),
  });

  // An idle client that errors (the server restarted, a network blip) is
  // removed from the pool. Without a listener the error would crash the process.
  pool.on('error', (error) => {
    console.error(JSON.stringify({ db: 'idle_client_error', message: error.message }));
  });

  return new Kysely<Schema>({ dialect: new PostgresDialect({ pool }) });
}
