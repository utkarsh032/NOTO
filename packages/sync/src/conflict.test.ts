import type { Folder, NotoDocument, RemoteChange, SyncRecord } from '@noto/types';
import { describe, expect, it } from 'vitest';

import { resolveConflict } from './conflict';
import { inApplyOrder } from './records';
import { SyncTransportError, createHttpSyncTransport } from './transport';

const body = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

function doc(overrides: Partial<NotoDocument> = {}): NotoDocument {
  return {
    id: 'd1',
    workspaceId: 'w1',
    folderId: null,
    title: 'Title',
    content: body('text'),
    status: 'active',
    excerpt: 'text',
    wordCount: 1,
    isFavorite: false,
    tags: [],
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

function folder(id: string, parentId: string | null, name = id): Folder {
  return {
    id,
    workspaceId: 'w1',
    parentId,
    name,
    position: 0,
    color: null,
    icon: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    deletedAt: null,
  };
}

const remote = (record: SyncRecord, seq = 1): RemoteChange =>
  ({ ...record, version: 2, seq, deviceId: 'other', deviceName: 'Laptop' }) as RemoteChange;

const local = (entity: NotoDocument): SyncRecord => ({ kind: 'document', entity });

describe('resolveConflict', () => {
  it('lets a remote delete beat a local edit', () => {
    const resolution = resolveConflict(
      local(doc({ title: 'Edited here', updatedAt: '2026-09-02T00:00:00.000Z' })),
      remote({ kind: 'document', entity: doc({ deletedAt: '2026-09-01T11:00:00.000Z' }) }),
    );

    expect(resolution).toEqual({ winner: 'remote' });
  });

  it('lets a local delete beat a remote edit', () => {
    const mine = doc({ deletedAt: '2026-09-01T11:00:00.000Z' });
    const resolution = resolveConflict(
      local(mine),
      remote({ kind: 'document', entity: doc({ title: 'Edited there' }) }),
    );

    expect(resolution).toEqual({ winner: 'local', record: local(mine), lostBody: null });
  });

  it('keeps the local body live and the remote body as a version', () => {
    const mine = doc({
      content: body('mine'),
      excerpt: 'mine',
      title: 'Old title',
      updatedAt: '2026-09-01T12:00:00.000Z',
    });
    const theirs = doc({
      content: body('theirs'),
      excerpt: 'theirs',
      title: 'New title',
      tags: ['from-there'],
      updatedAt: '2026-09-01T13:00:00.000Z',
    });

    const resolution = resolveConflict(local(mine), remote({ kind: 'document', entity: theirs }));

    expect(resolution.winner).toBe('local');
    if (resolution.winner !== 'local') return;
    expect(resolution.record.entity).toMatchObject({
      // The newer side's metadata…
      title: 'New title',
      tags: ['from-there'],
      updatedAt: '2026-09-01T13:00:00.000Z',
      // …around this device's body.
      content: body('mine'),
      excerpt: 'mine',
    });
    expect(resolution.lostBody?.content).toEqual(body('theirs'));
  });

  it('is last-writer-wins when the bodies are the same', () => {
    const older = doc({ title: 'Older', updatedAt: '2026-09-01T10:00:00.000Z' });
    const newer = doc({ title: 'Newer', updatedAt: '2026-09-01T11:00:00.000Z' });

    expect(resolveConflict(local(older), remote({ kind: 'document', entity: newer }))).toEqual({
      winner: 'remote',
    });
    expect(resolveConflict(local(newer), remote({ kind: 'document', entity: older }))).toEqual({
      winner: 'local',
      record: local(newer),
      lostBody: null,
    });
  });

  it('gives a tie to the server', () => {
    const resolution = resolveConflict(
      { kind: 'folder', entity: folder('f1', null, 'Mine') },
      remote({ kind: 'folder', entity: folder('f1', null, 'Theirs') }),
    );
    expect(resolution).toEqual({ winner: 'remote' });
  });
});

describe('inApplyOrder', () => {
  it('puts containers before what they contain, and parents before children', () => {
    const changes = [
      remote({ kind: 'document', entity: doc({ folderId: 'child' }) }, 1),
      remote({ kind: 'folder', entity: folder('child', 'parent') }, 2),
      remote({ kind: 'folder', entity: folder('parent', null) }, 3),
      remote(
        {
          kind: 'workspace',
          entity: {
            id: 'w1',
            name: 'Mine',
            ownerId: null,
            isLocal: false,
            icon: null,
            createdAt: '2026-09-01T10:00:00.000Z',
            updatedAt: '2026-09-01T10:00:00.000Z',
            deletedAt: null,
          },
        },
        4,
      ),
    ];

    expect(inApplyOrder(changes).map((change) => change.entity.id)).toEqual([
      'w1',
      'parent',
      'child',
      'd1',
    ]);
  });
});

describe('createHttpSyncTransport', () => {
  it('posts to the sync routes and returns the data', async () => {
    const calls: [string, string, unknown][] = [];
    const transport = createHttpSyncTransport({
      request: async <T>(method: string, path: string, options?: { body?: unknown }) => {
        calls.push([method, path, options?.body]);
        return { ok: true as const, status: 200, data: { applied: [], conflicts: [] } as T };
      },
    });

    const request = { deviceId: 'dev', workspaceId: 'w1', changes: [] };
    expect(await transport.push(request)).toEqual({ applied: [], conflicts: [] });
    expect(calls).toEqual([['POST', '/v1/sync/push', request]]);
  });

  it('turns a failure into a SyncTransportError, offline when nothing came back', async () => {
    const failing = (status: number) =>
      createHttpSyncTransport({
        request: async () => ({
          ok: false as const,
          status,
          error: status === 0 ? null : { code: 'forbidden', message: 'Verify your email first.' },
        }),
      });

    const offline = await failing(0)
      .pull({ deviceId: 'dev', workspaceId: 'w1', sinceSeq: 0 })
      .catch((error: unknown) => error);
    expect(offline).toBeInstanceOf(SyncTransportError);
    expect((offline as SyncTransportError).offline).toBe(true);

    const refused = await failing(403)
      .pull({ deviceId: 'dev', workspaceId: 'w1', sinceSeq: 0 })
      .catch((error: unknown) => error);
    expect(refused).toMatchObject({
      message: 'Verify your email first.',
      status: 403,
      code: 'forbidden',
      offline: false,
    });
  });
});
