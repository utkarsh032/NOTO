import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { accountsAwaitingReset, importSupabaseUsers } from '../src/db/import-supabase.ts';
import { type TestDatabase, createTestDatabase, hasDatabase } from './harness.ts';

const ADA = '40000000-0000-4000-8000-000000000001';
const GRACE = '40000000-0000-4000-8000-000000000002';
const CLASH = '40000000-0000-4000-8000-000000000003';

const EXPORT = {
  users: [
    {
      id: ADA,
      email: 'ada@example.com',
      email_confirmed_at: '2026-09-01T10:00:00Z',
      created_at: '2026-09-01T09:00:00Z',
      raw_user_meta_data: { display_name: 'Ada' },
    },
    {
      id: GRACE,
      email: 'grace@example.com',
      email_confirmed_at: null,
      created_at: '2026-09-02T09:00:00Z',
    },
    {
      id: CLASH,
      email: 'taken@example.com',
      email_confirmed_at: null,
      created_at: '2026-09-03T09:00:00Z',
    },
  ],
  profiles: [{ id: ADA, display_name: 'Ada Lovelace', locale: 'en-GB', marketing_opt_in: true }],
  user_settings: [{ user_id: ADA, appearance: { theme: 'dark' }, sync_enabled: true }],
};

describe.skipIf(!hasDatabase)('importing Supabase accounts', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.owner
      .insertInto('users')
      .values({ email: 'taken@example.com', display_name: 'already here' })
      .execute();
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('keeps ids, leaves passwords empty, and skips a clashing address', async () => {
    const report = await importSupabaseUsers(database.owner, EXPORT);

    expect(report).toEqual({
      imported: 2,
      alreadyPresent: 0,
      emailConflicts: ['taken@example.com'],
      settingsImported: 1,
    });

    const ada = await database.owner
      .selectFrom('users')
      .selectAll()
      .where('id', '=', ADA)
      .executeTakeFirstOrThrow();
    expect(ada).toMatchObject({
      email: 'ada@example.com',
      display_name: 'Ada Lovelace',
      locale: 'en-GB',
      marketing_opt_in: true,
      password_hash: null,
    });
    expect(ada.email_verified_at).not.toBeNull();

    const settings = await database.owner
      .selectFrom('user_settings')
      .select(['user_id', 'appearance', 'sync_enabled'])
      .orderBy('user_id')
      .execute();
    expect(settings.filter((row) => [ADA, GRACE].includes(row.user_id))).toEqual([
      { user_id: ADA, appearance: { theme: 'dark' }, sync_enabled: true },
      { user_id: GRACE, appearance: {}, sync_enabled: false },
    ]);
  });

  it('is safe to run again', async () => {
    const report = await importSupabaseUsers(database.owner, EXPORT);

    expect(report.imported).toBe(0);
    expect(report.alreadyPresent).toBe(2);
  });

  it('lists imported accounts that still need a password, once', async () => {
    const waiting = await accountsAwaitingReset(database.service, 10);
    expect(waiting.sort()).toEqual(['ada@example.com', 'grace@example.com', 'taken@example.com']);

    const ada = await database.owner
      .selectFrom('users')
      .select('id')
      .where('id', '=', ADA)
      .executeTakeFirstOrThrow();
    await database.owner
      .insertInto('email_tokens')
      .values({
        user_id: ada.id,
        kind: 'reset_password',
        token_hash: 'x'.repeat(64),
        expires_at: new Date(Date.now() + 3_600_000),
      })
      .execute();

    expect(await accountsAwaitingReset(database.service, 10)).not.toContain('ada@example.com');
  });
});
