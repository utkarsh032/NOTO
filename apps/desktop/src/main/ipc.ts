import type { SqlValue } from '@noto/database/sqlite';
import { BrowserWindow, ipcMain } from 'electron';

import { SHELL_CHANNELS, SQL_CHANNELS, UPDATER_CHANNELS } from '../shared/channels';
import { execute, select } from './sqlite';
import { checkForUpdates, installUpdate, setUpdatePublisher } from './updater';

/**
 * The renderer stays sandboxed and never touches the file system; it sends
 * statements, which the main process runs against the single open connection.
 */
export function registerSqlHandlers(): void {
  ipcMain.handle(SQL_CHANNELS.execute, (_event, sql: string, params: SqlValue[] = []) => {
    execute(sql, params);
  });

  ipcMain.handle(SQL_CHANNELS.select, (_event, sql: string, params: SqlValue[] = []) =>
    select(sql, params),
  );
}

/**
 * Printing, handed to the operating system.
 *
 * `webContents.print` prints the window the request came from, which is the
 * same DOM the editor renders — the print stylesheet in `@noto/ui` is what
 * reduces it to the document. Backgrounds are deliberately not printed: the
 * editor's card and its surface tint are screen furniture, and a page of them
 * is a page of toner.
 *
 * The promise resolves either way. A dialog the user dismissed is a decision,
 * not a failure, and the renderer has nothing useful to do about a printer
 * that is not there beyond saying so.
 */
export function registerShellHandlers(): void {
  ipcMain.handle(
    SHELL_CHANNELS.print,
    (event) =>
      new Promise<{ printed: boolean; reason?: string }>((resolve) => {
        event.sender.print({ silent: false, printBackground: false }, (printed, reason) =>
          resolve(printed ? { printed } : { printed, reason }),
        );
      }),
  );
}

/**
 * Updating, driven from the renderer.
 *
 * The shared shell decides when to look and what to say about it, because that
 * policy is the same on web and desktop and is written once. All the main
 * process contributes is the part a browser cannot do: asking the update feed,
 * and restarting into what it sent.
 *
 * Status is pushed to every open window rather than answered to the one that
 * asked. A download that finishes has no request outstanding to reply to, and
 * there is no window it is less true for.
 */
export function registerUpdateHandlers(): void {
  setUpdatePublisher((report) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(UPDATER_CHANNELS.status, report);
    }
  });

  ipcMain.handle(UPDATER_CHANNELS.check, () => checkForUpdates());

  ipcMain.handle(UPDATER_CHANNELS.install, () => {
    installUpdate();
  });
}
