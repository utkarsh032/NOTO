import { STORAGE_KEYS } from '@noto/config';
import { useSyncExternalStore } from 'react';

import { listeners, subscribeToLocalFiles } from './links';
import type { LocalFile } from './types';

/* -------------------------------------------------------------------------- */
/* Where you have been                                                        */
/* -------------------------------------------------------------------------- */

/*
 * Recent files.
 *
 * The list every file menu has had for thirty years, and it earns its place for
 * the same reason it always did: the file somebody wants next is nearly always
 * one they had open lately, and finding it again in a folder tree is a chore
 * the application already knows the answer to.
 *
 * Only files Noto can get back to are listed. A download, or a file dropped in
 * by a browser with no picker, has an empty `ref` and no way home — an entry
 * for one would be a menu item that could only ever apologise.
 */

/** Long enough to cover a day's work, short enough to stay a menu. */
const RECENT_LIMIT = 10;

let recents: LocalFile[] | null = null;

function readRecents(): LocalFile[] {
  if (recents) return recents;

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.recentFiles);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;

    recents = Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is LocalFile =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as LocalFile).ref === 'string' &&
            (entry as LocalFile).ref !== '',
        )
      : [];
  } catch {
    recents = [];
  }

  return recents;
}

/** Forgets the cached list, so the next read picks up another window's write. */
export function dropCachedRecents(): void {
  recents = null;
}

function writeRecents(next: LocalFile[]): void {
  recents = next;

  try {
    localStorage.setItem(STORAGE_KEYS.recentFiles, JSON.stringify(next));
  } catch {
    // A blocked quota costs the menu entry, never the file it was about.
  }

  for (const listener of [...listeners]) listener();
}

/** The files most recently opened or saved, newest first. */
export function recentFiles(): LocalFile[] {
  return readRecents();
}

/**
 * Records a file as the most recent one.
 *
 * Matched by `ref`, so the same file opened twice moves to the top rather than
 * appearing twice, and a file saved under a new name joins the list beside the
 * one it came from.
 */
export function rememberRecentFile(file: LocalFile): void {
  if (!file.ref) return;

  const next = [file, ...readRecents().filter((entry) => entry.ref !== file.ref)];
  writeRecents(next.slice(0, RECENT_LIMIT));
}

/**
 * Drops a file from the list.
 *
 * Called when reopening one fails: a file that has been moved or deleted is not
 * coming back, and an entry that answers with an error every time is worse than
 * no entry at all.
 */
export function forgetRecentFile(ref: string): void {
  const current = readRecents();
  const next = current.filter((entry) => entry.ref !== ref);

  if (next.length !== current.length) writeRecents(next);
}

/** Empties the list. The files themselves are untouched. */
export function clearRecentFiles(): void {
  if (readRecents().length > 0) writeRecents([]);
}

/* A stable empty array: a fresh one per server render would never settle. */
const NO_RECENTS: LocalFile[] = [];

/** The recent files, for a menu that has to redraw when they change. */
export function useRecentFiles(): LocalFile[] {
  return useSyncExternalStore(subscribeToLocalFiles, recentFiles, () => NO_RECENTS);
}
