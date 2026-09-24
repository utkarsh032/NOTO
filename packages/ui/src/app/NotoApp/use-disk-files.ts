import type { NotoDocument } from '@noto/types';
import { useCallback } from 'react';

import { showToast } from '../../components/toast-store';
import type { NotoDataValue } from '../data-context';
import { parseImportedFile } from '../export';
import {
  documentForFile,
  forgetRecentFile,
  linkFile,
  openFilesFromDisk,
  readRecentFile,
  recentFiles,
  type OpenedFile,
} from '../local-file';
import type { NotoActions } from '../use-noto-actions';

/**
 * Open and Open Recent: files off the disk, into documents.
 *
 * The window's own business, because they make documents; kept here so the
 * shell reads as a list of what it does rather than how each thing is done.
 * `actions` is passed in rather than read again, so the tab hook behind it has
 * one instance, not two.
 */
export function useDiskFiles(
  actions: NotoActions,
  status: NotoDataValue['status'],
  documents: NotoDocument[] | undefined,
): { openFromDisk(): Promise<void>; openRecent(ref: string): Promise<void> } {
  /*
   * Open, the way Notepad means it: files off the disk, each into a document of
   * its own, and the first of them in front. Each document remembers the file
   * it came from, so Save writes back there rather than asking where.
   *
   * The documents are created through the same import path the Documents
   * screen uses, so a file opened this way is an ordinary document from the
   * moment it exists — searchable, synced, in the sidebar — with one extra fact
   * about it kept on this machine.
   */
  /**
   * Turns files that have been read into documents, and puts the first in front.
   *
   * Shared by Open and by Recent, because the two differ only in how the file
   * was chosen: everything after the bytes arrive is the same, down to what is
   * said about it.
   */
  const adoptFiles = useCallback(
    async (opened: OpenedFile[]) => {
      let first: string | null = null;

      for (const { file, text } of opened) {
        const id = await actions.importDocument(parseImportedFile(file.name, text));
        if (!id) continue;

        linkFile(id, file);
        first ??= id;
      }

      if (!first) {
        showToast('Noto could not open those files. Nothing was changed.', { tone: 'error' });
        return;
      }

      actions.openDocument(first);
      showToast(
        opened.length === 1 ? `Opened ${opened[0]!.file.name}` : `Opened ${opened.length} files`,
        { tone: 'success' },
      );
    },
    [actions],
  );

  /**
   * True while the workspace is still opening.
   *
   * Nothing can be made of a file until storage is open, and a picker shown
   * before then ends with the user choosing a file that is quietly dropped. The
   * window is short — a skeleton is on screen for it — but "I opened it and it
   * vanished" is the worst way to learn that.
   */
  const notReadyYet = useCallback(() => {
    if (status === 'ready') return false;

    showToast('Noto is still opening your workspace. Try again in a moment.');
    return true;
  }, [status]);

  const openFromDisk = useCallback(async () => {
    if (notReadyYet()) return;

    let opened: OpenedFile[] | null;
    try {
      opened = await openFilesFromDisk();
    } catch (error) {
      showToast(
        error instanceof Error && error.message ? error.message : 'Noto could not open that file.',
        { tone: 'error' },
      );
      return;
    }

    if (!opened || opened.length === 0) return;

    await adoptFiles(opened);
  }, [adoptFiles, notReadyYet]);

  /*
   * Recent: a file the user chose once, opened again without finding it twice.
   *
   * A file that is already a document here comes back as that document rather
   * than as a second copy of itself — the tab, the edits and the history are
   * the reason somebody is reaching for it. Only a file Noto has lost track of
   * is read afresh, and one it cannot read at all leaves the list, because a
   * menu entry that can only ever apologise is worse than no entry.
   */
  const openRecent = useCallback(
    async (ref: string) => {
      if (notReadyYet()) return;

      const existing = documentForFile(ref);
      if (existing && (documents ?? []).some((document) => document.id === existing)) {
        actions.openDocument(existing);
        return;
      }

      const file = recentFiles().find((entry) => entry.ref === ref);
      if (!file) return;

      try {
        await adoptFiles([await readRecentFile(file)]);
      } catch (error) {
        forgetRecentFile(ref);
        showToast(
          error instanceof Error && error.message
            ? error.message
            : `Noto could not open ${file.name}.`,
          { tone: 'error' },
        );
      }
    },
    [actions, adoptFiles, documents, notReadyYet],
  );

  return { openFromDisk, openRecent };
}
