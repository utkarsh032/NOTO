import { APP_VERSION } from '@noto/config';
import type { DevicePlatform } from '@noto/types';
import type { DeviceRegistrationDto } from '@noto/types/api';

/**
 * This computer, as the account screen will list it.
 *
 * Shared by both cloud modules during the cutover, so the device id survives
 * the switch and the account screen shows one computer rather than two.
 */

const DEVICE_ID_KEY = 'noto.device.id';

/**
 * This installation's id.
 *
 * In the renderer's localStorage, which Electron keeps in the application's
 * user-data directory — so it survives signing out, and a reinstall that clears
 * that directory is honestly a new device.
 */
export function deviceId(): string {
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;

  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, created);

  return created;
}

/**
 * Which desktop this is.
 *
 * Read from the user agent rather than asked of the main process: Electron's
 * renderer reports the real platform there, and one synchronous string beats an
 * IPC round trip for something that cannot change while the window is open.
 */
function platform(): DevicePlatform {
  const agent = navigator.userAgent;
  if (agent.includes('Windows')) return 'windows';
  if (agent.includes('Mac OS X')) return 'macos';

  return 'linux';
}

function osName(): string {
  switch (platform()) {
    case 'windows':
      return 'Windows';
    case 'macos':
      return 'macOS';
    default:
      return 'Linux';
  }
}

export function device(): DeviceRegistrationDto {
  return {
    id: deviceId(),
    name: `${osName()} desktop`,
    platform: platform(),
    osName: osName(),
    appVersion: APP_VERSION,
  };
}
