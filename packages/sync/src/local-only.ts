import type { SyncState } from '@noto/types';

import type { SyncEngine, SyncStateListener } from './types';

/**
 * The default engine: it never talks to a network.
 *
 * Noto ships with this engine attached so the application always has a working
 * sync interface, and enabling the cloud becomes a matter of swapping the
 * engine rather than threading `if (syncEnabled)` through the app. Local
 * changes still collect in storage's outbox, ready for whenever a real engine
 * is attached.
 */
export class LocalOnlySyncEngine implements SyncEngine {
  private readonly listeners = new Set<SyncStateListener>();

  private currentState: SyncState = {
    status: 'disabled',
    lastSyncedAt: null,
    pendingChanges: 0,
    error: null,
  };

  get state(): SyncState {
    return this.currentState;
  }

  async start(): Promise<void> {
    this.setState({ status: 'disabled' });
  }

  async stop(): Promise<void> {
    this.listeners.clear();
  }

  notifyChange(): void {
    // Nothing to push to. The outbox keeps the change.
  }

  async sync(): Promise<void> {
    // Nothing to do: with no cloud configured, local storage is already the
    // source of truth.
  }

  subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(patch: Partial<SyncState>): void {
    this.currentState = { ...this.currentState, ...patch };
    for (const listener of this.listeners) listener(this.currentState);
  }
}

export function createLocalOnlySyncEngine(): SyncEngine {
  return new LocalOnlySyncEngine();
}
