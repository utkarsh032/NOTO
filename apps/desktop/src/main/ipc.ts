import type { SqlValue } from '@noto/database/sqlite';
import { ipcMain } from 'electron';

import { SQL_CHANNELS } from '../shared/channels';
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
