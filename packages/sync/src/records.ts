import type { NotoDatabase } from '@noto/database';
import type { Id, RemoteChange, SyncEntityKind, SyncRecord } from '@noto/types';

/** One key per entity, the same shape the outbox uses. */
export const entityKey = (kind: SyncEntityKind, id: Id): string => `${kind}:${id}`;

/** Reads an entity of any kind from local storage, tombstones included. */
export async function loadRecord(
  database: NotoDatabase,
  kind: SyncEntityKind,
  id: Id,
): Promise<SyncRecord | null> {
  switch (kind) {
    case 'workspace': {
      const entity = await database.workspaces.get(id);
      return entity && { kind, entity };
    }
    case 'folder': {
      const entity = await database.folders.get(id);
      return entity && { kind, entity };
    }
    case 'document': {
      const entity = await database.documents.get(id);
      return entity && { kind, entity };
    }
    case 'file': {
      const entity = await database.files.get(id);
      return entity && { kind, entity };
    }
    case 'memory': {
      const entity = await database.memory.get(id);
      return entity && { kind, entity };
    }
  }
}

/** The workspace an entity belongs to; a workspace belongs to itself. */
export function workspaceOf(record: SyncRecord): Id {
  return record.kind === 'workspace' ? record.entity.id : record.entity.workspaceId;
}

/**
 * The entity as it goes on the wire: without `version` and `contentHash`,
 * which are this device's bookkeeping and mean nothing anywhere else.
 */
export function toWire(record: SyncRecord): SyncRecord {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { version, contentHash, ...entity } = record.entity as SyncRecord['entity'] & {
    contentHash?: string;
  };
  return { kind: record.kind, entity } as SyncRecord;
}

/** The record a remote change carries, without the server's envelope. */
export function recordOf(change: RemoteChange): SyncRecord {
  return toWire({ kind: change.kind, entity: change.entity } as SyncRecord);
}

/**
 * A server copy with what only this device knows put back: where a file sits
 * on this device. The server never has it, so it arrives as `null`.
 */
export function keepLocalOnly(remote: SyncRecord, local: SyncRecord | null): SyncRecord {
  if (remote.kind === 'file' && local?.kind === 'file' && remote.entity.localPath === null) {
    return { kind: 'file', entity: { ...remote.entity, localPath: local.entity.localPath } };
  }
  return remote;
}

const KIND_ORDER: Record<SyncEntityKind, number> = {
  workspace: 0,
  folder: 1,
  document: 2,
  file: 3,
  memory: 4,
};

/**
 * The order to apply a page of remote changes in: what others point at first.
 *
 * The server sends each entity once, at the position of its latest change, so
 * a folder renamed after a document was filed in it arrives after the
 * document. SQLite checks those references, so containers go first — a
 * workspace before its content, and a parent folder before its children.
 */
export function inApplyOrder(changes: readonly RemoteChange[]): RemoteChange[] {
  const parents = new Map<Id, Id | null>();
  for (const change of changes) {
    if (change.kind === 'folder') parents.set(change.entity.id, change.entity.parentId);
  }

  const depth = (id: Id): number => {
    let level = 0;
    const seen = new Set<Id>();
    for (let parent = parents.get(id); parent && !seen.has(parent); parent = parents.get(parent)) {
      seen.add(parent);
      level += 1;
    }
    return level;
  };

  return changes
    .map((change, index) => ({
      change,
      index,
      depth: change.kind === 'folder' ? depth(change.entity.id) : 0,
    }))
    .sort(
      (a, b) =>
        KIND_ORDER[a.change.kind] - KIND_ORDER[b.change.kind] ||
        a.depth - b.depth ||
        a.index - b.index,
    )
    .map(({ change }) => change);
}
