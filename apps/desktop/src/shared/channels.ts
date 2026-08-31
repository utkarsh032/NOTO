/**
 * IPC channel names shared by the main process and the preload script.
 *
 * This module exists so the preload bundle can name the channels without
 * importing the main-process SQLite module: preload runs in the sandboxed
 * renderer, where `node:sqlite` does not exist and the import would fail.
 */
export const SQL_CHANNELS = {
  execute: 'noto:sql:execute',
  select: 'noto:sql:select',
} as const;

/**
 * Capabilities the shared shell asks the desktop for. Print is the first: the
 * renderer has no print preview of its own inside Electron, so the job is
 * handed to the main process, which hands it to the operating system.
 */
export const SHELL_CHANNELS = {
  print: 'noto:shell:print',
} as const;

/**
 * Updating.
 *
 * `check` and `install` are asked for by the renderer; `status` goes the other
 * way, because Electron's `autoUpdater` reports on its own schedule — it starts
 * downloading the moment it finds something, and finishes whenever the download
 * finishes. A request/response pair cannot express that, so the main process
 * pushes each change to whichever window is open.
 */
export const UPDATER_CHANNELS = {
  check: 'noto:update:check',
  install: 'noto:update:install',
  status: 'noto:update:status',
} as const;

/**
 * What the main process says about an update, in the shared shell's own terms.
 *
 * `downloading` is where an Electron update spends most of its life: the
 * updater fetches as soon as it finds something, so there is no moment at which
 * a desktop update is merely "available".
 */
export interface UpdateReport {
  state: 'checking' | 'up-to-date' | 'downloading' | 'ready' | 'unsupported' | 'error';
  /** The release found, without its `v`. */
  version?: string | null;
  /** ISO 8601 publication timestamp, when the feed gave one. */
  publishedAt?: string | null;
  /** Why it failed, or why this build cannot update itself. */
  message?: string | null;
}
