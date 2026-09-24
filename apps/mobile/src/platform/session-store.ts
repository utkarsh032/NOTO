import * as SecureStore from 'expo-secure-store';

/**
 * The signed-in session, kept in the platform's secure storage — the Keychain
 * on iOS, Keystore-encrypted preferences on Android — rather than in the
 * WebView's localStorage, which is a plain file any backup can carry.
 *
 * The interface asks for it over the bridge (`session.*`); it never holds the
 * refresh token anywhere but in memory.
 */

const KEY = 'noto.session';

const OPTIONS: SecureStore.SecureStoreOptions = {
  /*
   * Readable once the phone has been unlocked since it started, so a refresh
   * can run while Noto is in the background. `THIS_DEVICE_ONLY` keeps it out of
   * backups and off a new phone restored from one: a session belongs to the
   * device it was signed in on, and the server lists it as that device.
   */
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/** Far larger than two tokens and a date; anything bigger is not a session. */
const MAX_LENGTH = 8_192;

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false;
  const { accessToken, refreshToken, expiresAt } = value as Record<string, unknown>;
  return (
    typeof accessToken === 'string' &&
    accessToken !== '' &&
    typeof refreshToken === 'string' &&
    refreshToken !== '' &&
    typeof expiresAt === 'string' &&
    !Number.isNaN(Date.parse(expiresAt))
  );
}

export async function loadSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
  if (raw === null) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (isStoredSession(value)) return value;
  } catch {
    // Unreadable; removed below.
  }

  // Something that is not a session is worse than none: the client would try
  // to refresh with it and fail on every launch.
  await SecureStore.deleteItemAsync(KEY, OPTIONS);
  return null;
}

/** Resolves once the session is really stored. */
export async function saveSession(session: unknown): Promise<null> {
  if (!isStoredSession(session)) {
    throw new Error('Noto was asked to store something that is not a session.');
  }

  // Only the three fields, so nothing else the page sent is kept with them.
  const raw = JSON.stringify({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
  });
  if (raw.length > MAX_LENGTH) throw new Error('The session is too large to store.');

  await SecureStore.setItemAsync(KEY, raw, OPTIONS);
  return null;
}

/** Resolves once the session is really gone. */
export async function clearSession(): Promise<null> {
  await SecureStore.deleteItemAsync(KEY, OPTIONS);
  return null;
}
