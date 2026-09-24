import { APP_VERSION } from '@noto/config';
import type { DeviceRegistrationDto } from '@noto/types/api';

/**
 * This browser, as the account screen will list it.
 *
 * Shared by both cloud modules — the Supabase one being retired and the
 * `apps/api` one replacing it — so that switching backends keeps the same
 * device id, and the account screen shows one browser rather than two.
 */

const DEVICE_ID_KEY = 'noto.device.id';

/**
 * This installation's id.
 *
 * Generated here and kept in local storage, so signing out and back in is the
 * same device while a reinstall is a new one. That is what makes the device
 * list on the account screen a list of installations rather than of sessions.
 */
export function deviceId(): string {
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;

  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, created);

  return created;
}

/** A readable name for this browser. Coarse on purpose; it is a label, not a fingerprint. */
function browserName(): string {
  const agent = navigator.userAgent;
  if (agent.includes('Edg/')) return 'Edge';
  if (agent.includes('Chrome/') && !agent.includes('Chromium')) return 'Chrome';
  if (agent.includes('Firefox/')) return 'Firefox';
  if (agent.includes('Safari/')) return 'Safari';

  return 'Browser';
}

function osName(): string {
  const agent = navigator.userAgent;
  if (agent.includes('Windows')) return 'Windows';
  if (agent.includes('Mac OS X')) return 'macOS';
  if (agent.includes('Android')) return 'Android';
  if (agent.includes('Linux')) return 'Linux';

  return 'Unknown';
}

export function device(): DeviceRegistrationDto {
  return {
    id: deviceId(),
    name: browserName(),
    platform: 'web',
    osName: osName(),
    appVersion: APP_VERSION,
  };
}
