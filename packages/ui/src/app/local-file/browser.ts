import { deliverFile } from '../export';
import { LOCAL_FILE_ACCEPT, WRITABLE_FORMATS, formatForFileName, mimeTypeFor } from './formats';
import type { LocalFileGateway, OpenedFile } from './types';

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
export const browserGateway: LocalFileGateway = {
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
