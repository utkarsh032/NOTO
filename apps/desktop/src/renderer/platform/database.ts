import { createDefaultWorkspace } from '@noto/core';
import type { NotoDatabase } from '@noto/database';
import { createSqliteDatabase } from '@noto/database/sqlite';
import type { Workspace } from '@noto/types';

import { createIpcSqlDriver } from './ipc-sql-driver';

let database: NotoDatabase | null = null;

/**
 * Opens the desktop store and returns the workspace to show, creating the
 * offline default on first launch. Migrations run inside `open()`.
 */
export async function openDesktopDatabase(): Promise<{
  database: NotoDatabase;
  workspace: Workspace;
}> {
  database ??= createSqliteDatabase(createIpcSqlDriver());
  await database.open();

  const existing = await database.workspaces.list({ limit: 1 });
  const first = existing[0];
  if (first) return { database, workspace: first };

  const workspace = createDefaultWorkspace();
  await database.workspaces.put(workspace);

  return { database, workspace };
}
