import type { SqlValue } from '@noto/database/sqlite';
import { ipcMain } from 'electron';

import { SHELL_CHANNELS, SQL_CHANNELS } from '../shared/channels';
import { execute, select } from './sqlite';

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
