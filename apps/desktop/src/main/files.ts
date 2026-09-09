import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  BrowserWindow,
  type FileFilter,
  type OpenDialogOptions,
  type SaveDialogOptions,
  app,
  dialog,
  ipcMain,
} from 'electron';

import {
  FILE_CHANNELS,
  type OpenedFileReport,
  type ReadReport,
  type SavedFileReport,
  type WriteReport,
} from '../shared/channels';

/**
 * Files on the user's disk, for the sandboxed renderer.
 *
 * The renderer never sees the file system. It asks for a dialog and gets back
 * what the dialog produced — a path, and for Open the file's text — and it asks
 * for a write and is told whether the write landed. Everything between those
 * two sentences happens here.
 *
 * ## Why `write` checks the path
 *
 * A save has to be able to overwrite a file without a dialog, or Save means
 * Save As. So the renderer holds on to paths and hands them back. That is fine
 * for paths the user chose; it is not fine as a general "write these bytes to
 * that path" that anything running in the renderer could call with a path of
 * its own choosing. A renderer is the side an injected script would be
 * speaking from, which is exactly why it does not get to decide this.
 *
 * So the main process keeps its own list of every path a dialog has handed
 * out, and a write to anything else is refused. The list is written to disk so
 * that a file saved yesterday is still writable today — otherwise the first
 * Save after every launch would be a Save As.
 */

/** Formats Noto writes, in the order the save dialog offers them. */
const SAVE_FILTERS: FileFilter[] = [
  { name: 'Markdown', extensions: ['md', 'markdown'] },
  { name: 'Plain text', extensions: ['txt'] },
  { name: 'HTML', extensions: ['html', 'htm'] },
  { name: 'Noto JSON', extensions: ['json'] },
];

const OPEN_FILTERS: FileFilter[] = [
  { name: 'Documents', extensions: ['txt', 'md', 'markdown', 'json', 'html', 'htm'] },
  { name: 'All files', extensions: ['*'] },
];

/* -------------------------------------------------------------------------- */
/* Paths the user has chosen                                                  */
/* -------------------------------------------------------------------------- */

const GRANTS_FILE = 'file-grants.json';

/**
 * Enough to cover every file somebody is realistically still editing, small
 * enough that the list never becomes a record of everything they ever opened.
 */
const GRANT_LIMIT = 500;

/** Oldest first, so trimming drops what was chosen longest ago. */
let grants: Set<string> | null = null;

function grantsPath(): string {
  return path.join(app.getPath('userData'), GRANTS_FILE);
}

async function loadGrants(): Promise<Set<string>> {
  if (grants) return grants;

  try {
    const parsed: unknown = JSON.parse(await readFile(grantsPath(), 'utf8'));
    grants = new Set(
      Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === 'string')
        : [],
    );
  } catch {
    // First launch, or a file something else damaged: nothing is granted yet.
    grants = new Set();
  }

  return grants;
}

/** Records that a dialog handed out this path, so a later write to it is allowed. */
async function grant(filePath: string): Promise<void> {
  const current = await loadGrants();

  // Re-added at the end, so a file chosen again counts as recent.
  current.delete(filePath);
  current.add(filePath);

  while (current.size > GRANT_LIMIT) {
    const oldest = current.values().next().value;
    if (oldest === undefined) break;
    current.delete(oldest);
  }

  try {
    await writeFile(grantsPath(), JSON.stringify([...current]), 'utf8');
  } catch {
    // The grant still holds for this session; only the next launch forgets it,
    // and the cost of that is one Save As.
  }
}

/* -------------------------------------------------------------------------- */
/* Handlers                                                                   */
/* -------------------------------------------------------------------------- */

/** The window a request came from, so the dialog is modal to it. */
function windowFor(sender: Electron.WebContents): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(sender) ?? undefined;
}

/**
 * The renderer offers a name; only the name part of it is used. Nothing that
 * arrives from the renderer is allowed to steer the dialog into a directory.
 */
function suggestedFileName(value: unknown): string {
  if (typeof value !== 'string') return 'untitled.md';

  const name = path.basename(value.trim());
  return name === '' || name === '.' || name === '..' ? 'untitled.md' : name;
}

export function registerFileHandlers(): void {
  ipcMain.handle(FILE_CHANNELS.open, async (event): Promise<OpenedFileReport[] | null> => {
    const owner = windowFor(event.sender);
    const options: OpenDialogOptions = {
      title: 'Open',
      properties: ['openFile', 'multiSelections'],
      filters: OPEN_FILTERS,
    };

    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) return null;

    const files = await Promise.all(
      result.filePaths.map(async (filePath): Promise<OpenedFileReport> => ({
        path: filePath,
        name: path.basename(filePath),
        text: await readFile(filePath, 'utf8'),
      })),
    );

    // Opened is chosen: what was read can be written back to.
    for (const file of files) await grant(file.path);

    return files;
  });

  ipcMain.handle(
    FILE_CHANNELS.saveAs,
    async (event, suggested: unknown): Promise<SavedFileReport | null> => {
      const owner = windowFor(event.sender);
      const options: SaveDialogOptions = {
        title: 'Save As',
        /*
         * A bare name rather than a full path. Given a directory the dialog
         * goes there every time; given only a name it opens where the user
         * last saved, which is what every other application on the machine
         * does.
         */
        defaultPath: suggestedFileName(suggested),
        filters: SAVE_FILTERS,
      };

      const result = owner
        ? await dialog.showSaveDialog(owner, options)
        : await dialog.showSaveDialog(options);

      if (result.canceled || !result.filePath) return null;

      await grant(result.filePath);

      return { path: result.filePath, name: path.basename(result.filePath) };
    },
  );

  /*
   * Reopening from Recent. The same grant list guards it as guards a write:
   * the renderer may ask for a file the user once chose, and for nothing else.
   */
  ipcMain.handle(FILE_CHANNELS.read, async (_event, target: unknown): Promise<ReadReport> => {
    if (typeof target !== 'string') {
      return { text: null, reason: 'Noto could not read that file.' };
    }

    const allowed = await loadGrants();
    if (!allowed.has(target)) {
      return {
        text: null,
        reason: 'Noto has lost track of that file. Open it again to pick up where it is.',
      };
    }

    try {
      return { text: await readFile(target, 'utf8') };
    } catch (error) {
      const code = (error as { code?: string }).code;

      return {
        text: null,
        reason:
          code === 'ENOENT'
            ? 'That file is no longer where it was.'
            : code === 'EACCES' || code === 'EPERM'
              ? 'Noto is not allowed to read that file.'
              : 'Noto could not read that file.',
      };
    }
  });

  ipcMain.handle(
    FILE_CHANNELS.write,
    async (_event, target: unknown, contents: unknown): Promise<WriteReport> => {
      if (typeof target !== 'string' || typeof contents !== 'string') {
        return { written: false, reason: 'Noto could not write the file.' };
      }

      const allowed = await loadGrants();
      if (!allowed.has(target)) {
        return {
          written: false,
          reason: 'Noto has lost track of that file. Use Save As to choose it again.',
        };
      }

      try {
        await writeFile(target, contents, 'utf8');
      } catch (error) {
        const code = (error as { code?: string }).code;

        return {
          written: false,
          reason:
            code === 'ENOENT'
              ? 'That file is no longer where it was. Use Save As to choose where to save it.'
              : code === 'EACCES' || code === 'EPERM'
                ? 'Noto is not allowed to write to that file.'
                : 'Noto could not write the file.',
        };
      }

      return { written: true };
    },
  );
}
