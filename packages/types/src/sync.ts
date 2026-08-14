import type { Id, IsoDateTime } from './common';

export type SyncStatus = 'disabled' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt: IsoDateTime | null;
  /** Number of local changes not yet pushed. */
  pendingChanges: number;
  error: string | null;
}

export type SyncEntityKind = 'document' | 'folder' | 'file' | 'workspace';

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
