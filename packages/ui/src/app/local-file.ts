import { STORAGE_KEYS } from '@noto/config';
import { slugify } from '@noto/core';
import type { DocumentContent, Id } from '@noto/types';
import { useSyncExternalStore } from 'react';

import {
  EXPORT_FORMATS,
  IMPORT_ACCEPT,
  deliverFile,
  serialiseDocument,
  type ExportFormat,
} from './export';

/**
 * Documents as files on the user's own disk.
 *
 * Noto keeps every document in its own storage, and that is the right place for
 * them: it is what makes search instant, tabs survive a restart, and a thousand
 * notes cost nothing. But a workspace is a place work goes *into*, and some work
 * has to go *through* — the note that becomes a README, the draft somebody else
 * has to open, the file a build script reads. An application that can only ever
 * save inside itself makes every one of those a copy-and-paste job.
 *
 * So Noto does what every text editor since Notepad has done. Save writes the
 * document to a file; a document that already has one is written straight back
 * to it, and one that has none is asked where to go, once. Save As always asks.
 * Open reads a file into a tab, and what is typed there afterwards goes home to
 * the same file.
 *
 * Autosave is untouched by all of it. The workspace copy is still written on its
 * own timer and flushed before every save here, so the file on disk is a second
 * home for the document rather than the only one — nothing is lost when a file
 * is moved, renamed or deleted behind Noto's back.
 *
 * ## The seam
 *
 * Choosing a file is the one part of this that no shared code can do. A browser
 * has the File System Access API and a sandbox around it; Electron has the
 * operating system's own dialogs and a real path at the end of them. Both are
 * expressed as a `LocalFileGateway`, registered the same way the print and
 * external-link handlers are, and everything above that line is the same code on
 * every platform.
 */

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

/* -------------------------------------------------------------------------- */
/* Names and formats                                                          */
/* -------------------------------------------------------------------------- */

/** The formats Noto can write, in the order a save dialog should offer them. */
const WRITABLE_FORMATS = EXPORT_FORMATS.filter((format) => format.supported);

/** What Noto writes when it has nothing better to go on. */
export const DEFAULT_LOCAL_FILE_FORMAT: ExportFormat = 'md';

/** What a picker should let the user choose when opening. */
export const LOCAL_FILE_ACCEPT = IMPORT_ACCEPT;

/**
 * Which format a file name asks for.
 *
 * Anything unrecognised is plain text. That is the honest answer for a file
 * somebody named `notes` or `todo.list`: Noto can always write the words, and
 * refusing an extension it has not heard of would be refusing the file.
 */
export function formatForFileName(name: string): ExportFormat {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';

  switch (extension) {
    case 'md':
    case 'markdown':
      return 'md';
    case 'html':
    case 'htm':
      return 'html';
    case 'json':
      return 'json';
    default:
      return 'txt';
  }
}

/** The name Noto suggests for a document that has never been saved. */
export function fileNameFor(
  title: string,
  format: ExportFormat = DEFAULT_LOCAL_FILE_FORMAT,
): string {
  const info = EXPORT_FORMATS.find((candidate) => candidate.id === format);
  return `${slugify(title || 'untitled') || 'untitled'}.${info?.extension ?? 'txt'}`;
}

/** The MIME type a format is written as, for the platforms that ask for one. */
export function mimeTypeFor(format: ExportFormat): string {
  return EXPORT_FORMATS.find((candidate) => candidate.id === format)?.mimeType ?? 'text/plain';
}

/** The formats a save dialog should offer, richest first. */
export function writableFormats(): readonly (typeof EXPORT_FORMATS)[number][] {
  return WRITABLE_FORMATS;
}

/* -------------------------------------------------------------------------- */
/* The gateway                                                                */
/* -------------------------------------------------------------------------- */

let gateway: LocalFileGateway | null = null;

/**
 * Installs the platform's file implementation, replacing any previous one.
 *
 * Registered rather than passed down, for the same reason the print handler is:
 * exactly one exists per running application and it is set once at startup. The
 * desktop sets it, because Electron's dialogs give a real path and a sandboxed
 * renderer must not go near the file system itself. The browser needs no
 * registration — the default below is the browser.
 */
export function setLocalFileGateway(next: LocalFileGateway | null): void {
  gateway = next;
}

function activeGateway(): LocalFileGateway {
  return gateway ?? browserGateway;
}

/** True when saving means writing back to the same file rather than downloading. */
export function canWriteFilesInPlace(): boolean {
  return activeGateway().canWriteInPlace;
}

/* -------------------------------------------------------------------------- */
/* The browser                                                                */
/* -------------------------------------------------------------------------- */

/*
 * The File System Access API, typed here rather than taken from `lib.dom`.
 *
 * `showSaveFilePicker` and the permission methods are not in every TypeScript
 * DOM library, and the ones that carry them disagree about the details.
 * Declaring the handful of members Noto actually calls keeps this compiling on
 * whatever version the workspace is on, and turns feature detection into a plain
 * check for a function rather than a cast.
 */
interface FileWritable {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

interface PickedFile {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FileWritable>;
  queryPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}

interface PickerWindow {
  showOpenFilePicker?(options?: {
    multiple?: boolean;
    types?: PickerType[];
  }): Promise<PickedFile[]>;
  showSaveFilePicker?(options?: {
    suggestedName?: string;
    types?: PickerType[];
  }): Promise<PickedFile>;
}

function pickerWindow(): PickerWindow {
  return typeof window === 'undefined' ? {} : (window as unknown as PickerWindow);
}

function hasFilePicker(): boolean {
  return typeof pickerWindow().showSaveFilePicker === 'function';
}

/** A dismissed dialog, which is a decision rather than a failure. */
function isCancellation(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'AbortError';
}

const SAVE_TYPES: PickerType[] = WRITABLE_FORMATS.map((format) => ({
  description: format.label,
  accept: { [format.mimeType]: [`.${format.extension}`] },
}));

const OPEN_TYPES: PickerType[] = [
  {
    description: 'Documents Noto can read',
    accept: { 'text/*': LOCAL_FILE_ACCEPT.split(',') },
  },
];

/* --- Handles, kept between visits ---------------------------------------- */

/*
 * A file handle is the browser's only way back to a file the user chose, and it
 * is not a string — so it cannot live in the link map alongside everything else.
 * It goes into a small IndexedDB store of its own instead, under a generated
 * key, and that key is what the link map holds.
 *
 * The alternative is asking where to save every time the page is reloaded, which
 * is not what Save means anywhere else.
 */
const HANDLE_DATABASE = 'noto-file-handles';
const HANDLE_STORE = 'handles';

/** Handles already used this session, so a repeated save skips the database. */
const handleCache = new Map<string, PickedFile>();

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DATABASE, 1);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(HANDLE_STORE)) {
        request.result.createObjectStore(HANDLE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB is unavailable.'));
  });
}

async function rememberHandle(ref: string, handle: PickedFile): Promise<void> {
  handleCache.set(ref, handle);

  try {
    const database = await openHandleDatabase();

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(HANDLE_STORE, 'readwrite');
      transaction.objectStore(HANDLE_STORE).put(handle, ref);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Write failed.'));
    });

    database.close();
  } catch {
    /*
     * A private window, a blocked quota, a browser that will not clone the
     * handle. The save itself already worked and the handle is in memory, so
     * this session behaves normally; only the next one has to be told where the
     * file lives again.
     */
  }
}

async function recallHandle(ref: string): Promise<PickedFile | null> {
  const cached = handleCache.get(ref);
  if (cached) return cached;

  try {
    const database = await openHandleDatabase();

    const handle = await new Promise<PickedFile | null>((resolve, reject) => {
      const transaction = database.transaction(HANDLE_STORE, 'readonly');
      const request = transaction.objectStore(HANDLE_STORE).get(ref);
      request.onsuccess = () => resolve((request.result as PickedFile | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Read failed.'));
    });

    database.close();

    if (handle) handleCache.set(ref, handle);
    return handle;
  } catch {
    return null;
  }
}

/**
 * Confirms Noto may still read a handle.
 *
 * The gentler half of `ensureWritable`: reopening a file from Recent needs to
 * read it and nothing more, and asking for write access at that moment would be
 * asking for permission to do something the user has not asked for yet.
 */
async function ensureReadable(handle: PickedFile): Promise<void> {
  if (!handle.queryPermission || !handle.requestPermission) return;

  const descriptor = { mode: 'read' } as const;

  let state = await handle.queryPermission(descriptor);
  if (state !== 'granted') state = await handle.requestPermission(descriptor);

  if (state !== 'granted') {
    throw new Error('Noto is no longer allowed to read that file.');
  }
}

/**
 * Confirms Noto may still write to a handle.
 *
 * Permission does not survive a reload, so a file linked yesterday has to be
 * asked about again. The prompt is allowed here because every route into this
 * begins with a key press or a click — the browser refuses it otherwise, which
 * is exactly why saving must not wait on anything slow first.
 */
async function ensureWritable(handle: PickedFile): Promise<void> {
  if (!handle.queryPermission || !handle.requestPermission) return;

  const descriptor = { mode: 'readwrite' } as const;

  let state = await handle.queryPermission(descriptor);
  if (state !== 'granted') state = await handle.requestPermission(descriptor);

  if (state !== 'granted') {
    throw new Error('Noto is no longer allowed to write to that file.');
  }
}

/* --- The browser gateway -------------------------------------------------- */

/**
 * The browser.
 *
 * Where the File System Access API exists — Chrome, Edge, anything else built on
 * Chromium — this is a real editor: the user picks a file once and every save
 * afterwards goes back to it silently. Where it does not, saving falls back to a
 * download, which is the only thing those browsers offer. The document is still
 * written out, but each save is a new file in the downloads folder rather than
 * an overwrite, and `canWriteInPlace` says so rather than pretending otherwise.
 */
const browserGateway: LocalFileGateway = {
  get canWriteInPlace() {
    return hasFilePicker();
  },

  async open() {
    const picker = pickerWindow();

    if (picker.showOpenFilePicker) {
      let handles: PickedFile[];
      try {
        handles = await picker.showOpenFilePicker({ multiple: true, types: OPEN_TYPES });
      } catch (error) {
        if (isCancellation(error)) return null;
        throw error;
      }

      return Promise.all(
        handles.map(async (handle) => {
          const ref = newRef();
          const text = await (await handle.getFile()).text();
          await rememberHandle(ref, handle);

          return {
            file: {
              ref,
              label: handle.name,
              name: handle.name,
              format: formatForFileName(handle.name),
            },
            text,
          };
        }),
      );
    }

    return openWithInput();
  },

  async read(file) {
    const handle = await recallHandle(file.ref);

    if (!handle) {
      throw new Error('Noto has lost track of that file. Open it again to pick up where it is.');
    }

    await ensureReadable(handle);
    return (await handle.getFile()).text();
  },

  async saveAs(target) {
    const picker = pickerWindow();

    if (picker.showSaveFilePicker) {
      let handle: PickedFile;
      try {
        handle = await picker.showSaveFilePicker({
          suggestedName: target.suggestedName,
          types: SAVE_TYPES,
        });
      } catch (error) {
        if (isCancellation(error)) return null;
        throw error;
      }

      const format = formatForFileName(handle.name);
      const ref = newRef();

      await writeThrough(handle, target.serialise(format));
      await rememberHandle(ref, handle);

      return { ref, label: handle.name, name: handle.name, format };
    }

    /*
     * No picker: a download — or, on a phone, the share sheet the export path
     * already knows how to reach — and no way back to the file afterwards. The
     * empty `ref` is what stops the caller linking a document to something it
     * could never write to again.
     */
    const format = formatForFileName(target.suggestedName);
    deliverFile({
      fileName: target.suggestedName,
      contents: target.serialise(format),
      mimeType: mimeTypeFor(format),
      format,
    });

    return { ref: '', label: target.suggestedName, name: target.suggestedName, format };
  },

  async write(file, contents) {
    const handle = await recallHandle(file.ref);

    if (!handle) {
      throw new Error('Noto has lost track of that file. Use Save As to choose it again.');
    }

    await ensureWritable(handle);
    await writeThrough(handle, contents);
  },
};

async function writeThrough(handle: PickedFile, contents: string): Promise<void> {
  const writable = await handle.createWritable();

  try {
    await writable.write(contents);
  } finally {
    // Nothing reaches the file until the stream closes, and an unclosed writable
    // holds a lock on it — so this happens even when the write threw.
    await writable.close();
  }
}

/**
 * The fallback picker: a hidden file input.
 *
 * Resolves `null` on the `cancel` event, which is what a modern browser fires
 * when the dialog is dismissed. Older ones never settle this promise, and that
 * is the right shape for a cancellation there too — nothing was chosen, and
 * nothing should be said about it.
 */
function openWithInput(): Promise<OpenedFile[] | null> {
  return new Promise((resolve) => {
    const input = window.document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = LOCAL_FILE_ACCEPT;
    input.style.display = 'none';

    const finish = (result: OpenedFile[] | null) => {
      input.remove();
      resolve(result);
    };

    input.addEventListener('cancel', () => finish(null));

    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) {
        finish(null);
        return;
      }

      void Promise.all(
        files.map(async (file) => ({
          /*
           * No handle, so no way back: an empty `ref` keeps the document
           * unlinked, and its first save asks where it should go.
           */
          file: {
            ref: '',
            label: file.name,
            name: file.name,
            format: formatForFileName(file.name),
          },
          text: await file.text(),
        })),
      ).then(finish, () => finish(null));
    });

    window.document.body.appendChild(input);
    input.click();
  });
}

let refCounter = 0;

/** A key for the handle store. Unique per chosen file, not per document. */
function newRef(): string {
  refCounter += 1;
  return `web:${Date.now().toString(36)}-${refCounter.toString(36)}`;
}

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

const listeners = new Set<() => void>();

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
    recents = null;
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
