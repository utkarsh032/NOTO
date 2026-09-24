import type { NotoDatabase } from '@noto/database';
import type { Id, SyncEntityKind, SyncRecord, Workspace } from '@noto/types';

import { entityKey } from './records';
import { SyncTransportError, type SyncApiClient } from './transport';

/**
 * Bringing a device's local workspace into an account (audit plan phase 4,
 * step 5; Backend_Node_Plan §9.5; Backend_Plan open question 5).
 *
 * Signing in never uploads anything by itself — the app asks first, then
 * calls `joinAccount`. What happens depends on whether the account already
 * has a workspace:
 *
 * - It has none: this device's workspace becomes the account's, with its id
 *   kept (`claim`). Everything in it is queued for the first push.
 * - It has one (another device got there first): this device's notes move
 *   into it, ids kept, and the emptied local workspace is dropped. Noto shows
 *   one workspace, so two devices end up with one set of notes rather than
 *   two workspaces side by side.
 *
 * Either way the result names the workspace to sync from now on.
 */

export interface WorkspaceSummary {
  workspace: Workspace;
  role: 'owner' | 'editor' | 'commenter' | 'viewer';
  version: number;
}

export interface JoinResult {
  workspaceId: Id;
  mode: 'claimed' | 'merged';
  /** How many local entities were queued to go up. */
  queued: number;
}

async function call<T>(
  client: SyncApiClient,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await client.request<T>(method, path, body === undefined ? {} : { body });
  if (response.ok) return response.data;

  throw new SyncTransportError(
    response.error?.message ?? 'The server did not accept that.',
    response.status,
    response.error?.code ?? null,
  );
}

/** The account's workspaces, newest first. */
export async function listAccountWorkspaces(client: SyncApiClient): Promise<WorkspaceSummary[]> {
  return (await call<{ workspaces: WorkspaceSummary[] }>(client, 'GET', '/v1/workspaces'))
    .workspaces;
}

export async function joinAccount(
  database: NotoDatabase,
  client: SyncApiClient,
  localWorkspaceId: Id,
): Promise<JoinResult> {
  const local = await database.workspaces.get(localWorkspaceId);
  if (!local) throw new Error(`There is no local workspace ${localWorkspaceId}.`);

  const existing = (await listAccountWorkspaces(client)).find(
    (summary) => summary.role === 'owner' || summary.role === 'editor',
  );

  if (!existing || existing.workspace.id === localWorkspaceId) {
    return claimWorkspace(database, client, local);
  }

  return mergeInto(database, local, existing);
}

/** Makes this device's workspace the account's, and queues everything in it. */
export async function claimWorkspace(
  database: NotoDatabase,
  client: SyncApiClient,
  local: Workspace,
): Promise<JoinResult> {
  const claimed = await call<WorkspaceSummary>(client, 'POST', `/v1/workspaces/${local.id}/claim`, {
    name: local.name,
    icon: local.icon,
    createdAt: local.createdAt,
    updatedAt: local.updatedAt,
  });

  // The server's copy now stands for the workspace: no longer local, owned,
  // and at the server's version, so the next change to it is pushed on that.
  await database.sync.applyRemote(
    { kind: 'workspace', entity: claimed.workspace },
    { baseVersion: claimed.version, dequeue: true },
  );

  return { workspaceId: local.id, mode: 'claimed', queued: await queueContent(database, local.id) };
}

/**
 * Moves this device's notes into the account's workspace. The ids stay, so a
 * link or an open tab keeps pointing at the same note; only `workspaceId`
 * changes. The emptied local workspace is purged, which also retires its
 * outbox entry the next time the engine looks.
 */
async function mergeInto(
  database: NotoDatabase,
  local: Workspace,
  target: WorkspaceSummary,
): Promise<JoinResult> {
  await database.sync.applyRemote(
    { kind: 'workspace', entity: target.workspace },
    { baseVersion: target.version },
  );

  const records = await contentOf(database, local.id);
  // Containers first: SQLite checks that a document's folder exists.
  for (const record of records) {
    await put(database, {
      ...record,
      entity: { ...record.entity, workspaceId: target.workspace.id },
    } as SyncRecord);
  }

  await database.workspaces.purge(local.id);
  return { workspaceId: target.workspace.id, mode: 'merged', queued: records.length };
}

/**
 * Queues what the outbox does not already hold. Content saved before schema
 * v2 never passed through the outbox; saving it again is what queues it.
 */
async function queueContent(database: NotoDatabase, workspaceId: Id): Promise<number> {
  const queued = new Set(
    (await database.outbox.list()).map((entry) => entityKey(entry.entityKind, entry.entityId)),
  );

  const records = await contentOf(database, workspaceId);
  for (const record of records) {
    if (!queued.has(entityKey(record.kind, record.entity.id))) await put(database, record);
  }
  return records.length;
}

/** Everything live in a workspace, folders parents-first, then documents, files and memory. */
async function contentOf(database: NotoDatabase, workspaceId: Id): Promise<SyncRecord[]> {
  const folders = await database.folders.listByWorkspace(workspaceId);
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const depth = (id: Id): number => {
    let level = 0;
    const seen = new Set<Id>();
    for (let parent = byId.get(id)?.parentId; parent && !seen.has(parent);) {
      seen.add(parent);
      level += 1;
      parent = byId.get(parent)?.parentId ?? null;
    }
    return level;
  };
  folders.sort((a, b) => depth(a.id) - depth(b.id));

  const documents = await database.documents.listByWorkspace(workspaceId);
  const files = (
    await Promise.all(documents.map((document) => database.files.listByDocument(document.id)))
  ).flat();
  const memory = await database.memory.listByWorkspace(workspaceId);

  return [
    ...folders.map((entity) => ({ kind: 'folder' as const, entity })),
    ...documents.map((entity) => ({ kind: 'document' as const, entity })),
    ...files.map((entity) => ({ kind: 'file' as const, entity })),
    ...memory.map((entity) => ({ kind: 'memory' as const, entity })),
  ];
}

const REPOSITORY: Record<
  Exclude<SyncEntityKind, 'workspace'>,
  (database: NotoDatabase, record: SyncRecord) => Promise<void>
> = {
  folder: (database, record) => database.folders.put(record.entity as never),
  document: (database, record) => database.documents.put(record.entity as never),
  file: (database, record) => database.files.put(record.entity as never),
  memory: (database, record) => database.memory.put(record.entity as never),
};

function put(database: NotoDatabase, record: SyncRecord): Promise<void> {
  if (record.kind === 'workspace') return database.workspaces.put(record.entity);
  return REPOSITORY[record.kind](database, record);
}
