import type { OpenedFile } from './types';

/**
 * Files handed to Noto from outside it.
 *
 * Double-clicking a `.md` file, dragging one onto the application's icon, or
 * choosing Noto from "Open with" all end with the operating system starting
 * Noto — or poking the copy already running — with a path. The platform reads
 * the file; this is where it hands the result to the shell.
 *
 * They are held until somebody takes them. The commonest case is also the
 * earliest one: Noto was not running, the file is what started it, and it
 * arrives long before the workspace has been opened and there is anywhere to
 * put it. Dropping it then would be the worst possible first impression — the
 * user asked for a file and got an empty window.
 */
type OpenedFilesListener = (files: OpenedFile[]) => void;

const pending: OpenedFile[][] = [];
let listener: OpenedFilesListener | null = null;

/** Called by the platform with files it has read. Delivered now, or once somebody listens. */
export function receiveOpenedFiles(files: OpenedFile[]): void {
  if (files.length === 0) return;

  if (listener) listener(files);
  else pending.push(files);
}

/**
 * Takes files from outside, starting with any that arrived before this call.
 *
 * One listener at a time: the files become documents, and two windows each
 * making a document of the same file is a duplicate, not a feature.
 */
export function subscribeToOpenedFiles(next: OpenedFilesListener): () => void {
  listener = next;

  for (const files of pending.splice(0)) next(files);

  return () => {
    if (listener === next) listener = null;
  };
}
