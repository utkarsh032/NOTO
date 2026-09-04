import { ok } from '@noto/core';
import type { Result } from '@noto/types';
import type {
  AuthEventDto,
  AuthSessionDto,
  AuthSignUpDto,
  DeviceDto,
  DeviceRegistrationDto,
  SettingsDto,
  UserDto,
} from '@noto/types/api';
import type { SupabaseClient, User } from '@supabase/supabase-js';

import { fromProviderError } from '../helpers/errors.ts';
import type {
  AuditPort,
  AuthPort,
  DevicePort,
  ProfilePort,
  RateLimitPort,
  SettingsPort,
} from '../ports/index.ts';
import {
  type AuthEventRow,
  type DeviceRow,
  type ProfileRow,
  type SettingsRow,
  toAuthEventDto,
  toDeviceDto,
  toSettingsDto,
  toUserDto,
} from './rows.ts';

/**
 * The adapters.
 *
 * One class per port, each of them thin on purpose: translate, call, translate
 * back, and convert a failure into a `NotoError`. There is no business logic
 * here — if a rule appears in this file it is in the wrong layer, because it
 * would then be untestable without a database and unavailable to any other
 * backend.
 */

// ---------------------------------------------------------------------------

export class SupabaseAuthAdapter implements AuthPort {
  constructor(private readonly client: SupabaseClient) {}

  async signUp(input: {
    email: string;
    password: string;
    displayName?: string;
    locale?: string;
  }): Promise<Result<AuthSignUpDto>> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          ...(input.displayName === undefined ? {} : { display_name: input.displayName }),
          ...(input.locale === undefined ? {} : { locale: input.locale }),
        },
      },
    });

    if (error) return fromProviderError(error, 'Sign-up');
    if (!data.user) return fromProviderError(new Error('no user'), 'Sign-up');

    /*
     * No session is the ordinary outcome when email confirmation is on: the
     * account exists and the person has to answer a mail before they can sign
     * in. Reporting that as a failure told people their sign-up had not worked
     * when it had, and left them unable to try again — the address was taken.
     */
    const session = data.session ? this.toSession(data.session, data.user) : null;

    if (session && !session.ok) return session;

    return ok({
      user: this.toUser(data.user),
      session: session === null ? null : session.value,
      confirmationRequired: data.session === null,
    });
  }

  async signIn(input: { email: string; password: string }): Promise<Result<AuthSessionDto>> {
    const { data, error } = await this.client.auth.signInWithPassword(input);

    if (error) return fromProviderError(error, 'Sign-in');
    return this.toSession(data.session, data.user);
  }

  async signOut(): Promise<Result<void>> {
    const { error } = await this.client.auth.signOut();

    if (error) return fromProviderError(error, 'Sign-out');
    return ok(undefined);
  }

  async refresh(refreshToken: string): Promise<Result<AuthSessionDto>> {
    const { data, error } = await this.client.auth.refreshSession({ refresh_token: refreshToken });

    if (error) return fromProviderError(error, 'Session refresh');
    return this.toSession(data.session, data.user);
  }

  async currentUser(): Promise<Result<UserDto | null>> {
    const { data, error } = await this.client.auth.getUser();

    // "No session" is an answer, not a failure: signed out is a supported state.
    if (error) return ok(null);
    if (!data.user) return ok(null);

    return ok(this.toUser(data.user));
  }

  async requestPasswordReset(email: string): Promise<Result<void>> {
    const { error } = await this.client.auth.resetPasswordForEmail(email);

    // Deliberately reports success either way. Whether the address has an
    // account is not something this endpoint will confirm.
    if (error) return ok(undefined);
    return ok(undefined);
  }

  async updatePassword(input: {
    newPassword: string;
    signOutOtherDevices: boolean;
  }): Promise<Result<void>> {
    const { error } = await this.client.auth.updateUser({ password: input.newPassword });
    if (error) return fromProviderError(error, 'Password update');

    if (input.signOutOtherDevices) {
      // A password change is usually a response to a suspected compromise, so
      // ending the other sessions is the point of it.
      const { error: signOutError } = await this.client.auth.signOut({ scope: 'others' });
      if (signOutError) return fromProviderError(signOutError, 'Signing out other devices');
    }

    return ok(undefined);
  }

  async startOAuth(input: {
    provider: string;
    redirectTo: string;
    codeChallenge: string;
  }): Promise<Result<{ url: string }>> {
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: input.provider as Parameters<
        SupabaseClient['auth']['signInWithOAuth']
      >[0]['provider'],
      options: { redirectTo: input.redirectTo, skipBrowserRedirect: true },
    });

    if (error) return fromProviderError(error, 'OAuth');
    if (!data.url) return fromProviderError(new Error('no url'), 'OAuth');

    return ok({ url: data.url });
  }

  private toSession(
    session: { access_token: string; refresh_token: string; expires_at?: number } | null,
    user: User | null,
  ): Result<AuthSessionDto> {
    if (!session || !user) {
      // Only sign-in and refresh reach this now. Sign-up handles a missing
      // session itself, because there it is the expected outcome rather than
      // a failure.
      return fromProviderError(new Error('no session'), 'Sign-in');
    }

    return ok({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: new Date((session.expires_at ?? 0) * 1000).toISOString(),
      user: this.toUser(user),
      mfaRequired: false,
    });
  }

  private toUser(user: User): UserDto {
    const metadata = user.user_metadata as { display_name?: string; locale?: string };

    return {
      id: user.id,
      email: user.email ?? '',
      displayName: metadata.display_name ?? (user.email ?? '').split('@')[0] ?? '',
      avatarUrl: null,
      locale: metadata.locale ?? 'en',
      emailVerified: Boolean(user.email_confirmed_at),
      mfaEnabled: (user.factors ?? []).length > 0,
      createdAt: user.created_at,
      updatedAt: user.updated_at ?? user.created_at,
    };
  }
}

// ---------------------------------------------------------------------------

export class SupabaseProfileAdapter implements ProfilePort {
  constructor(private readonly client: SupabaseClient) {}

  async get(userId: string): Promise<Result<UserDto>> {
    const { data, error } = await this.client
      .from('profiles')
      .select('id, email, display_name, avatar_url, locale, created_at, updated_at')
      .eq('id', userId)
      .single<ProfileRow>();

    if (error) return fromProviderError(error, 'Loading your profile');

    const auth = await this.client.auth.getUser();

    return ok(
      toUserDto(data, {
        emailVerified: Boolean(auth.data.user?.email_confirmed_at),
        mfaEnabled: (auth.data.user?.factors ?? []).length > 0,
      }),
    );
  }

  async update(
    userId: string,
    patch: { displayName?: string; avatarUrl?: string | null; locale?: string },
  ): Promise<Result<UserDto>> {
    const { error } = await this.client
      .from('profiles')
      .update({
        ...(patch.displayName === undefined ? {} : { display_name: patch.displayName }),
        ...(patch.avatarUrl === undefined ? {} : { avatar_url: patch.avatarUrl }),
        ...(patch.locale === undefined ? {} : { locale: patch.locale }),
      })
      .eq('id', userId);

    if (error) return fromProviderError(error, 'Saving your profile');
    return this.get(userId);
  }
}

// ---------------------------------------------------------------------------

export class SupabaseDeviceAdapter implements DevicePort {
  private static readonly COLUMNS =
    'id, name, platform, os_name, app_version, location, last_active_at, revoked_at';

  constructor(private readonly client: SupabaseClient) {}

  async list(userId: string): Promise<Result<DeviceDto[]>> {
    const { data, error } = await this.client
      .from('devices')
      .select(SupabaseDeviceAdapter.COLUMNS)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('last_active_at', { ascending: false })
      .returns<DeviceRow[]>();

    if (error) return fromProviderError(error, 'Loading your devices');
    return ok(data.map(toDeviceDto));
  }

  async upsert(userId: string, device: DeviceRegistrationDto): Promise<Result<DeviceDto>> {
    const { data, error } = await this.client
      .from('devices')
      .upsert(
        {
          id: device.id,
          user_id: userId,
          name: device.name,
          platform: device.platform,
          os_name: device.osName,
          app_version: device.appVersion,
          last_active_at: new Date().toISOString(),
          // Signing in again on a revoked device un-revokes it: the person
          // proved they own the account, which is what revocation was testing.
          revoked_at: null,
        },
        { onConflict: 'id' },
      )
      .select(SupabaseDeviceAdapter.COLUMNS)
      .single<DeviceRow>();

    if (error) return fromProviderError(error, 'Registering this device');
    return ok(toDeviceDto(data));
  }

  async touch(deviceId: string): Promise<Result<void>> {
    const { error } = await this.client
      .from('devices')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', deviceId);

    if (error) return fromProviderError(error, 'Updating this device');
    return ok(undefined);
  }

  async revoke(userId: string, deviceId: string): Promise<Result<void>> {
    const { error } = await this.client
      .from('devices')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', deviceId)
      .eq('user_id', userId);

    if (error) return fromProviderError(error, 'Signing out that device');
    return ok(undefined);
  }
}

// ---------------------------------------------------------------------------

export class SupabaseSettingsAdapter implements SettingsPort {
  private static readonly COLUMNS = 'appearance, editor, updates, sync_enabled, updated_at';

  constructor(private readonly client: SupabaseClient) {}

  async get(userId: string): Promise<Result<SettingsDto>> {
    const { data, error } = await this.client
      .from('user_settings')
      .select(SupabaseSettingsAdapter.COLUMNS)
      .eq('user_id', userId)
      .single<SettingsRow>();

    if (error) return fromProviderError(error, 'Loading your settings');
    return ok(toSettingsDto(data));
  }

  async update(userId: string, patch: Partial<SettingsDto>): Promise<Result<SettingsDto>> {
    const current = await this.get(userId);
    if (!current.ok) return current;

    // Merged per group rather than replaced wholesale, so a client that does
    // not know about a setting cannot delete it by omission.
    const { error } = await this.client
      .from('user_settings')
      .update({
        appearance: { ...current.value.appearance, ...patch.appearance },
        editor: { ...current.value.editor, ...patch.editor },
        updates: { ...current.value.updates, ...patch.updates },
        ...(patch.syncEnabled === undefined ? {} : { sync_enabled: patch.syncEnabled }),
      })
      .eq('user_id', userId);

    if (error) return fromProviderError(error, 'Saving your settings');
    return this.get(userId);
  }
}

// ---------------------------------------------------------------------------

export class SupabaseAuditAdapter implements AuditPort {
  constructor(private readonly client: SupabaseClient) {}

  async list(userId: string, limit: number): Promise<Result<AuthEventDto[]>> {
    const { data, error } = await this.client
      .from('auth_events')
      .select('id, kind, outcome, created_at, devices ( name, location )')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .returns<AuthEventRow[]>();

    if (error) return fromProviderError(error, 'Loading your security history');
    return ok(data.map(toAuthEventDto));
  }

  async record(event: {
    userId: string | null;
    deviceId?: string | null;
    kind: string;
    outcome: 'success' | 'failure';
    detail?: Record<string, unknown>;
  }): Promise<Result<void>> {
    const { error } = await this.client.from('auth_events').insert({
      user_id: event.userId,
      device_id: event.deviceId ?? null,
      kind: event.kind,
      outcome: event.outcome,
      detail: event.detail ?? {},
    });

    // An audit write that fails must never fail the operation it was recording.
    // Losing one log line is bad; refusing a correct sign-in because of it is
    // worse, and would hand anyone who can break the log a denial of service.
    if (error) return ok(undefined);
    return ok(undefined);
  }
}

// ---------------------------------------------------------------------------

export class SupabaseRateLimitAdapter implements RateLimitPort {
  constructor(private readonly client: SupabaseClient) {}

  async countRecent(key: string, kind: string, withinSeconds: number): Promise<Result<number>> {
    const { data, error } = await this.client.rpc('count_recent_attempts', {
      attempt_key: key,
      attempt_kind: kind,
      within: `${withinSeconds} seconds`,
    });

    if (error) return fromProviderError(error, 'Checking rate limits');
    return ok(typeof data === 'number' ? data : 0);
  }

  async record(key: string, kind: string): Promise<Result<void>> {
    const { error } = await this.client.rpc('record_attempt', {
      attempt_key: key,
      attempt_kind: kind,
    });

    if (error) return fromProviderError(error, 'Recording an attempt');
    return ok(undefined);
  }
}
