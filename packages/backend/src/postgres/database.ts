import type { Result } from '@noto/types';
import type { Kysely } from 'kysely';

import { fromProviderError } from '../helpers/errors.ts';
import type { Schema } from './schema.ts';

/**
 * How an adapter reaches Postgres.
 *
 * Two doors, and choosing one is the security decision in every method:
 *
 * - `asUser` runs as `noto_api` inside a transaction that names the caller, so
 *   row-level security applies. A bug in an adapter that uses it cannot read
 *   another person's rows, because the database refuses, not the code.
 * - `asService` runs as `noto_service`, which bypasses RLS. It is for the
 *   server's own tables — sessions, mailed tokens, the security log, rate
 *   limits — and for the moments before anybody is signed in. It is never
 *   given a row filter that came from the request body.
 *
 * Both run their work in one transaction. `apps/api/src/db/tx.ts` implements
 * this; the adapters never see a pool, and nothing in this package imports `pg`.
 */
export interface PostgresDatabase {
  asUser<T>(userId: string, work: (db: Kysely<Schema>) => Promise<T>): Promise<T>;
  asService<T>(work: (db: Kysely<Schema>) => Promise<T>): Promise<T>;
}

/**
 * A failure that must also undo the transaction it happened in.
 *
 * Returning an error from inside `asService` commits whatever ran before it,
 * which is usually what is wanted — a detected token reuse must stay revoked.
 * When it is not, throwing this aborts the work and `attempt` hands the error
 * back unchanged.
 */
export class Rollback extends Error {
  constructor(readonly result: Result<never>) {
    super('rollback');
  }
}

/**
 * Runs an adapter body and turns a thrown database error into a `Result`.
 *
 * node-postgres throws; the ports return. Every adapter method goes through
 * here so that a unique violation is a `conflict`, a refused connection is
 * `storage_unavailable`, and nothing escapes as an exception.
 */
export async function attempt<T>(
  context: string,
  work: () => Promise<Result<T>>,
): Promise<Result<T>> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof Rollback) return error.result;
    return fromProviderError(error, context);
  }
}
