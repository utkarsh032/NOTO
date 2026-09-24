import { err, ok } from '@noto/core';
import type { Result } from '@noto/types';
import type { AuthSessionDto, AuthSignUpDto, SessionDto, UserDto } from '@noto/types/api';
import { type Kysely, sql } from 'kysely';

import { randomToken, sha256Hex } from '../helpers/crypto.ts';
import type {
  AuthPort,
  CallerIdentity,
  ClientInfo,
  IdentityPort,
  MailPort,
} from '../ports/index.ts';
import {
  changeEmailMail,
  emailChangedNoticeMail,
  existingAccountMail,
  type MailContent,
  type MailLinks,
  resetPasswordMail,
  verifyEmailMail,
} from '../shared/mail.ts';
import { type PostgresDatabase, Rollback, attempt } from './database.ts';
import { USER_COLUMNS, type UserRow, iso, toSessionDto, toUserDto } from './rows.ts';
import type { EmailTokenKind, Schema } from './schema.ts';

/**
 * Identity, owned: what GoTrue did, on three tables (plan §4.1–§4.3, §9).
 *
 * The rules around sign-in — rate limits, the audit log, constant-time
 * padding — stay in `AuthService` and `IdentityService`. What lives here is
 * the part only storage can do: hashing and checking passwords, issuing and
 * rotating sessions, and the single-use tokens sent by mail.
 *
 * One instance per request. `caller` is the verified identity of whoever sent
 * it, or `null` before sign-in; the few `AuthPort` methods that act on "the
 * current session" read it rather than trusting anything in the request.
 */

/** Hashes passwords. argon2id in production (`apps/api/src/security/passwords.ts`). */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
  deviceId: string | null;
}

/** Issues and checks the short-lived access token. HS256 JWTs in production. */
export interface AccessTokens {
  issue(claims: AccessTokenClaims): Promise<{ token: string; expiresAt: Date }>;
  /** The claims of a genuine, unexpired token; `null` for anything else. */
  verify(token: string): Promise<AccessTokenClaims | null>;
}

export interface PostgresAuthOptions {
  db: PostgresDatabase;
  hasher: PasswordHasher;
  tokens: AccessTokens;
  mail: MailPort;
  links: MailLinks;
  caller?: CallerIdentity | null;
  /** How long a refresh token lives, sliding. Default 30 days. */
  refreshTokenTtlSeconds?: number;
}

type ConsumedToken = { userId: string; kind: 'verify_email' | 'change_email' };

const DAY_SECONDS = 24 * 60 * 60;
const VERIFY_TTL_SECONDS = DAY_SECONDS;
const CHANGE_EMAIL_TTL_SECONDS = DAY_SECONDS;
// Short, because email is not a secure channel and a reset link is a key.
const RESET_TTL_SECONDS = 60 * 60;

/** The one answer every failed sign-in gets, whatever the reason. */
const INVALID_CREDENTIALS = 'That email and password do not match an account.';
const SESSION_ENDED = 'This session has ended. Sign in again.';

/**
 * A hash to check against when the address has no account.
 *
 * Without it, "no such user" returns before argon2 runs and "wrong password"
 * returns after, and the difference in time is an answer to "does this address
 * have an account". One per hasher, computed once.
 */
const dummyHashes = new WeakMap<PasswordHasher, Promise<string>>();

function dummyHash(hasher: PasswordHasher): Promise<string> {
  let hash = dummyHashes.get(hasher);
  if (!hash) {
    hash = hasher.hash(randomToken());
    dummyHashes.set(hasher, hash);
  }

  return hash;
}

/**
 * An address fit for an `inet` column, or `null`.
 *
 * The value comes from a proxy header. A malformed one must cost the session
 * row its IP, not cost the person their sign-in.
 */
function asInet(value: string | undefined): string | null {
  if (!value || value.length > 45) return null;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return value;
  if (value.includes(':') && /^[0-9a-fA-F:.]+$/.test(value)) return value;

  return null;
}

function secondsFromNow(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}

export class PostgresAuthAdapter implements AuthPort, IdentityPort {
  private readonly db: PostgresDatabase;
  private readonly caller: CallerIdentity | null;
  private readonly refreshTtlSeconds: number;

  constructor(private readonly options: PostgresAuthOptions) {
    this.db = options.db;
    this.caller = options.caller ?? null;
    this.refreshTtlSeconds = options.refreshTokenTtlSeconds ?? 30 * DAY_SECONDS;
  }

  // -------------------------------------------------------------------------
  // AuthPort
  // -------------------------------------------------------------------------

  /**
   * Creates an account, unverified, and mails the link that verifies it.
   *
   * An address that already has an account gets the same answer as a new one
   * (plan §9.1): a made-up user and "check your inbox". The inbox is where the
   * two differ — the owner is told they already have an account. The password
   * is hashed in both cases, so the timing does not differ either.
   */
  async signUp(input: {
    email: string;
    password: string;
    displayName?: string;
    locale?: string;
    marketingOptIn?: boolean;
  }): Promise<Result<AuthSignUpDto>> {
    return attempt('Sign-up', async () => {
      const passwordHash = await this.options.hasher.hash(input.password);
      const displayName = input.displayName?.trim() || input.email.split('@')[0] || 'Noto user';
      const verifyToken = randomToken();

      const created = await this.db.asService(async (db) => {
        const user = await db
          .insertInto('users')
          .values({
            email: input.email,
            password_hash: passwordHash,
            display_name: displayName.slice(0, 80),
            ...(input.locale === undefined ? {} : { locale: input.locale }),
            marketing_opt_in: input.marketingOptIn ?? false,
          })
          .onConflict((conflict) =>
            conflict.column('email').where('deleted_at', 'is', null).doNothing(),
          )
          .returning(USER_COLUMNS)
          .executeTakeFirst();

        if (!user) return null;

        await db.insertInto('user_settings').values({ user_id: user.id }).execute();
        await db
          .insertInto('auth_events')
          .values({
            user_id: user.id,
            kind: 'sign_up',
            outcome: 'success',
            detail: JSON.stringify({ provider: 'email' }),
          })
          .execute();
        await this.insertEmailToken(db, user.id, 'verify_email', verifyToken, VERIFY_TTL_SECONDS);

        return user;
      });

      if (!created) {
        await this.sendMail(input.email, existingAccountMail(this.options.links.signIn()));

        const now = new Date().toISOString();
        return ok({
          user: {
            id: crypto.randomUUID(),
            email: input.email,
            displayName,
            avatarUrl: null,
            locale: input.locale ?? 'en',
            emailVerified: false,
            mfaEnabled: false,
            passwordChangedAt: null,
            createdAt: now,
            updatedAt: now,
          },
          session: null,
          confirmationRequired: true,
        });
      }

      await this.sendMail(
        input.email,
        verifyEmailMail(this.options.links.verifyEmail(verifyToken)),
      );

      return ok({ user: toUserDto(created), session: null, confirmationRequired: true });
    });
  }

  /**
   * Checks a password and opens a session (plan §9.2).
   *
   * Every way of failing — no account, no password, wrong password — runs one
   * argon2 verification and returns the same words. The single exception is an
   * unverified address with the right password, which says so, carrying
   * `email_not_confirmed` in the cause for `AuthService` to recognise.
   */
  async signIn(input: {
    email: string;
    password: string;
    deviceId?: string;
    client?: ClientInfo;
  }): Promise<Result<AuthSessionDto>> {
    return attempt('Sign-in', async () => {
      const account = await this.db.asService((db) =>
        db
          .selectFrom('users')
          .select([...USER_COLUMNS, 'password_hash'])
          .where('email', '=', input.email)
          .where('deleted_at', 'is', null)
          .executeTakeFirst(),
      );

      const hash = account?.password_hash ?? (await dummyHash(this.options.hasher));
      const matches = await this.options.hasher.verify(hash, input.password);

      if (!account || !account.password_hash || !matches) {
        return err('permission_denied', INVALID_CREDENTIALS);
      }

      if (account.email_verified_at === null) {
        return err(
          'permission_denied',
          'Confirm your email address before signing in. Check your inbox for the link.',
          { code: 'email_not_confirmed' },
        );
      }

      // The row keeps the token's hash, never the token: a copy of this table
      // must not be a set of keys to other people's accounts.
      const refreshToken = randomToken();
      const refreshTokenHash = await sha256Hex(refreshToken);

      const session = await this.db.asService((db) =>
        db
          .insertInto('sessions')
          .values({
            user_id: account.id,
            device_id: input.deviceId ?? null,
            refresh_token_hash: refreshTokenHash,
            user_agent: input.client?.userAgent?.slice(0, 400) ?? null,
            ip: asInet(input.client?.ip),
            expires_at: secondsFromNow(this.refreshTtlSeconds),
          })
          .returning(['id', 'device_id'])
          .executeTakeFirstOrThrow(),
      );

      return ok(await this.sessionDto(account, session.id, session.device_id, refreshToken));
    });
  }

  /** Ends the caller's own session. Signed out already is not a failure. */
  async signOut(): Promise<Result<void>> {
    if (!this.caller) return ok(undefined);
    const { userId, sessionId } = this.caller;

    return attempt('Sign-out', async () => {
      await this.revokeSessions(userId, 'signout', sessionId);
      return ok(undefined);
    });
  }

  /**
   * Rotates a refresh token (plan §9.3).
   *
   * The token presented is looked up by its hash. A match rotates it: the old
   * hash moves to `previous_token_hash` and a new token is issued. No match,
   * but a match on some session's *previous* hash, means a token that was
   * already rotated has been presented again — so two parties hold it, and one
   * of them is not the owner. Every session the user has is revoked, on
   * purpose, and the real person signs in again.
   *
   * The whole check runs in one transaction with the row locked, so two
   * concurrent refreshes of the same token cannot both succeed.
   */
  async refresh(refreshToken: string): Promise<Result<AuthSessionDto>> {
    return attempt('Session refresh', async () => {
      const presented = await sha256Hex(refreshToken);
      const next = randomToken();
      const nextHash = await sha256Hex(next);

      const outcome = await this.db.asService(async (db) => {
        const current = await db
          .selectFrom('sessions')
          .select(['id', 'user_id', 'device_id', 'expires_at', 'revoked_at'])
          .where('refresh_token_hash', '=', presented)
          .forUpdate()
          .executeTakeFirst();

        if (!current) {
          const replayed = await db
            .selectFrom('sessions')
            .select(['user_id'])
            .where('previous_token_hash', '=', presented)
            .executeTakeFirst();

          if (replayed) {
            await db
              .updateTable('sessions')
              .set({ revoked_at: new Date(), revoked_reason: 'reuse_detected' })
              .where('user_id', '=', replayed.user_id)
              .where('revoked_at', 'is', null)
              .execute();

            return { kind: 'reused' as const, userId: replayed.user_id };
          }

          return { kind: 'unknown' as const };
        }

        if (current.revoked_at !== null || current.expires_at.getTime() <= Date.now()) {
          return { kind: 'ended' as const };
        }

        const user = await db
          .selectFrom('users')
          .select(USER_COLUMNS)
          .where('id', '=', current.user_id)
          .where('deleted_at', 'is', null)
          .executeTakeFirst();

        if (!user) return { kind: 'ended' as const };

        await db
          .updateTable('sessions')
          .set({
            previous_token_hash: presented,
            refresh_token_hash: nextHash,
            rotated_at: new Date(),
            expires_at: secondsFromNow(this.refreshTtlSeconds),
          })
          .where('id', '=', current.id)
          .execute();

        return {
          kind: 'rotated' as const,
          user,
          sessionId: current.id,
          deviceId: current.device_id,
        };
      });

      switch (outcome.kind) {
        case 'rotated':
          return ok(await this.sessionDto(outcome.user, outcome.sessionId, outcome.deviceId, next));
        case 'reused':
          return err('permission_denied', SESSION_ENDED, {
            code: 'refresh_token_reused',
            userId: outcome.userId,
          });
        default:
          return err('permission_denied', SESSION_ENDED);
      }
    });
  }

  /** The caller, read as the caller — row-level security applies. */
  async currentUser(): Promise<Result<UserDto | null>> {
    if (!this.caller) return ok(null);
    const { userId } = this.caller;

    return attempt('Loading your account', async () => {
      const user = await this.db.asUser(userId, (db) =>
        db
          .selectFrom('users')
          .select(USER_COLUMNS)
          .where('id', '=', userId)
          .where('deleted_at', 'is', null)
          .executeTakeFirst(),
      );

      return ok(user ? toUserDto(user) : null);
    });
  }

  /**
   * Mails a reset link, if the address has an account.
   *
   * Always succeeds, whether it does or not. Issuing a token invalidates every
   * earlier unused one, so a run of "forgot password" mails leaves one live key
   * behind, not a dozen.
   */
  async requestPasswordReset(email: string): Promise<Result<void>> {
    const token = randomToken();

    const result = await attempt('Password reset', async () => {
      const issued = await this.db.asService(async (db) => {
        const user = await this.liveUserByEmail(db, email);
        if (!user) return false;

        await this.insertEmailToken(db, user.id, 'reset_password', token, RESET_TTL_SECONDS);
        return true;
      });

      if (issued) {
        await this.sendMail(email, resetPasswordMail(this.options.links.resetPassword(token)));
      }

      return ok(undefined);
    });

    if (!result.ok)
      console.error(JSON.stringify({ passwordReset: 'failed', code: result.error.code }));
    return ok(undefined);
  }

  /** Changes the caller's password. The rules are applied by `AuthService` first. */
  async updatePassword(input: {
    newPassword: string;
    signOutOtherDevices: boolean;
  }): Promise<Result<void>> {
    if (!this.caller) return err('permission_denied', 'Sign in to change your password.');

    return this.changePassword(
      this.caller.userId,
      input.newPassword,
      input.signOutOtherDevices ? this.caller.sessionId : null,
    );
  }

  /** Not built yet (plan §4.4). Kept on the interface for the Supabase adapter's sake. */
  async startOAuth(): Promise<Result<{ url: string }>> {
    return err('invalid_input', 'Signing in with another account provider is not available yet.');
  }

  // -------------------------------------------------------------------------
  // IdentityPort
  // -------------------------------------------------------------------------

  /**
   * Checks an access token, then that its session is still live.
   *
   * The signature alone would do for fifteen minutes. Checking the row as well
   * means signing out, revoking a device or resetting a password takes effect
   * on the next request rather than whenever the token happens to expire — one
   * indexed lookup per request is a small price for that.
   */
  async authenticate(accessToken: string): Promise<Result<CallerIdentity | null>> {
    const claims = await this.options.tokens.verify(accessToken);
    if (!claims) return ok(null);

    return attempt('Checking your session', async () => {
      const session = await this.db.asService((db) =>
        db
          .selectFrom('sessions')
          .select(['id', 'user_id', 'device_id'])
          .where('id', '=', claims.sessionId)
          .where('user_id', '=', claims.userId)
          .where('revoked_at', 'is', null)
          .where('expires_at', '>', new Date())
          .executeTakeFirst(),
      );

      if (!session) return ok(null);

      return ok({ userId: session.user_id, sessionId: session.id, deviceId: session.device_id });
    });
  }

  async listSessions(userId: string): Promise<Result<SessionDto[]>> {
    return attempt('Loading your sessions', async () => {
      const rows = await this.db.asService((db) =>
        db
          .selectFrom('sessions')
          .leftJoin('devices', (join) =>
            join
              .onRef('devices.id', '=', 'sessions.device_id')
              .onRef('devices.user_id', '=', 'sessions.user_id'),
          )
          .select([
            'sessions.id',
            'sessions.user_agent',
            'sessions.created_at',
            'sessions.rotated_at',
            'devices.name as device_name',
            'devices.platform as device_platform',
            'devices.app_version as device_app_version',
            'devices.location as device_location',
          ])
          .where('sessions.user_id', '=', userId)
          .where('sessions.revoked_at', 'is', null)
          .where('sessions.expires_at', '>', new Date())
          .orderBy(sql`coalesce(sessions.rotated_at, sessions.created_at)`, 'desc')
          .execute(),
      );

      return ok(rows.map(toSessionDto));
    });
  }

  async signOutSession(userId: string, sessionId: string): Promise<Result<void>> {
    return attempt('Signing out that session', async () => {
      const ended = await this.revokeSessions(userId, 'signout', sessionId);

      return ended > 0 ? ok(undefined) : err('not_found', 'That session was not found.');
    });
  }

  async signOutAll(userId: string): Promise<Result<void>> {
    return attempt('Signing out everywhere', async () => {
      await this.revokeSessions(userId, 'signout_all');
      return ok(undefined);
    });
  }

  async verifyPassword(userId: string, password: string): Promise<Result<boolean>> {
    return attempt('Checking your password', async () => {
      const user = await this.db.asService((db) =>
        db
          .selectFrom('users')
          .select(['password_hash'])
          .where('id', '=', userId)
          .where('deleted_at', 'is', null)
          .executeTakeFirst(),
      );

      const hash = user?.password_hash ?? (await dummyHash(this.options.hasher));
      const matches = await this.options.hasher.verify(hash, password);

      return ok(Boolean(user?.password_hash) && matches);
    });
  }

  /**
   * Consumes a verification or email-change token and applies it.
   *
   * The token is spent by an `UPDATE … WHERE consumed_at IS NULL RETURNING`,
   * not a `SELECT` then an `UPDATE`, so two clicks on the same link cannot both
   * succeed. For an email change, the account moves in the same transaction;
   * if the new address has been taken since, the whole thing rolls back and
   * the token stays unspent.
   */
  async consumeEmailToken(token: string): Promise<Result<ConsumedToken>> {
    const hash = await sha256Hex(token);
    let noticeTo: string | null = null;

    const result = await attempt('Confirming your email address', async () =>
      this.db.asService(async (db): Promise<Result<ConsumedToken>> => {
        const spent = await db
          .updateTable('email_tokens')
          .set({ consumed_at: new Date() })
          .where('token_hash', '=', hash)
          .where('kind', 'in', ['verify_email', 'change_email'])
          .where('consumed_at', 'is', null)
          .where('expires_at', '>', new Date())
          .returning(['user_id', 'kind', 'new_email'])
          .executeTakeFirst();

        if (!spent) {
          return err('not_found', 'That link has expired or has already been used.');
        }

        if (spent.kind === 'verify_email') {
          await db
            .updateTable('users')
            .set({ email_verified_at: sql`coalesce(email_verified_at, now())` as never })
            .where('id', '=', spent.user_id)
            .execute();

          return ok({ userId: spent.user_id, kind: 'verify_email' as const });
        }

        const previous = await db
          .selectFrom('users')
          .select(['email'])
          .where('id', '=', spent.user_id)
          .executeTakeFirstOrThrow();

        const moved = await db
          .updateTable('users')
          .set({ email: spent.new_email ?? previous.email, email_verified_at: new Date() })
          .where('id', '=', spent.user_id)
          .where('deleted_at', 'is', null)
          .executeTakeFirst();

        if (Number(moved.numUpdatedRows) === 0) {
          throw new Rollback(err('not_found', 'That account no longer exists.'));
        }

        noticeTo = previous.email;
        return ok({ userId: spent.user_id, kind: 'change_email' as const });
      }),
    );

    // After the commit, not inside it: the old address is told only about a
    // change that actually happened.
    if (result.ok && noticeTo !== null) await this.sendMail(noticeTo, emailChangedNoticeMail());

    return result;
  }

  async resendVerification(email: string): Promise<Result<void>> {
    const token = randomToken();

    return attempt('Sending the verification mail', async () => {
      const issued = await this.db.asService(async (db) => {
        const user = await this.liveUserByEmail(db, email);
        if (!user || user.email_verified_at !== null) return false;

        await this.insertEmailToken(db, user.id, 'verify_email', token, VERIFY_TTL_SECONDS);
        return true;
      });

      if (issued) {
        await this.sendMail(email, verifyEmailMail(this.options.links.verifyEmail(token)));
      }

      return ok(undefined);
    });
  }

  /**
   * Sets a password from a reset link (plan §9.4), and ends every session.
   *
   * Following the link proves control of the mailbox, which is what verifying
   * an address proves, so an unverified account comes out verified.
   */
  async resetPassword(token: string, newPassword: string): Promise<Result<{ userId: string }>> {
    const hash = await sha256Hex(token);

    return attempt('Resetting your password', async () => {
      const passwordHash = await this.options.hasher.hash(newPassword);

      return this.db.asService(async (db) => {
        const spent = await db
          .updateTable('email_tokens')
          .set({ consumed_at: new Date() })
          .where('token_hash', '=', hash)
          .where('kind', '=', 'reset_password')
          .where('consumed_at', 'is', null)
          .where('expires_at', '>', new Date())
          .returning(['user_id'])
          .executeTakeFirst();

        if (!spent) return err('not_found', 'That link has expired or has already been used.');

        await db
          .updateTable('users')
          .set({
            password_hash: passwordHash,
            password_changed_at: new Date(),
            email_verified_at: sql`coalesce(email_verified_at, now())` as never,
          })
          .where('id', '=', spent.user_id)
          .execute();

        await db
          .updateTable('sessions')
          .set({ revoked_at: new Date(), revoked_reason: 'password_changed' })
          .where('user_id', '=', spent.user_id)
          .where('revoked_at', 'is', null)
          .execute();

        return ok({ userId: spent.user_id });
      });
    });
  }

  async changePassword(
    userId: string,
    newPassword: string,
    keepSessionId: string | null,
  ): Promise<Result<void>> {
    return attempt('Changing your password', async () => {
      const passwordHash = await this.options.hasher.hash(newPassword);

      await this.db.asService(async (db) => {
        await db
          .updateTable('users')
          .set({ password_hash: passwordHash, password_changed_at: new Date() })
          .where('id', '=', userId)
          .execute();

        if (keepSessionId !== null) {
          await db
            .updateTable('sessions')
            .set({ revoked_at: new Date(), revoked_reason: 'password_changed' })
            .where('user_id', '=', userId)
            .where('id', '!=', keepSessionId)
            .where('revoked_at', 'is', null)
            .execute();
        }
      });

      return ok(undefined);
    });
  }

  async requestEmailChange(userId: string, newEmail: string): Promise<Result<void>> {
    const token = randomToken();

    return attempt('Changing your email address', async () => {
      const outcome = await this.db.asService(async (db) => {
        const taken = await this.liveUserByEmail(db, newEmail);
        if (taken) return taken.id === userId ? 'same' : 'taken';

        await this.insertEmailToken(
          db,
          userId,
          'change_email',
          token,
          CHANGE_EMAIL_TTL_SECONDS,
          newEmail,
        );
        return 'issued';
      });

      if (outcome === 'same') return err('invalid_input', 'That is already your email address.');
      if (outcome === 'taken') return err('conflict', 'That address is already in use.');

      await this.sendMail(newEmail, changeEmailMail(this.options.links.verifyEmail(token)));
      return ok(undefined);
    });
  }

  // -------------------------------------------------------------------------

  private async sessionDto(
    user: UserRow,
    sessionId: string,
    deviceId: string | null,
    refreshToken: string,
  ): Promise<AuthSessionDto> {
    const access = await this.options.tokens.issue({ userId: user.id, sessionId, deviceId });

    return {
      accessToken: access.token,
      expiresAt: iso(access.expiresAt),
      refreshToken,
      user: toUserDto(user),
      mfaRequired: false,
    };
  }

  /** Issues a mailed token, spending every earlier unused one of the same kind. */
  private async insertEmailToken(
    db: Kysely<Schema>,
    userId: string,
    kind: EmailTokenKind,
    token: string,
    ttlSeconds: number,
    newEmail: string | null = null,
  ): Promise<void> {
    await db
      .updateTable('email_tokens')
      .set({ consumed_at: new Date() })
      .where('user_id', '=', userId)
      .where('kind', '=', kind)
      .where('consumed_at', 'is', null)
      .execute();

    await db
      .insertInto('email_tokens')
      .values({
        user_id: userId,
        kind,
        token_hash: await sha256Hex(token),
        new_email: newEmail,
        expires_at: secondsFromNow(ttlSeconds),
      })
      .execute();
  }

  private liveUserByEmail(db: Kysely<Schema>, email: string) {
    return db
      .selectFrom('users')
      .select(['id', 'email_verified_at'])
      .where('email', '=', email)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  /**
   * Revokes the user's live sessions — one of them when `sessionId` is given,
   * otherwise all. Returns how many ended.
   */
  private async revokeSessions(
    userId: string,
    reason: string,
    sessionId?: string,
  ): Promise<number> {
    const result = await this.db.asService((db) => {
      let query = db
        .updateTable('sessions')
        .set({ revoked_at: new Date(), revoked_reason: reason })
        .where('user_id', '=', userId)
        .where('revoked_at', 'is', null);
      if (sessionId !== undefined) query = query.where('id', '=', sessionId);

      return query.executeTakeFirst();
    });

    return Number(result.numUpdatedRows);
  }

  /**
   * Sends a message, and never fails the operation because of it.
   *
   * The account change has already happened by the time mail goes out. A mail
   * provider outage should cost a resend, not an error for something that
   * worked — so the failure is logged and swallowed.
   */
  private async sendMail(to: string, content: MailContent): Promise<void> {
    const sent = await this.options.mail.send({ to, ...content });
    if (!sent.ok) {
      console.error(
        JSON.stringify({ mail: 'failed', subject: content.subject, code: sent.error.code }),
      );
    }
  }
}
