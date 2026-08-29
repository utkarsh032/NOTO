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
