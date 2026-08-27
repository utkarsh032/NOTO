import { RECOVERY_KEY_PREFIX } from '@noto/config';
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
 * A snapshot closes that. It is written synchronously to `localStorage` on
 * every edit — the same store the settings live in, which is available on web
 * and on desktop and does not go through the database layer that may itself be
 * mid-transaction when the process dies. On the next open, a snapshot that
 * outlives the stored document is offered back to the user; anything else is
 * discarded silently, because a snapshot that merely repeats what was saved is
 * not news.
 */

export interface RecoverySnapshot {
  documentId: Id;
  title: string;
  content: DocumentContent;
  /** When the snapshot was taken, as an epoch millisecond count. */
  savedAt: number;
}

const keyFor = (documentId: Id): string => `${RECOVERY_KEY_PREFIX}${documentId}`;

/**
 * Records the in-progress state of a document.
 *
 * Failure is swallowed on purpose: a full or blocked storage quota is a reason
 * to lose the safety net, never a reason to interrupt someone's typing.
 */
export function writeSnapshot(snapshot: RecoverySnapshot): void {
  try {
    localStorage.setItem(keyFor(snapshot.documentId), JSON.stringify(snapshot));
  } catch {
    // No recovery for this document; the editor carries on regardless.
  }
}

export function clearSnapshot(documentId: Id): void {
  try {
    localStorage.removeItem(keyFor(documentId));
  } catch {
    // Nothing to do — a snapshot that cannot be removed is checked against the
    // stored document on the next open and discarded there instead.
  }
}

function parse(raw: string): RecoverySnapshot | null {
  try {
    const parsed = JSON.parse(raw) as Partial<RecoverySnapshot>;

    // Written by an older release, or by something else entirely.
    if (typeof parsed.documentId !== 'string') return null;
    if (typeof parsed.title !== 'string') return null;
    if (typeof parsed.savedAt !== 'number') return null;

    const content = parsed.content as DocumentContent | undefined;
    if (!content || content.type !== 'doc') return null;

    return { documentId: parsed.documentId, title: parsed.title, content, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

/**
 * The snapshot worth offering for `documentId`, if there is one.
 *
 * A snapshot is only interesting when it is newer than what was stored: in the
 * ordinary case autosave got there first, and the two say the same thing.
 * Comparing timestamps rather than content keeps this cheap on a large
 * document, and errs towards offering — being asked about a recovery you do not
 * need costs a click, while not being asked costs the work.
 */
export function readSnapshot(documentId: Id, storedUpdatedAt: string): RecoverySnapshot | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(keyFor(documentId));
  } catch {
    return null;
  }
  if (!raw) return null;

  const snapshot = parse(raw);
  if (!snapshot || snapshot.documentId !== documentId) {
    clearSnapshot(documentId);
    return null;
  }

  const storedAt = Date.parse(storedUpdatedAt);
  if (Number.isNaN(storedAt) || snapshot.savedAt <= storedAt) {
    clearSnapshot(documentId);
    return null;
  }

  return snapshot;
}
