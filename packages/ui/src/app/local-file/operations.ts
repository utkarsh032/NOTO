import type { DocumentContent, Id } from '@noto/types';

import { serialiseDocument } from '../export';
import { fileNameFor } from './formats';
import { activeGateway } from './gateway';
import { linkFile, linkedFile } from './links';
import { rememberRecentFile } from './recents';
import type { LocalFile, OpenedFile } from './types';

/* -------------------------------------------------------------------------- */
/* Saving and opening                                                         */
/* -------------------------------------------------------------------------- */

/** What was written, and whether Noto can write to it again. */
export interface SavedToFile {
  file: LocalFile;
  /** True when the next Save goes straight back to this file with no dialog. */
  linked: boolean;
}

export interface SaveToFileOptions {
  /** Ask for a destination even when the document already has one — Save As. */
  chooseLocation?: boolean;
}

/**
 * Writes a document to disk. `null` when the user dismissed the dialog.
 *
 * The order of what happens here is load-bearing. A file dialog may only be
 * opened while the browser still considers a key press or a click to be in hand,
 * and awaiting anything slow first — a database write, most obviously — spends
 * that. So the document is serialised synchronously and the picker is the very
 * first thing awaited.
 *
 * Errors are thrown rather than swallowed: a save that did not happen is exactly
 * the thing a person needs to be told about.
 */
export async function saveDocumentToFile(
  documentId: Id,
  document: { title: string; content: DocumentContent },
  options: SaveToFileOptions = {},
): Promise<SavedToFile | null> {
  const platform = activeGateway();
  const existing = linkedFile(documentId);

  if (existing && !options.chooseLocation && platform.canWriteInPlace) {
    await platform.write(existing, serialiseDocument(document, existing.format));
    rememberRecentFile(existing);
    return { file: existing, linked: true };
  }

  const saved = await platform.saveAs({
    /*
     * A document that already has a file keeps its name when saved elsewhere;
     * one that has none is named after its title, the way export names it.
     */
    suggestedName: existing?.name ?? fileNameFor(document.title),
    serialise: (format) => serialiseDocument(document, format),
  });

  if (!saved) return null;

  linkFile(documentId, saved);
  rememberRecentFile(saved);

  return { file: saved, linked: Boolean(saved.ref) && platform.canWriteInPlace };
}

/**
 * Reads files chosen by the user. `null` when the dialog was dismissed.
 *
 * What becomes of them is the caller's business: this module knows about files,
 * and creating documents belongs to the shell that owns the workspace.
 */
export async function openFilesFromDisk(): Promise<OpenedFile[] | null> {
  const opened = await activeGateway().open();

  for (const { file } of opened ?? []) rememberRecentFile(file);

  return opened;
}

/**
 * Reads a file straight from the Recent list, with no dialog in the way.
 *
 * Throws what the platform threw. The caller is expected to drop the entry when
 * it does: a file that cannot be read is one that has moved or gone, and the
 * menu should stop offering it rather than keep failing at it.
 */
export async function readRecentFile(file: LocalFile): Promise<OpenedFile> {
  return { file, text: await activeGateway().read(file) };
}
