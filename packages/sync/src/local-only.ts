import { createId, systemClock } from '@noto/core';
import type { SyncChange, SyncEntityKind, SyncOperation, SyncState } from '@noto/types';

import { InMemoryQueue } from './queue';
import type { SyncEngine, SyncStateListener } from './types';

/**
 * The default engine: it records changes but never talks to a network.
 *
 * Noto ships with this engine attached so the application always has a working
 * sync interface, and enabling the cloud becomes a matter of swapping the
 * engine rather than threading `if (syncEnabled)` through the app.
 */
export class LocalOnlySyncEngine implements SyncEngine {
  private readonly queue = new InMemoryQueue();
  private readonly listeners = new Set<SyncStateListener>();
  private localVersion = 0;

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

  async enqueue(kind: SyncEntityKind, entityId: string, operation: SyncOperation): Promise<void> {
    this.localVersion += 1;
    this.queue.add({
      id: createId(),
      entityKind: kind,
      entityId,
      operation,
      localVersion: this.localVersion,
      queuedAt: systemClock.now(),
    });

    this.setState({ pendingChanges: this.queue.size });
  }

  async sync(): Promise<void> {
    // Nothing to do: with no cloud configured, local storage is already the
    // source of truth. Changes stay queued for whenever an engine is attached.
  }

  subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Exposed so the queue can be handed to a real engine when sync is enabled. */
  get pending(): readonly SyncChange[] {
    return this.queue.peekAll();
  }

  private setState(patch: Partial<SyncState>): void {
    this.currentState = { ...this.currentState, ...patch };
    for (const listener of this.listeners) listener(this.currentState);
  }
}

export function createLocalOnlySyncEngine(): SyncEngine {
  return new LocalOnlySyncEngine();
}
