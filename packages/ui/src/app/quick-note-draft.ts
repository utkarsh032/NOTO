/**
 * The Quick Note draft.
 *
 * One string, in local storage, shared by every surface that can take a quick
 * note: the floating window, the Quick Note screen, and — on the desktop — the
 * dock that sits on the edge of the display after the application window has
 * gone. A thought started in one of them has to be findable in the others, or
 * "quick" only means "quick to lose".
 *
 * Local storage rather than the database on purpose. A draft is not a document
 * yet; it has no title, no id and nothing to sync, and writing one to the
 * document store on every keystroke would fill the workspace with things
 * nobody chose to keep. Saving is what turns it into a document.
 */

const DRAFT_KEY = 'noto.quick-note.draft';

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
