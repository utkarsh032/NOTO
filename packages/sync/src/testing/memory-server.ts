import type {
  Id,
  RemoteChange,
  SyncEntityKind,
  SyncPullRequest,
  SyncPullResult,
  SyncPushRequest,
  SyncPushResult,
  SyncRecord,
} from '@noto/types';

import { entityKey, workspaceOf } from '../records';
import type { SyncTransport } from '../transport';

interface StoredRow {
  record: SyncRecord;
  workspaceId: Id;
  version: number;
  seq: number;
  deviceId: Id;
}

const PUSH_CAP = 200;
const PULL_CAP = 500;

/**
 * The sync server's rules, in memory.
 *
 * This is the reference `apps/api`'s `sync` controller has to match, and what
 * the engine is tested against: per-entity versions checked on push, one
 * change log per workspace read by cursor, and a device never sent its own
 * changes back. Everything crosses as a structured clone, as it would over
 * the wire, so no test can pass because two devices share an object.
 */
export class InMemorySyncServer implements SyncTransport {
  private readonly rows = new Map<string, StoredRow>();
  private readonly deviceNames = new Map<Id, string>();
  private seq = 0;
  /** Log positions at or below this have been trimmed. */
  private floor = 0;

  /** Names a device, as the server would know it from its registration. */
  registerDevice(deviceId: Id, name: string): void {
    this.deviceNames.set(deviceId, name);
  }

  async push(request: SyncPushRequest): Promise<SyncPushResult> {
    const { deviceId, workspaceId, changes } = structuredClone(request);

    if (changes.length > PUSH_CAP) throw new Error(`At most ${PUSH_CAP} changes per push.`);
    for (const change of changes) {
      if (workspaceOf(change) !== workspaceId) {
        throw new Error(`${change.kind} ${change.entity.id} is not in workspace ${workspaceId}.`);
      }
    }

    const result: SyncPushResult = { applied: [], conflicts: [] };

    for (const change of changes) {
      const key = entityKey(change.kind, change.entity.id);
      const current = this.rows.get(key);

      // The whole concurrency rule: a change applies only on top of the
      // version it was made on. `operation` is informational — a create of
      // something the server has is a conflict like any other.
      if (current && current.version !== change.baseVersion) {
        result.conflicts.push(this.toRemote(current));
        continue;
      }

      const version = (current?.version ?? 0) + 1;
      this.seq += 1;
      this.rows.set(key, {
        record: { kind: change.kind, entity: change.entity } as SyncRecord,
        workspaceId,
        version,
        seq: this.seq,
        deviceId,
      });
      result.applied.push({ kind: change.kind, id: change.entity.id, version });
    }

    return structuredClone(result);
  }

  async pull(request: SyncPullRequest): Promise<SyncPullResult> {
    const { deviceId, workspaceId, sinceSeq } = request;

    if (sinceSeq > 0 && sinceSeq < this.floor) {
      return { changes: [], seq: 0, hasMore: false, fullResyncRequired: true };
    }

    const limit = Math.min(request.limit ?? PULL_CAP, PULL_CAP);
    const candidates = [...this.rows.values()]
      .filter((row) => row.workspaceId === workspaceId && row.seq > sinceSeq)
      .sort((a, b) => a.seq - b.seq);

    const changes: RemoteChange[] = [];
    let seq = sinceSeq;
    let hasMore = false;

    for (const row of candidates) {
      if (row.deviceId !== deviceId) {
        if (changes.length >= limit) {
          hasMore = true;
          break;
        }
        changes.push(this.toRemote(row));
      }
      // Own changes are skipped, but the cursor still moves past them.
      seq = row.seq;
    }

    return structuredClone({ changes, seq, hasMore, fullResyncRequired: false });
  }

  /** What the server holds for an entity, for assertions. */
  get(kind: SyncEntityKind, id: Id): { record: SyncRecord; version: number } | null {
    const row = this.rows.get(entityKey(kind, id));
    return row ? structuredClone({ record: row.record, version: row.version }) : null;
  }

  /** Simulates the change log being compacted past every device's cursor. */
  trimLog(): void {
    this.floor = this.seq;
  }

  private toRemote(row: StoredRow): RemoteChange {
    return {
      ...row.record,
      version: row.version,
      seq: row.seq,
      deviceId: row.deviceId,
      deviceName: this.deviceNames.get(row.deviceId) ?? null,
    } as RemoteChange;
  }
}
