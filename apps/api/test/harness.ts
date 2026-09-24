import type { MailPort } from '@noto/backend';
import type { PostgresDatabase, Schema } from '@noto/backend/postgres';
import { FakeTurnstilePort } from '@noto/backend/testing';
import { ok } from '@noto/core';
import { type Kysely, sql } from 'kysely';

import { createApp } from '../src/app.ts';
import { migrate } from '../src/db/migrations.ts';
import { createKysely } from '../src/db/pool.ts';
import { createDatabase } from '../src/db/tx.ts';
import { createMailLinks } from '../src/mail.ts';
import { createArgon2Hasher } from '../src/security/passwords.ts';
import { createAccessTokens } from '../src/security/tokens.ts';

/**
 * Integration-test harness: a throwaway database per test file.
 *
 * `NOTO_TEST_DATABASE_URL` names a role that can create databases — the local
 * `postgres` superuser, or the CI runner's. Each file creates
 * `noto_test_<random>`, migrates it, and drops it afterwards, so the tests
 * never touch development data and can run in parallel.
 *
 * The API's two roles are reached through that one URL with `SET ROLE`
 * (`createKysely`'s `role` option), so the tests need no role passwords and
 * still run every query as `noto_api` or `noto_service` — row-level security
 * and the column grants apply exactly as in production.
 *
 * Without the variable, the integration suites skip rather than fail: a
 * contributor without Postgres can still run everything else.
 */

export const TEST_DATABASE_URL = process.env['NOTO_TEST_DATABASE_URL'];
export const hasDatabase = Boolean(TEST_DATABASE_URL);

export interface TestDatabase {
  db: PostgresDatabase;
  /** As `noto_api`. */
  api: Kysely<Schema>;
  /** As `noto_service`. */
  service: Kysely<Schema>;
  /** As the owner — for arranging state a test cannot reach through the API. */
  owner: Kysely<Schema>;
  drop(): Promise<void>;
}

export async function createTestDatabase(
  options: { apiPoolSize?: number } = {},
): Promise<TestDatabase> {
  if (!TEST_DATABASE_URL) throw new Error('NOTO_TEST_DATABASE_URL is not set.');

  const name = `noto_test_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const admin = createKysely({ connectionString: TEST_DATABASE_URL, max: 1 });
  await ensureRoles(admin);
  await sql.raw(`create database ${name}`).execute(admin);

  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${name}`;
  const connectionString = url.toString();

  const owner = createKysely({ connectionString, max: 2 });
  await migrate(owner);

  const api = createKysely({ connectionString, role: 'noto_api', max: options.apiPoolSize ?? 4 });
  const service = createKysely({ connectionString, role: 'noto_service', max: 4 });

  return {
    db: createDatabase({ api, service }),
    api,
    service,
    owner,
    async drop() {
      await Promise.all([api.destroy(), service.destroy(), owner.destroy()]);
      await sql.raw(`drop database if exists ${name} with (force)`).execute(admin);
      await admin.destroy();
    },
  };
}

/**
 * Roles are cluster-wide, and test files run in parallel. Creating them here
 * first — tolerating the loser of a race — means no two migrations race to
 * create them inside their own transactions.
 */
async function ensureRoles(admin: Kysely<Schema>): Promise<void> {
  for (const statement of [
    'create role noto_api nologin',
    'create role noto_service nologin bypassrls',
  ]) {
    try {
      await sql.raw(statement).execute(admin);
    } catch (error) {
      const code = (error as { code?: string }).code;
      // 42710 duplicate_object; 23505 when two sessions insert the catalog row at once.
      if (code !== '42710' && code !== '23505') throw error;
    }
  }
}

/** Collects mail instead of sending it, and finds the token in a link. */
export class MailBox implements MailPort {
  readonly messages: { to: string; subject: string; text: string }[] = [];

  send(message: { to: string; subject: string; text: string; html: string }) {
    this.messages.push({ to: message.to, subject: message.subject, text: message.text });
    return Promise.resolve(ok(undefined));
  }

  /** The newest message to `to` whose subject matches. */
  last(to: string, subject: RegExp) {
    const found = [...this.messages]
      .reverse()
      .find((message) => message.to === to && subject.test(message.subject));
    if (!found) throw new Error(`No mail to ${to} matching ${subject}.`);
    return found;
  }

  /** The token in the newest matching message's link. */
  token(to: string, subject: RegExp): string {
    const match = /token=([0-9a-f]+)/.exec(this.last(to, subject).text);
    if (!match?.[1]) throw new Error(`No token in the mail to ${to}.`);
    return match[1];
  }
}

export const JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-characters';

export function createTestApp(database: TestDatabase, mail = new MailBox()) {
  const app = createApp(
    {
      db: database.db,
      hasher: createArgon2Hasher(),
      tokens: createAccessTokens({ secret: JWT_SECRET, ttlSeconds: 900 }),
      mail,
      links: createMailLinks('https://app.noto.test'),
      turnstile: new FakeTurnstilePort(),
      refreshTokenTtlSeconds: 30 * 86_400,
      authOptions: { minimumAttemptMs: 0 },
      async ready() {
        await sql`select 1`.execute(database.api);
        return true;
      },
    },
    {
      env: {
        NOTO_ALLOWED_ORIGINS: [],
        NOTO_ALLOW_LOCALHOST_ORIGINS: false,
        NOTO_CLIENT_IP_HEADER: 'x-forwarded-for',
      },
      requestsPerMinute: 10_000,
    },
  );

  return { app, mail };
}
