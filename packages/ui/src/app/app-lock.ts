import { useCallback, useEffect, useState } from 'react';

import { showToast } from '../components/toast-store';

/**
 * The app lock — Face ID, a fingerprint or the device passcode before Noto
 * opens — where the platform has one. Today that is the phone.
 *
 * The lock itself is enforced natively, beneath the interface; the interface
 * only shows the switch. Registered rather than passed down, like the print
 * handler: one exists per running application, set once at startup.
 */

export interface AppLockState {
  /** Whether this device has a screen lock Noto can ask for. */
  available: boolean;
  /** What the person calls it: "Face ID", "fingerprint", "passcode"… */
  method: string | null;
  enabled: boolean;
}

export interface AppLockControl {
  describe(): Promise<AppLockState>;
  /** Asks the person to authenticate, then turns the lock on or off. */
  setEnabled(enabled: boolean): Promise<AppLockState>;
}

let control: AppLockControl | null = null;

export function setAppLockControl(next: AppLockControl | null): void {
  control = next;
}

export interface AppLockValue {
  /** `null` where the platform has no lock, or before the first answer. */
  state: AppLockState | null;
  busy: boolean;
  setEnabled(enabled: boolean): Promise<void>;
}

export function useAppLock(): AppLockValue {
  const [state, setState] = useState<AppLockState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!control) return;
    let active = true;

    control
      .describe()
      .then((next) => {
        if (active) setState(next);
      })
      .catch(() => {
        // No answer is no switch, rather than a switch that cannot work.
        if (active) setState(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const setEnabled = useCallback(async (enabled: boolean) => {
    if (!control) return;
    setBusy(true);

    try {
      const next = await control.setEnabled(enabled);
      setState(next);

      // A cancelled prompt is a decision, but the switch springing back with no
      // word would read as a fault.
      if (next.enabled !== enabled) {
        showToast(enabled ? 'The lock was not turned on.' : 'The lock is still on.');
      }
    } catch {
      showToast('Noto could not change the lock.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, setEnabled };
}
