import { browserGateway } from './browser';
import type { LocalFileGateway } from './types';

/* -------------------------------------------------------------------------- */
/* The gateway                                                                */
/* -------------------------------------------------------------------------- */

export let gateway: LocalFileGateway | null = null;

/**
 * Installs the platform's file implementation, replacing any previous one.
 *
 * Registered rather than passed down, for the same reason the print handler is:
 * exactly one exists per running application and it is set once at startup. The
 * desktop sets it, because Electron's dialogs give a real path and a sandboxed
 * renderer must not go near the file system itself. The browser needs no
 * registration — the default below is the browser.
 */
export function setLocalFileGateway(next: LocalFileGateway | null): void {
  gateway = next;
}

export function activeGateway(): LocalFileGateway {
  return gateway ?? browserGateway;
}

/** True when saving means writing back to the same file rather than downloading. */
export function canWriteFilesInPlace(): boolean {
  return activeGateway().canWriteInPlace;
}
