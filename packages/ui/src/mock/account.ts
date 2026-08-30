import { APP_VERSION } from '@noto/config';
import type { Device, Session, User } from '@noto/types';

/**
 * Presentation data for Account & Devices.
 *
 * Noto has no account service yet — the application is local-first and works
 * signed out — so the screen is built against this fixture. It is shaped like
 * what an identity provider will return, and read through `useAccount`, so the
 * screens do not change when one arrives.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const NOW = Date.now();
const ago = (ms: number): string => new Date(NOW - ms).toISOString();

export const MOCK_USER: User = {
  id: 'user-1',
  email: 'aman.kumar@example.com',
  displayName: 'Aman Kumar',
  avatarUrl: null,
  createdAt: new Date('2024-02-18T09:12:00Z').toISOString(),
  updatedAt: ago(3 * HOUR),
  deletedAt: null,
};

export const MOCK_DEVICES: Device[] = [
  {
    id: 'device-1',
    name: 'Windows Desktop',
    platform: 'windows',
    osName: 'Windows 11 Pro',
    appVersion: APP_VERSION,
    location: 'Bengaluru, IN',
    lastActiveAt: ago(MINUTE),
    isCurrent: true,
  },
  {
    id: 'device-2',
    name: 'MacBook Pro',
    platform: 'macos',
    osName: 'macOS 15.2',
    appVersion: APP_VERSION,
    location: 'Bengaluru, IN',
    lastActiveAt: ago(5 * HOUR),
    isCurrent: false,
  },
  {
    id: 'device-3',
    name: 'iPhone 15',
    platform: 'ios',
    osName: 'iOS 18.3',
    appVersion: '1.1.0',
    location: 'Bengaluru, IN',
    lastActiveAt: ago(2 * DAY),
    isCurrent: false,
  },
  {
    id: 'device-4',
    name: 'iPad Air',
    platform: 'ios',
    osName: 'iPadOS 18.2',
    appVersion: '1.1.0',
    location: 'Pune, IN',
    lastActiveAt: ago(9 * DAY),
    isCurrent: false,
  },
];

export const MOCK_SESSIONS: Session[] = [
  {
    id: 'session-1',
    kind: 'desktop',
    client: 'Noto for Windows',
    location: 'Bengaluru, IN',
    startedAt: ago(4 * HOUR),
    lastActiveAt: ago(MINUTE),
    isCurrent: true,
  },
  {
    id: 'session-2',
    kind: 'web',
    client: 'Chrome 132 on Windows',
    location: 'Bengaluru, IN',
    startedAt: ago(2 * DAY),
    lastActiveAt: ago(6 * HOUR),
    isCurrent: false,
  },
  {
    id: 'session-3',
    kind: 'mobile',
    client: 'Noto for iOS',
    location: 'Pune, IN',
    startedAt: ago(9 * DAY),
    lastActiveAt: ago(2 * DAY),
    isCurrent: false,
  },
];

export interface AccountPlan {
  name: string;
  description: string;
  /** Bytes included with the plan. */
  storageLimitBytes: number;
  renewsOn: string | null;
}

export const MOCK_PLAN: AccountPlan = {
  name: 'Noto Free',
  description: 'Everything local, on every device you own.',
  storageLimitBytes: 2 * 1024 * 1024 * 1024,
  renewsOn: null,
};

export interface SecurityState {
  passwordChangedAt: string;
  twoFactorEnabled: boolean;
  recoveryEmail: string | null;
}

export const MOCK_SECURITY: SecurityState = {
  passwordChangedAt: ago(64 * DAY),
  twoFactorEnabled: false,
  recoveryEmail: 'a.kumar.recovery@example.com',
};
