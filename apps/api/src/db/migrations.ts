import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { type Kysely, sql } from 'kysely';

/**
 * The migration runner (plan §10).
 *
 * Plain `.sql` files in `db/migrations/`, applied in filename order, each in
 * its own transaction, recorded in `schema_migrations`. No framework: the
 * files stay readable in a pull request, and this is the whole of the logic.
 *
 * Never edit a migration that has run anywhere but your own machine. The
 * runner stores each file's checksum and refuses to go on if an applied file
 * has changed, because a silently different schema per environment is worse
 * than a loud failure.
 */

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../db/migrations/', import.meta.url));

export interface Migration {
  name: string;
  sql: string;
  checksum: string;
}

export interface MigrationStatus {
  applied: string[];
  pending: string[];
}

async function checksum(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function loadMigrations(dir = MIGRATIONS_DIR): Promise<Migration[]> {
  const names = (await readdir(dir)).filter((name) => /^\d{4}_[\w-]+\.sql$/.test(name)).sort();

  return Promise.all(
    names.map(async (name) => {
      // Line endings normalised so a Windows checkout and a Linux runner agree
      // on the checksum of the same file.
      const text = (await readFile(`${dir}${name}`, 'utf8')).replace(/\r\n/g, '\n');
      return { name, sql: text, checksum: await checksum(text) };
    }),
  );
}

async function ensureTable<DB>(db: Kysely<DB>): Promise<void> {
  await sql`
    create table if not exists public.schema_migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `.execute(db);
}

async function appliedMigrations<DB>(db: Kysely<DB>): Promise<Map<string, string>> {
  const rows = await sql<{ name: string; checksum: string }>`
    select name, checksum from public.schema_migrations order by name
  `.execute(db);

  return new Map(rows.rows.map((row) => [row.name, row.checksum]));
}

function checkUnchanged(migrations: Migration[], applied: Map<string, string>): void {
  for (const migration of migrations) {
    const recorded = applied.get(migration.name);
    if (recorded !== undefined && recorded !== migration.checksum) {
      throw new Error(
        `Migration ${migration.name} has changed since it was applied. Add a new migration instead of editing one that has run.`,
      );
    }
  }
}

export async function migrationStatus<DB>(
  db: Kysely<DB>,
  migrations?: Migration[],
): Promise<MigrationStatus> {
  const all = migrations ?? (await loadMigrations());
  await ensureTable(db);
  const applied = await appliedMigrations(db);
  checkUnchanged(all, applied);

  return {
    applied: all.filter((m) => applied.has(m.name)).map((m) => m.name),
    pending: all.filter((m) => !applied.has(m.name)).map((m) => m.name),
  };
}

/**
 * Applies every pending migration, in order. Returns the names applied.
 *
 * Takes an advisory lock first, so two deploys starting at once cannot both
 * run the same file.
 */
export async function migrate<DB>(
  db: Kysely<DB>,
  options: { migrations?: Migration[]; log?: (line: string) => void } = {},
): Promise<string[]> {
  const all = options.migrations ?? (await loadMigrations());
  const log = options.log ?? (() => undefined);

  return db.connection().execute(async (connection) => {
    await sql`select pg_advisory_lock(hashtext('noto_schema_migrations'))`.execute(connection);

    try {
      await ensureTable(connection);
      const applied = await appliedMigrations(connection);
      checkUnchanged(all, applied);

      const ran: string[] = [];

      for (const migration of all) {
        if (applied.has(migration.name)) continue;

        await connection.transaction().execute(async (tx) => {
          // No parameters, so node-postgres uses the simple protocol, which
          // accepts a whole file of statements in one call.
          await sql.raw(migration.sql).execute(tx);
          await sql`
            insert into public.schema_migrations (name, checksum)
            values (${migration.name}, ${migration.checksum})
          `.execute(tx);
        });

        log(`applied ${migration.name}`);
        ran.push(migration.name);
      }

      return ran;
    } finally {
      await sql`select pg_advisory_unlock(hashtext('noto_schema_migrations'))`.execute(connection);
    }
  });
}
