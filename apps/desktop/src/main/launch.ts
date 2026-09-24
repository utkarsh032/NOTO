import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { BrowserWindow } from 'electron';

import { LAUNCH_CHANNELS, type LaunchReport, type OpenedFileReport } from '../shared/channels';
import { grant } from './files';
import { asNotoLink, isAssociatedFile, launchTargets } from './launch-arguments';
import { handleTrusted } from './security';

/**
 * What the operating system asked Noto to open, held until the window takes it.
 *
 * Three doors lead here. On Windows and Linux a double-clicked file or a
 * clicked `noto://` link arrives on the command line: `process.argv` when it
 * started Noto, `second-instance` when Noto was already running. macOS has
 * events of its own instead — `open-file` and `open-url` — which can fire
 * before the application is even ready.
 *
 * Files are read here rather than in the renderer, and only once the user has
 * plainly chosen them: this is the same line `files.ts` draws around a dialog.
 * Opening a file with Noto is choosing it, so it is granted too — Save writes
 * back to the file that was double-clicked, just as it would after Open.
 */

/** A notes file this size is already a mistake; one much larger would stall the renderer. */
const FILE_SIZE_LIMIT = 10 * 1024 * 1024;

const queue: LaunchReport = { files: [], links: [] };

/** The window to tell. Looked up each time, because it can be closed and recreated. */
let windowToTell: () => BrowserWindow | null = () => null;

function announce(): void {
  const target = windowToTell();
  if (!target || target.isDestroyed()) return;

  /*
   * A page still loading has nobody listening yet. That is fine: the renderer
   * takes what is waiting as soon as it starts, so a message now would only be
   * lost, not needed.
   */
  if (target.webContents.isLoading()) return;

  target.webContents.send(LAUNCH_CHANNELS.available);
}

async function readForLaunch(filePath: string): Promise<OpenedFileReport | null> {
  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size > FILE_SIZE_LIMIT) return null;

    const text = await readFile(filePath, 'utf8');
    await grant(filePath);

    return { path: filePath, name: path.basename(filePath), text };
  } catch {
    // Gone, or not ours to read. The OS offered it; nothing is lost by not opening it.
    return null;
  }
}

/** Queues files by path. Only associated types are accepted, whatever the caller was handed. */
export async function queueFiles(paths: readonly string[]): Promise<void> {
  const reports = await Promise.all(
    paths.filter((filePath) => isAssociatedFile(filePath)).map(readForLaunch),
  );

  const read = reports.filter((report): report is OpenedFileReport => report !== null);
  if (read.length === 0) return;

  queue.files.push(...read);
  announce();
}

/** Queues a `noto://` link. Anything else is ignored. */
export function queueLink(url: string): void {
  const link = asNotoLink(url);
  if (!link) return;

  queue.links.push(link);
  announce();
}

/** Queues whatever a command line asked for. Answers whether it asked for anything. */
export function queueCommandLine(argv: readonly string[], workingDirectory: string): boolean {
  const targets = launchTargets(argv, workingDirectory);

  for (const link of targets.links) queueLink(link);
  if (targets.files.length > 0) void queueFiles(targets.files);

  return targets.links.length > 0 || targets.files.length > 0;
}

export function registerLaunchHandlers(window: () => BrowserWindow | null): void {
  windowToTell = window;

  handleTrusted(LAUNCH_CHANNELS.take, (): LaunchReport => {
    const taken: LaunchReport = { files: queue.files.splice(0), links: queue.links.splice(0) };
    return taken;
  });
}
