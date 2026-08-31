import type { SqlDriver, SqlValue } from '@noto/database/sqlite';

import { createExpoSqlDriver } from './sqlite-driver';

/**
 * The native end of the interface's SQL bridge.
 *
 * The connection lives here rather than in the WebView for two reasons. It is
 * the same database file the application has always used, so no note already on
 * the device is stranded by the move to a WebView interface; and a WebView on a
 * `file://` origin has no durable storage of its own worth trusting a
 * document to.
 *
 * Only `execute` and `select` are exposed. Transactions are driven from the
 * other side with plain BEGIN/COMMIT statements — see `bridge-sql-driver.ts` in
 * `@noto/mobile-webview`, and `ipc-sql-driver.ts` on desktop, which does the
 * same thing over Electron's IPC.
 */

let opening: Promise<SqlDriver> | null = null;

function driver(): Promise<SqlDriver> {
  opening ??= createExpoSqlDriver();
  return opening;
}

/** Runs a statement that returns no rows. Resolves to `null`, not `undefined`, */
/** because `undefined` does not survive the JSON trip back across the bridge. */
export async function executeSql(sql: string, params: readonly SqlValue[]): Promise<null> {
  await (await driver()).execute(sql, params);
  return null;
}

/** Runs a query and returns its rows. */
export async function selectSql(sql: string, params: readonly SqlValue[]): Promise<unknown[]> {
  return (await driver()).select(sql, params);
}
