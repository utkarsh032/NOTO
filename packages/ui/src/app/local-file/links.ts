import { STORAGE_KEYS } from '@noto/config';
import type { Id } from '@noto/types';
import { useSyncExternalStore } from 'react';

import { dropCachedRecents } from './recents';
import type { LocalFile } from './types';

/* -------------------------------------------------------------------------- */
/* Which document is which file                                               */
/* -------------------------------------------------------------------------- */

/*
 * The links live in local storage rather than in the database because they are
 * facts about this machine, not about the document. The same note synced to a
 * second device is not sitting at `C:\Users\...` over there, and carrying the
 * path across would be carrying a path to nothing.
 */

type LinkMap = Record<Id, LocalFile>;

let links: LinkMap | null = null;

function readLinks(): LinkMap {
  if (links) return links;

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.localFiles);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;

    links =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as LinkMap) : {};
  } catch {
    links = {};
  }

  return links;
}

/** Told whenever a link or a recent file changes. Shared with `recents.ts`. */
export const listeners = new Set<() => void>();

function writeLinks(next: LinkMap): void {
  links = next;

  try {
    localStorage.setItem(STORAGE_KEYS.localFiles, JSON.stringify(next));
  } catch {
    // A blocked or full quota costs the link, never the save that just landed.
  }

  for (const listener of [...listeners]) listener();
}

/** The file `documentId` is saved to, if it has one. */
export function linkedFile(documentId: Id): LocalFile | null {
  const file = readLinks()[documentId];

  // An empty ref is a file Noto could not write to again — a download, a
  // dropped file — and must never be treated as a link.
  return file && file.ref ? file : null;
}

/** Remembers that `documentId` is this file, so the next Save writes to it. */
export function linkFile(documentId: Id, file: LocalFile): void {
  if (!file.ref) return;

  writeLinks({ ...readLinks(), [documentId]: file });
}

/**
 * The document already linked to this file, if one is.
 *
 * Reopening from Recent asks this first: a file that is already a document in
 * this workspace should come back as *that* document, with its tab, its edits
 * and its history, rather than as a second copy of itself.
 */
export function documentForFile(ref: string): Id | null {
  if (!ref) return null;

  for (const [documentId, file] of Object.entries(readLinks())) {
    if (file?.ref === ref) return documentId;
  }

  return null;
}

/** Forgets a document's file. The file itself is left exactly where it is. */
export function unlinkFile(documentId: Id): void {
  const current = readLinks();
  if (!current[documentId]) return;

  const next = { ...current };
  delete next[documentId];
  writeLinks(next);
}

/**
 * Calls back whenever a link changes, here or in another window.
 *
 * Shaped for `useSyncExternalStore`: it returns an unsubscribe function and says
 * nothing about the value, which is read separately.
 */
export function subscribeToLocalFiles(listener: () => void): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (
      event.key !== null &&
      event.key !== STORAGE_KEYS.localFiles &&
      event.key !== STORAGE_KEYS.recentFiles
    ) {
      return;
    }

    // Written by the desktop's other window, or by a second tab. Dropping the
    // cached copies is what makes the next read pick up what they wrote.
    links = null;
    dropCachedRecents();
    listener();
  };

  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

/**
 * The file behind an open document, for anything that has to show it.
 *
 * The snapshot is the stored object itself rather than a copy, so React sees the
 * same reference until a link actually changes.
 */
export function useLocalFile(documentId: Id | null): LocalFile | null {
  return useSyncExternalStore(
    subscribeToLocalFiles,
    () => (documentId ? linkedFile(documentId) : null),
    () => null,
  );
}
