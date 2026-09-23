import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  app,
  ipcMain,
  shell,
  type IpcMainInvokeEvent,
  type WebContents,
  type WebFrameMain,
} from 'electron';

// Injected by @electron-forge/plugin-vite.
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

/**
 * The main process's side of the trust boundary.
 *
 * `sandbox` and `contextIsolation` keep an injected script away from Node. What
 * they do not do is decide who may call the bridge, where a window may go, or
 * what the SQL channel will run. The first two are decided here, once, rather
 * than by each handler remembering to; the third is `sql-policy.ts`.
 */

/** Where the renderer bundle lives when packaged. */
function rendererRoot(): string {
  return path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`);
}

/**
 * Whether a URL is Noto's own renderer: the dev server in development, the
 * packaged `index.html` otherwise. Everything else is somebody else's page.
 */
export function isAppUrl(target: string): boolean {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return false;
  }

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return url.origin === new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).origin;
  }

  if (url.protocol !== 'file:') return false;

  let file: string;
  try {
    file = fileURLToPath(url);
  } catch {
    return false;
  }

  const relative = path.relative(rendererRoot(), file);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Whether an IPC call came from a frame showing Noto's own renderer.
 *
 * A window that navigated somewhere else — through a bug, or a link the guards
 * below missed — keeps its preload, and with it the bridge. Checking the frame
 * that sent the message, not the window, is what makes that bridge useless to
 * a page that is not Noto.
 */
export function isTrustedSender(frame: WebFrameMain | null): boolean {
  if (!frame) return false;

  // Only the top-level frame. Noto renders no iframes of its own, and an
  // embedded one is exactly the content this check exists to keep out.
  if (frame.parent) return false;

  return isAppUrl(frame.url);
}

/**
 * `ipcMain.handle`, refusing any caller that is not Noto's own renderer.
 *
 * Every privileged channel registers through this, so a new handler is guarded
 * by default instead of by somebody remembering.
 */
export function handleTrusted<Args extends unknown[], Result>(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: Args) => Result,
): void {
  ipcMain.handle(channel, (event, ...args: unknown[]) => {
    if (!isTrustedSender(event.senderFrame)) {
      throw new Error(`Refused ${channel}: the caller is not Noto.`);
    }

    return listener(event, ...(args as Args));
  });
}

/* -------------------------------------------------------------------------- */
/* Windows and navigation                                                     */
/* -------------------------------------------------------------------------- */

/** Hands an https link to the user's browser. Anything else is dropped. */
function openOutside(target: string): void {
  try {
    const url = new URL(target);
    if (url.protocol === 'https:') void shell.openExternal(url.toString());
  } catch {
    // Not a URL at all; nothing to open.
  }
}

function guard(contents: WebContents): void {
  /*
   * No window in Noto opens another. A link with `target="_blank"` in a
   * document, or a `window.open` from anything that got into the renderer, is
   * sent to the browser if it is https and dropped otherwise.
   */
  contents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: 'deny' };
  });

  /*
   * And no window leaves Noto. A navigated window keeps its preload — and so
   * its bridge — so a page that is not Noto must never be loaded into one.
   */
  const refuseNavigation = (event: { preventDefault: () => void }, url: string) => {
    if (isAppUrl(url)) return;

    event.preventDefault();
    openOutside(url);
  };

  contents.on('will-navigate', refuseNavigation);
  contents.on('will-redirect', refuseNavigation);

  // Noto uses no <webview>. One that appears was not put there by Noto.
  contents.on('will-attach-webview', (event) => event.preventDefault());
}

/** Applies the guards to every web contents Noto will ever create. */
export function installWindowGuards(): void {
  app.on('web-contents-created', (_event, contents) => guard(contents));
}
