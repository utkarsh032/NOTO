import { sql } from 'kysely';

import { createKysely } from '../src/db/pool.ts';

/**
 * `pnpm db:bootstrap` — once per machine.
 *
 * Creates the database named in DATABASE_MIGRATE_URL, and the `noto_api` and
 * `noto_service` login roles with the passwords in DATABASE_URL and
 * DATABASE_SERVICE_URL. Safe to run again: it creates what is missing and
 * resets the two passwords to what `.env` says.
 *
 * Passwords live in `.env`, never in a migration. The migrations only grant to
 * the roles; logging in is an operator's decision.
 */

function required(name: string): URL {
  const value = process.env[name];
  if (!value) {
    console.error(`Set ${name} (see docs/development/database.md).`);
    process.exit(1);
  }
  return new URL(value);
}

const owner = required('DATABASE_MIGRATE_URL');
const apiUrl = required('DATABASE_URL');
const serviceUrl = required('DATABASE_SERVICE_URL');

const databaseName = decodeURIComponent(owner.pathname.slice(1)) || 'noto';
const maintenance = new URL(owner);
maintenance.pathname = '/postgres';

const admin = createKysely({ connectionString: maintenance.toString(), max: 1 });

async function ensureRole(url: URL, expected: string, bypassRls: boolean): Promise<void> {
  const name = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);

  if (name !== expected) {
    throw new Error(`The URL names role "${name}"; the migrations grant to "${expected}".`);
  }
  if (!password) throw new Error(`The URL for ${expected} has no password.`);

  const exists = await sql<{
    n: number;
  }>`select 1 as n from pg_roles where rolname = ${name}`.execute(admin);
  const verb = exists.rows.length > 0 ? 'alter' : 'create';

  // Identifiers and the password literal cannot be bound parameters here.
  await sql
    .raw(
      `${verb} role ${name} login password ${sql.lit(password).compile(admin).sql} ${bypassRls ? 'bypassrls' : 'nobypassrls'}`,
    )
    .execute(admin);

  console.warn(`${verb === 'create' ? 'created' : 'updated'} role ${name}`);
}

try {
  const found = await sql<{
    n: number;
  }>`select 1 as n from pg_database where datname = ${databaseName}`.execute(admin);

  if (found.rows.length === 0) {
    await sql.raw(`create database "${databaseName.replace(/"/g, '""')}"`).execute(admin);
    console.warn(`created database ${databaseName}`);
  } else {
    console.warn(`database ${databaseName} exists`);
  }

  await ensureRole(apiUrl, 'noto_api', false);
  await ensureRole(serviceUrl, 'noto_service', true);

  console.warn('Next: pnpm db:migrate');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await admin.destroy();
}
