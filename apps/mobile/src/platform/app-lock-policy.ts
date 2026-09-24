/**
 * The rules of the app lock, apart from the native modules that carry them
 * out — so they can be tested without a phone.
 */

/**
 * How long Noto may sit in the background before it locks again.
 *
 * Long enough that sharing an export, answering a notification or checking
 * another app for a moment does not cost an unlock; short enough that a phone
 * put down on a table is locked by the time someone else picks it up.
 */
export const LOCK_GRACE_MS = 30_000;

/** Whether coming back to the foreground should lock Noto. */
export function shouldLockOnReturn(
  enabled: boolean,
  backgroundedAt: number | null,
  now: number,
  graceMs: number = LOCK_GRACE_MS,
): boolean {
  if (!enabled || backgroundedAt === null) return false;
  return now - backgroundedAt >= graceMs;
}

/** `expo-local-authentication`'s `AuthenticationType`, by value. */
const FINGERPRINT = 1;
const FACIAL_RECOGNITION = 2;
const IRIS = 3;

/** `expo-local-authentication`'s `SecurityLevel`, by value. */
const SECURITY_NONE = 0;
const SECURITY_SECRET = 1;

/**
 * What the lock is called on this phone: the words the person already uses for
 * how they unlock it.
 *
 * `null` when the phone has no screen lock at all, in which case there is
 * nothing for Noto to lock with.
 */
export function lockMethodLabel(
  platform: 'ios' | 'android' | string,
  level: number,
  types: readonly number[],
): string | null {
  if (level === SECURITY_NONE) return null;

  const ios = platform === 'ios';

  // Only the PIN, pattern or passcode is set up; no biometrics are enrolled.
  if (level === SECURITY_SECRET) return ios ? 'passcode' : 'screen lock';

  if (types.includes(FACIAL_RECOGNITION)) return ios ? 'Face ID' : 'face unlock';
  if (types.includes(FINGERPRINT)) return ios ? 'Touch ID' : 'fingerprint';
  if (types.includes(IRIS)) return 'iris unlock';

  return ios ? 'passcode' : 'screen lock';
}
