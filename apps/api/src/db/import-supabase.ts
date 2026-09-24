import type { Schema } from '@noto/backend/postgres';
import { type Kysely, sql } from 'kysely';
import { z } from 'zod';

/**
 * The one-time move of Supabase accounts into `users` (audit Phase 3, D7).
 *
 * Accounts keep their ids, so anything keyed on a user id elsewhere survives.
 * Passwords do not come across: GoTrue's bcrypt hashes are left behind and
 * `password_hash` is NULL, which signs in exactly like a wrong password until
 * the person sets a new one from the reset mail (`db:send-reset-mails`).
 *
 * Idempotent: an id already present is skipped, and so is an address that
 * already belongs to a different live account (reported, never merged).
 */

const timestamp = z.string().min(1).nullable().optional();

const exportSchema = z.object({
  users: z.array(
    z.object({
      id: z.uuid(),
      email: z.string().min(3).max(254),
      email_confirmed_at: timestamp,
      created_at: z.string().min(1),
      raw_user_meta_data: z
        .object({ display_name: z.string().optional(), locale: z.string().optional() })
        .loose()
        .nullable()
        .optional(),
    }),
  ),
  profiles: z
    .array(
      z.object({
        id: z.uuid(),
        display_name: z.string().min(1).nullable().optional(),
        avatar_url: z.string().nullable().optional(),
        locale: z.string().min(2).max(12).nullable().optional(),
        marketing_opt_in: z.boolean().nullable().optional(),
        onboarded_at: timestamp,
        deleted_at: timestamp,
      }),
    )
    .default([]),
  user_settings: z
    .array(
      z.object({
        user_id: z.uuid(),
        appearance: z.record(z.string(), z.unknown()).default({}),
        editor: z.record(z.string(), z.unknown()).default({}),
        updates: z.record(z.string(), z.unknown()).default({}),
        sync_enabled: z.boolean().default(false),
      }),
    )
    .default([]),
});

export type SupabaseExport = z.input<typeof exportSchema>;

export interface ImportReport {
  imported: number;
  alreadyPresent: number;
  /** Addresses owned by a different live account here. Resolve by hand. */
  emailConflicts: string[];
  settingsImported: number;
}

export async function importSupabaseUsers(
  db: Kysely<Schema>,
  input: unknown,
): Promise<ImportReport> {
  const data = exportSchema.parse(input);
  const profiles = new Map(data.profiles.map((profile) => [profile.id, profile]));
  const settings = new Map(data.user_settings.map((row) => [row.user_id, row]));

  return db.transaction().execute(async (tx) => {
    const report: ImportReport = {
      imported: 0,
      alreadyPresent: 0,
      emailConflicts: [],
      settingsImported: 0,
    };

    for (const user of data.users) {
      const existing = await tx
        .selectFrom('users')
        .select(['id'])
        .where((eb) =>
          eb.or([
            eb('id', '=', user.id),
            eb.and([eb('email', '=', user.email), eb('deleted_at', 'is', null)]),
          ]),
        )
        .execute();

      if (existing.some((row) => row.id === user.id)) {
        report.alreadyPresent += 1;
        continue;
      }
      if (existing.length > 0) {
        report.emailConflicts.push(user.email);
        continue;
      }

      const profile = profiles.get(user.id);
      const displayName = (
        profile?.display_name?.trim() ||
        user.raw_user_meta_data?.display_name?.trim() ||
        user.email.split('@')[0] ||
        'Noto user'
      ).slice(0, 80);

      await tx
        .insertInto('users')
        .values({
          id: user.id,
          email: user.email,
          email_verified_at: user.email_confirmed_at ?? null,
          password_hash: null,
          display_name: displayName,
          avatar_url: profile?.avatar_url ?? null,
          locale: profile?.locale ?? user.raw_user_meta_data?.locale ?? 'en',
          marketing_opt_in: profile?.marketing_opt_in ?? false,
          onboarded_at: profile?.onboarded_at ?? null,
          deleted_at: profile?.deleted_at ?? null,
          created_at: user.created_at,
        })
        .execute();

      const row = settings.get(user.id);
      await tx
        .insertInto('user_settings')
        .values({
          user_id: user.id,
          appearance: JSON.stringify(row?.appearance ?? {}),
          editor: JSON.stringify(row?.editor ?? {}),
          updates: JSON.stringify(row?.updates ?? {}),
          sync_enabled: row?.sync_enabled ?? false,
        })
        .execute();

      if (row) report.settingsImported += 1;
      report.imported += 1;
    }

    return report;
  });
}

/**
 * Imported accounts still waiting for a password: no hash, not deleted, and
 * no reset link that is still live — so running the mailer twice does not
 * mail anyone twice.
 */
export async function accountsAwaitingReset(db: Kysely<Schema>, limit: number): Promise<string[]> {
  const rows = await db
    .selectFrom('users')
    .select(['email'])
    .where('password_hash', 'is', null)
    .where('deleted_at', 'is', null)
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom('email_tokens')
            .select(sql`1`.as('one'))
            .whereRef('email_tokens.user_id', '=', 'users.id')
            .where('email_tokens.kind', '=', 'reset_password')
            .where('email_tokens.consumed_at', 'is', null)
            .where('email_tokens.expires_at', '>', new Date()),
        ),
      ),
    )
    .orderBy('created_at')
    .limit(limit)
    .execute();

  return rows.map((row) => row.email);
}
