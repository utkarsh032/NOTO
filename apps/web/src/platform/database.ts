import { createDefaultWorkspace } from '@noto/core';
import { createWebDatabase } from '@noto/database/web';
import type { Workspace } from '@noto/types';

/**
 * The web application's local store: IndexedDB through Dexie.
 *
 * A single instance is shared by the whole app so `useLiveQuery` subscriptions
 * all observe the same connection.
 */
export const db = createWebDatabase();

/**
 * Returns the workspace to open, creating the offline default on first launch.
 * Noto is usable before any account exists, so this never touches the network.
 */
export async function ensureWorkspace(): Promise<Workspace> {
  await db.open();

  const existing = await db.workspaces.list({ limit: 1 });
  const first = existing[0];
  if (first) return first;

  const workspace = createDefaultWorkspace();
  await db.workspaces.put(workspace);
  return workspace;
}
