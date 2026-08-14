import type { SyncChange, SyncEntityKind, SyncOperation, SyncState } from '@noto/types';

export type SyncStateListener = (state: SyncState) => void;

/**
 * The synchronization contract.
 *
 * Noto is local-first: the app writes to local storage and is fully usable with
 * no engine attached. A sync engine observes those writes and reconciles them
 * with the cloud in the background — it is never on the read or write path.
 */
export interface SyncEngine {
  readonly state: SyncState;

  start(): Promise<void>;
  stop(): Promise<void>;

  /** Records a local mutation for eventual push. */
  enqueue(kind: SyncEntityKind, entityId: string, operation: SyncOperation): Promise<void>;

  /** Pushes queued changes and pulls remote ones. Resolves when the pass completes. */
  sync(): Promise<void>;

  /** Subscribes to state changes; returns an unsubscribe function. */
  subscribe(listener: SyncStateListener): () => void;
}

export interface SyncQueue {
  add(change: SyncChange): void;
  peekAll(): readonly SyncChange[];
  remove(changeId: string): void;
  clear(): void;
  readonly size: number;
}
