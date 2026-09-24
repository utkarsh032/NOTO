import { createKysely } from '../src/db/pool.ts';
import { migrate, migrationStatus } from '../src/db/migrations.ts';

/**
 * `pnpm db:migrate` and `pnpm db:status`.
 *
 * Runs as DATABASE_MIGRATE_URL — the database owner — because migrations
 * create tables and grants. The API itself never connects with it.
 */

const command = process.argv[2] ?? 'status';
const url = process.env['DATABASE_MIGRATE_URL'];

if (!url) {
  console.error(
    'Set DATABASE_MIGRATE_URL to the database owner (see docs/development/database.md).',
  );
  process.exit(1);
}

const db = createKysely({ connectionString: url, max: 1, applicationName: 'noto-migrate' });

try {
  if (command === 'up') {
    const ran = await migrate(db, { log: (line) => console.warn(line) });
    console.warn(ran.length === 0 ? 'Nothing to apply.' : `Applied ${ran.length} migration(s).`);
  } else if (command === 'status') {
    const status = await migrationStatus(db);
    for (const name of status.applied) console.warn(`  applied  ${name}`);
    for (const name of status.pending) console.warn(`  pending  ${name}`);
    console.warn(`${status.applied.length} applied, ${status.pending.length} pending.`);
  } else {
    console.error(`Unknown command "${command}". Use "up" or "status".`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
