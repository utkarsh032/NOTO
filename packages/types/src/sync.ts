import type { Id, IsoDateTime } from './common.ts';

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

/** A single queued local mutation awaiting push to the cloud. */
export interface SyncChange {
  id: Id;
  entityKind: SyncEntityKind;
  entityId: Id;
  operation: SyncOperation;
  /** Monotonic local clock used to order changes before they reach the server. */
  localVersion: number;
  queuedAt: IsoDateTime;
}

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
