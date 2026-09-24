import { RECOVERY_KEY_PREFIX } from '@noto/config';
import type { NotoDatabase } from '@noto/database';
import type { DocumentContent, Id } from '@noto/types';

/**
 * Crash recovery for the editor.
 *
 * Autosave already survives the ordinary ways an edit escapes — switching
 * documents, hiding the window, closing a tab — because it flushes on all of
 * them. What it cannot survive is the process disappearing between a keystroke
 * and the debounced write: a crash, a force quit, a lost battery. The window
 * is short, but everything typed in it is gone with no trace that it existed.
 *
 * A snapshot closes that. It is written to the database's `local_state` table
 * on every edit — coalesced, so a burst of typing is one write in flight and
 * one queued, never a write per keystroke. It used to live in `localStorage`,
 * which holds a few megabytes for the whole site (a handful of long documents'
 * worth) and is cleared along with cookies; a snapshot is a whole document, so
 * that was exactly the wrong size of store. Snapshots written there by an older
 * release are still read, and moved across when they are.
 *
 * On the next open, a snapshot that outlives the stored document is offered
 * back to the user; anything else is discarded silently, because a snapshot
 * that merely repeats what was saved is not news.
 */

export interface RecoverySnapshot {
  documentId: Id;
  title: string;
  content: DocumentContent;
  /** When the snapshot was taken, as an epoch millisecond count. */
  savedAt: number;
}

export interface RecoveryStore {
  /** The snapshot worth offering for `documentId`, if there is one. */
  read(documentId: Id, storedUpdatedAt: string): Promise<RecoverySnapshot | null>;
  /** Records the in-progress state. Never throws, never waits. */
  write(snapshot: RecoverySnapshot): void;
  clear(documentId: Id): Promise<void>;
}

const stateKey = (documentId: Id): string => `recovery:${documentId}`;
const legacyKey = (documentId: Id): string => `${RECOVERY_KEY_PREFIX}${documentId}`;

function parse(value: unknown): RecoverySnapshot | null {
  const parsed = (typeof value === 'string' ? safeJson(value) : value) as Partial<RecoverySnapshot>;
  if (!parsed || typeof parsed !== 'object') return null;

  // Written by an older release, or by something else entirely.
  if (typeof parsed.documentId !== 'string') return null;
  if (typeof parsed.title !== 'string') return null;
  if (typeof parsed.savedAt !== 'number') return null;

  const content = parsed.content as DocumentContent | undefined;
  if (!content || content.type !== 'doc') return null;

  return { documentId: parsed.documentId, title: parsed.title, content, savedAt: parsed.savedAt };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** A snapshot an older release left in localStorage, removed as it is read. */
function takeLegacy(documentId: Id): RecoverySnapshot | null {
  try {
    if (typeof localStorage === 'undefined') return null;

    const raw = localStorage.getItem(legacyKey(documentId));
    if (raw === null) return null;

    localStorage.removeItem(legacyKey(documentId));
    return parse(raw);
  } catch {
    return null;
  }
}

class DatabaseRecoveryStore implements RecoveryStore {
  /** Per document: whether a write is running, and the newest one waiting. */
  private readonly writes = new Map<Id, { running: boolean; next: RecoverySnapshot | null }>();

  constructor(private readonly database: NotoDatabase) {}

  async read(documentId: Id, storedUpdatedAt: string): Promise<RecoverySnapshot | null> {
    let snapshot: RecoverySnapshot | null = null;

    try {
      snapshot = parse(await this.database.localState.get(stateKey(documentId)));
    } catch {
      snapshot = null;
    }

    const legacy = takeLegacy(documentId);
    if (legacy && (!snapshot || legacy.savedAt > snapshot.savedAt)) snapshot = legacy;

    /*
     * Only interesting when it is newer than what was stored: in the ordinary
     * case autosave got there first, and the two say the same thing. Comparing
     * timestamps rather than content keeps this cheap on a large document, and
     * errs towards offering — being asked about a recovery you do not need
     * costs a click, while not being asked costs the work.
     */
    const storedAt = Date.parse(storedUpdatedAt);
    if (
      !snapshot ||
      snapshot.documentId !== documentId ||
      Number.isNaN(storedAt) ||
      snapshot.savedAt <= storedAt
    ) {
      await this.clear(documentId);
      return null;
    }

    return snapshot;
  }

  write(snapshot: RecoverySnapshot): void {
    const slot = this.writes.get(snapshot.documentId) ?? { running: false, next: null };
    slot.next = snapshot;
    this.writes.set(snapshot.documentId, slot);

    if (!slot.running) void this.drain(snapshot.documentId);
  }

  async clear(documentId: Id): Promise<void> {
    // A snapshot still waiting to be written is as stale as the stored one.
    const slot = this.writes.get(documentId);
    if (slot) slot.next = null;

    try {
      await this.database.localState.delete(stateKey(documentId));
    } catch {
      // Checked against the stored document on the next open and dropped there.
    }
  }

  private async drain(documentId: Id): Promise<void> {
    const slot = this.writes.get(documentId);
    if (!slot) return;

    slot.running = true;
    while (slot.next) {
      const next = slot.next;
      slot.next = null;

      try {
        await this.database.localState.set(stateKey(documentId), next);
      } catch {
        // A full or blocked store is a reason to lose the safety net, never a
        // reason to interrupt someone's typing.
      }
    }
    slot.running = false;
  }
}

const stores = new WeakMap<NotoDatabase, RecoveryStore>();

/** The recovery store for a database: one per connection, shared by every editor. */
export function recoveryFor(database: NotoDatabase): RecoveryStore {
  let store = stores.get(database);
  if (!store) {
    store = new DatabaseRecoveryStore(database);
    stores.set(database, store);
  }
  return store;
}
