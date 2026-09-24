/**
 * Whether the device thinks it is online, and when that changes.
 *
 * Only a hint: "online" means a network is up, not that the server answers,
 * so the engine still treats an unreachable server as offline. What the hint
 * buys is not trying while there is certainly no network, and trying again
 * the moment one comes back.
 */
export interface Connectivity {
  readonly online: boolean;
  subscribe(listener: (online: boolean) => void): () => void;
}

/** For environments with no notion of it (tests, a server): always online. */
export const alwaysOnline: Connectivity = {
  online: true,
  subscribe: () => () => {},
};

/** The slice of `window` this needs; the shared packages build without the DOM library. */
export interface BrowserTarget {
  navigator: { onLine: boolean };
  addEventListener(type: 'online' | 'offline', listener: () => void): void;
  removeEventListener(type: 'online' | 'offline', listener: () => void): void;
}

/**
 * `navigator.onLine` and the window's `online`/`offline` events. Web, the
 * desktop renderer and the mobile WebView all run the UI in a browser engine,
 * so this one implementation serves every platform.
 */
export function browserConnectivity(
  target: BrowserTarget = globalThis as unknown as BrowserTarget,
): Connectivity {
  return {
    get online() {
      return target.navigator.onLine;
    },

    subscribe(listener) {
      const up = () => listener(true);
      const down = () => listener(false);
      target.addEventListener('online', up);
      target.addEventListener('offline', down);
      return () => {
        target.removeEventListener('online', up);
        target.removeEventListener('offline', down);
      };
    },
  };
}
