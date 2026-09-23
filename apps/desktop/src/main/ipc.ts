import type { SqlValue } from '@noto/database/sqlite';
import { BrowserWindow, shell } from 'electron';

import { SHELL_CHANNELS, SQL_CHANNELS, UPDATER_CHANNELS } from '../shared/channels';
import { handleTrusted } from './security';
import { checkStatement } from './sql-policy';
import { execute, select } from './sqlite';
import { checkForUpdates, installUpdate, setUpdatePublisher } from './updater';

/**
 * The renderer stays sandboxed and never touches the file system; it sends
 * statements, which the main process runs against the single open connection.
 *
 * Only Noto's own renderer may send them (`handleTrusted`), and a statement
 * that could reach beyond the database — `ATTACH`, `VACUUM INTO`, an unknown
 * pragma — is refused whoever sends it. See `security.ts`.
 */
export function registerSqlHandlers(): void {
  handleTrusted(SQL_CHANNELS.execute, (_event, sql: unknown, params: unknown = []) => {
    const check = checkStatement(sql, params);
    if (!check.ok) throw new Error(`Refused SQL: ${check.reason}.`);

    execute(sql as string, params as SqlValue[]);
  });

  handleTrusted(SQL_CHANNELS.select, (_event, sql: unknown, params: unknown = []) => {
    const check = checkStatement(sql, params);
    if (!check.ok) throw new Error(`Refused SQL: ${check.reason}.`);

    return select(sql as string, params as SqlValue[]);
  });
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
  handleTrusted(
    SHELL_CHANNELS.print,
    (event) =>
      new Promise<{ printed: boolean; reason?: string }>((resolve) => {
        event.sender.print({ silent: false, printBackground: false }, (printed, reason) =>
          resolve(printed ? { printed } : { printed, reason }),
        );
      }),
  );

  /*
   * Opening a link outside Noto.
   *
   * `shell.openExternal` hands a string to the operating system to do
   * something with, and the operating system will do a great deal more than
   * open a web page — `file:` reaches the disk, and on Windows a handler
   * exists for schemes that run programs. So the scheme is checked here rather
   * than trusted from the renderer: https, and nothing else, whatever a page
   * asks for. A renderer is the side an injected script would be speaking
   * from, which is exactly why it does not get to make this decision.
   */
  handleTrusted(SHELL_CHANNELS.openExternal, async (_event, target: unknown) => {
    if (typeof target !== 'string') return false;

    let url: URL;
    try {
      url = new URL(target);
    } catch {
      return false;
    }

    if (url.protocol !== 'https:') return false;

    await shell.openExternal(url.toString());

    return true;
  });
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

  handleTrusted(UPDATER_CHANNELS.check, () => checkForUpdates());

  handleTrusted(UPDATER_CHANNELS.install, () => {
    installUpdate();
  });
}
