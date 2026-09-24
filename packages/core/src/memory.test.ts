import { describe, expect, it } from 'vitest';

import { fixedClock } from './clock.ts';
import { createMemoryItem, deleteMemoryItem, memoryTitleFrom, updateMemoryItem } from './memory.ts';

const deps = { clock: fixedClock('2026-09-23T10:00:00.000Z'), generateId: () => 'm1' };

describe('memoryTitleFrom', () => {
  it('takes the first non-empty line', () => {
    expect(memoryTitleFrom('\n  Buy milk  \nand eggs')).toBe('Buy milk');
  });

  it('cuts a long line at a word', () => {
    const title = memoryTitleFrom(`${'word '.repeat(30)}end`);
    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(81);
  });

  it('falls back to the link host, then to Untitled', () => {
    expect(memoryTitleFrom('', 'https://www.example.com/a/b')).toBe('example.com');
    expect(memoryTitleFrom('   ')).toBe('Untitled');
  });
});

describe('memory items', () => {
  it('creates an item with a derived title and unique tags', () => {
    const item = createMemoryItem(
      { workspaceId: 'w1', kind: 'note', content: 'A thought\nmore', tags: ['a', 'a', 'b'] },
      deps,
    );

    expect(item).toMatchObject({
      id: 'm1',
      title: 'A thought',
      tags: ['a', 'b'],
      isPinned: false,
      deletedAt: null,
      createdAt: '2026-09-23T10:00:00.000Z',
    });
  });

  it('updates and soft-deletes with a new timestamp', () => {
    const item = createMemoryItem({ workspaceId: 'w1', kind: 'link', content: '' }, deps);
    const later = { clock: fixedClock('2026-09-24T10:00:00.000Z') };

    expect(updateMemoryItem(item, { isPinned: true }, later)).toMatchObject({
      isPinned: true,
      updatedAt: '2026-09-24T10:00:00.000Z',
    });
    expect(deleteMemoryItem(item, later).deletedAt).toBe('2026-09-24T10:00:00.000Z');
  });
});
