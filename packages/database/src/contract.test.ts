import 'fake-indexeddb/auto';

import { DatabaseSync } from 'node:sqlite';

import { createDefaultWorkspace, createDocument, fixedClock } from '@noto/core';
import type { DocumentVersionRecord, MemoryItem, NotoDocument } from '@noto/types';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InMemoryDatabase } from './memory';
import type { SqlDriver, SqlValue } from './sqlite/driver';
import { MIGRATIONS } from './sqlite/schema';
import { SqliteDatabase } from './sqlite/sqlite-database';
import type { NotoDatabase } from './types';
import { DexieDatabase } from './web/dexie-database';

/*
 * One contract, three engines.
 *
 * The in-memory store is the reference; SQLite (desktop and mobile) and
 * IndexedDB (web) must agree with it on everything the application can
 * observe. Each engine runs the same suite, so a behaviour that differs
 * between platforms fails here rather than on somebody's phone.
 */

/** A `SqlDriver` over Node's built-in SQLite, the engine the desktop ships. */
function nodeSqliteDriver(file = ':memory:'): SqlDriver & { db: DatabaseSync } {
  const db = new DatabaseSync(file);
  let depth = 0;

  return {
    db,
    execute: async (sql, params = []) => {
      if (params.length === 0) db.exec(sql);
      else db.prepare(sql).run(...(params as SqlValue[]));
    },
    select: async <TRow>(sql: string, params: readonly SqlValue[] = []) =>
      db.prepare(sql).all(...(params as SqlValue[])) as TRow[],
    transaction: async (work) => {
      if (depth > 0) return work();
      depth += 1;
      db.exec('BEGIN');
      try {
        const result = await work();
        db.exec('COMMIT');
        return result;
      } catch (cause) {
        db.exec('ROLLBACK');
        throw cause;
      } finally {
        depth -= 1;
      }
    },
    close: async () => db.close(),
  };
}

let databaseCounter = 0;

const ENGINES: [string, () => NotoDatabase][] = [
  ['in-memory', () => new InMemoryDatabase()],
  ['sqlite', () => new SqliteDatabase(nodeSqliteDriver())],
  ['indexeddb', () => new DexieDatabase(`noto-contract-${(databaseCounter += 1)}`)],
];

let idCounter = 0;
const nextId = () => `id-${String((idCounter += 1)).padStart(4, '0')}`;

const body = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

function makeDocument(workspaceId: string, text: string, overrides: Partial<NotoDocument> = {}) {
  return {
    ...createDocument(
      { workspaceId, title: text, content: body(text) },
      { generateId: nextId, clock: fixedClock('2026-09-01T10:00:00.000Z') },
    ),
    ...overrides,
  };
}

function makeMemory(workspaceId: string, overrides: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: nextId(),
    workspaceId,
    kind: 'note',
    title: 'A note',
    content: 'Remember the milk',
    source: 'Quick Note',
    url: null,
    tags: [],
    isPinned: false,
    sizeBytes: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

function makeVersion(
  documentId: string,
  workspaceId: string,
  createdAt: string,
): DocumentVersionRecord {
  return {
    id: nextId(),
    documentId,
    workspaceId,
    title: 'Title',
    content: body(createdAt),
    wordCount: 1,
    contentHash: 'hash',
    origin: 'autosave',
    summary: null,
    createdAt,
  };
}

describe.each(ENGINES)('NotoDatabase contract — %s', (_name, create) => {
  let db: NotoDatabase;
  let workspaceId: string;

  beforeEach(async () => {
    db = create();
    await db.open();
    const workspace = createDefaultWorkspace({ generateId: nextId });
    workspaceId = workspace.id;
    await db.workspaces.put(workspace);
    await db.outbox.clear();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('versions and the outbox', () => {
    it('counts saves, whatever version the caller sends', async () => {
      const document = makeDocument(workspaceId, 'Hello');

      await db.documents.put(document);
      expect((await db.documents.get(document.id))?.version).toBe(1);

      await db.documents.put({ ...document, title: 'Again', version: 99 });
      await db.documents.put({ ...document, title: 'And again' });
      expect((await db.documents.get(document.id))?.version).toBe(3);
    });

    it('fingerprints the body, and only the body', async () => {
      const document = makeDocument(workspaceId, 'Hello');
      await db.documents.put(document);
      const first = (await db.documents.get(document.id))?.contentHash;

      await db.documents.put({ ...document, title: 'Renamed' });
      expect((await db.documents.get(document.id))?.contentHash).toBe(first);

      await db.documents.put({ ...document, content: body('Changed') });
      expect((await db.documents.get(document.id))?.contentHash).not.toBe(first);
    });

    it('keeps one outbox entry per entity, and remembers it was never pushed', async () => {
      const document = makeDocument(workspaceId, 'Hello');
      await db.documents.put(document);
      await db.documents.put({ ...document, title: 'Edited' });

      const entries = await db.outbox.list();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        entityKind: 'document',
        entityId: document.id,
        operation: 'create',
      });
    });

    it('queues an update after a push, and a delete for a tombstone', async () => {
      const document = makeDocument(workspaceId, 'Hello');
      await db.documents.put(document);
      await db.outbox.acknowledge(await db.outbox.list());
      expect(await db.outbox.count()).toBe(0);

      await db.documents.put({ ...document, title: 'Edited' });
      expect((await db.outbox.list())[0]?.operation).toBe('update');

      await db.documents.put({ ...document, deletedAt: '2026-09-02T00:00:00.000Z' });
      expect((await db.outbox.list())[0]?.operation).toBe('delete');
    });

    it('does not acknowledge an edit made while a push was in flight', async () => {
      const document = makeDocument(workspaceId, 'Hello');
      await db.documents.put(document);
      const sent = await db.outbox.list();

      await db.documents.put({ ...document, title: 'Typed during the push' });
      await db.outbox.acknowledge(sent);

      expect(await db.outbox.count()).toBe(1);
    });

    it('lists the outbox oldest first', async () => {
      const a = makeDocument(workspaceId, 'A');
      const b = makeDocument(workspaceId, 'B');
      await db.documents.put(a);
      await db.documents.put(b);
      await db.documents.put({ ...a, title: 'A again' });

      expect((await db.outbox.list()).map((entry) => entry.entityId)).toEqual([b.id, a.id]);
      expect(await db.outbox.list(1)).toHaveLength(1);
    });
  });

  describe('tags', () => {
    it('counts tags on live documents, most used first', async () => {
      await db.documents.put(makeDocument(workspaceId, 'One', { tags: ['work', 'ideas'] }));
      await db.documents.put(makeDocument(workspaceId, 'Two', { tags: ['work'] }));
      await db.documents.put(
        makeDocument(workspaceId, 'Gone', {
          tags: ['work', 'trash'],
          deletedAt: '2026-09-02T00:00:00.000Z',
        }),
      );

      expect(await db.documents.listTags(workspaceId)).toEqual([
        { tag: 'work', count: 2 },
        { tag: 'ideas', count: 1 },
      ]);
    });

    it('filters documents by tag, and follows a tag being removed', async () => {
      const tagged = makeDocument(workspaceId, 'Tagged', { tags: ['work'] });
      await db.documents.put(tagged);
      await db.documents.put(makeDocument(workspaceId, 'Plain'));

      expect(
        (await db.documents.listByWorkspace(workspaceId, { tag: 'work' })).map((d) => d.id),
      ).toEqual([tagged.id]);

      await db.documents.put({ ...tagged, tags: [] });
      expect(await db.documents.listByWorkspace(workspaceId, { tag: 'work' })).toEqual([]);
    });
  });

  describe('memory', () => {
    it('round-trips an item and bumps its version', async () => {
      const item = makeMemory(workspaceId, { tags: ['groceries'], isPinned: true });
      await db.memory.put(item);

      expect(await db.memory.get(item.id)).toEqual({ ...item, version: 1 });
      expect(await db.memory.get('missing')).toBeNull();
    });

    it('filters by kind and pin, newest first, without tombstones', async () => {
      const older = makeMemory(workspaceId, {
        kind: 'link',
        updatedAt: '2026-09-01T09:00:00.000Z',
      });
      const newer = makeMemory(workspaceId, {
        kind: 'link',
        isPinned: true,
        updatedAt: '2026-09-01T11:00:00.000Z',
      });
      const note = makeMemory(workspaceId);
      const gone = makeMemory(workspaceId, { deletedAt: '2026-09-02T00:00:00.000Z' });
      await db.memory.putMany([older, newer, note, gone]);

      expect(
        (await db.memory.listByWorkspace(workspaceId, { kind: 'link' })).map((m) => m.id),
      ).toEqual([newer.id, older.id]);
      expect(
        (await db.memory.listByWorkspace(workspaceId, { pinnedOnly: true })).map((m) => m.id),
      ).toEqual([newer.id]);
      expect(await db.memory.listByWorkspace(workspaceId)).toHaveLength(3);
    });

    it('searches title, content, source and tags', async () => {
      const byContent = makeMemory(workspaceId, { content: 'The Quarterly numbers' });
      const byTag = makeMemory(workspaceId, { tags: ['quarterly'] });
      await db.memory.putMany([byContent, byTag, makeMemory(workspaceId)]);

      const hits = await db.memory.search(workspaceId, 'QUARTERLY');
      expect(hits.map((m) => m.id).sort()).toEqual([byContent.id, byTag.id].sort());
    });

    it('queues memory for sync', async () => {
      await db.memory.put(makeMemory(workspaceId));
      expect((await db.outbox.list())[0]?.entityKind).toBe('memory');
    });
  });

  describe('versions', () => {
    it('lists newest first and prunes to the newest few', async () => {
      const document = makeDocument(workspaceId, 'Versioned');
      await db.documents.put(document);

      for (const hour of ['09', '10', '11', '12']) {
        await db.versions.add(
          makeVersion(document.id, workspaceId, `2026-09-01T${hour}:00:00.000Z`),
        );
      }

      const listed = await db.versions.listByDocument(document.id);
      expect(listed.map((v) => v.createdAt.slice(11, 13))).toEqual(['12', '11', '10', '09']);
      expect(await db.versions.listByDocument(document.id, { limit: 2 })).toHaveLength(2);

      await db.versions.prune(document.id, 2);
      const kept = await db.versions.listByDocument(document.id);
      expect(kept.map((v) => v.createdAt.slice(11, 13))).toEqual(['12', '11']);
      expect(await db.versions.get(kept[0]!.id)).toEqual(kept[0]);
    });

    it('does not queue versions for sync', async () => {
      const document = makeDocument(workspaceId, 'Versioned');
      await db.documents.put(document);
      await db.outbox.clear();

      await db.versions.add(makeVersion(document.id, workspaceId, '2026-09-01T09:00:00.000Z'));
      expect(await db.outbox.count()).toBe(0);
    });

    it('survives a save of its document', async () => {
      // An upsert must not cascade: REPLACE would delete the parent row first.
      const document = makeDocument(workspaceId, 'Versioned');
      await db.documents.put(document);
      await db.versions.add(makeVersion(document.id, workspaceId, '2026-09-01T09:00:00.000Z'));

      await db.documents.put({ ...document, title: 'Saved again' });
      expect(await db.versions.listByDocument(document.id)).toHaveLength(1);
    });
  });

  describe('local state', () => {
    it('stores, lists by prefix and deletes values', async () => {
      await db.localState.set('recovery:a', { text: 'unsaved', at: 1 });
      await db.localState.set('recovery:b', { text: 'more' });
      await db.localState.set('draft:quick-note', 'jot');

      expect(await db.localState.get('recovery:a')).toEqual({ text: 'unsaved', at: 1 });
      expect(await db.localState.get('draft:quick-note')).toBe('jot');
      expect(await db.localState.get('missing')).toBeNull();
      expect((await db.localState.keys('recovery:')).sort()).toEqual(['recovery:a', 'recovery:b']);
      expect(await db.localState.keys('Recovery:')).toEqual([]);

      await db.localState.delete('recovery:a');
      expect(await db.localState.get('recovery:a')).toBeNull();
    });
  });

  it('clears everything', async () => {
    await db.documents.put(makeDocument(workspaceId, 'Hello', { tags: ['x'] }));
    await db.memory.put(makeMemory(workspaceId));
    await db.localState.set('k', 1);

    await db.clear();

    expect(await db.workspaces.list()).toEqual([]);
    expect(await db.outbox.count()).toBe(0);
    expect(await db.localState.get('k')).toBeNull();
  });
});

describe('opening a new SQLite database', () => {
  it('migrates once when opened twice at the same time', async () => {
    const driver = nodeSqliteDriver();
    const db = new SqliteDatabase(driver);

    await Promise.all([db.open(), db.open()]);

    const workspace = createDefaultWorkspace();
    await db.workspaces.put(workspace);
    expect(await db.workspaces.list()).toHaveLength(1);
  });
});

describe('upgrading from schema version 1', () => {
  it('migrates a SQLite database in place, keeping documents and indexing their tags', async () => {
    const driver = nodeSqliteDriver();
    for (const statement of MIGRATIONS[1]!) driver.db.exec(statement);
    driver.db.exec('PRAGMA user_version = 1');

    driver.db
      .prepare('INSERT INTO workspaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run('w1', 'Mine', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    driver.db
      .prepare(
        'INSERT INTO documents (id, workspace_id, title, content, tags, created_at, updated_at)' +
          ' VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'd1',
        'w1',
        'Old note',
        JSON.stringify(body('from version one')),
        '["kept","work"]',
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z',
      );

    const db = new SqliteDatabase(driver);
    await db.open();

    const document = await db.documents.get('d1');
    expect(document?.title).toBe('Old note');
    expect(document?.version).toBe(1);
    expect(await db.documents.listTags('w1')).toEqual([
      { tag: 'kept', count: 1 },
      { tag: 'work', count: 1 },
    ]);

    const [row] = driver.db.prepare('PRAGMA user_version').all() as { user_version: number }[];
    expect(row?.user_version).toBe(2);

    // Opening again is a no-op, not a second migration.
    await db.open();
    await db.close();
  });

  it('upgrades an IndexedDB database in place', async () => {
    const name = `noto-upgrade-${Date.now()}`;

    const legacy = new Dexie(name);
    legacy.version(1).stores({
      workspaces: 'id, updatedAt',
      folders: 'id, workspaceId, parentId, updatedAt, [workspaceId+parentId]',
      documents:
        'id, workspaceId, folderId, status, updatedAt, createdAt, [workspaceId+folderId], [workspaceId+status]',
      files: 'id, workspaceId, documentId, updatedAt',
    });
    await legacy.open();
    await legacy
      .table('documents')
      .put(makeDocument('w1', 'From version one', { id: 'd1', tags: ['kept'] }));
    legacy.close();

    const db = new DexieDatabase(name);
    await db.open();

    expect((await db.documents.get('d1'))?.title).toBe('From version one');
    expect(await db.documents.listTags('w1')).toEqual([{ tag: 'kept', count: 1 }]);

    await db.documents.put((await db.documents.get('d1'))!);
    expect((await db.documents.get('d1'))?.version).toBe(1);

    await db.close();
  });
});
