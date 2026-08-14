import { DATABASE_NAME } from '@noto/config';
import type { SqlDriver, SqlValue } from '@noto/database/sqlite';
import * as SQLite from 'expo-sqlite';

/**
 * A `SqlDriver` backed by expo-sqlite.
 *
 * The schema and every query come from `@noto/database/sqlite` — the same code
 * the desktop application runs — so this file is only the engine binding.
 */
export async function createExpoSqlDriver(): Promise<SqlDriver> {
  const db = await SQLite.openDatabaseAsync(`${DATABASE_NAME}.db`);
  let depth = 0;

  return {
    execute: async (sql, params = []) => {
      // PRAGMA assignments cannot be bound, so parameterless statements use exec.
      if (params.length === 0) {
        await db.execAsync(sql);
        return;
      }
      await db.runAsync(sql, params as SQLite.SQLiteBindValue[]);
    },

    select: async <TRow>(sql: string, params: readonly SqlValue[] = []) =>
      db.getAllAsync<TRow>(sql, params as SQLite.SQLiteBindValue[]),

    transaction: async <T>(work: () => Promise<T>): Promise<T> => {
      // SQLite has no nested transactions; an inner call joins the outer one.
      if (depth > 0) return work();

      depth += 1;
      let result: T;
      try {
        await db.withTransactionAsync(async () => {
          result = await work();
        });
      } finally {
        depth -= 1;
      }

      return result!;
    },

    close: async () => {
      await db.closeAsync();
    },
  };
}
