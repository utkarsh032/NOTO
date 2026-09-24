import { type NotoDatabase, versionOf } from '@noto/database';
import type {
  Id,
  OutboxEntry,
  RemoteChange,
  SyncEntityKind,
  SyncPushChange,
  SyncRecord,
  SyncState,
} from '@noto/types';

import { resolveConflict } from './conflict';
import { type Connectivity, alwaysOnline } from './connectivity';
import { entityKey, inApplyOrder, loadRecord, recordOf, toWire, workspaceOf } from './records';
import { type SyncTransport, SyncTransportError } from './transport';
import type { SyncEngine, SyncStateListener } from './types';

/** What the user may want to hear about: two devices changed the same thing. */
export interface SyncConflict {
  kind: SyncEntityKind;
  id: Id;
  /** Whose copy is live now. */
  winner: 'local' | 'remote';
  /** The version-history entry that keeps the other body, when there was one. */
  keptVersionId: Id | null;
  /** The other device, when the server named it. */
  deviceName: string | null;
}

export interface CloudSyncOptions {
  database: NotoDatabase;
  transport: SyncTransport;
  workspaceId: Id;
  deviceId: Id;
  connectivity?: Connectivity;
  /** Called with every entity another device changed, once it is stored here. */
  onRemoteChange?: (records: readonly SyncRecord[]) => void;
  onConflict?: (conflict: SyncConflict) => void;
  /** Wait after a local edit before pushing. */
  debounceMs?: number;
  /** Wait between passes while nothing else asks for one. */
  pollMs?: number;
  minBackoffMs?: number;
  maxBackoffMs?: number;
  /** Changes per push; the server's cap is 200. */
  pushBatchSize?: number;
  /** Changes per pull; the server's cap is 500. */
  pullBatchSize?: number;
  now?: () => Date;
  /** In [0, 1). Jitter for the backoff. */
  random?: () => number;
}

/**
 * Rounds of conflicts one pass will resolve. Each resolved conflict is pushed
 * again in the next round; a device racing another for the same entity should
 * not keep a pass going for ever.
 */
const MAX_CONFLICT_ROUNDS = 5;
/** Attempts to store one remote change while local edits keep landing on it. */
const MAX_APPLY_ATTEMPTS = 3;

const cursorKey = (workspaceId: Id) => `sync:cursor:${workspaceId}`;

interface PushItem {
  entry: OutboxEntry;
  change: SyncPushChange;
}

/**
 * The sync engine: drains the outbox to the server and applies what other
 * devices changed (audit plan phase 4, step 3; Backend_Node_Plan §9.6).
 *
 * A pass pushes, then pulls. Passes run on start, on reconnect, shortly after
 * a local edit, and every `pollMs` otherwise; a failed pass is retried with
 * exponential backoff and jitter. Everything the engine knows survives a
 * restart, because it keeps none of it: the outbox, the base versions and the
 * pull cursor all live in the local database.
 */
export class CloudSyncEngine implements SyncEngine {
  private readonly database: NotoDatabase;
  private readonly transport: SyncTransport;
  private readonly workspaceId: Id;
  private readonly deviceId: Id;
  private readonly connectivity: Connectivity;
  private readonly options: CloudSyncOptions;
  private readonly listeners = new Set<SyncStateListener>();

  private currentState: SyncState = {
    status: 'disabled',
    lastSyncedAt: null,
    pendingChanges: 0,
    error: null,
  };

  private running = false;
  private failures = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private timerDue = Infinity;
  private pass: Promise<void> | null = null;
  private queuedPass: Promise<void> | null = null;
  /** A remote change could not be stored this pass; try again soon, not in `pollMs`. */
  private retrySoon = false;
  private unsubscribeConnectivity: (() => void) | null = null;

  constructor(options: CloudSyncOptions) {
    this.options = options;
    this.database = options.database;
    this.transport = options.transport;
    this.workspaceId = options.workspaceId;
    this.deviceId = options.deviceId;
    this.connectivity = options.connectivity ?? alwaysOnline;
  }

  get state(): SyncState {
    return this.currentState;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.unsubscribeConnectivity = this.connectivity.subscribe((online) => {
      if (!this.running) return;
      if (online) {
        this.failures = 0;
        this.schedule(0);
      } else {
        this.cancelTimer();
        this.setState({ status: 'offline', error: null });
      }
    });

    await this.refreshPending();
    this.setState({ status: this.connectivity.online ? 'idle' : 'offline', error: null });
    this.schedule(0);
  }

  async stop(): Promise<void> {
    this.running = false;
    this.cancelTimer();
    this.unsubscribeConnectivity?.();
    this.unsubscribeConnectivity = null;

    await this.pass?.catch(() => {});
    this.setState({ status: 'disabled', error: null });
  }

  notifyChange(): void {
    void this.refreshPending();
    if (this.running) this.schedule(this.options.debounceMs ?? 2_000);
  }

  sync(): Promise<void> {
    if (!this.pass) {
      this.pass = this.runPass().finally(() => {
        this.pass = null;
      });
      return this.pass;
    }

    // A pass is running and may have read the outbox before the change the
    // caller is waiting for: run one more after it, shared by every caller.
    this.queuedPass ??= this.pass.then(() => {
      this.queuedPass = null;
      return this.sync();
    });
    return this.queuedPass;
  }

  subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ── A pass ────────────────────────────────────────────────────────────────

  private async runPass(): Promise<void> {
    this.cancelTimer();

    if (!this.connectivity.online) {
      // The connectivity listener starts the next pass when the network returns.
      this.setState({ status: 'offline', error: null });
      return;
    }

    this.setState({ status: 'syncing', error: null });
    this.retrySoon = false;

    try {
      await this.push();
      await this.pull();

      this.failures = 0;
      await this.refreshPending();
      this.setState({
        status: 'idle',
        error: null,
        lastSyncedAt: (this.options.now?.() ?? new Date()).toISOString(),
      });

      if (this.running) {
        this.schedule(
          this.retrySoon ? (this.options.debounceMs ?? 2_000) : (this.options.pollMs ?? 30_000),
        );
      }
    } catch (error) {
      this.failures += 1;
      const offline =
        !this.connectivity.online || (error instanceof SyncTransportError && error.offline);

      await this.refreshPending().catch(() => {});
      this.setState({
        status: offline ? 'offline' : 'error',
        error: offline ? null : error instanceof Error ? error.message : String(error),
      });

      if (this.running) this.schedule(this.backoffDelay());
    }
  }

  private async push(): Promise<void> {
    const batchSize = this.options.pushBatchSize ?? 200;

    let conflictRounds = 0;

    for (;;) {
      const batch = await this.collectPushBatch(batchSize);
      if (batch.length === 0) return;

      const result = await this.transport.push({
        deviceId: this.deviceId,
        workspaceId: this.workspaceId,
        changes: batch.map((item) => item.change),
      });

      const sent = new Map(
        batch.map((item) => [entityKey(item.entry.entityKind, item.entry.entityId), item]),
      );

      for (const applied of result.applied) {
        const item = sent.get(entityKey(applied.kind, applied.id));
        if (!item) continue;

        // The server holds what was sent, at `applied.version`. An edit made
        // since stays queued — the acknowledgement is for this `seq` only —
        // and will be pushed on top of that version.
        await this.database.sync.setBaseVersion(applied.kind, applied.id, applied.version);
        await this.database.outbox.acknowledge([item.entry]);
      }

      for (const conflict of result.conflicts) await this.applyIncoming(conflict);

      if (result.applied.length === 0 && result.conflicts.length === 0) return;
      if (result.conflicts.length > 0) {
        conflictRounds += 1;
        if (conflictRounds >= MAX_CONFLICT_ROUNDS) return;
      } else if (batch.length < batchSize) {
        return;
      }
    }
  }

  /** The oldest queued changes in this workspace, ready to send. */
  private async collectPushBatch(limit: number): Promise<PushItem[]> {
    const batch: PushItem[] = [];

    for (const entry of await this.database.outbox.list()) {
      if (batch.length >= limit) break;

      const record = await loadRecord(this.database, entry.entityKind, entry.entityId);
      if (!record) {
        // Purged locally before it was ever pushed: there is nothing to send.
        await this.database.outbox.acknowledge([entry]);
        continue;
      }
      if (workspaceOf(record) !== this.workspaceId) continue;

      batch.push({
        entry,
        change: {
          ...toWire(record),
          operation: entry.operation,
          baseVersion: await this.database.sync.baseVersion(entry.entityKind, entry.entityId),
        } as SyncPushChange,
      });
    }

    return batch;
  }

  private async pull(): Promise<void> {
    const key = cursorKey(this.workspaceId);
    let cursor = (await this.database.localState.get<number>(key)) ?? 0;

    for (;;) {
      const result = await this.transport.pull({
        deviceId: this.deviceId,
        workspaceId: this.workspaceId,
        sinceSeq: cursor,
        limit: this.options.pullBatchSize ?? 500,
      });

      if (result.fullResyncRequired) {
        if (cursor === 0) throw new Error('The server asked for a full resync of a full resync.');
        // The log was trimmed past this device. Pull everything again; what
        // is already here is recognised by its base version and skipped.
        cursor = 0;
        await this.database.localState.set(key, cursor);
        continue;
      }

      const stored: SyncRecord[] = [];
      for (const change of inApplyOrder(result.changes)) {
        const record = await this.applyIncoming(change);
        if (record === false) {
          // Not stored: leave the cursor where it is so the page comes again.
          this.retrySoon = true;
          this.announce(stored);
          return;
        }
        if (record) stored.push(record);
      }

      this.announce(stored);
      cursor = result.seq;
      await this.database.localState.set(key, cursor);

      if (!result.hasMore) return;
    }
  }

  /**
   * Stores one change from the server: a pulled change, or the server's side
   * of a conflict. Resolves with the record now stored, `null` when there was
   * nothing to do, or `false` when local edits kept landing on the entity.
   */
  private async applyIncoming(change: RemoteChange): Promise<SyncRecord | null | false> {
    const { kind } = change;
    const id = change.entity.id;

    for (let attempt = 0; attempt < MAX_APPLY_ATTEMPTS; attempt += 1) {
      const local = await loadRecord(this.database, kind, id);
      const base = await this.database.sync.baseVersion(kind, id);

      // Already here: this device's own change coming back, or an old copy.
      if (local && change.version <= base) return null;

      const expectedVersion = local ? (local.entity.version ?? 0) : null;
      const pending = local !== null && (await this.isQueued(kind, id));

      if (!pending) {
        const remote = recordOf(change);
        const written = await this.database.sync.applyRemote(remote, {
          baseVersion: change.version,
          expectedVersion,
        });
        if (written) return remote;
        continue;
      }

      const resolution = resolveConflict(local, change);

      if (resolution.winner === 'remote') {
        const remote = recordOf(change);
        const written = await this.database.sync.applyRemote(remote, {
          baseVersion: change.version,
          expectedVersion,
          dequeue: true,
        });
        if (!written) continue;

        this.options.onConflict?.({
          kind,
          id,
          winner: 'remote',
          keptVersionId: null,
          deviceName: change.deviceName,
        });
        return remote;
      }

      // The local change stands. Rebased onto the server's version, it stays
      // queued and goes out with the next push.
      const written = await this.database.sync.applyRemote(resolution.record, {
        baseVersion: change.version,
        expectedVersion,
      });
      if (!written) continue;

      let keptVersionId: Id | null = null;
      if (resolution.lostBody) {
        const kept = versionOf(resolution.lostBody, 'conflict', {
          summary: `Edited on ${change.deviceName ?? 'another device'}`,
        });
        await this.database.versions.add(kept);
        keptVersionId = kept.id;
      }

      this.options.onConflict?.({
        kind,
        id,
        winner: 'local',
        keptVersionId,
        deviceName: change.deviceName,
      });
      return resolution.record;
    }

    return false;
  }

  private async isQueued(kind: SyncEntityKind, id: Id): Promise<boolean> {
    const entries = await this.database.outbox.list();
    return entries.some((entry) => entry.entityKind === kind && entry.entityId === id);
  }

  // ── Plumbing ──────────────────────────────────────────────────────────────

  private announce(records: readonly SyncRecord[]): void {
    if (records.length > 0) this.options.onRemoteChange?.(records);
  }

  /** Runs a pass in `delayMs`, unless one is already due sooner. */
  private schedule(delayMs: number): void {
    const due = Date.now() + delayMs;
    if (this.timer !== null && this.timerDue <= due) return;

    this.cancelTimer();
    this.timerDue = due;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.timerDue = Infinity;
      void this.sync();
    }, delayMs);
  }

  private cancelTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.timerDue = Infinity;
  }

  /** 1 s, 2 s, 4 s … up to 5 min, each drawn from its upper half so devices spread out. */
  private backoffDelay(): number {
    const min = this.options.minBackoffMs ?? 1_000;
    const max = this.options.maxBackoffMs ?? 300_000;
    const ceiling = Math.min(max, min * 2 ** (this.failures - 1));
    const random = this.options.random ?? Math.random;
    return ceiling / 2 + random() * (ceiling / 2);
  }

  private async refreshPending(): Promise<void> {
    this.setState({ pendingChanges: await this.database.outbox.count() });
  }

  private setState(patch: Partial<SyncState>): void {
    this.currentState = { ...this.currentState, ...patch };
    for (const listener of this.listeners) listener(this.currentState);
  }
}

export function createCloudSyncEngine(options: CloudSyncOptions): CloudSyncEngine {
  return new CloudSyncEngine(options);
}
