/**
 * The channel between the interface and the Android application around it.
 *
 * Everything the page cannot do for itself crosses here: SQL statements, which
 * run against the one native SQLite connection, and the handful of platform
 * actions — printing, saving a file — that a WebView has no way to perform.
 *
 * The shape is a request/reply pair over `postMessage`. Each request carries an
 * id; the native side answers by calling {@link resolveBridgeRequest} through
 * `injectJavaScript`. Events travel the other way with no reply expected.
 */

export interface BridgeReply {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export type BridgeEventName = 'insets' | 'back';

export interface BridgeInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void };
    /** Installed below, called by the native side. */
    __noto?: {
      resolve(reply: BridgeReply): void;
      event(name: BridgeEventName, payload: unknown): void;
    };
  }
}

const pending = new Map<number, Pending>();
const listeners = new Map<BridgeEventName, Set<(payload: never) => void>>();

let nextId = 1;

/** Whether the page is running inside the Android application. */
export function hasBridge(): boolean {
  return typeof window.ReactNativeWebView?.postMessage === 'function';
}

/**
 * Sends a request to the native side and waits for its answer.
 *
 * Rejects rather than hanging when there is no native side at all, which is
 * what `vite dev` in a desktop browser looks like from in here. Nothing else
 * times out: a request is only outstanding while native code is working on it,
 * and a slow query on a large workspace is not a failure.
 */
export function requestFromNative<T>(channel: string, payload?: unknown): Promise<T> {
  const bridge = window.ReactNativeWebView;
  if (!bridge) {
    return Promise.reject(
      new Error(
        'Noto is running outside its Android shell, so device storage is unavailable. ' +
          'Run the mobile app itself, or use the web application for interface work.',
      ),
    );
  }

  const id = nextId++;

  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    bridge.postMessage(JSON.stringify({ id, channel, payload }));
  });
}

/** Subscribes to an event pushed by the native side. Returns an unsubscribe. */
export function onNativeEvent<T>(
  name: BridgeEventName,
  listener: (payload: T) => void,
): () => void {
  const set = listeners.get(name) ?? new Set();
  listeners.set(name, set);
  set.add(listener as (payload: never) => void);

  return () => {
    set.delete(listener as (payload: never) => void);
  };
}

function resolveBridgeRequest(reply: BridgeReply): void {
  const entry = pending.get(reply.id);
  // A reply with no request behind it means the page reloaded while native code
  // was still working. Dropping it is correct; the caller is already gone.
  if (!entry) return;

  pending.delete(reply.id);

  if (reply.ok) entry.resolve(reply.result);
  else entry.reject(new Error(reply.error ?? 'The Android side of Noto reported no reason.'));
}

function dispatchNativeEvent(name: BridgeEventName, payload: unknown): void {
  const set = listeners.get(name);
  if (!set) return;

  for (const listener of set) {
    try {
      (listener as (value: unknown) => void)(payload);
    } catch (error) {
      // One bad listener must not stop the others, and must not throw back
      // across `injectJavaScript` into the native caller.
      console.error(`Noto could not handle the "${name}" event.`, error);
    }
  }
}

// Installed at module load, before React renders, so a reply can never arrive
// at an object that is not there yet.
window.__noto = { resolve: resolveBridgeRequest, event: dispatchNativeEvent };
