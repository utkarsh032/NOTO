/** Values SQLite can bind directly. Objects and booleans are encoded before binding. */
export type SqlValue = string | number | null;

/**
 * The minimum surface Noto needs from a SQLite engine.
 *
 * Desktop (Electron) and mobile (Expo) ship different SQLite bindings, so the
 * shared schema and queries are written once here and each app supplies a small
 * driver rather than a second copy of the database layer.
 */
export interface SqlDriver {
  /** Runs a statement that returns no rows. */
  execute(sql: string, params?: readonly SqlValue[]): Promise<void>;
  /** Runs a query and returns its rows. */
  select<TRow>(sql: string, params?: readonly SqlValue[]): Promise<TRow[]>;
  /** Runs `work` inside a transaction, rolling back if it throws. */
  transaction<T>(work: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
