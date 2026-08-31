import type { SqlDriver, SqlValue } from '@noto/database/sqlite';

import { requestFromNative } from './bridge';

/**
 * A `SqlDriver` that forwards statements across the WebView bridge.
 *
 * This is the same arrangement the desktop application uses — see
 * `apps/desktop/src/renderer/platform/ipc-sql-driver.ts` — with `postMessage`
 * in place of Electron's IPC. The schema, the queries and the repositories all
 * come from `@noto/database`; only the transport differs, so mobile reads and
 * writes the very same database file the old native screens did and no note
 * already on the device is left behind.
 *
 * There is exactly one connection, owned by the native side, and messages are
 * delivered in order — which is what makes driving transactions with plain
 * BEGIN/COMMIT statements from this side safe.
 */
export function createBridgeSqlDriver(): SqlDriver {
  let depth = 0;

  return {
    execute: async (sql, params = []) => {
      await requestFromNative<void>('sql.execute', { sql, params: [...params] });
    },

    select: async <TRow>(sql: string, params: readonly SqlValue[] = []) =>
      requestFromNative<TRow[]>('sql.select', { sql, params: [...params] }),

    transaction: async (work) => {
      // SQLite has no nested transactions; an inner call joins the outer one.
      if (depth > 0) return work();

      depth += 1;
      await requestFromNative<void>('sql.execute', { sql: 'BEGIN', params: [] });

      try {
        const result = await work();
        await requestFromNative<void>('sql.execute', { sql: 'COMMIT', params: [] });
        return result;
      } catch (cause) {
        await requestFromNative<void>('sql.execute', { sql: 'ROLLBACK', params: [] });
        throw cause;
      } finally {
        depth -= 1;
      }
    },

    close: async () => {
      // The connection belongs to the native side and closes with the app.
    },
  };
}
