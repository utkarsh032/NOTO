import { type ExportFormat } from '../export';

/* -------------------------------------------------------------------------- */
/* What a file is                                                             */
/* -------------------------------------------------------------------------- */

/**
 * A file on the user's disk, as this platform refers to one.
 *
 * `ref` is opaque to everything but the gateway that produced it — an absolute
 * path on the desktop, a key into a handle store in a browser. It is a string
 * rather than a handle object on purpose: the link between a document and its
 * file has to survive being written to local storage and read back tomorrow,
 * which is the whole difference between Save and Save As.
 *
 * An empty `ref` means the platform handed the file to the user and kept no way
 * back to it — a browser download, a share sheet. Such a file is never linked to
 * a document, because the next Save could not honour the link.
 */
export interface LocalFile {
  ref: string;
  /** What to show: a full path where the platform gives one, else the name. */
  label: string;
  /** The file's own name, extension included. */
  name: string;
  /** How the document is written into it, taken from the extension. */
  format: ExportFormat;
}

/** A file read off the disk, with what was in it. */
export interface OpenedFile {
  file: LocalFile;
  text: string;
}

/**
 * A Save As in progress.
 *
 * `serialise` is a callback rather than a finished string because the format is
 * not known until the user has named the file: choosing `notes.html` in the
 * dialog is how somebody asks for HTML. The gateway picks the target, reads the
 * extension, and only then asks for the bytes.
 */
export interface SaveTarget {
  /** The name to offer in the dialog, extension included. */
  suggestedName: string;
  serialise(format: ExportFormat): string;
}

export interface LocalFileGateway {
  /**
   * Whether a file, once chosen, can be written again without asking.
   *
   * False in a browser without the File System Access API, where saving is a
   * download and every save is a new one. What the user is told depends on this,
   * so it is stated rather than guessed at.
   */
  readonly canWriteInPlace: boolean;
  /** Reads files chosen by the user. `null` when the dialog was dismissed. */
  open(): Promise<OpenedFile[] | null>;
  /**
   * Reads a file chosen earlier, without a dialog. Throws when it can no longer
   * be read — moved, deleted, or permission withdrawn.
   *
   * This is what Recent is: the file was chosen once, and choosing it again
   * should not mean finding it in a folder tree a second time.
   */
  read(file: LocalFile): Promise<string>;
  /** Chooses a destination and writes to it. `null` when the dialog was dismissed. */
  saveAs(target: SaveTarget): Promise<LocalFile | null>;
  /** Overwrites a file chosen earlier. Throws when it can no longer be written. */
  write(file: LocalFile, contents: string): Promise<void>;
}
