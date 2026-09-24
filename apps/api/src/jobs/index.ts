import type { PostgresDatabase } from '@noto/backend/postgres';
import { sql } from 'kysely';
import cron from 'node-cron';

/**
 * Scheduled work — the `pg_cron` replacement (plan §12).
 *
 * In-process with `node-cron` while there is one instance. The moment there
 * are two, set `NOTO_RUN_JOBS=false` on all but one (or move these behind an
 * authenticated endpoint a scheduler calls), or every sweep runs twice.
 *
 * Only the identity sweeps exist yet; the change-log, version-history, usage
 * and export jobs arrive with the tables they sweep.
 */

export interface Job {
  name: string;
  /** Cron expression, UTC. */
  schedule: string;
  run(db: PostgresDatabase): Promise<number>;
}

export const JOBS: Job[] = [
  {
    // The longest rate-limit window is an hour; two keeps a margin.
    name: 'sweep-auth-attempts',
    schedule: '7 * * * *',
    run: (db) =>
      db.asService(async (tx) => {
        const result = await tx
          .deleteFrom('auth_attempts')
          .where('attempted_at', '<', sql<Date>`now() - interval '2 hours'`)
          .executeTakeFirst();
        return Number(result.numDeletedRows);
      }),
  },
  {
    name: 'sweep-sessions',
    schedule: '17 3 * * *',
    run: (db) =>
      db.asService(async (tx) => {
        const result = await tx
          .deleteFrom('sessions')
          .where((eb) =>
            eb.or([
              eb('expires_at', '<', sql<Date>`now() - interval '30 days'`),
              eb('revoked_at', '<', sql<Date>`now() - interval '30 days'`),
            ]),
          )
          .executeTakeFirst();
        return Number(result.numDeletedRows);
      }),
  },
  {
    // A day's grace after expiry or use, so a link clicked late still meets
    // "expired" rather than "unknown" — the two answer the same anyway.
    name: 'sweep-email-tokens',
    schedule: '27 3 * * *',
    run: (db) =>
      db.asService(async (tx) => {
        const result = await tx
          .deleteFrom('email_tokens')
          .where((eb) =>
            eb.or([
              eb('expires_at', '<', sql<Date>`now() - interval '1 day'`),
              eb('consumed_at', '<', sql<Date>`now() - interval '1 day'`),
            ]),
          )
          .executeTakeFirst();
        return Number(result.numDeletedRows);
      }),
  },
  {
    // The security log's promised lifetime: six months.
    name: 'trim-auth-events',
    schedule: '37 3 * * *',
    run: (db) =>
      db.asService(async (tx) => {
        const result = await tx
          .deleteFrom('auth_events')
          .where('created_at', '<', sql<Date>`now() - interval '180 days'`)
          .executeTakeFirst();
        return Number(result.numDeletedRows);
      }),
  },
];

/** Runs one job, logging the outcome. A failed sweep is reported and retried next time. */
export async function runJob(job: Job, db: PostgresDatabase): Promise<void> {
  const startedAt = Date.now();

  try {
    const affected = await job.run(db);
    console.warn(JSON.stringify({ job: job.name, affected, ms: Date.now() - startedAt }));
  } catch (error) {
    console.error(
      JSON.stringify({
        job: job.name,
        failed: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

/** Schedules every job. Returns a function that stops them, for shutdown. */
export function startJobs(db: PostgresDatabase): () => void {
  const tasks = JOBS.map((job) =>
    cron.schedule(job.schedule, () => runJob(job, db), { name: job.name, timezone: 'UTC' }),
  );

  return () => {
    for (const task of tasks) void task.stop();
  };
}
