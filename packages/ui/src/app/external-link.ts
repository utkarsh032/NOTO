/**
 * Opening something outside Noto.
 *
 * A browser needs no help: `window.open` is a new tab. A packaged desktop
 * renderer does — it is served from `file://`, where a new window is another
 * Electron window rather than the browser, and where Electron's own policy
 * decides whether one may be opened at all. So the desktop registers a handler
 * that hands the URL to the main process, which hands it to the operating
 * system.
 *
 * Registered rather than passed down, for the same reason as the print handler:
 * exactly one exists per running application, it is set once at startup, and
 * threading it from the shell to whichever screen has a link would be ceremony
 * around a constant.
 */

export type ExternalLinkHandler = (url: string) => void | Promise<void>;

let handler: ExternalLinkHandler | null = null;

export function setExternalLinkHandler(next: ExternalLinkHandler | null): void {
  handler = next;
}

/**
 * Opens a URL wherever this platform opens URLs.
 *
 * `noopener` is not optional on the web: without it the opened page gets a
 * handle on the window that opened it, and can navigate it somewhere else.
 * Failure is swallowed — a blocked pop-up is not a reason to take a screen
 * down, and the caller has already told the person what it was trying to do.
 */
export async function openExternalLink(url: string): Promise<void> {
  try {
    if (handler) {
      await handler(url);

      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    // Nothing useful to say here that the screen has not already said.
  }
}
