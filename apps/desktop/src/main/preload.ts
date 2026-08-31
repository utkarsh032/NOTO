import { contextBridge, ipcRenderer } from 'electron';

import {
  SHELL_CHANNELS,
  SQL_CHANNELS,
  UPDATER_CHANNELS,
  type UpdateReport,
} from '../shared/channels';

/**
 * The renderer's entire privileged surface: two SQL calls, a print request and
 * the three halves of updating.
 * The shared query layer in `@noto/database/sqlite` runs on the renderer side
 * and sends statements through here.
 */
const notoSql = {
  execute: (sql: string, params: unknown[]): Promise<void> =>
    ipcRenderer.invoke(SQL_CHANNELS.execute, sql, params) as Promise<void>,

  select: (sql: string, params: unknown[]): Promise<unknown[]> =>
    ipcRenderer.invoke(SQL_CHANNELS.select, sql, params) as Promise<unknown[]>,
};

/** Desktop capabilities the shared shell asks for by name. */
const notoShell = {
  print: (): Promise<{ printed: boolean; reason?: string }> =>
    ipcRenderer.invoke(SHELL_CHANNELS.print) as Promise<{ printed: boolean; reason?: string }>,
};

/**
 * Updating. `onStatus` is the only push in the bridge: a download finishes
 * whenever it finishes, and there is no request left open to answer.
 *
 * The listener is wrapped rather than handed the IPC event, so nothing from the
 * main process's side of the boundary — a sender, a port — reaches renderer
 * code that only wanted to know a version number.
 */
const notoUpdates = {
  check: (): Promise<UpdateReport> =>
    ipcRenderer.invoke(UPDATER_CHANNELS.check) as Promise<UpdateReport>,

  install: (): Promise<void> => ipcRenderer.invoke(UPDATER_CHANNELS.install) as Promise<void>,

  onStatus: (listener: (report: UpdateReport) => void): (() => void) => {
    const handler = (_event: unknown, report: UpdateReport) => listener(report);
    ipcRenderer.on(UPDATER_CHANNELS.status, handler);
    return () => ipcRenderer.off(UPDATER_CHANNELS.status, handler);
  },
};

contextBridge.exposeInMainWorld('notoSql', notoSql);
contextBridge.exposeInMainWorld('notoShell', notoShell);
contextBridge.exposeInMainWorld('notoUpdates', notoUpdates);

export type NotoSqlBridge = typeof notoSql;
export type NotoShellBridge = typeof notoShell;
export type NotoUpdatesBridge = typeof notoUpdates;
