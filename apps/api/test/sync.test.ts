import { createDocument, createWorkspace } from '@noto/core';
import { InMemoryDatabase } from '@noto/database';
import {
  CloudSyncEngine,
  type SyncApiClient,
  type SyncConflict,
  createHttpSyncTransport,
  joinAccount,
} from '@noto/sync';
import type { NotoDocument, SyncPullResult, SyncPushResult, Workspace } from '@noto/types';
import type { AuthSessionDto } from '@noto/types/api';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type MailBox,
  type TestDatabase,
  createTestApp,
  createTestDatabase,
  hasDatabase,
} from './harness.ts';

/**
 * Sync against a real PostgreSQL (audit plan phase 4, steps 1, 2, 5 and 7).
 *
 * The routes are exercised directly — guards, claims, the version check,
 * paging, tenancy — and then two real `CloudSyncEngine`s, each with its own
 * device database, sync through them the way two devices will.
 */

type App = ReturnType<typeof createTestApp>['app'];

const PASSWORD = 'correct horse battery staple';
const at = (minute: number) => new Date(Date.UTC(2026, 8, 1, 10, minute)).toISOString();
const body = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

interface Session {
  accessToken: string;
  deviceId: string;
}

describe.skipIf(!hasDatabase)('sync, against PostgreSQL', () => {
  let database: TestDatabase;
  let app: App;
  let mail: MailBox;
  let addresses = 0;

  beforeAll(async () => {
    database = await createTestDatabase();
    ({ app, mail } = createTestApp(database));
  });

  afterAll(async () => {
    await database?.drop();
  });

  async function call<T = unknown>(
    method: string,
    path: string,
    options: { body?: unknown; token?: string } = {},
  ): Promise<{ status: number; body: T }> {
    const response = await app.request(path, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.9',
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
  }

  async function signUp(email: string) {
    addresses += 1;
    const response = await app.request('/v1/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `192.0.2.${addresses}` },
      body: JSON.stringify({ email, password: PASSWORD, turnstileToken: 'test' }),
    });
    expect(response.status).toBe(200);
  }

  async function signIn(email: string, deviceName: string): Promise<Session> {
    const deviceId = crypto.randomUUID();
    const response = await call<AuthSessionDto>('POST', '/v1/auth/signin', {
      body: {
        email,
        password: PASSWORD,
        device: {
          id: deviceId,
          name: deviceName,
          platform: 'windows',
          osName: 'Windows 11',
          appVersion: '1.5.0',
        },
      },
    });
    expect(response.status).toBe(200);
    return { accessToken: response.body.accessToken, deviceId };
  }

  /** A verified account, signed in on a device called `deviceName`. */
  async function account(email: string, deviceName = 'Desktop'): Promise<Session> {
    await signUp(email);
    await call('POST', '/v1/auth/verify-email', {
      body: { token: mail.token(email, /Confirm your email/) },
    });
    return signIn(email, deviceName);
  }

  function workspace(name = 'Mine'): Workspace {
    return createWorkspace({ name }, { clock: { now: () => at(0) } });
  }

  function document(workspaceId: string, text: string, overrides: Partial<NotoDocument> = {}) {
    return {
      ...createDocument(
        { workspaceId, title: text, content: body(text) },
        { clock: { now: () => at(0) } },
      ),
      ...overrides,
    };
  }

  async function claim(session: Session, local: Workspace) {
    return call<{ workspace: Workspace; version: number }>(
      'POST',
      `/v1/workspaces/${local.id}/claim`,
      {
        token: session.accessToken,
        body: {
          name: local.name,
          icon: null,
          createdAt: local.createdAt,
          updatedAt: local.updatedAt,
        },
      },
    );
  }

  const push = (
    session: Session,
    workspaceId: string,
    changes: { entity: NotoDocument; baseVersion: number }[],
  ) =>
    call<SyncPushResult>('POST', '/v1/sync/push', {
      token: session.accessToken,
      body: {
        deviceId: session.deviceId,
        workspaceId,
        changes: changes.map(({ entity, baseVersion }) => ({
          kind: 'document',
          entity,
          operation: baseVersion === 0 ? 'create' : 'update',
          baseVersion,
        })),
      },
    });

  const pull = (session: Session, workspaceId: string, sinceSeq = 0, limit?: number) =>
    call<SyncPullResult>('POST', '/v1/sync/pull', {
      token: session.accessToken,
      body: { deviceId: session.deviceId, workspaceId, sinceSeq, ...(limit ? { limit } : {}) },
    });

  // ── Guards ─────────────────────────────────────────────────────────────────

  it('refuses a caller who is signed out, unverified, or on another device', async () => {
    const owner = await account('guard-owner@example.com');
    const mine = workspace();
    expect((await claim(owner, mine)).status).toBe(200);

    const signedOut = await call('POST', '/v1/sync/pull', {
      body: { deviceId: owner.deviceId, workspaceId: mine.id, sinceSeq: 0 },
    });
    expect(signedOut.status).toBe(401);

    await signUp('unverified@example.com');
    const unverified = await signIn('unverified@example.com', 'Laptop');
    const refused = await pull(unverified, mine.id);
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ code: 'permission_denied' });

    // A session opened on one device cannot speak for another.
    const elsewhere = await call('POST', '/v1/sync/pull', {
      token: owner.accessToken,
      body: { deviceId: crypto.randomUUID(), workspaceId: mine.id, sinceSeq: 0 },
    });
    expect(elsewhere.status).toBe(400);

    const malformed = await call('POST', '/v1/sync/push', {
      token: owner.accessToken,
      body: { deviceId: owner.deviceId, workspaceId: mine.id, changes: [{ kind: 'nope' }] },
    });
    expect(malformed.status).toBe(400);
  });

  // ── Workspaces ─────────────────────────────────────────────────────────────

  it('claims a workspace once, keeps its id, and keeps it from anyone else', async () => {
    const owner = await account('claim-owner@example.com');
    const intruder = await account('claim-intruder@example.com');
    const local = workspace('From the train');

    const first = await claim(owner, local);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      workspace: { id: local.id, name: 'From the train', isLocal: false },
      version: 1,
    });

    // Asking twice is safe; nothing is created twice.
    expect((await claim(owner, local)).body).toMatchObject({ workspace: { id: local.id } });

    const stolen = await claim(intruder, local);
    expect(stolen.status).toBe(409);
    expect(JSON.stringify(stolen.body)).not.toContain('From the train');

    const listed = await call<{ workspaces: { workspace: Workspace; role: string }[] }>(
      'GET',
      '/v1/workspaces',
      { token: owner.accessToken },
    );
    expect(listed.body.workspaces).toMatchObject([{ workspace: { id: local.id }, role: 'owner' }]);
    expect(
      (
        await call<{ workspaces: unknown[] }>('GET', '/v1/workspaces', {
          token: intruder.accessToken,
        })
      ).body.workspaces,
    ).toEqual([]);
  });

  // ── Push and pull ──────────────────────────────────────────────────────────

  it('moves a change from one device to another, and never echoes it back', async () => {
    const desktop = await account('two-devices@example.com', 'Desktop');
    const phone = await signIn('two-devices@example.com', 'Phone');
    const shared = workspace();
    await claim(desktop, shared);

    const note = document(shared.id, 'Hello from the desktop');
    const pushed = await push(desktop, shared.id, [{ entity: note, baseVersion: 0 }]);
    expect(pushed.status).toBe(200);
    expect(pushed.body).toEqual({
      applied: [{ kind: 'document', id: note.id, version: 1 }],
      conflicts: [],
    });

    const onPhone = await pull(phone, shared.id);
    expect(onPhone.status).toBe(200);
    const change = onPhone.body.changes.find((c) => c.entity.id === note.id);
    expect(change).toMatchObject({
      kind: 'document',
      version: 1,
      deviceId: desktop.deviceId,
      deviceName: 'Desktop',
      entity: { title: 'Hello from the desktop', content: body('Hello from the desktop') },
    });
    // The device's own timestamps survive the round trip, to the millisecond.
    expect(change?.entity.updatedAt).toBe(note.updatedAt);

    // The desktop is not sent its own change, but its cursor moves past it.
    const onDesktop = await pull(desktop, shared.id);
    expect(onDesktop.body.changes.map((c) => c.entity.id)).not.toContain(note.id);
    expect(onDesktop.body.seq).toBeGreaterThan(0);

    const state = await call<{ lastPulledSeq: number }>(
      'GET',
      `/v1/sync/state?workspaceId=${shared.id}`,
      { token: desktop.accessToken },
    );
    expect(state.body.lastPulledSeq).toBe(onDesktop.body.seq);
  });

  it("answers a change made on an old version with the server's copy", async () => {
    const desktop = await account('stale@example.com', 'Desktop');
    const phone = await signIn('stale@example.com', 'Phone');
    const shared = workspace();
    await claim(desktop, shared);
    const note = document(shared.id, 'First');
    await push(desktop, shared.id, [{ entity: note, baseVersion: 0 }]);

    const fromPhone = await push(phone, shared.id, [
      { entity: { ...note, title: 'Phone edit', updatedAt: at(2) }, baseVersion: 1 },
    ]);
    expect(fromPhone.body.applied).toEqual([{ kind: 'document', id: note.id, version: 2 }]);

    const stale = await push(desktop, shared.id, [
      { entity: { ...note, title: 'Desktop edit', updatedAt: at(3) }, baseVersion: 1 },
    ]);
    expect(stale.body.applied).toEqual([]);
    expect(stale.body.conflicts as unknown[]).toMatchObject([
      { kind: 'document', version: 2, deviceName: 'Phone', entity: { title: 'Phone edit' } },
    ]);
  });

  it('keeps every workspace to its members', async () => {
    const alice = await account('alice@example.com');
    const bob = await account('bob@example.com');
    const hers = workspace('Alice');
    const his = workspace('Bob');
    await claim(alice, hers);
    await claim(bob, his);
    const secret = document(hers.id, 'Alice only');
    await push(alice, hers.id, [{ entity: secret, baseVersion: 0 }]);

    expect((await pull(bob, hers.id)).status).toBe(404);
    expect(
      (await push(bob, hers.id, [{ entity: document(hers.id, 'Planted'), baseVersion: 0 }])).status,
    ).toBe(404);

    // Reusing her document's id in his own workspace is refused without a word of it.
    const hijack = await push(bob, his.id, [
      { entity: { ...secret, workspaceId: his.id, title: 'Mine now' }, baseVersion: 0 },
    ]);
    expect(hijack.status).toBe(409);
    expect(JSON.stringify(hijack.body)).not.toContain('Alice only');

    // And a change must be in the workspace the push names.
    const mismatched = await push(bob, his.id, [
      { entity: document(hers.id, 'Wrong place'), baseVersion: 0 },
    ]);
    expect(mismatched.status).toBe(400);

    const stored = await database.owner
      .selectFrom('documents' as never)
      .select(['title' as never])
      .where('id' as never, '=', secret.id as never)
      .executeTakeFirst();
    expect(stored).toEqual({ title: 'Alice only' });
  });

  it('pages a pull and resumes from the cursor', async () => {
    const desktop = await account('paging@example.com', 'Desktop');
    const phone = await signIn('paging@example.com', 'Phone');
    const shared = workspace();
    await claim(desktop, shared);
    const notes = Array.from({ length: 5 }, (_, index) => document(shared.id, `Note ${index}`));
    await push(
      desktop,
      shared.id,
      notes.map((entity) => ({ entity, baseVersion: 0 })),
    );

    const seen: string[] = [];
    let cursor = 0;
    let pages = 0;
    for (;;) {
      const page = await pull(phone, shared.id, cursor, 2);
      pages += 1;
      seen.push(...page.body.changes.map((c) => c.entity.id));
      cursor = page.body.seq;
      if (!page.body.hasMore) break;
    }

    expect(pages).toBeGreaterThanOrEqual(3);
    expect(seen).toEqual(expect.arrayContaining(notes.map((note) => note.id)));
    expect((await pull(phone, shared.id, cursor)).body.changes).toEqual([]);
  });

  it('asks for a full resync when the log has moved past the device', async () => {
    const desktop = await account('resync@example.com');
    const shared = workspace();
    await claim(desktop, shared);
    const first = await pull(desktop, shared.id);

    await sql`update public.sync_state set full_resync_required = true
              where device_id = ${desktop.deviceId}`.execute(database.owner);

    const behind = await pull(desktop, shared.id, first.body.seq + 1);
    expect(behind.body.fullResyncRequired).toBe(true);

    // Starting again from the beginning clears it.
    expect((await pull(desktop, shared.id, 0)).body.fullResyncRequired).toBe(false);
    expect((await pull(desktop, shared.id, 1)).body.fullResyncRequired).toBe(false);
  });

  it('does not let a caller write versions or the change log', async () => {
    const owner = await account('rls-writes@example.com');
    const shared = workspace();
    await claim(owner, shared);
    const note = document(shared.id, 'Guarded');
    await push(owner, shared.id, [{ entity: note, baseVersion: 0 }]);

    const userId = (
      await sql<{
        id: string;
      }>`select id from public.users where email = 'rls-writes@example.com'`.execute(database.owner)
    ).rows[0]!.id;

    await expect(
      database.db.asUser(userId, (tx) =>
        sql`update public.documents set version = 99 where id = ${note.id}`.execute(tx),
      ),
    ).rejects.toThrow(/permission denied/);

    await expect(
      database.db.asUser(userId, (tx) =>
        sql`insert into public.change_log (workspace_id, entity_kind, entity_id, operation, version)
            values (${shared.id}, 'document', ${note.id}, 'update', 5)`.execute(tx),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  // ── Two real engines ───────────────────────────────────────────────────────

  it('syncs two devices end to end, offline edits and a conflict included', async () => {
    const email = 'engines@example.com';
    const desktopSession = await account(email, 'Desktop');
    const phoneSession = await signIn(email, 'Phone');

    const client = (session: Session): SyncApiClient => ({
      request: async <T>(method: string, path: string, options?: { body?: unknown }) => {
        const response = await call<T>(method, path, {
          token: session.accessToken,
          ...(options?.body === undefined ? {} : { body: options.body }),
        });
        return response.status === 200
          ? { ok: true as const, status: 200, data: response.body }
          : {
              ok: false as const,
              status: response.status,
              error: response.body as { code?: string; message?: string },
            };
      },
    });

    // Each device has its own local workspace and a note in it, before either signs in.
    const desktop = new InMemoryDatabase();
    const phone = new InMemoryDatabase();
    const desktopLocal = workspace('Desktop notes');
    const phoneLocal = workspace('Phone notes');
    await desktop.workspaces.put(desktopLocal);
    await phone.workspaces.put(phoneLocal);
    const fromDesktop = document(desktopLocal.id, 'Written on the desktop');
    const fromPhone = document(phoneLocal.id, 'Written on the phone');
    await desktop.documents.put(fromDesktop);
    await phone.documents.put(fromPhone);

    // Step 5: the first device claims its workspace; the second merges into it.
    const claimed = await joinAccount(desktop, client(desktopSession), desktopLocal.id);
    expect(claimed).toMatchObject({ workspaceId: desktopLocal.id, mode: 'claimed' });
    const merged = await joinAccount(phone, client(phoneSession), phoneLocal.id);
    expect(merged).toMatchObject({ workspaceId: desktopLocal.id, mode: 'merged', queued: 1 });

    const conflicts: SyncConflict[] = [];
    const engine = (db: InMemoryDatabase, session: Session) =>
      new CloudSyncEngine({
        database: db,
        transport: createHttpSyncTransport(client(session)),
        workspaceId: desktopLocal.id,
        deviceId: session.deviceId,
        onConflict: (conflict) => conflicts.push(conflict),
      });
    const onDesktop = engine(desktop, desktopSession);
    const onPhone = engine(phone, phoneSession);

    await onDesktop.sync();
    await onPhone.sync();
    await onDesktop.sync();

    for (const db of [desktop, phone]) {
      const titles = (await db.documents.listByWorkspace(desktopLocal.id)).map((d) => d.title);
      expect(titles.sort()).toEqual(['Written on the desktop', 'Written on the phone']);
      expect(await db.outbox.count()).toBe(0);
    }
    expect(onPhone.state).toMatchObject({ status: 'idle', error: null });

    // Both rewrite the desktop's note while offline; the phone syncs last.
    const edit = async (db: InMemoryDatabase, text: string, minute: number) => {
      const current = (await db.documents.get(fromDesktop.id))!;
      await db.documents.put({ ...current, content: body(text), updatedAt: at(minute) });
    };
    await edit(desktop, 'Desktop rewrite', 10);
    await edit(phone, 'Phone rewrite', 11);

    await onDesktop.sync();
    await onPhone.sync();
    await onDesktop.sync();

    for (const db of [desktop, phone]) {
      expect((await db.documents.get(fromDesktop.id))?.content).toEqual(body('Phone rewrite'));
    }
    const [kept] = await phone.versions.listByDocument(fromDesktop.id);
    expect(kept).toMatchObject({
      origin: 'conflict',
      content: body('Desktop rewrite'),
      summary: 'Edited on Desktop',
    });
    expect(conflicts).toMatchObject([{ id: fromDesktop.id, winner: 'local' }]);
  });
});
