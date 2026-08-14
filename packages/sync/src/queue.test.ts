import type { SyncChange } from '@noto/types';
import { describe, expect, it } from 'vitest';

import { InMemoryQueue } from './queue';

const change = (overrides: Partial<SyncChange> = {}): SyncChange => ({
  id: 'change-1',
  entityKind: 'document',
  entityId: 'doc-1',
  operation: 'update',
  localVersion: 1,
  queuedAt: '2026-08-13T10:00:00.000Z',
  ...overrides,
});

describe('InMemoryQueue', () => {
  it('collapses repeated changes to the same entity', () => {
    const queue = new InMemoryQueue();
    queue.add(change({ id: 'a', localVersion: 1 }));
    queue.add(change({ id: 'b', localVersion: 2 }));

    expect(queue.size).toBe(1);
    expect(queue.peekAll()[0]?.localVersion).toBe(2);
  });

  it('keeps changes to different entities apart', () => {
    const queue = new InMemoryQueue();
    queue.add(change({ id: 'a', entityId: 'doc-1' }));
    queue.add(change({ id: 'b', entityId: 'doc-2', localVersion: 2 }));
    queue.add(change({ id: 'c', entityKind: 'folder', entityId: 'doc-1', localVersion: 3 }));

    expect(queue.size).toBe(3);
  });

  it('ignores a change that is older than the one already queued', () => {
    const queue = new InMemoryQueue();
    queue.add(change({ id: 'newer', localVersion: 5 }));
    queue.add(change({ id: 'older', localVersion: 2 }));

    expect(queue.peekAll()[0]?.id).toBe('newer');
  });

  it('keeps a pending create a create when it is later updated', () => {
    const queue = new InMemoryQueue();
    queue.add(change({ id: 'a', operation: 'create', localVersion: 1 }));
    queue.add(change({ id: 'b', operation: 'update', localVersion: 2 }));

    expect(queue.peekAll()[0]?.operation).toBe('create');
  });

  it('lets a delete supersede a pending create', () => {
    const queue = new InMemoryQueue();
    queue.add(change({ id: 'a', operation: 'create', localVersion: 1 }));
    queue.add(change({ id: 'b', operation: 'delete', localVersion: 2 }));

    expect(queue.peekAll()[0]?.operation).toBe('delete');
  });

  it('orders changes by local version', () => {
    const queue = new InMemoryQueue();
    queue.add(change({ id: 'a', entityId: 'doc-2', localVersion: 9 }));
    queue.add(change({ id: 'b', entityId: 'doc-1', localVersion: 3 }));

    expect(queue.peekAll().map((c) => c.entityId)).toEqual(['doc-1', 'doc-2']);
  });

  it('removes by change id and clears', () => {
    const queue = new InMemoryQueue();
    queue.add(change({ id: 'a', entityId: 'doc-1' }));
    queue.add(change({ id: 'b', entityId: 'doc-2' }));

    queue.remove('a');
    expect(queue.size).toBe(1);

    queue.clear();
    expect(queue.size).toBe(0);
  });
});
