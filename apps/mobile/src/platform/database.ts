import { createDefaultWorkspace } from '@noto/core';
import type { NotoDatabase } from '@noto/database';
import { createSqliteDatabase } from '@noto/database/sqlite';
import type { Workspace } from '@noto/types';

import { createExpoSqlDriver } from './sqlite-driver';

let opening: Promise<{ database: NotoDatabase; workspace: Workspace }> | null = null;

async function open(): Promise<{ database: NotoDatabase; workspace: Workspace }> {
  const database = createSqliteDatabase(await createExpoSqlDriver());
  await database.open();

  const existing = await database.workspaces.list({ limit: 1 });
  const first = existing[0];
  if (first) return { database, workspace: first };

  const workspace = createDefaultWorkspace();
  await database.workspaces.put(workspace);

  return { database, workspace };
}

/**
 * Opens the mobile store, creating the offline default workspace on first
 * launch. The promise is cached so concurrent screens share one connection.
 */
export function openMobileDatabase(): Promise<{
  database: NotoDatabase;
  workspace: Workspace;
}> {
  opening ??= open();
  return opening;
}
