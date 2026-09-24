import type { SyncState } from '@noto/types';

export type SyncStateListener = (state: SyncState) => void;

/**
 * The synchronization contract.
 *
 * Noto is local-first: the app writes to local storage and is fully usable with
 * no engine attached. Storage records every local change in its outbox; a sync
 * engine drains that outbox to the cloud and brings other devices' changes
 * back, in the background — it is never on the read or write path.
 */
export interface SyncEngine {
  readonly state: SyncState;

  start(): Promise<void>;
  stop(): Promise<void>;

  /** Tells the engine something was saved locally, so it can push soon. */
  notifyChange(): void;

  /** Pushes queued changes and pulls remote ones. Resolves when the pass completes. */
  sync(): Promise<void>;

  /** Subscribes to state changes; returns an unsubscribe function. */
  subscribe(listener: SyncStateListener): () => void;
}
