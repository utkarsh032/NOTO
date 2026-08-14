import type { SqlDriver, SqlValue } from '@noto/database/sqlite';

/**
 * A `SqlDriver` that forwards statements to the Electron main process.
 *
 * There is exactly one connection, owned by main, and IPC preserves call order
 * per channel — which is what makes driving transactions with plain
 * BEGIN/COMMIT statements from this side safe.
 */
export function createIpcSqlDriver(): SqlDriver {
  const bridge = window.notoSql;
  let depth = 0;

  return {
    execute: async (sql, params = []) => {
      await bridge.execute(sql, [...params]);
    },

    select: async <TRow>(sql: string, params: readonly SqlValue[] = []) =>
      (await bridge.select(sql, [...params])) as TRow[],

    transaction: async (work) => {
      // SQLite has no nested transactions; an inner call joins the outer one.
      if (depth > 0) return work();

      depth += 1;
      await bridge.execute('BEGIN', []);

      try {
        const result = await work();
        await bridge.execute('COMMIT', []);
        return result;
      } catch (cause) {
        await bridge.execute('ROLLBACK', []);
        throw cause;
      } finally {
        depth -= 1;
      }
    },

    close: async () => {
      // The connection belongs to the main process and closes with the app.
    },
  };
}
