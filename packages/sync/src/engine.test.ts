import { DatabaseSync } from 'node:sqlite';

import { createDocument, createFolder, createWorkspace, fixedClock } from '@noto/core';
import { InMemoryDatabase, type NotoDatabase } from '@noto/database';
import { SqliteDatabase, type SqlDriver, type SqlValue } from '@noto/database/sqlite';
import type { NotoDocument, SyncRecord } from '@noto/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Connectivity } from './connectivity';
import { CloudSyncEngine, type CloudSyncOptions, type SyncConflict } from './engine';
import { InMemorySyncServer } from './testing/memory-server';
import { type SyncTransport, SyncTransportError } from './transport';

/*
 * Two devices, one server.
 *
 * Each device has its own database and engine; the server is the reference
 * implementation of the sync protocol. The suite runs on the in-memory store
 * and on real SQLite, which checks foreign keys — so a change applied before
 * the folder or workspace it points at fails here, not on a phone.
 */

function sqliteDriver(): SqlDriver {
  const db = new DatabaseSync(':memory:');
  let depth = 0;

  return {
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

const ENGINES: [string, () => NotoDatabase][] = [
  ['in-memory', () => new InMemoryDatabase()],
  ['sqlite', () => new SqliteDatabase(sqliteDriver())],
];

const WORKSPACE_ID = 'w1';

/** Minute `n` of a fixed day, so "newer" is always explicit. */
const at = (minute: number) => new Date(Date.UTC(2026, 8, 1, 10, minute)).toISOString();

const body = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

let idCounter = 0;
const nextId = () => `id-${(idCounter += 1)}`;

function newDocument(text: string, overrides: Partial<NotoDocument> = {}): NotoDocument {
  return {
    ...createDocument(
      { workspaceId: WORKSPACE_ID, title: text, content: body(text) },
      { generateId: nextId, clock: fixedClock(at(0)) },
    ),
    ...overrides,
  };
}

interface Device {
  name: string;
  db: NotoDatabase;
  engine: CloudSyncEngine;
  online: boolean;
  /** Server errors to throw before answering normally. */
  failNext: number;
  /** Runs inside the next push, before the server sees it. */
  duringPush: (() => Promise<void>) | null;
  conflicts: SyncConflict[];
  received: SyncRecord[];
  connectivity: Connectivity & { set(online: boolean): void };
  restart(): void;
}

function fakeConnectivity(): Connectivity & { set(online: boolean): void } {
  const listeners = new Set<(online: boolean) => void>();
  let online = true;
  return {
    get online() {
      return online;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(value) {
      online = value;
      for (const listener of listeners) listener(value);
    },
  };
}

describe.each(ENGINES)('sync between two devices — %s', (_name, createDatabase) => {
  let server: InMemorySyncServer;
  const devices: Device[] = [];

  function device(name: string, options: Partial<CloudSyncOptions> = {}): Device {
    const connectivity = fakeConnectivity();

    const self: Device = {
      name,
      db: createDatabase(),
      engine: undefined as unknown as CloudSyncEngine,
      online: true,
      failNext: 0,
      duringPush: null,
      conflicts: [],
      received: [],
      connectivity,
      restart() {
        self.received = [];
        self.engine = createEngine();
      },
    };

    const reachable = () => {
      if (!self.online) throw new SyncTransportError('Offline', 0);
      if (self.failNext > 0) {
        self.failNext -= 1;
        throw new SyncTransportError('The server had a problem.', 500);
      }
    };

    const transport: SyncTransport = {
      push: async (request) => {
        reachable();
        const during = self.duringPush;
        self.duringPush = null;
        await during?.();
        return server.push(request);
      },
      pull: async (request) => {
        reachable();
        return server.pull(request);
      },
    };

    const createEngine = () =>
      new CloudSyncEngine({
        database: self.db,
        transport,
        workspaceId: WORKSPACE_ID,
        deviceId: name,
        connectivity,
        onConflict: (conflict) => self.conflicts.push(conflict),
        onRemoteChange: (records) => self.received.push(...records),
        ...options,
      });

    self.engine = createEngine();
    server.registerDevice(name, name);
    devices.push(self);
    return self;
  }

  /** A device that owns the workspace, with it already on the server. */
  async function firstDevice(name = 'Desktop', options: Partial<CloudSyncOptions> = {}) {
    const self = device(name, options);
    await self.db.open();
    await self.db.workspaces.put(
      createWorkspace(
        { name: 'Mine' },
        { generateId: () => WORKSPACE_ID, clock: fixedClock(at(0)) },
      ),
    );
    return self;
  }

  async function secondDevice(name = 'Phone', options: Partial<CloudSyncOptions> = {}) {
    const self = device(name, options);
    await self.db.open();
    return self;
  }

  async function edit(on: Device, id: string, patch: Partial<NotoDocument>) {
    const current = await on.db.documents.get(id);
    await on.db.documents.put({ ...current!, ...patch });
  }

  beforeEach(() => {
    server = new InMemorySyncServer();
  });

  afterEach(async () => {
    vi.useRealTimers();
    for (const each of devices.splice(0)) {
      await each.engine.stop();
      await each.db.close();
    }
  });

  it('brings an edit on one device to the other, and back', async () => {
    const desktop = await firstDevice();
    const phone = await secondDevice();
    const document = newDocument('Hello');
    await desktop.db.documents.put(document);

    await desktop.engine.sync();
    await phone.engine.sync();

    expect((await phone.db.workspaces.get(WORKSPACE_ID))?.name).toBe('Mine');
    expect((await phone.db.documents.get(document.id))?.title).toBe('Hello');
    expect(phone.received.map((record) => record.entity.id)).toEqual([WORKSPACE_ID, document.id]);
    // What arrived from the server is not queued to go back to it.
    expect(await phone.db.outbox.count()).toBe(0);
    expect(await desktop.db.outbox.count()).toBe(0);

    await edit(phone, document.id, { title: 'Edited on the phone', updatedAt: at(1) });
    await phone.engine.sync();
    await desktop.engine.sync();

    expect((await desktop.db.documents.get(document.id))?.title).toBe('Edited on the phone');
    expect(server.get('document', document.id)?.version).toBe(2);
    expect([...desktop.conflicts, ...phone.conflicts]).toEqual([]);
    expect(phone.engine.state).toMatchObject({ status: 'idle', pendingChanges: 0, error: null });
  });

  it('merges offline edits to different documents without losing either', async () => {
    const desktop = await firstDevice();
    const phone = await secondDevice();
    await desktop.engine.sync();
    await phone.engine.sync();

    desktop.online = false;
    phone.online = false;
    const fromDesktop = newDocument('Written on the train');
    const fromPhone = newDocument('Written on the bus');
    await desktop.db.documents.put(fromDesktop);
    await phone.db.documents.put(fromPhone);

    await desktop.engine.sync();
    expect(desktop.engine.state.status).toBe('offline');
    expect(desktop.engine.state.pendingChanges).toBe(1);

    desktop.online = true;
    phone.online = true;
    await desktop.engine.sync();
    await phone.engine.sync();
    await desktop.engine.sync();

    for (const each of [desktop, phone]) {
      const titles = (await each.db.documents.listByWorkspace(WORKSPACE_ID)).map((d) => d.title);
      expect(titles.sort()).toEqual(['Written on the bus', 'Written on the train']);
      expect(await each.db.outbox.count()).toBe(0);
    }
  });

  it('keeps both bodies when both devices rewrote the same document offline', async () => {
    const desktop = await firstDevice();
    const phone = await secondDevice();
    const document = newDocument('Shared');
    await desktop.db.documents.put(document);
    await desktop.engine.sync();
    await phone.engine.sync();

    desktop.online = false;
    phone.online = false;
    await edit(desktop, document.id, { content: body('Desktop words'), updatedAt: at(3) });
    await edit(phone, document.id, {
      content: body('Phone words'),
      title: 'Renamed on the phone',
      updatedAt: at(4),
    });

    desktop.online = true;
    phone.online = true;
    await desktop.engine.sync();
    await phone.engine.sync();
    await desktop.engine.sync();

    // Both devices converge on one live document…
    for (const each of [desktop, phone]) {
      const live = await each.db.documents.get(document.id);
      expect(live?.content).toEqual(body('Phone words'));
      expect(live?.title).toBe('Renamed on the phone');
      expect(await each.db.outbox.count()).toBe(0);
    }

    // …and the desktop's words are in the phone's history, not lost.
    const [kept] = await phone.db.versions.listByDocument(document.id);
    expect(kept).toMatchObject({
      origin: 'conflict',
      content: body('Desktop words'),
      summary: 'Edited on Desktop',
    });
    expect(phone.conflicts).toEqual([
      {
        kind: 'document',
        id: document.id,
        winner: 'local',
        keptVersionId: kept?.id,
        deviceName: 'Desktop',
      },
    ]);
    expect(server.get('document', document.id)?.version).toBe(3);
  });

  it('lets a delete beat an edit, whichever device syncs first', async () => {
    const desktop = await firstDevice();
    const phone = await secondDevice();
    const first = newDocument('First');
    const second = newDocument('Second');
    await desktop.db.documents.putMany([first, second]);
    await desktop.engine.sync();
    await phone.engine.sync();

    desktop.online = false;
    phone.online = false;
    // `first`: deleted on the desktop, which syncs first.
    await edit(desktop, first.id, { deletedAt: at(5), updatedAt: at(5) });
    await edit(phone, first.id, { title: 'Edited after', updatedAt: at(6) });
    // `second`: edited on the desktop, which syncs first; deleted on the phone.
    await edit(desktop, second.id, { title: 'Edited later', updatedAt: at(8) });
    await edit(phone, second.id, { deletedAt: at(7), updatedAt: at(7) });

    desktop.online = true;
    phone.online = true;
    await desktop.engine.sync();
    await phone.engine.sync();
    await desktop.engine.sync();

    for (const each of [desktop, phone]) {
      expect((await each.db.documents.get(first.id))?.deletedAt).not.toBeNull();
      expect((await each.db.documents.get(second.id))?.deletedAt).not.toBeNull();
      expect(await each.db.outbox.count()).toBe(0);
    }
    expect(phone.conflicts.map(({ id, winner }) => ({ id, winner }))).toEqual(
      expect.arrayContaining([
        { id: first.id, winner: 'remote' },
        { id: second.id, winner: 'local' },
      ]),
    );
  });

  it('takes the newer name when a folder was renamed on both devices', async () => {
    const desktop = await firstDevice();
    const phone = await secondDevice();
    const folder = createFolder(
      { workspaceId: WORKSPACE_ID, name: 'Projects' },
      { generateId: nextId, clock: fixedClock(at(0)) },
    );
    await desktop.db.folders.put(folder);
    await desktop.engine.sync();
    await phone.engine.sync();

    await desktop.db.folders.put({ ...folder, name: 'Work', updatedAt: at(9) });
    await phone.db.folders.put({ ...folder, name: 'Clients', updatedAt: at(8) });
    await desktop.engine.sync();
    await phone.engine.sync();

    expect((await phone.db.folders.get(folder.id))?.name).toBe('Work');
    expect(phone.conflicts).toMatchObject([{ id: folder.id, winner: 'remote' }]);
  });

  it('pulls a document before the folder it was filed in was renamed', async () => {
    const desktop = await firstDevice();
    const phone = await secondDevice();
    const parent = createFolder(
      { workspaceId: WORKSPACE_ID, name: 'Parent' },
      { generateId: nextId, clock: fixedClock(at(0)) },
    );
    const child = createFolder(
      { workspaceId: WORKSPACE_ID, name: 'Child', parentId: parent.id },
      { generateId: nextId, clock: fixedClock(at(0)) },
    );
    const document = newDocument('Filed', { folderId: child.id });

    await desktop.db.folders.putMany([parent, child]);
    await desktop.db.documents.put(document);
    await desktop.engine.sync();
    // Renamed after the document was filed: the server now sends the
    // document before either folder, and then the workspace last of all.
    await desktop.db.folders.put({ ...child, name: 'Child, renamed', updatedAt: at(1) });
    await desktop.db.folders.put({ ...parent, name: 'Parent, renamed', updatedAt: at(1) });
    await desktop.db.workspaces.put({
      ...(await desktop.db.workspaces.get(WORKSPACE_ID))!,
      name: 'Renamed',
    });
    await desktop.engine.sync();

    await phone.engine.sync();

    expect((await phone.db.documents.get(document.id))?.folderId).toBe(child.id);
    expect((await phone.db.folders.get(child.id))?.name).toBe('Child, renamed');
    expect(phone.engine.state.status).toBe('idle');
  });

  it('keeps an edit made while its push was in flight, and sends it next', async () => {
    const desktop = await firstDevice();
    const document = newDocument('Before');
    await desktop.db.documents.put(document);
    desktop.duringPush = () => edit(desktop, document.id, { title: 'Typed during the push' });

    await desktop.engine.sync();
    expect(server.get('document', document.id)?.record.entity).toMatchObject({ title: 'Before' });
    expect(await desktop.db.outbox.count()).toBe(1);

    await desktop.engine.sync();
    expect(server.get('document', document.id)).toMatchObject({
      version: 2,
      record: { entity: { title: 'Typed during the push' } },
    });
    expect(await desktop.db.outbox.count()).toBe(0);
  });

  it('pushes and pulls in pages', async () => {
    const desktop = await firstDevice('Desktop', { pushBatchSize: 2 });
    const phone = await secondDevice('Phone', { pullBatchSize: 2 });
    const documents = Array.from({ length: 7 }, (_, index) => newDocument(`Note ${index}`));
    await desktop.db.documents.putMany(documents);

    await desktop.engine.sync();
    expect(await desktop.db.outbox.count()).toBe(0);

    await phone.engine.sync();
    expect(await phone.db.documents.countByWorkspace(WORKSPACE_ID)).toBe(7);
  });

  it('pushes only the workspace it syncs', async () => {
    const desktop = await firstDevice();
    await desktop.db.workspaces.put(
      createWorkspace({ name: 'Local only' }, { generateId: () => 'w2', clock: fixedClock(at(0)) }),
    );
    await desktop.db.documents.put(newDocument('Private', { workspaceId: 'w2' }));

    await desktop.engine.sync();

    expect(server.get('workspace', 'w2')).toBeNull();
    expect((await desktop.db.outbox.list()).map((entry) => entry.entityKind).sort()).toEqual([
      'document',
      'workspace',
    ]);
  });

  it('carries on from where it was after a restart', async () => {
    const desktop = await firstDevice();
    const phone = await secondDevice();
    await desktop.db.documents.put(newDocument('Old news'));
    await desktop.engine.sync();
    await phone.engine.sync();

    phone.restart();
    const fresh = newDocument('New');
    await desktop.db.documents.put(fresh);
    await desktop.engine.sync();
    await phone.engine.sync();

    expect(phone.received.map((record) => record.entity.id)).toEqual([fresh.id]);
  });

  it('pulls everything again when the log was trimmed, storing only what is new', async () => {
    const desktop = await firstDevice();
    const phone = await secondDevice();
    await desktop.db.documents.put(newDocument('Seen'));
    await desktop.engine.sync();
    await phone.engine.sync();

    const unseen = newDocument('Unseen');
    await desktop.db.documents.put(unseen);
    await desktop.engine.sync();
    server.trimLog();

    phone.received = [];
    await phone.engine.sync();

    expect(phone.received.map((record) => record.entity.id)).toEqual([unseen.id]);
    expect(await phone.db.documents.countByWorkspace(WORKSPACE_ID)).toBe(2);
  });

  it('retries with backoff, waits out being offline, and syncs on reconnect', async () => {
    vi.useFakeTimers();
    const desktop = await firstDevice('Desktop', {
      debounceMs: 2_000,
      pollMs: 60_000,
      minBackoffMs: 1_000,
      random: () => 0.999,
    });
    const document = newDocument('Hello');
    await desktop.db.documents.put(document);
    desktop.failNext = 2;

    await desktop.engine.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(desktop.engine.state).toMatchObject({
      status: 'error',
      error: 'The server had a problem.',
      pendingChanges: 2,
    });

    await vi.advanceTimersByTimeAsync(1_000); // first retry, after ~1 s — fails again
    expect(desktop.engine.state.status).toBe('error');
    expect(server.get('document', document.id)).toBeNull();

    await vi.advanceTimersByTimeAsync(1_500); // not yet: the second wait is ~2 s
    expect(server.get('document', document.id)).toBeNull();
    await vi.advanceTimersByTimeAsync(500);
    expect(desktop.engine.state).toMatchObject({ status: 'idle', pendingChanges: 0 });
    expect(desktop.engine.state.lastSyncedAt).not.toBeNull();
    expect(server.get('document', document.id)).not.toBeNull();

    // The network goes; an edit waits for it.
    desktop.online = false;
    desktop.connectivity.set(false);
    expect(desktop.engine.state.status).toBe('offline');

    await edit(desktop, document.id, { title: 'Offline edit' });
    desktop.engine.notifyChange();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(desktop.engine.state).toMatchObject({ status: 'offline', pendingChanges: 1 });

    desktop.online = true;
    desktop.connectivity.set(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(server.get('document', document.id)?.record.entity).toMatchObject({
      title: 'Offline edit',
    });
    expect(desktop.engine.state).toMatchObject({ status: 'idle', pendingChanges: 0 });

    // A local edit goes out shortly after it is made, not at the next poll.
    await edit(desktop, document.id, { title: 'Quick' });
    desktop.engine.notifyChange();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(server.get('document', document.id)?.version).toBe(3);

    await desktop.engine.stop();
    expect(desktop.engine.state.status).toBe('disabled');
  });

  it('shares one follow-up pass between callers who ask during a pass', async () => {
    const desktop = await firstDevice();
    let pushes = 0;
    desktop.duringPush = async () => {
      pushes += 1;
    };

    const first = desktop.engine.sync();
    const second = desktop.engine.sync();
    const third = desktop.engine.sync();
    expect(second).toBe(third);
    await Promise.all([first, second, third]);

    expect(pushes).toBe(1);
    expect(await desktop.db.outbox.count()).toBe(0);
  });
});
