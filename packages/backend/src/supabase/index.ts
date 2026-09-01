import { type EnvRecord, readCloudConfig } from '@noto/config';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';

import type { BackendPorts } from '../ports';
import { AccountService } from '../services/account-service';
import { AuthService, type AuthServiceOptions } from '../services/auth-service';
import {
  SupabaseAuditAdapter,
  SupabaseAuthAdapter,
  SupabaseDeviceAdapter,
  SupabaseProfileAdapter,
  SupabaseRateLimitAdapter,
  SupabaseSettingsAdapter,
} from './adapters';
import { HibpBreachCheck, NoBreachCheck } from './breach-check';

export * from './adapters';
export * from './breach-check';
export * from './rows';

/**
 * The composition root.
 *
 * The one place that knows both which adapters exist and which services need
 * them. Everything else in the package receives its dependencies and never
 * constructs one, which is what keeps the services testable and the wiring
 * inspectable in a single file.
 */

export type NotoSupabaseClient = SupabaseClient;

/**
 * Creates the client, or `null` when the cloud is not configured.
 *
 * `null` is the normal local-first state, not an error: Noto runs with no
 * Supabase environment variables at all, and the repository is configured that
 * way today.
 */
export function createSupabaseClient(env: EnvRecord): NotoSupabaseClient | null {
  const { supabase } = readCloudConfig(env);
  if (!supabase) return null;

  return createClient(supabase.url, supabase.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // PKCE, so desktop and mobile can complete OAuth without a client secret
      // they would have to ship inside the application.
      flowType: 'pkce',
    },
  });
}

export function isCloudConfigured(env: EnvRecord): boolean {
  return readCloudConfig(env).supabase !== null;
}

/** Every port, backed by Supabase. */
export function createSupabasePorts(
  client: SupabaseClient,
  options: { breachCheck?: 'hibp' | 'none' } = {},
): BackendPorts {
  return {
    auth: new SupabaseAuthAdapter(client),
    profiles: new SupabaseProfileAdapter(client),
    devices: new SupabaseDeviceAdapter(client),
    settings: new SupabaseSettingsAdapter(client),
    audit: new SupabaseAuditAdapter(client),
    rateLimit: new SupabaseRateLimitAdapter(client),
    breachCheck: options.breachCheck === 'none' ? new NoBreachCheck() : new HibpBreachCheck(),
  };
}

export interface NotoBackend {
  auth: AuthService;
  account: AccountService;
  ports: BackendPorts;
}

/** Assembles the services from a set of ports. Vendor-agnostic by construction. */
export function createBackend(ports: BackendPorts, options: AuthServiceOptions = {}): NotoBackend {
  return {
    auth: new AuthService(ports, options),
    account: new AccountService(ports),
    ports,
  };
}

/**
 * The whole thing, from an environment.
 *
 * Returns `null` rather than throwing when the cloud is not configured, so the
 * caller's happy path is `if (backend)` instead of a `try`/`catch` around
 * start-up.
 */
export function createSupabaseBackend(
  env: EnvRecord,
  options: AuthServiceOptions & { breachCheck?: 'hibp' | 'none' } = {},
): NotoBackend | null {
  const client = createSupabaseClient(env);
  if (!client) return null;

  const breachCheck = options.breachCheck;

  return createBackend(
    createSupabasePorts(client, breachCheck === undefined ? {} : { breachCheck }),
    options,
  );
}
