import { createDocument, createDefaultWorkspace, fixedClock } from '@noto/core';
import type { NotoDocument } from '@noto/types';
import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryDatabase } from './memory';
import type { NotoDatabase } from './types';

let idCounter = 0;
const deps = { generateId: () => `id-${(idCounter += 1)}` };

const doc = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

function seedDocument(
  workspaceId: string,
  text: string,
  at: string,
  overrides: Partial<NotoDocument> = {},
): NotoDocument {
  return {
    ...createDocument(
      { workspaceId, content: doc(text), title: text },
      { ...deps, clock: fixedClock(at) },
    ),
    ...overrides,
  };
}

describe('InMemoryDatabase', () => {
  let db: InMemoryDatabase;

  beforeEach(async () => {
    db = new InMemoryDatabase();
    await db.open();
  });

  it('satisfies the NotoDatabase contract', () => {
    const asContract: NotoDatabase = db;
    expect(asContract.documents).toBeDefined();
  });

  it('round-trips a workspace', async () => {
    const workspace = createDefaultWorkspace(deps);
    await db.workspaces.put(workspace);

    expect(await db.workspaces.get(workspace.id)).toEqual(workspace);
    expect(await db.workspaces.get('missing')).toBeNull();
  });

  it('lists documents newest first', async () => {
    await db.documents.putMany([
      seedDocument('ws-1', 'older', '2026-08-10T10:00:00.000Z'),
      seedDocument('ws-1', 'newer', '2026-08-12T10:00:00.000Z'),
    ]);

    const documents = await db.documents.listByWorkspace('ws-1');
    expect(documents.map((d) => d.title)).toEqual(['newer', 'older']);
  });

  it('scopes queries to a workspace', async () => {
    await db.documents.putMany([
      seedDocument('ws-1', 'mine', '2026-08-10T10:00:00.000Z'),
      seedDocument('ws-2', 'theirs', '2026-08-10T10:00:00.000Z'),
    ]);

    const documents = await db.documents.listByWorkspace('ws-1');
    expect(documents.map((d) => d.title)).toEqual(['mine']);
  });

  it('hides tombstones unless they are asked for', async () => {
    await db.documents.putMany([
      seedDocument('ws-1', 'live', '2026-08-10T10:00:00.000Z'),
      seedDocument('ws-1', 'trashed', '2026-08-11T10:00:00.000Z', {
        deletedAt: '2026-08-12T10:00:00.000Z',
      }),
    ]);

    expect(await db.documents.countByWorkspace('ws-1')).toBe(1);
    expect((await db.documents.listByWorkspace('ws-1')).map((d) => d.title)).toEqual(['live']);
    expect(
      (await db.documents.listByWorkspace('ws-1', { includeDeleted: true })).map((d) => d.title),
    ).toEqual(['trashed', 'live']);
  });

  it('filters by folder, including the workspace root', async () => {
    await db.documents.putMany([
      seedDocument('ws-1', 'root doc', '2026-08-10T10:00:00.000Z'),
      seedDocument('ws-1', 'filed doc', '2026-08-11T10:00:00.000Z', { folderId: 'folder-1' }),
    ]);

    expect(
      (await db.documents.listByWorkspace('ws-1', { folderId: 'folder-1' })).map((d) => d.title),
    ).toEqual(['filed doc']);
    expect(
      (await db.documents.listByWorkspace('ws-1', { folderId: null })).map((d) => d.title),
    ).toEqual(['root doc']);
  });

  it('searches title and excerpt case-insensitively', async () => {
    await db.documents.putMany([
      seedDocument('ws-1', 'Quarterly Report', '2026-08-10T10:00:00.000Z'),
      seedDocument('ws-1', 'Grocery list', '2026-08-11T10:00:00.000Z'),
    ]);

    expect((await db.documents.search('ws-1', 'quarterly')).map((d) => d.title)).toEqual([
      'Quarterly Report',
    ]);
    expect(await db.documents.search('ws-1', 'nothing here')).toEqual([]);
    expect(await db.documents.search('ws-1', '   ')).toHaveLength(2);
  });

  it('paginates with limit and offset', async () => {
    await db.documents.putMany([
      seedDocument('ws-1', 'a', '2026-08-13T10:00:00.000Z'),
      seedDocument('ws-1', 'b', '2026-08-12T10:00:00.000Z'),
      seedDocument('ws-1', 'c', '2026-08-11T10:00:00.000Z'),
    ]);

    const page = await db.documents.listByWorkspace('ws-1', { limit: 2, offset: 1 });
    expect(page.map((d) => d.title)).toEqual(['b', 'c']);
  });

  it('overwrites on put rather than duplicating', async () => {
    const document = seedDocument('ws-1', 'first', '2026-08-10T10:00:00.000Z');
    await db.documents.put(document);
    await db.documents.put({ ...document, title: 'second' });

    const documents = await db.documents.listByWorkspace('ws-1');
    expect(documents).toHaveLength(1);
    expect(documents[0]?.title).toBe('second');
  });

  it('clears every store', async () => {
    await db.workspaces.put(createDefaultWorkspace(deps));
    await db.documents.put(seedDocument('ws-1', 'doc', '2026-08-10T10:00:00.000Z'));

    await db.clear();

    expect(await db.workspaces.list()).toEqual([]);
    expect(await db.documents.listByWorkspace('ws-1')).toEqual([]);
  });
});
