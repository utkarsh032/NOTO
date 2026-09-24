import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Schema } from '@noto/backend/postgres';

import { createDatabase } from '../src/db/tx.ts';
import { type TestDatabase, createTestDatabase, hasDatabase } from './harness.ts';

/**
 * Row-level security, proven against a real Postgres (plan §13).
 *
 * Under Supabase these guarantees came free with PostgREST. Now the API
 * connects as one role and names the caller per transaction, so this file is
 * the evidence that doing so still keeps every person inside their own rows —
 * including the two tests the plan says must exist before this ships.
 */

const ALICE = '00000000-0000-4000-8000-00000000000a';
const BOB = '00000000-0000-4000-8000-00000000000b';
const STRANGER = '00000000-0000-4000-8000-0000000000ff';
const ALICE_DEVICE = '10000000-0000-4000-8000-00000000000a';

describe.skipIf(!hasDatabase)('row-level security', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase({ apiPoolSize: 1 });
    const { owner } = database;

    for (const [id, email] of [
      [ALICE, 'alice@example.com'],
      [BOB, 'bob@example.com'],
    ] as const) {
      await owner
        .insertInto('users')
        .values({ id, email, display_name: email.split('@')[0]!, password_hash: 'not-a-real-hash' })
        .execute();
      await owner.insertInto('user_settings').values({ user_id: id }).execute();
      await owner
        .insertInto('auth_events')
        .values({ user_id: id, kind: 'sign_in', outcome: 'success' })
        .execute();
      await owner
        .insertInto('sessions')
        .values({
          user_id: id,
          refresh_token_hash: `hash-${id}`,
          expires_at: new Date(Date.now() + 86_400_000),
        })
        .execute();
      await owner
        .insertInto('auth_attempts')
        .values({ key: `ip:${id}`, kind: 'sign_in' })
        .execute();
    }

    await owner
      .insertInto('devices')
      .values({
        id: ALICE_DEVICE,
        user_id: ALICE,
        name: 'ThinkPad',
        platform: 'windows',
        os_name: 'Windows 11',
        app_version: '1.5.0',
        revoked_at: new Date(),
      })
      .execute();
  });

  afterAll(async () => {
    await database?.drop();
  });

  const asUser = <T>(userId: string, work: (db: Kysely<Schema>) => Promise<T>) =>
    database.db.asUser(userId, work);

  it('shows a stranger nothing in any table it can read', async () => {
    const counts = await asUser(STRANGER, async (db) => ({
      users: (await db.selectFrom('users').select('id').execute()).length,
      devices: (await db.selectFrom('devices').select('id').execute()).length,
      events: (await db.selectFrom('auth_events').select('id').execute()).length,
      settings: (await db.selectFrom('user_settings').select('user_id').execute()).length,
    }));

    expect(counts).toEqual({ users: 0, devices: 0, events: 0, settings: 0 });
  });

  it('shows each user their own rows and only those', async () => {
    const rows = await asUser(ALICE, async (db) => ({
      users: await db.selectFrom('users').select('email').execute(),
      devices: await db.selectFrom('devices').select('id').execute(),
      events: await db.selectFrom('auth_events').select('user_id').execute(),
    }));

    expect(rows.users).toEqual([{ email: 'alice@example.com' }]);
    expect(rows.devices).toEqual([{ id: ALICE_DEVICE }]);
    expect(rows.events).toEqual([{ user_id: ALICE }]);
  });

  it.each(['sessions', 'email_tokens', 'auth_attempts'] as const)(
    'gives noto_api no access at all to %s',
    async (table) => {
      await expect(
        asUser(ALICE, (db) =>
          db
            .selectFrom(table)
            .select(sql`1`.as('one'))
            .execute(),
        ),
      ).rejects.toMatchObject({ code: '42501' });
    },
  );

  it('never lets noto_api read a password hash, even its own', async () => {
    await expect(
      asUser(ALICE, (db) => db.selectFrom('users').select('password_hash').execute()),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('never lets noto_api write server-owned user columns', async () => {
    for (const change of [
      { email: 'mallory@example.com' },
      { email_verified_at: new Date() },
      { deleted_at: null },
      { password_changed_at: new Date() },
    ]) {
      await expect(
        asUser(ALICE, (db) =>
          db.updateTable('users').set(change).where('id', '=', ALICE).execute(),
        ),
      ).rejects.toMatchObject({ code: '42501' });
    }
  });

  it('cannot update another user’s row: the update matches nothing', async () => {
    const result = await asUser(ALICE, (db) =>
      db
        .updateTable('users')
        .set({ display_name: 'pwned' })
        .where('id', '=', BOB)
        .executeTakeFirst(),
    );

    expect(Number(result.numUpdatedRows)).toBe(0);
    const bob = await database.owner
      .selectFrom('users')
      .select('display_name')
      .where('id', '=', BOB)
      .executeTakeFirstOrThrow();
    expect(bob.display_name).toBe('bob');
  });

  it('cannot plant a device on another account', async () => {
    await expect(
      asUser(ALICE, (db) =>
        db
          .insertInto('devices')
          .values({
            id: '20000000-0000-4000-8000-000000000001',
            user_id: BOB,
            name: 'Planted',
            platform: 'web',
            os_name: 'Web',
            app_version: '1.5.0',
          })
          .execute(),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('lets an owner revoke a device but never un-revoke it', async () => {
    await asUser(ALICE, (db) =>
      db.updateTable('devices').set({ revoked_at: null }).where('id', '=', ALICE_DEVICE).execute(),
    );

    const device = await database.owner
      .selectFrom('devices')
      .select('revoked_at')
      .where('id', '=', ALICE_DEVICE)
      .executeTakeFirstOrThrow();
    expect(device.revoked_at).not.toBeNull();
  });

  it('does not leak one request’s caller into the next on a pooled connection', async () => {
    // The API pool has exactly one connection, so these run back to back on
    // the same backend process — the case SET LOCAL exists for.
    const first = await asUser(ALICE, (db) => db.selectFrom('users').select('email').execute());
    const second = await asUser(BOB, (db) => db.selectFrom('users').select('email').execute());

    expect(first).toEqual([{ email: 'alice@example.com' }]);
    expect(second).toEqual([{ email: 'bob@example.com' }]);

    // And outside any `asUser`, the same connection names nobody.
    const bare = await database.api.selectFrom('users').select('email').execute();
    const setting = await sql<{ value: string | null }>`
      select current_setting('app.user_id', true) as value
    `.execute(database.api);

    expect(bare).toEqual([]);
    expect(setting.rows[0]?.value ?? '').toBe('');
  });

  it('forgets the caller when a transaction fails', async () => {
    await expect(
      asUser(ALICE, async (db) => {
        await db.selectFrom('users').select('id').execute();
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const after = await database.api.selectFrom('users').select('email').execute();
    expect(after).toEqual([]);
  });

  it('lets the service role see everything, which is why routes never use it with a caller-supplied filter', async () => {
    const service = createDatabase({ api: database.api, service: database.service });
    const users = await service.asService((db) => db.selectFrom('users').select('id').execute());

    expect(users).toHaveLength(2);
  });
});
