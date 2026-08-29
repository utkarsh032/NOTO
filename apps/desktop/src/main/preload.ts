import { contextBridge, ipcRenderer } from 'electron';

import { SHELL_CHANNELS, SQL_CHANNELS } from '../shared/channels';

/**
 * The renderer's entire privileged surface: two SQL calls and a print request.
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

contextBridge.exposeInMainWorld('notoSql', notoSql);
contextBridge.exposeInMainWorld('notoShell', notoShell);

export type NotoSqlBridge = typeof notoSql;
export type NotoShellBridge = typeof notoShell;
