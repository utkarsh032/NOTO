import { contextBridge, ipcRenderer } from 'electron';

import { SQL_CHANNELS } from '../shared/channels';

/**
 * The renderer's entire privileged surface: two SQL calls, nothing else. The
 * shared query layer in `@noto/database/sqlite` runs on the renderer side and
 * sends statements through here.
 */
const notoSql = {
  execute: (sql: string, params: unknown[]): Promise<void> =>
    ipcRenderer.invoke(SQL_CHANNELS.execute, sql, params) as Promise<void>,

  select: (sql: string, params: unknown[]): Promise<unknown[]> =>
    ipcRenderer.invoke(SQL_CHANNELS.select, sql, params) as Promise<unknown[]>,
};

contextBridge.exposeInMainWorld('notoSql', notoSql);

export type NotoSqlBridge = typeof notoSql;
