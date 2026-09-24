import type { CallerIdentity } from '@noto/backend';
import type { PostgresDatabase, Schema } from '@noto/backend/postgres';
import { err, ok } from '@noto/core';
import type {
  Id,
  NotoError,
  RemoteChange,
  Result,
  SyncEntityKind,
  SyncPullResult,
  SyncPushResult,
  SyncRecord,
  Workspace,
} from '@noto/types';
import { type Kysely, type RawBuilder, sql } from 'kysely';

import { PULL_CAP, type PushChange } from './schemas.ts';

/**
 * Sync's SQL (Node plan §9.5–9.6). Raw SQL through Kysely, as the plan says
 * `sync_push` wants to be: the version check is one statement per change.
 *
 * Every query runs in `asUser`, so row-level security applies to all of it.
 * The one exception is the id check before a push, which has to see rows the
 * caller cannot — that is the point of it — and answers only yes or no.
 */

type Db = Kysely<Schema>;
type Row = Record<string, unknown>;

// ── Tables ───────────────────────────────────────────────────────────────────

interface TableSpec {
  table: string;
  /** Insert columns, in the order `values` produces them. */
  columns: readonly string[];
  /** Columns a later change may overwrite. */
  updatable: readonly string[];
  values(entity: PushChange['entity']): unknown[];
  toEntity(row: Row): SyncRecord['entity'];
}

const iso = (value: unknown): string | null =>
  value === null || value === undefined ? null : (value as Date).toISOString();

const timestamps = (row: Row) => ({
  createdAt: iso(row['created_at'])!,
  updatedAt: iso(row['updated_at'])!,
  deletedAt: iso(row['deleted_at']),
});

type Entity<K extends PushChange['kind']> = Extract<PushChange, { kind: K }>['entity'];

const TABLES: Record<SyncEntityKind, TableSpec> = {
  workspace: {
    table: 'workspaces',
    columns: [],
    updatable: ['name', 'icon', 'updated_at', 'deleted_at'],
    values: (entity) => {
      const e = entity as Entity<'workspace'>;
      return [e.name, e.icon, e.updatedAt, e.deletedAt];
    },
    toEntity: (row): Workspace => ({
      id: row['id'] as string,
      name: row['name'] as string,
      ownerId: row['owner_id'] as string,
      isLocal: false,
      icon: (row['icon'] as string | null) ?? null,
      ...timestamps(row),
    }),
  },

  folder: {
    table: 'folders',
    columns: [
      'id',
      'workspace_id',
      'parent_id',
      'name',
      'position',
      'color',
      'icon',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    updatable: ['parent_id', 'name', 'position', 'color', 'icon', 'updated_at', 'deleted_at'],
    values: (entity) => {
      const e = entity as Entity<'folder'>;
      return [
        e.id,
        e.workspaceId,
        e.parentId,
        e.name,
        e.position,
        e.color,
        e.icon,
        e.createdAt,
        e.updatedAt,
        e.deletedAt,
      ];
    },
    toEntity: (row) => ({
      id: row['id'] as string,
      workspaceId: row['workspace_id'] as string,
      parentId: (row['parent_id'] as string | null) ?? null,
      name: row['name'] as string,
      position: row['position'] as number,
      color: (row['color'] as string | null) ?? null,
      icon: (row['icon'] as string | null) ?? null,
      ...timestamps(row),
    }),
  },

  document: {
    table: 'documents',
    columns: [
      'id',
      'workspace_id',
      'folder_id',
      'title',
      'content',
      'status',
      'excerpt',
      'word_count',
      'is_favorite',
      'tags',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    updatable: [
      'folder_id',
      'title',
      'content',
      'status',
      'excerpt',
      'word_count',
      'is_favorite',
      'tags',
      'updated_at',
      'deleted_at',
    ],
    values: (entity) => {
      const e = entity as Entity<'document'>;
      return [
        e.id,
        e.workspaceId,
        e.folderId,
        e.title,
        JSON.stringify(e.content),
        e.status,
        e.excerpt,
        e.wordCount,
        e.isFavorite,
        e.tags,
        e.createdAt,
        e.updatedAt,
        e.deletedAt,
      ];
    },
    toEntity: (row) => ({
      id: row['id'] as string,
      workspaceId: row['workspace_id'] as string,
      folderId: (row['folder_id'] as string | null) ?? null,
      title: row['title'] as string,
      content: row['content'] as { type: 'doc' },
      status: row['status'] as 'draft',
      excerpt: row['excerpt'] as string,
      wordCount: row['word_count'] as number,
      isFavorite: row['is_favorite'] as boolean,
      tags: row['tags'] as string[],
      ...timestamps(row),
    }),
  },

  file: {
    table: 'files',
    columns: [
      'id',
      'workspace_id',
      'document_id',
      'name',
      'mime_type',
      'size',
      'checksum',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    updatable: ['document_id', 'name', 'mime_type', 'size', 'checksum', 'updated_at', 'deleted_at'],
    values: (entity) => {
      const e = entity as Entity<'file'>;
      return [
        e.id,
        e.workspaceId,
        e.documentId,
        e.name,
        e.mimeType,
        e.size,
        e.checksum,
        e.createdAt,
        e.updatedAt,
        e.deletedAt,
      ];
    },
    toEntity: (row) => ({
      id: row['id'] as string,
      workspaceId: row['workspace_id'] as string,
      documentId: (row['document_id'] as string | null) ?? null,
      name: row['name'] as string,
      mimeType: row['mime_type'] as string,
      size: Number(row['size']),
      // Where the file sits on this device is this device's business; the
      // server never stores a URL (it signs one on demand, Phase 7).
      localPath: null,
      remoteUrl: null,
      checksum: (row['checksum'] as string | null) ?? null,
      ...timestamps(row),
    }),
  },

  memory: {
    table: 'memory_items',
    columns: [
      'id',
      'workspace_id',
      'kind',
      'title',
      'content',
      'source',
      'url',
      'tags',
      'is_pinned',
      'size_bytes',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    updatable: [
      'kind',
      'title',
      'content',
      'source',
      'url',
      'tags',
      'is_pinned',
      'size_bytes',
      'updated_at',
      'deleted_at',
    ],
    values: (entity) => {
      const e = entity as Entity<'memory'>;
      return [
        e.id,
        e.workspaceId,
        e.kind,
        e.title,
        e.content,
        e.source,
        e.url,
        e.tags,
        e.isPinned,
        e.sizeBytes,
        e.createdAt,
        e.updatedAt,
        e.deletedAt,
      ];
    },
    toEntity: (row) => ({
      id: row['id'] as string,
      workspaceId: row['workspace_id'] as string,
      kind: row['kind'] as 'note',
      title: row['title'] as string,
      content: row['content'] as string,
      source: (row['source'] as string | null) ?? null,
      url: (row['url'] as string | null) ?? null,
      tags: row['tags'] as string[],
      isPinned: row['is_pinned'] as boolean,
      sizeBytes: row['size_bytes'] === null ? null : Number(row['size_bytes']),
      ...timestamps(row),
    }),
  },
};

const CONTENT_KINDS = ['folder', 'document', 'file', 'memory'] as const;

/** A value bound as a parameter, cast where Postgres cannot infer it. */
function bind(column: string, value: unknown): RawBuilder<unknown> {
  if (column === 'content') return sql`${value}::jsonb`;
  if (column === 'tags') return sql`${value}::text[]`;
  return sql`${value}`;
}

// ── The caller ───────────────────────────────────────────────────────────────

export interface SyncCaller {
  userId: Id;
  deviceId: Id;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Role = 'owner' | 'editor' | 'commenter' | 'viewer';

/**
 * Who may sync (Node plan §6: "session + device"): a verified account, on a
 * device of its own that has not been signed out. Answers with the device id
 * sync will record changes against.
 */
export async function authorizeDevice(
  db: PostgresDatabase,
  caller: CallerIdentity,
  claimedDeviceId: Id,
): Promise<Result<SyncCaller, NotoError>> {
  if (!UUID.test(claimedDeviceId)) {
    return err('invalid_input', 'Name the device this is.');
  }
  // A session opened on a device speaks for that device and no other.
  if (caller.deviceId !== null && caller.deviceId !== claimedDeviceId) {
    return err('invalid_input', 'This session belongs to another device.');
  }

  return db.asUser(caller.userId, async (tx) => {
    const [user] = (
      await sql<{ verified: boolean }>`
        select email_verified_at is not null as verified
        from public.users where id = public.current_user_id()
      `.execute(tx)
    ).rows;
    if (!user?.verified) {
      return err('permission_denied', 'Confirm your email address to turn on sync.');
    }

    const [device] = (
      await sql<{ revoked: boolean }>`
        select revoked_at is not null as revoked from public.devices where id = ${claimedDeviceId}
      `.execute(tx)
    ).rows;
    if (!device || device.revoked) {
      return err('permission_denied', 'Sign in again on this device to sync it.');
    }

    return ok({ userId: caller.userId, deviceId: claimedDeviceId });
  });
}

async function roleIn(tx: Db, workspaceId: Id): Promise<Role | null> {
  const [member] = (
    await sql<{ role: Role }>`
      select role from public.workspace_members
      where workspace_id = ${workspaceId} and user_id = public.current_user_id()
    `.execute(tx)
  ).rows;
  return member?.role ?? null;
}

/** Names the device in the transaction, for the change-log trigger. */
async function actAs(tx: Db, deviceId: Id): Promise<void> {
  await sql`select set_config('app.device_id', ${deviceId}, true)`.execute(tx);
}

const noSuchWorkspace = () => err('not_found', 'There is no such workspace.');

// ── Workspaces ───────────────────────────────────────────────────────────────

export interface WorkspaceSummary {
  workspace: Workspace;
  role: Role;
  version: number;
}

/** The caller's workspaces, for a device choosing what to sync (step 5). */
export async function listWorkspaces(
  db: PostgresDatabase,
  userId: Id,
): Promise<Result<{ workspaces: WorkspaceSummary[] }, NotoError>> {
  return db.asUser(userId, async (tx) => {
    const rows = (
      await sql<Row>`
        select w.*, m.role from public.workspaces w
        join public.workspace_members m
          on m.workspace_id = w.id and m.user_id = public.current_user_id()
        where w.deleted_at is null
        order by w.updated_at desc, w.id
      `.execute(tx)
    ).rows;

    return ok({
      workspaces: rows.map((row) => ({
        workspace: TABLES.workspace.toEntity(row) as Workspace,
        role: row['role'] as Role,
        version: row['version'] as number,
      })),
    });
  });
}

/**
 * Adopts a workspace a device created offline (Node plan §9.5), keeping its
 * id. Claiming a workspace the caller already owns answers with it again, so
 * a device that lost the first answer can simply ask twice.
 */
export async function claimWorkspace(
  db: PostgresDatabase,
  caller: SyncCaller,
  workspaceId: Id,
  input: { name: string; icon?: string | null | undefined; createdAt: string; updatedAt: string },
): Promise<Result<WorkspaceSummary, NotoError>> {
  // Visible or not, an id someone else holds is not the caller's to claim.
  const taken = await db.asService(async (tx) => {
    const [row] = (
      await sql<{ owner_id: string }>`
        select owner_id from public.workspaces where id = ${workspaceId}
      `.execute(tx)
    ).rows;
    return row ? row.owner_id !== caller.userId : false;
  });
  if (taken) return err('conflict', 'That workspace belongs to someone else.');

  return db.asUser(caller.userId, async (tx) => {
    await actAs(tx, caller.deviceId);

    await sql`
      insert into public.workspaces (id, name, owner_id, icon, created_at, updated_at)
      values (${workspaceId}, ${input.name}, public.current_user_id(), ${input.icon ?? null},
              ${input.createdAt}, ${input.updatedAt})
      on conflict (id) do nothing
    `.execute(tx);

    await sql`
      insert into public.workspace_members (workspace_id, user_id, role, accepted_at)
      values (${workspaceId}, public.current_user_id(), 'owner', now())
      on conflict do nothing
    `.execute(tx);

    const [row] = (
      await sql<Row>`select * from public.workspaces where id = ${workspaceId}`.execute(tx)
    ).rows;
    if (!row) return noSuchWorkspace();

    return ok({
      workspace: TABLES.workspace.toEntity(row) as Workspace,
      role: 'owner' as const,
      version: row['version'] as number,
    });
  });
}

// ── Push ─────────────────────────────────────────────────────────────────────

const KIND_ORDER: Record<SyncEntityKind, number> = {
  workspace: 0,
  folder: 1,
  document: 2,
  file: 3,
  memory: 4,
};

/**
 * Applies a device's changes in one transaction (Node plan §9.6).
 *
 * Each change is written only if the server's version is still the one the
 * device made it on; otherwise the server's copy goes back as a conflict for
 * the device to resolve. `operation` is informational — a create of something
 * the server has is a conflict like any other.
 */
export async function push(
  db: PostgresDatabase,
  caller: SyncCaller,
  workspaceId: Id,
  changes: readonly PushChange[],
): Promise<Result<SyncPushResult, NotoError>> {
  for (const change of changes) {
    const target = change.kind === 'workspace' ? change.entity.id : change.entity.workspaceId;
    if (target !== workspaceId) {
      return err('invalid_input', 'Every change in a push must be in the workspace it names.');
    }
  }

  // Ids are the devices' own. One that already belongs to another workspace is
  // refused outright, without saying whose.
  if (await idsHeldElsewhere(db, workspaceId, changes)) {
    return err('conflict', 'This push names something that belongs elsewhere.');
  }

  return db.asUser(caller.userId, async (tx) => {
    const role = await roleIn(tx, workspaceId);
    if (!role) return noSuchWorkspace();
    if (role !== 'owner' && role !== 'editor') {
      return err('permission_denied', 'You can read this workspace but not change it.');
    }

    await actAs(tx, caller.deviceId);

    const result: SyncPushResult = { applied: [], conflicts: [] };
    // Containers first, so nothing is written before what it sits in.
    const ordered = [...changes].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

    for (const change of ordered) {
      if (change.kind === 'workspace' && change.entity.deletedAt !== null && role !== 'owner') {
        return err('permission_denied', 'Only the owner can delete a workspace.');
      }

      const version = await write(tx, change);
      if (version !== null) {
        result.applied.push({ kind: change.kind, id: change.entity.id, version });
        continue;
      }

      const current = await currentChange(tx, workspaceId, change.kind, change.entity.id);
      if (current) result.conflicts.push(current);
    }

    await sql`
      insert into public.sync_state (device_id, workspace_id, last_pushed_at)
      values (${caller.deviceId}, ${workspaceId}, now())
      on conflict (device_id, workspace_id) do update set last_pushed_at = excluded.last_pushed_at
    `.execute(tx);

    return ok(result);
  });
}

/** The new version, or `null` when the server's copy had moved on. */
async function write(tx: Db, change: PushChange): Promise<number | null> {
  const spec = TABLES[change.kind];
  const values = spec.values(change.entity);

  if (change.kind === 'workspace') {
    // Workspaces come into being by claim; a push only changes one.
    const [row] = (
      await sql<{ version: number }>`
        update public.workspaces
        set ${sql.join(spec.updatable.map((column, index) => sql`${sql.ref(column)} = ${values[index]}`))}
        where id = ${change.entity.id} and version = ${change.baseVersion}
        returning version
      `.execute(tx)
    ).rows;
    return row?.version ?? null;
  }

  const table = sql.table(`public.${spec.table}`);
  const [row] = (
    await sql<{ version: number }>`
      insert into ${table} (${sql.join(spec.columns.map((column) => sql.ref(column)))})
      values (${sql.join(spec.columns.map((column, index) => bind(column, values[index])))})
      on conflict (id) do update
      set ${sql.join(spec.updatable.map((column) => sql`${sql.ref(column)} = excluded.${sql.ref(column)}`))}
      where ${sql.ref(`${spec.table}.version`)} = ${change.baseVersion}
      returning version
    `.execute(tx)
  ).rows;
  return row?.version ?? null;
}

async function idsHeldElsewhere(
  db: PostgresDatabase,
  workspaceId: Id,
  changes: readonly PushChange[],
): Promise<boolean> {
  return db.asService(async (tx) => {
    for (const kind of CONTENT_KINDS) {
      const ids = changes.filter((change) => change.kind === kind).map((c) => c.entity.id);
      if (ids.length === 0) continue;

      const [row] = (
        await sql<{ found: number }>`
          select 1 as found from ${sql.table(`public.${TABLES[kind].table}`)}
          where id = any(${ids}::uuid[]) and workspace_id <> ${workspaceId}
          limit 1
        `.execute(tx)
      ).rows;
      if (row) return true;
    }
    return false;
  });
}

/** The server's copy of one entity, as a pull would send it. */
async function currentChange(
  tx: Db,
  workspaceId: Id,
  kind: SyncEntityKind,
  id: Id,
): Promise<RemoteChange | null> {
  const [row] = (
    await sql<Row>`
      select * from ${sql.table(`public.${TABLES[kind].table}`)} where id = ${id}
    `.execute(tx)
  ).rows;
  if (!row) return null;

  const [latest] = (
    await sql<{ seq: string; actor_device_id: string | null; device_name: string | null }>`
      select c.seq, c.actor_device_id, d.name as device_name
      from public.change_log c left join public.devices d on d.id = c.actor_device_id
      where c.workspace_id = ${workspaceId} and c.entity_kind = ${kind} and c.entity_id = ${id}
      order by c.seq desc limit 1
    `.execute(tx)
  ).rows;

  return {
    kind,
    entity: TABLES[kind].toEntity(row),
    version: row['version'] as number,
    seq: Number(latest?.seq ?? 0),
    deviceId: latest?.actor_device_id ?? null,
    deviceName: latest?.device_name ?? null,
  } as RemoteChange;
}

// ── Pull ─────────────────────────────────────────────────────────────────────

/**
 * What changed in a workspace after `sinceSeq`, made by other devices
 * (Node plan §9.6). Each entity comes once, as it is now, at the position of
 * its latest change; a device's own changes are skipped, but the cursor still
 * moves past them so they are not scanned again.
 */
export async function pull(
  db: PostgresDatabase,
  caller: SyncCaller,
  workspaceId: Id,
  sinceSeq: number,
  limit = PULL_CAP,
): Promise<Result<SyncPullResult, NotoError>> {
  return db.asUser(caller.userId, async (tx) => {
    if (!(await roleIn(tx, workspaceId))) return noSuchWorkspace();

    const [state] = (
      await sql<{ full_resync_required: boolean }>`
        select full_resync_required from public.sync_state
        where device_id = ${caller.deviceId} and workspace_id = ${workspaceId}
      `.execute(tx)
    ).rows;
    if (state?.full_resync_required && sinceSeq > 0) {
      return ok({ changes: [], seq: 0, hasMore: false, fullResyncRequired: true });
    }

    // Twice the page: room to skip this device's own changes and still fill it.
    const window = limit * 2;
    const latest = (
      await sql<{
        seq: string;
        entity_kind: SyncEntityKind;
        entity_id: string;
        actor_device_id: string | null;
      }>`
        select seq, entity_kind, entity_id, actor_device_id from (
          select distinct on (entity_kind, entity_id) seq, entity_kind, entity_id, actor_device_id
          from public.change_log
          where workspace_id = ${workspaceId} and seq > ${sinceSeq}
          order by entity_kind, entity_id, seq desc
        ) latest
        order by seq
        limit ${window}
      `.execute(tx)
    ).rows;

    const picked: typeof latest = [];
    let seq = sinceSeq;
    let hasMore = latest.length === window;

    for (const change of latest) {
      if (change.actor_device_id !== caller.deviceId) {
        if (picked.length >= limit) {
          hasMore = true;
          break;
        }
        picked.push(change);
      }
      seq = Number(change.seq);
    }

    const changes = await loadChanges(tx, picked);

    await sql`
      insert into public.sync_state (device_id, workspace_id, last_pulled_seq, last_pulled_at)
      values (${caller.deviceId}, ${workspaceId}, ${seq}, now())
      on conflict (device_id, workspace_id) do update
      set last_pulled_seq = excluded.last_pulled_seq,
          last_pulled_at = excluded.last_pulled_at,
          full_resync_required = false
    `.execute(tx);

    return ok({ changes, seq, hasMore, fullResyncRequired: false });
  });
}

/** Joins the entities to their log rows, keeping the log's order. */
async function loadChanges(
  tx: Db,
  picked: readonly {
    seq: string;
    entity_kind: SyncEntityKind;
    entity_id: string;
    actor_device_id: string | null;
  }[],
): Promise<RemoteChange[]> {
  const rows = new Map<string, Row>();

  for (const kind of Object.keys(TABLES) as SyncEntityKind[]) {
    const ids = picked.filter((change) => change.entity_kind === kind).map((c) => c.entity_id);
    if (ids.length === 0) continue;

    const found = (
      await sql<Row>`
        select * from ${sql.table(`public.${TABLES[kind].table}`)} where id = any(${ids}::uuid[])
      `.execute(tx)
    ).rows;
    for (const row of found) rows.set(`${kind}:${row['id'] as string}`, row);
  }

  const actors = [
    ...new Set(picked.map((change) => change.actor_device_id).filter((id) => id !== null)),
  ];
  const names = new Map<string, string>();
  if (actors.length > 0) {
    // Only the caller's own devices are visible; another member's stay unnamed.
    const found = (
      await sql<{ id: string; name: string }>`
        select id, name from public.devices where id = any(${actors}::uuid[])
      `.execute(tx)
    ).rows;
    for (const device of found) names.set(device.id, device.name);
  }

  const changes: RemoteChange[] = [];
  for (const change of picked) {
    const row = rows.get(`${change.entity_kind}:${change.entity_id}`);
    if (!row) continue;

    changes.push({
      kind: change.entity_kind,
      entity: TABLES[change.entity_kind].toEntity(row),
      version: row['version'] as number,
      seq: Number(change.seq),
      deviceId: change.actor_device_id,
      deviceName: change.actor_device_id ? (names.get(change.actor_device_id) ?? null) : null,
    } as RemoteChange);
  }
  return changes;
}

/** The device's cursor in a workspace (`GET /v1/sync/state`). */
export async function syncState(
  db: PostgresDatabase,
  caller: SyncCaller,
  workspaceId: Id,
): Promise<
  Result<
    {
      lastPulledSeq: number;
      lastPulledAt: string | null;
      lastPushedAt: string | null;
      fullResyncRequired: boolean;
    },
    NotoError
  >
> {
  return db.asUser(caller.userId, async (tx) => {
    if (!(await roleIn(tx, workspaceId))) return noSuchWorkspace();

    const [state] = (
      await sql<Row>`
        select * from public.sync_state
        where device_id = ${caller.deviceId} and workspace_id = ${workspaceId}
      `.execute(tx)
    ).rows;

    return ok({
      lastPulledSeq: Number(state?.['last_pulled_seq'] ?? 0),
      lastPulledAt: iso(state?.['last_pulled_at']),
      lastPushedAt: iso(state?.['last_pushed_at']),
      fullResyncRequired: Boolean(state?.['full_resync_required']),
    });
  });
}
