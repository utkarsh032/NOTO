import { DATABASE_VERSION } from '@noto/config';

import type { SqlDriver } from './driver';

/**
 * Schema migrations, indexed by the version they upgrade *to*.
 *
 * Version 1 is the initial schema. Every later entry must be additive and
 * idempotent, and `DATABASE_VERSION` in `@noto/config` must be bumped with it so
 * the web and SQLite stores stay on the same version number.
 */
export const MIGRATIONS: Readonly<Record<number, readonly string[]>> = {
  1: [
    `CREATE TABLE IF NOT EXISTS workspaces (
       id          TEXT PRIMARY KEY NOT NULL,
       name        TEXT NOT NULL,
       owner_id    TEXT,
       is_local    INTEGER NOT NULL DEFAULT 1,
       icon        TEXT,
       created_at  TEXT NOT NULL,
       updated_at  TEXT NOT NULL,
       deleted_at  TEXT
     )`,

    `CREATE TABLE IF NOT EXISTS folders (
       id           TEXT PRIMARY KEY NOT NULL,
       workspace_id TEXT NOT NULL,
       parent_id    TEXT,
       name         TEXT NOT NULL,
       position     INTEGER NOT NULL DEFAULT 0,
       color        TEXT,
       icon         TEXT,
       created_at   TEXT NOT NULL,
       updated_at   TEXT NOT NULL,
       deleted_at   TEXT,
       FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
       FOREIGN KEY (parent_id) REFERENCES folders (id) ON DELETE SET NULL
     )`,

    `CREATE TABLE IF NOT EXISTS documents (
       id           TEXT PRIMARY KEY NOT NULL,
       workspace_id TEXT NOT NULL,
       folder_id    TEXT,
       title        TEXT NOT NULL,
       content      TEXT NOT NULL,
       status       TEXT NOT NULL DEFAULT 'draft',
       excerpt      TEXT NOT NULL DEFAULT '',
       word_count   INTEGER NOT NULL DEFAULT 0,
       is_favorite  INTEGER NOT NULL DEFAULT 0,
       tags         TEXT NOT NULL DEFAULT '[]',
       created_at   TEXT NOT NULL,
       updated_at   TEXT NOT NULL,
       deleted_at   TEXT,
       FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
       FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE SET NULL
     )`,

    `CREATE TABLE IF NOT EXISTS files (
       id           TEXT PRIMARY KEY NOT NULL,
       workspace_id TEXT NOT NULL,
       document_id  TEXT,
       name         TEXT NOT NULL,
       mime_type    TEXT NOT NULL,
       size         INTEGER NOT NULL DEFAULT 0,
       local_path   TEXT,
       remote_url   TEXT,
       checksum     TEXT,
       created_at   TEXT NOT NULL,
       updated_at   TEXT NOT NULL,
       deleted_at   TEXT,
       FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
       FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
     )`,

    `CREATE INDEX IF NOT EXISTS idx_folders_workspace ON folders (workspace_id, deleted_at)`,
    `CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders (parent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents (workspace_id, deleted_at, updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents (folder_id, deleted_at)`,
    `CREATE INDEX IF NOT EXISTS idx_documents_status ON documents (workspace_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_files_document ON files (document_id, deleted_at)`,
  ],
};

/**
 * Brings the database up to `DATABASE_VERSION`, applying only the migrations
 * the file has not seen. Version tracking uses SQLite's own `user_version`
 * pragma, so no bookkeeping table is required.
 */
export async function migrate(driver: SqlDriver): Promise<void> {
  await driver.execute('PRAGMA foreign_keys = ON');

  const rows = await driver.select<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = rows[0]?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) return;

  await driver.transaction(async () => {
    for (let version = currentVersion + 1; version <= DATABASE_VERSION; version += 1) {
      for (const statement of MIGRATIONS[version] ?? []) {
        await driver.execute(statement);
      }
    }

    // PRAGMA does not accept bound parameters, and the value is a validated integer.
    await driver.execute(`PRAGMA user_version = ${DATABASE_VERSION}`);
  });
}

/** Table names in the order they must be cleared to respect foreign keys. */
export const TABLES_IN_DELETE_ORDER = ['files', 'documents', 'folders', 'workspaces'] as const;
