import type { SyncChange } from '@noto/types';

import type { SyncQueue } from './types';

/**
 * An in-memory change queue.
 *
 * Queued changes are ordered by `localVersion`, and a newer change for the same
 * entity replaces the older one — pushing three edits to one document should
 * cost one request, not three.
 */
export class InMemoryQueue implements SyncQueue {
  private readonly changes = new Map<string, SyncChange>();

  add(change: SyncChange): void {
    const key = `${change.entityKind}:${change.entityId}`;
    const existing = this.changes.get(key);

    if (existing && existing.localVersion > change.localVersion) return;

    // A pending create followed by an update is still, to the server, a create.
    const operation =
      existing?.operation === 'create' && change.operation === 'update'
        ? 'create'
        : change.operation;

    this.changes.set(key, { ...change, operation });
  }

  peekAll(): readonly SyncChange[] {
    return [...this.changes.values()].sort((a, b) => a.localVersion - b.localVersion);
  }

  remove(changeId: string): void {
    for (const [key, change] of this.changes) {
      if (change.id === changeId) {
        this.changes.delete(key);
        return;
      }
    }
  }

  clear(): void {
    this.changes.clear();
  }

  get size(): number {
    return this.changes.size;
  }
}
