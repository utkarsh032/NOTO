import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearRecentFiles,
  documentForFile,
  fileNameFor,
  forgetRecentFile,
  formatForFileName,
  linkFile,
  linkedFile,
  openFilesFromDisk,
  readRecentFile,
  recentFiles,
  saveDocumentToFile,
  setLocalFileGateway,
  subscribeToLocalFiles,
  unlinkFile,
  type LocalFile,
  type LocalFileGateway,
  type SaveTarget,
} from './local-file';

/*
 * The gateway is faked and the storage is a map: what is under test is the
 * meaning of Save — when it asks, when it does not, what it remembers — not
 * any platform's dialog.
 */

function fakeStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
}

interface FakeGateway extends LocalFileGateway {
  saved: SaveTarget[];
  written: { file: LocalFile; contents: string }[];
  /** What the next Save As answers with. `null` plays a dismissed dialog. */
  nextChoice: LocalFile | null;
  /** What a file holds, by ref. A ref that is not here can no longer be read. */
  contents: Map<string, string>;
}

function fakeGateway(options: { canWriteInPlace?: boolean } = {}): FakeGateway {
  const gateway: FakeGateway = {
    canWriteInPlace: options.canWriteInPlace ?? true,
    saved: [],
    written: [],
    nextChoice: {
      ref: 'C:\\notes\\draft.md',
      label: 'C:\\notes\\draft.md',
      name: 'draft.md',
      format: 'md',
    },

    contents: new Map<string, string>(),

    open: async () => null,

    async read(file) {
      const text = gateway.contents.get(file.ref);
      if (text === undefined) throw new Error('That file is no longer where it was.');

      return text;
    },

    async saveAs(target) {
      gateway.saved.push(target);
      if (!gateway.nextChoice) return null;

      gateway.written.push({
        file: gateway.nextChoice,
        contents: target.serialise(gateway.nextChoice.format),
      });
      return gateway.nextChoice;
    },

    async write(file, contents) {
      gateway.written.push({ file, contents });
    },
  };

  return gateway;
}

const document = {
  title: 'Meeting notes',
  content: {
    type: 'doc' as const,
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Agenda' }] }],
  },
};

describe('formatForFileName', () => {
  it('reads the format off the extension', () => {
    expect(formatForFileName('notes.md')).toBe('md');
    expect(formatForFileName('NOTES.MARKDOWN')).toBe('md');
    expect(formatForFileName('page.html')).toBe('html');
    expect(formatForFileName('page.htm')).toBe('html');
    expect(formatForFileName('backup.json')).toBe('json');
  });

  it('falls back to plain text rather than refusing a name', () => {
    expect(formatForFileName('notes.txt')).toBe('txt');
    expect(formatForFileName('notes')).toBe('txt');
    expect(formatForFileName('todo.list')).toBe('txt');
  });
});

describe('fileNameFor', () => {
  it('names the file after the title, as Markdown by default', () => {
    expect(fileNameFor('Meeting notes')).toBe('meeting-notes.md');
    expect(fileNameFor('Meeting notes', 'txt')).toBe('meeting-notes.txt');
  });

  it('has a name for a document that has none', () => {
    expect(fileNameFor('')).toBe('untitled.md');
    expect(fileNameFor('   ')).toBe('untitled.md');
  });
});

describe('the link between a document and its file', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage());
  });

  afterEach(() => {
    unlinkFile('doc-1');
    vi.unstubAllGlobals();
  });

  it('remembers a file and forgets it again', () => {
    const file: LocalFile = { ref: '/tmp/a.md', label: '/tmp/a.md', name: 'a.md', format: 'md' };

    expect(linkedFile('doc-1')).toBeNull();

    linkFile('doc-1', file);
    expect(linkedFile('doc-1')).toEqual(file);

    unlinkFile('doc-1');
    expect(linkedFile('doc-1')).toBeNull();
  });

  it('never links a file it could not write to again', () => {
    linkFile('doc-1', { ref: '', label: 'a.md', name: 'a.md', format: 'md' });
    expect(linkedFile('doc-1')).toBeNull();
  });

  it('tells subscribers when a link changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToLocalFiles(listener);

    linkFile('doc-1', { ref: '/tmp/a.md', label: '/tmp/a.md', name: 'a.md', format: 'md' });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    unlinkFile('doc-1');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('saveDocumentToFile', () => {
  let gateway: FakeGateway;

  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage());
    gateway = fakeGateway();
    setLocalFileGateway(gateway);
  });

  afterEach(() => {
    unlinkFile('doc-1');
    setLocalFileGateway(null);
    vi.unstubAllGlobals();
  });

  it('asks where to save a document that has no file, once', async () => {
    const first = await saveDocumentToFile('doc-1', document);

    expect(first).toEqual({ file: gateway.nextChoice, linked: true });
    expect(gateway.saved).toHaveLength(1);
    expect(gateway.saved[0]!.suggestedName).toBe('meeting-notes.md');
    expect(linkedFile('doc-1')).toEqual(gateway.nextChoice);

    // The second save goes straight back to the same file, no dialog.
    const second = await saveDocumentToFile('doc-1', { ...document, title: 'Renamed' });

    expect(second).toEqual({ file: gateway.nextChoice, linked: true });
    expect(gateway.saved).toHaveLength(1);
    expect(gateway.written).toHaveLength(2);
    expect(gateway.written[1]!.file).toEqual(gateway.nextChoice);
    expect(gateway.written[1]!.contents).toContain('# Renamed');
  });

  it('writes in the format the file already has', async () => {
    linkFile('doc-1', { ref: '/tmp/a.txt', label: '/tmp/a.txt', name: 'a.txt', format: 'txt' });

    await saveDocumentToFile('doc-1', document);

    expect(gateway.written[0]!.contents).toBe('Meeting notes\n\nAgenda\n');
  });

  it('always asks for Save As, and offers the current name', async () => {
    linkFile('doc-1', { ref: '/tmp/a.md', label: '/tmp/a.md', name: 'a.md', format: 'md' });
    gateway.nextChoice = { ref: '/tmp/b.md', label: '/tmp/b.md', name: 'b.md', format: 'md' };

    const saved = await saveDocumentToFile('doc-1', document, { chooseLocation: true });

    expect(gateway.saved).toHaveLength(1);
    expect(gateway.saved[0]!.suggestedName).toBe('a.md');
    expect(saved?.file.name).toBe('b.md');
    // From here on, Save means the new file.
    expect(linkedFile('doc-1')?.ref).toBe('/tmp/b.md');
  });

  it('says nothing and changes nothing when the dialog is dismissed', async () => {
    gateway.nextChoice = null;

    expect(await saveDocumentToFile('doc-1', document)).toBeNull();
    expect(gateway.written).toHaveLength(0);
    expect(linkedFile('doc-1')).toBeNull();
  });

  it('does not pretend a download is a file it can write to again', async () => {
    gateway = fakeGateway({ canWriteInPlace: false });
    gateway.nextChoice = {
      ref: '',
      label: 'meeting-notes.md',
      name: 'meeting-notes.md',
      format: 'md',
    };
    setLocalFileGateway(gateway);

    const saved = await saveDocumentToFile('doc-1', document);

    expect(saved?.linked).toBe(false);
    expect(linkedFile('doc-1')).toBeNull();

    // And so the next save asks again, because it has to.
    await saveDocumentToFile('doc-1', document);
    expect(gateway.saved).toHaveLength(2);
  });

  it('lets a failed write through, so the person is told', async () => {
    linkFile('doc-1', { ref: '/tmp/a.md', label: '/tmp/a.md', name: 'a.md', format: 'md' });
    gateway.write = async () => {
      throw new Error('That file is no longer where it was.');
    };

    await expect(saveDocumentToFile('doc-1', document)).rejects.toThrow('no longer where it was');
  });
});

/*
 * Recent files.
 *
 * The list is the one part of this that outlives the documents it was made
 * from, so what is tested is what it remembers, what it refuses to remember,
 * and what happens when a file it names has gone.
 */
describe('recent files', () => {
  let gateway: FakeGateway;

  const draft: LocalFile = {
    ref: '/tmp/draft.md',
    label: '/tmp/draft.md',
    name: 'draft.md',
    format: 'md',
  };

  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage());
    gateway = fakeGateway();
    setLocalFileGateway(gateway);
    clearRecentFiles();
  });

  afterEach(() => {
    unlinkFile('doc-1');
    clearRecentFiles();
    setLocalFileGateway(null);
    vi.unstubAllGlobals();
  });

  it('remembers a file that was saved, newest first', async () => {
    await saveDocumentToFile('doc-1', document);

    gateway.nextChoice = { ref: '/tmp/b.md', label: '/tmp/b.md', name: 'b.md', format: 'md' };
    await saveDocumentToFile('doc-1', document, { chooseLocation: true });

    expect(recentFiles().map((file) => file.name)).toEqual(['b.md', 'draft.md']);
  });

  it('remembers a file that was opened, and lists it once however often', async () => {
    gateway.open = async () => [{ file: draft, text: '# Draft' }];

    await openFilesFromDisk();
    await openFilesFromDisk();

    expect(recentFiles()).toEqual([draft]);
  });

  it('never lists a file it could not get back to', async () => {
    const download: LocalFile = { ref: '', label: 'a.md', name: 'a.md', format: 'md' };
    gateway.open = async () => [{ file: download, text: 'x' }];

    await openFilesFromDisk();

    expect(recentFiles()).toEqual([]);
  });

  it('reads a file it listed, without a dialog', async () => {
    gateway.open = async () => [{ file: draft, text: '# Draft' }];
    gateway.contents.set(draft.ref, '# Draft, later');
    await openFilesFromDisk();

    await expect(readRecentFile(recentFiles()[0]!)).resolves.toEqual({
      file: draft,
      text: '# Draft, later',
    });
    // No dialog was opened for it.
    expect(gateway.saved).toHaveLength(0);
  });

  it('reports a file that has gone, and can be dropped from the list', async () => {
    gateway.open = async () => [{ file: draft, text: '# Draft' }];
    await openFilesFromDisk();

    await expect(readRecentFile(draft)).rejects.toThrow('no longer where it was');

    forgetRecentFile(draft.ref);
    expect(recentFiles()).toEqual([]);
  });

  it('finds the document a file is already open as', async () => {
    linkFile('doc-1', draft);

    expect(documentForFile(draft.ref)).toBe('doc-1');
    expect(documentForFile('/tmp/elsewhere.md')).toBeNull();
    // An empty ref is not a file, so it can never match one.
    expect(documentForFile('')).toBeNull();
  });

  it('tells subscribers when the list changes', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToLocalFiles(listener);

    gateway.open = async () => [{ file: draft, text: '# Draft' }];
    await openFilesFromDisk();
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });
});
