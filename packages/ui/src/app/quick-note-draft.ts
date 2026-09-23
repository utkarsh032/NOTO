import type { NotoDatabase } from '@noto/database';

/**
 * The Quick Note draft.
 *
 * One string, in local storage, shared by every surface that can take a quick
 * note: the floating window, the Quick Note screen, and — on the desktop — the
 * dock that sits on the edge of the display after the application window has
 * gone. A thought started in one of them has to be findable in the others, or
 * "quick" only means "quick to lose".
 *
 * Local storage is the fast path, on purpose: reads are synchronous, which is
 * what lets every surface render the same string on the same frame, and its
 * `storage` event is how the desktop dock and the application window — two
 * renderers — hear each other. A draft is not a document yet, so it is never
 * written to the document store.
 *
 * But local storage is also the first thing a browser clears. So the draft is
 * mirrored into the database's `local_state` table as well, a moment after
 * each change, and put back from there when local storage comes up empty.
 * See `persistQuickNoteDraftTo`.
 */

const DRAFT_KEY = 'noto.quick-note.draft';

/** The draft's key in the database's `local_state` table. */
const DRAFT_STATE_KEY = 'draft:quick-note';

/** How long after the last keystroke the durable copy is written. */
const MIRROR_DELAY_MS = 500;

let durable: NotoDatabase | null = null;
let mirrorTimer: ReturnType<typeof setTimeout> | null = null;

function mirror(text: string): void {
  if (!durable) return;

  if (mirrorTimer) clearTimeout(mirrorTimer);
  const database = durable;

  mirrorTimer = setTimeout(() => {
    mirrorTimer = null;
    const write =
      text === ''
        ? database.localState.delete(DRAFT_STATE_KEY)
        : database.localState.set(DRAFT_STATE_KEY, text);
    // Local storage still has it; losing the backup is not worth a message.
    void write.catch(() => undefined);
  }, MIRROR_DELAY_MS);
}

/**
 * Keeps a durable copy of the draft in `database`, for as long as the returned
 * function is not called. If local storage has no draft — cleared, or a new
 * browser profile over the same data — the copy is put back.
 */
export function persistQuickNoteDraftTo(database: NotoDatabase): () => void {
  durable = database;

  void database.localState
    .get<string>(DRAFT_STATE_KEY)
    .then((saved) => {
      if (saved && readQuickNoteDraft() === '') writeQuickNoteDraft(saved);
    })
    .catch(() => undefined);

  return () => {
    if (durable === database) durable = null;
  };
}

/** Fires whenever the draft changes in this window. */
const CHANGE_EVENT = 'noto:quick-note-draft';

export function readQuickNoteDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? '';
  } catch {
    // Blocked storage is not a reason to refuse a note.
    return '';
  }
}

export function writeQuickNoteDraft(text: string): void {
  try {
    localStorage.setItem(DRAFT_KEY, text);
  } catch {
    // Same again: the note stays in the field either way.
  }

  /*
   * `storage` events only reach *other* windows, which is exactly backwards for
   * the case here: the Quick Note window and the screen behind it are usually
   * the same document. A private event covers this window; the `storage`
   * listener below covers the desktop's separate dock window.
   */
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }

  mirror(text);
}

/**
 * Calls back whenever the draft changes, here or in another window.
 *
 * Shaped for `useSyncExternalStore`: it returns an unsubscribe function and
 * says nothing about the value, which is read separately.
 */
export function subscribeToQuickNoteDraft(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === DRAFT_KEY) listener();
  };

  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** The title a note gets when it becomes a document: its first line, trimmed. */
export function quickNoteTitle(text: string): string {
  const [firstLine = ''] = text.trim().split('\n');
  return firstLine.slice(0, 80) || 'Quick note';
}
