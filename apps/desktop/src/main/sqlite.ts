import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

import { DATABASE_NAME } from '@noto/config';
import type { SqlValue } from '@noto/database/sqlite';

/**
 * The desktop SQLite connection.
 *
 * Noto uses Node's built-in `node:sqlite`, which Electron ships with, rather
 * than a native addon such as better-sqlite3. That removes the node-gyp
 * toolchain and the per-Electron-version rebuild step from the contributor
 * setup, at the cost of nothing Noto currently needs.
 */
let connection: DatabaseSync | null = null;

export function openConnection(userDataPath: string): DatabaseSync {
  if (connection) return connection;

  const file = path.join(userDataPath, `${DATABASE_NAME}.db`);
  connection = new DatabaseSync(file);

  // Write-ahead logging keeps reads from blocking on the autosave writes.
  connection.exec('PRAGMA journal_mode = WAL');
  connection.exec('PRAGMA foreign_keys = ON');

  return connection;
}

export function closeConnection(): void {
  connection?.close();
  connection = null;
}

function requireConnection(): DatabaseSync {
  if (!connection) throw new Error('The Noto database has not been opened yet.');
  return connection;
}

/**
 * Runs a statement that returns no rows.
 *
 * PRAGMA assignments cannot be prepared, so parameterless statements go through
 * `exec`. Everything with bound values is prepared.
 */
export function execute(sql: string, params: readonly SqlValue[] = []): void {
  const db = requireConnection();

  if (params.length === 0) {
    db.exec(sql);
    return;
  }

  db.prepare(sql).run(...params);
}

export function select(sql: string, params: readonly SqlValue[] = []): unknown[] {
  return requireConnection()
    .prepare(sql)
    .all(...params);
}
