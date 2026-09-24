import type { Id, IsoDateTime } from './common.ts';
import type { NotoDocument } from './document.ts';
import type { NotoFile } from './file.ts';
import type { Folder } from './folder.ts';
import type { MemoryItem } from './memory.ts';
import type { Workspace } from './workspace.ts';

export type SyncStatus = 'disabled' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt: IsoDateTime | null;
  /** Number of local changes not yet pushed. */
  pendingChanges: number;
  error: string | null;
}

export type SyncEntityKind = 'document' | 'folder' | 'file' | 'workspace' | 'memory';

export type SyncOperation = 'create' | 'update' | 'delete';

/**
 * An entity changed on this device and not yet pushed.
 *
 * One row per entity, not per edit: saving a document forty times while
 * offline leaves one entry, so the outbox stays as small as the set of things
 * that changed however long sync has been off. `seq` increases on every
 * change, which is how a push acknowledges exactly what it sent and not an
 * edit that arrived while it was in flight.
 */
export interface OutboxEntry {
  entityKind: SyncEntityKind;
  entityId: Id;
  operation: SyncOperation;
  seq: number;
  queuedAt: IsoDateTime;
}

/** The entity each kind carries. */
export interface SyncEntityMap {
  workspace: Workspace;
  folder: Folder;
  document: NotoDocument;
  file: NotoFile;
  memory: MemoryItem;
}

/**
 * An entity together with its kind, so one list can carry all five.
 *
 * On the wire the entity leaves out `version` and `contentHash`: both are this
 * device's own bookkeeping, and the receiving side computes its own.
 */
export type SyncRecord = {
  [K in SyncEntityKind]: { kind: K; entity: SyncEntityMap[K] };
}[SyncEntityKind];

/*
 * The sync protocol: `POST /v1/sync/push` and `POST /v1/sync/pull`.
 *
 * Every entity has a server version that moves on by one each time the server
 * accepts a change to it. A push says which version its change was made on top
 * of (`baseVersion`); the server applies it only if that is still the current
 * version, and otherwise answers with what it has instead — a conflict, which
 * the client resolves and pushes again.
 */

export type SyncPushChange = SyncRecord & {
  operation: SyncOperation;
  /** The server version this change was made on. `0` for an entity the server has never had. */
  baseVersion: number;
};

export interface SyncPushRequest {
  deviceId: Id;
  workspaceId: Id;
  changes: SyncPushChange[];
}

/** An entity as the server holds it. */
export type RemoteChange = SyncRecord & {
  version: number;
  /** Position in the workspace's change log. */
  seq: number;
  /** The device that made the change, when the server knows it. */
  deviceId: Id | null;
  deviceName: string | null;
};

export interface SyncPushResult {
  /** Changes the server accepted, with the version each now has. */
  applied: { kind: SyncEntityKind; id: Id; version: number }[];
  /** Changes it refused because the entity moved on; each carries the server's copy. */
  conflicts: RemoteChange[];
}

export interface SyncPullRequest {
  deviceId: Id;
  workspaceId: Id;
  /** The last change-log position this device has applied. `0` pulls everything. */
  sinceSeq: number;
  limit?: number;
}

export interface SyncPullResult {
  /** Changes after `sinceSeq` made by other devices, oldest first. */
  changes: RemoteChange[];
  /** The position to pull from next time. */
  seq: number;
  hasMore: boolean;
  /** The log was trimmed past this device's cursor: pull again from `0`. */
  fullResyncRequired: boolean;
}
