import { err, ok } from '@noto/core';
import type { Result } from '@noto/types';
import type {
  AuthEventDto,
  DeviceDto,
  DeviceRegistrationDto,
  SettingsDto,
  UserDto,
} from '@noto/types/api';
import { type Kysely, sql } from 'kysely';

import type {
  AuditPort,
  DevicePort,
  ProfilePatch,
  ProfilePort,
  RateLimitPort,
  SettingsPort,
} from '../ports/index.ts';
import { type PostgresDatabase, attempt } from './database.ts';
import {
  DEVICE_COLUMNS,
  USER_COLUMNS,
  toAuthEventDto,
  toDeviceDto,
  toSettingsDto,
  toUserDto,
} from './rows.ts';
import type { Schema } from './schema.ts';

/**
 * The account adapters.
 *
 * The Postgres twins of `src/supabase/adapters.ts`, and as thin: translate,
 * query, translate back. Everything a person does to their own account runs
 * through `asUser`, so row-level security is the net under every query here;
 * only the security log's writes and the rate-limit counters, which a person
 * must not be able to touch, use `asService`.
 */

// ---------------------------------------------------------------------------

export class PostgresProfileAdapter implements ProfilePort {
  constructor(private readonly db: PostgresDatabase) {}

  async get(userId: string): Promise<Result<UserDto>> {
    return attempt('Loading your profile', async () => {
      const user = await this.db.asUser(userId, (db) =>
        db
          .selectFrom('users')
          .select(USER_COLUMNS)
          .where('id', '=', userId)
          .where('deleted_at', 'is', null)
          .executeTakeFirst(),
      );

      return user ? ok(toUserDto(user)) : err('not_found', 'Loading your profile: not found.');
    });
  }

  async update(userId: string, patch: ProfilePatch): Promise<Result<UserDto>> {
    const changes = {
      ...(patch.displayName === undefined ? {} : { display_name: patch.displayName }),
      ...(patch.avatarUrl === undefined ? {} : { avatar_url: patch.avatarUrl }),
      ...(patch.locale === undefined ? {} : { locale: patch.locale }),
      ...(patch.marketingOptIn === undefined ? {} : { marketing_opt_in: patch.marketingOptIn }),
    };

    if (Object.keys(changes).length === 0) return this.get(userId);

    return attempt('Saving your profile', async () => {
      const user = await this.db.asUser(userId, (db) =>
        db
          .updateTable('users')
          .set(changes)
          .where('id', '=', userId)
          .where('deleted_at', 'is', null)
          .returning(USER_COLUMNS)
          .executeTakeFirst(),
      );

      return user ? ok(toUserDto(user)) : err('not_found', 'Saving your profile: not found.');
    });
  }
}

// ---------------------------------------------------------------------------

export class PostgresDeviceAdapter implements DevicePort {
  /**
   * @param privileged Sign-in's instance. A fresh sign-in on a revoked device
   *   un-revokes it — the person just proved they own the account — and only
   *   the service role may clear `revoked_at` (0007_roles_rls.sql). Every other
   *   caller registers as themselves, and RLS applies.
   */
  constructor(
    private readonly db: PostgresDatabase,
    private readonly options: { privileged?: boolean } = {},
  ) {}

  async list(userId: string): Promise<Result<DeviceDto[]>> {
    return attempt('Loading your devices', async () => {
      const rows = await this.db.asUser(userId, (db) =>
        db
          .selectFrom('devices')
          .select(DEVICE_COLUMNS)
          .where('user_id', '=', userId)
          .where('deleted_at', 'is', null)
          .orderBy('last_active_at', 'desc')
          .execute(),
      );

      return ok(rows.map(toDeviceDto));
    });
  }

  /**
   * Registers a device for its owner, and only for its owner.
   *
   * Two statements, each safe on its own (the S1 fix, carried over from the
   * Supabase adapter): update the row only where it already belongs to this
   * user; otherwise insert — and a primary-key collision then means the id is
   * somebody else's, which is refused rather than taken over.
   */
  async upsert(userId: string, device: DeviceRegistrationDto): Promise<Result<DeviceDto>> {
    const privileged = this.options.privileged ?? false;
    const fields = {
      name: device.name,
      os_name: device.osName,
      app_version: device.appVersion,
      last_active_at: new Date(),
    };

    const register = async (db: Kysely<Schema>) => {
      const updated = await db
        .updateTable('devices')
        .set(privileged ? { ...fields, revoked_at: null } : fields)
        .where('id', '=', device.id)
        .where('user_id', '=', userId)
        .returning(DEVICE_COLUMNS)
        .executeTakeFirst();

      if (updated) return updated;

      return db
        .insertInto('devices')
        .values({ id: device.id, user_id: userId, platform: device.platform, ...fields })
        .returning(DEVICE_COLUMNS)
        .executeTakeFirstOrThrow();
    };

    const result = await attempt('Registering this device', async () => {
      const row = privileged
        ? await this.db.asService(register)
        : await this.db.asUser(userId, register);

      return ok(toDeviceDto(row));
    });

    if (!result.ok && result.error.code === 'conflict') {
      return err('conflict', 'Registering this device: that device id is already in use.');
    }

    return result;
  }

  async touch(deviceId: string): Promise<Result<void>> {
    return attempt('Updating this device', async () => {
      await this.db.asService((db) =>
        db
          .updateTable('devices')
          .set({ last_active_at: new Date() })
          .where('id', '=', deviceId)
          .execute(),
      );

      return ok(undefined);
    });
  }

  /**
   * Signs a device out: the row is marked revoked and every session opened on
   * it ends, so the device cannot refresh its way back in.
   */
  async revoke(userId: string, deviceId: string): Promise<Result<void>> {
    return attempt('Signing out that device', async () => {
      const revoked = await this.db.asUser(userId, (db) =>
        db
          .updateTable('devices')
          .set({ revoked_at: new Date() })
          .where('id', '=', deviceId)
          .where('user_id', '=', userId)
          .where('deleted_at', 'is', null)
          .returning(['id'])
          .executeTakeFirst(),
      );

      if (!revoked) return err('not_found', 'That device was not found.');

      await this.db.asService((db) =>
        db
          .updateTable('sessions')
          .set({ revoked_at: new Date(), revoked_reason: 'device_revoked' })
          .where('user_id', '=', userId)
          .where('device_id', '=', deviceId)
          .where('revoked_at', 'is', null)
          .execute(),
      );

      return ok(undefined);
    });
  }
}

// ---------------------------------------------------------------------------

export class PostgresSettingsAdapter implements SettingsPort {
  constructor(private readonly db: PostgresDatabase) {}

  async get(userId: string): Promise<Result<SettingsDto>> {
    return attempt('Loading your settings', async () => {
      const row = await this.db.asUser(userId, (db) =>
        db
          .selectFrom('user_settings')
          .select(['appearance', 'editor', 'updates', 'sync_enabled', 'updated_at'])
          .where('user_id', '=', userId)
          .executeTakeFirst(),
      );

      return row ? ok(toSettingsDto(row)) : err('not_found', 'Loading your settings: not found.');
    });
  }

  /**
   * Merges a patch per group, in one transaction with the row locked, so a
   * client that does not know about a setting cannot delete it by omission and
   * two devices saving at once cannot lose each other's change.
   */
  async update(userId: string, patch: Partial<SettingsDto>): Promise<Result<SettingsDto>> {
    return attempt('Saving your settings', async () => {
      const row = await this.db.asUser(userId, async (db) => {
        const current = await db
          .selectFrom('user_settings')
          .select(['appearance', 'editor', 'updates'])
          .where('user_id', '=', userId)
          .forUpdate()
          .executeTakeFirst();

        if (!current) return undefined;

        return db
          .updateTable('user_settings')
          .set({
            appearance: JSON.stringify({ ...current.appearance, ...patch.appearance }),
            editor: JSON.stringify({ ...current.editor, ...patch.editor }),
            updates: JSON.stringify({ ...current.updates, ...patch.updates }),
            ...(patch.syncEnabled === undefined ? {} : { sync_enabled: patch.syncEnabled }),
          })
          .where('user_id', '=', userId)
          .returning(['appearance', 'editor', 'updates', 'sync_enabled', 'updated_at'])
          .executeTakeFirstOrThrow();
      });

      return row ? ok(toSettingsDto(row)) : err('not_found', 'Saving your settings: not found.');
    });
  }
}

// ---------------------------------------------------------------------------

export class PostgresAuditAdapter implements AuditPort {
  constructor(private readonly db: PostgresDatabase) {}

  async list(userId: string, limit: number): Promise<Result<AuthEventDto[]>> {
    return attempt('Loading your security history', async () => {
      const rows = await this.db.asUser(userId, (db) =>
        db
          .selectFrom('auth_events')
          .leftJoin('devices', 'devices.id', 'auth_events.device_id')
          .select([
            'auth_events.id',
            'auth_events.kind',
            'auth_events.outcome',
            'auth_events.created_at',
            'devices.name as device_name',
            'devices.location as device_location',
          ])
          .where('auth_events.user_id', '=', userId)
          .orderBy('auth_events.created_at', 'desc')
          .orderBy('auth_events.id', 'desc')
          .limit(limit)
          .execute(),
      );

      return ok(rows.map(toAuthEventDto));
    });
  }

  /**
   * Appends to the security log.
   *
   * A failed write never fails the operation it was recording — refusing a
   * correct sign-in because the log was down would hand anyone who can break
   * the log a denial of service. It is reported, though (audit S10): a log that
   * silently stops is worse than one that says so.
   */
  async record(event: {
    userId: string | null;
    deviceId?: string | null;
    kind: string;
    outcome: 'success' | 'failure';
    detail?: Record<string, unknown>;
  }): Promise<Result<void>> {
    const written = await attempt('Writing the security log', async () => {
      await this.db.asService((db) =>
        db
          .insertInto('auth_events')
          .values({
            user_id: event.userId,
            device_id: event.deviceId ?? null,
            kind: event.kind,
            outcome: event.outcome,
            detail: JSON.stringify(event.detail ?? {}),
          })
          .execute(),
      );

      return ok(undefined);
    });

    if (!written.ok) {
      console.error(
        JSON.stringify({ audit: 'dropped', kind: event.kind, code: written.error.code }),
      );
    }

    return ok(undefined);
  }
}

// ---------------------------------------------------------------------------

export class PostgresRateLimitAdapter implements RateLimitPort {
  constructor(private readonly db: PostgresDatabase) {}

  async countRecent(key: string, kind: string, withinSeconds: number): Promise<Result<number>> {
    return attempt('Checking rate limits', async () => {
      const row = await this.db.asService((db) =>
        db
          .selectFrom('auth_attempts')
          .select((eb) => eb.fn.countAll<string>().as('count'))
          .where('key', '=', key)
          .where('kind', '=', kind)
          .where('attempted_at', '>', sql<Date>`now() - make_interval(secs => ${withinSeconds})`)
          .executeTakeFirstOrThrow(),
      );

      return ok(Number(row.count));
    });
  }

  async record(key: string, kind: string): Promise<Result<void>> {
    return attempt('Recording an attempt', async () => {
      await this.db.asService((db) =>
        db.insertInto('auth_attempts').values({ key, kind }).execute(),
      );
      return ok(undefined);
    });
  }
}
