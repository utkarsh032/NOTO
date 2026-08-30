import type { Id, IsoDateTime } from './common';

export type DevicePlatform = 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'web';

export interface Device {
  id: Id;
  name: string;
  platform: DevicePlatform;
  /** Operating system as the user would name it, e.g. "Windows 11 Pro". */
  osName: string;
  /** Which build of Noto is installed there. */
  appVersion: string;
  /** Approximate location, from the address the device last connected with. */
  location: string | null;
  lastActiveAt: IsoDateTime;
  /** `true` for the device the application is running on right now. */
  isCurrent: boolean;
}

export type SessionKind = 'desktop' | 'web' | 'mobile';

export interface Session {
  id: Id;
  kind: SessionKind;
  /** The browser or application the session belongs to. */
  client: string;
  location: string | null;
  startedAt: IsoDateTime;
  lastActiveAt: IsoDateTime;
  isCurrent: boolean;
}
