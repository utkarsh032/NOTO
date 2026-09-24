import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { lockMethodLabel, shouldLockOnReturn } from './app-lock-policy';

/**
 * The app lock: Face ID, a fingerprint or the phone's own passcode before Noto
 * shows anything.
 *
 * The switch lives here, on the device, rather than in Noto's settings. It is
 * about this phone — it must not follow the account to a laptop — and it has
 * to be readable before the interface has loaded, because the interface is
 * what it hides.
 */

const KEY = 'noto.appLock';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/** What the interface is told about the lock. */
export interface AppLockState {
  /** Whether this phone has any screen lock Noto can ask for. */
  available: boolean;
  /** What the person calls it: "Face ID", "fingerprint", "passcode"… */
  method: string | null;
  enabled: boolean;
}

/**
 * Read synchronously, so a locked Noto is locked on its very first frame.
 *
 * A read that fails counts as locked. Unlocking still works — and on a phone
 * whose screen lock has since been removed, unlocking lets the person straight
 * in — so this can cost one prompt, never access.
 */
function readEnabled(): boolean {
  try {
    return SecureStore.getItem(KEY, OPTIONS) === 'on';
  } catch {
    return true;
  }
}

type Verdict = 'passed' | 'refused' | 'no-lock';

export interface AppLock {
  /** Noto is locked; the interface must not be shown or read out. */
  locked: boolean;
  /** Noto is in the background or the app switcher; hide its content. */
  covered: boolean;
  /** Asks for Face ID / fingerprint / passcode, and unlocks on success. */
  unlock(): Promise<void>;
  describe(): Promise<AppLockState>;
  /** Turns the lock on or off. Either way needs the person to authenticate. */
  setEnabled(enabled: boolean): Promise<AppLockState>;
}

export function useAppLock(): AppLock {
  const [initial] = useState(readEnabled);
  const enabled = useRef(initial);
  const [locked, setLocked] = useState(initial);
  const [covered, setCovered] = useState(false);

  const backgroundedAt = useRef<number | null>(null);
  const authenticating = useRef(false);
  // One automatic prompt per lock. After a cancel, the button asks again.
  const prompted = useRef(false);

  const authenticate = useCallback(async (promptMessage: string): Promise<Verdict> => {
    if (authenticating.current) return 'refused';
    authenticating.current = true;

    try {
      const level = await LocalAuthentication.getEnrolledLevelAsync();
      if (level === LocalAuthentication.SecurityLevel.NONE) return 'no-lock';

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Cancel',
        // The passcode stays available, so a failed face or finger is not the
        // end of the road — and a phone with only a passcode can still lock.
        disableDeviceFallback: false,
      });
      return result.success ? 'passed' : 'refused';
    } catch {
      return 'refused';
    } finally {
      authenticating.current = false;
    }
  }, []);

  const unlock = useCallback(async () => {
    const verdict = await authenticate('Unlock Noto');
    // A phone with no screen lock left has nothing to ask for; keeping Noto
    // shut on it would lock the person out of their own notes for good.
    if (verdict !== 'refused') setLocked(false);
  }, [authenticate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setCovered(false);
        if (shouldLockOnReturn(enabled.current, backgroundedAt.current, Date.now())) {
          prompted.current = false;
          setLocked(true);
        }
        backgroundedAt.current = null;
        return;
      }

      // `inactive` is the app switcher on iOS, and the moment before
      // `background`: covered now, so the snapshot it takes shows nothing.
      if (enabled.current) setCovered(true);
      if (state === 'background' && backgroundedAt.current === null) {
        backgroundedAt.current = Date.now();
      }
    });

    return () => subscription.remove();
  }, []);

  // Asks straight away when Noto opens locked, rather than making the person
  // find a button first.
  useEffect(() => {
    if (!locked || prompted.current || AppState.currentState !== 'active') return;
    prompted.current = true;
    void unlock();
  }, [locked, unlock]);

  const describe = useCallback(async (): Promise<AppLockState> => {
    const [level, types] = await Promise.all([
      LocalAuthentication.getEnrolledLevelAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const method = lockMethodLabel(Platform.OS, level, types);

    return { available: method !== null, method, enabled: enabled.current };
  }, []);

  const setEnabled = useCallback(
    async (next: boolean): Promise<AppLockState> => {
      if (next !== enabled.current) {
        const verdict = await authenticate(
          next ? 'Turn on the Noto lock' : 'Turn off the Noto lock',
        );
        // Off is allowed on a phone with no screen lock left; on is not.
        const allowed = verdict === 'passed' || (!next && verdict === 'no-lock');

        if (allowed) {
          await SecureStore.setItemAsync(KEY, next ? 'on' : 'off', OPTIONS);
          enabled.current = next;
        }
      }

      return describe();
    },
    [authenticate, describe],
  );

  return { locked, covered, unlock, describe, setEnabled };
}
