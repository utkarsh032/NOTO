import { type Page, expect, test } from '@playwright/test';

/**
 * Saving to, and opening from, the user's own disk.
 *
 * The browser's file picker is a native dialog no test can click, so the File
 * System Access API is replaced before the application loads with one backed by
 * an object. That leaves everything above it real — the accelerators, the
 * command registry, the link between a document and its file, the serialiser
 * that decides what actually lands in the file — and asserts on the bytes
 * rather than on the toast, because the file is what the user keeps.
 */

interface FakeDisk {
  /** File name to contents, as the disk stands right now. */
  files: Record<string, string>;
  /** The suggested name each Save dialog was opened with, in order. */
  savePrompts: string[];
  openPrompts: number;
  /** What the next Save dialog answers with, when it should not be the suggestion. */
  nextSaveName: string | null;
}

/** The document body. The title field is the other textbox on the page. */
const body = (page: Page) => page.locator('#noto-document-body .ProseMirror');

const readDisk = (page: Page): Promise<FakeDisk> =>
  page.evaluate(() => (window as unknown as { __notoDisk: FakeDisk }).__notoDisk);

/** Replaces the file picker with one backed by `seed`, before anything loads. */
async function installFakeDisk(page: Page, seed: Record<string, string> = {}) {
  await page.addInitScript((initial: Record<string, string>) => {
    const disk: FakeDisk = {
      files: { ...initial },
      savePrompts: [],
      openPrompts: 0,
      nextSaveName: null,
    };

    (window as unknown as { __notoDisk: FakeDisk }).__notoDisk = disk;

    const handleFor = (name: string) => ({
      name,
      getFile: () => Promise.resolve(new File([disk.files[name] ?? ''], name)),
      createWritable: () => {
        let buffer = '';
        return Promise.resolve({
          write: (data: string) => {
            buffer += data;
            return Promise.resolve();
          },
          close: () => {
            disk.files[name] = buffer;
            return Promise.resolve();
          },
        });
      },
      queryPermission: () => Promise.resolve('granted'),
      requestPermission: () => Promise.resolve('granted'),
    });

    Object.assign(window, {
      showSaveFilePicker: (options?: { suggestedName?: string }) => {
        disk.savePrompts.push(options?.suggestedName ?? '');

        const name = disk.nextSaveName ?? options?.suggestedName ?? 'untitled.md';
        disk.nextSaveName = null;
        return Promise.resolve(handleFor(name));
      },
      showOpenFilePicker: () => {
        disk.openPrompts += 1;
        return Promise.resolve(Object.keys(initial).map(handleFor));
      },
    });
  }, seed);
}

/**
 * Opens Noto and waits for storage.
 *
 * The shell renders a skeleton while the database opens, and a file opened
 * before then has no workspace to become a document in — so every test here
 * waits for the header, which is the first thing that only exists once the
 * workspace does.
 */
async function openNoto(page: Page) {
  await page.goto('/');
  await expect(
    page.getByRole('banner').getByRole('button', { name: 'New document' }),
  ).toBeVisible();
}

/** A new document, named, with `text` typed into it. */
async function writeDocument(page: Page, title: string, text: string) {
  await openNoto(page);
  await page.getByRole('main').getByRole('button', { name: 'New document', exact: true }).click();

  await page.getByRole('textbox', { name: 'Document title' }).fill(title);

  const editor = body(page);
  await editor.click();
  await page.keyboard.type(text);

  return editor;
}

test.describe('files on disk', () => {
  test('asks where to save once, then saves there every time after', async ({ page }) => {
    await installFakeDisk(page);
    await writeDocument(page, 'Release notes', 'First line');

    await page.keyboard.press('ControlOrMeta+s');

    // Named after the document, and the file holds what was typed.
    await expect.poll(async () => (await readDisk(page)).savePrompts).toEqual(['release-notes.md']);
    await expect
      .poll(async () => (await readDisk(page)).files['release-notes.md'])
      .toContain('First line');

    await expect(page.getByText('Saved to release-notes.md')).toBeVisible();
    // And the status bar says which file this document now is.
    await expect(page.getByLabel('Saved to release-notes.md')).toBeVisible();

    await body(page).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' and a second');

    await page.keyboard.press('ControlOrMeta+s');

    // No second dialog: Save means this file now.
    await expect
      .poll(async () => (await readDisk(page)).files['release-notes.md'])
      .toContain('First line and a second');
    expect((await readDisk(page)).savePrompts).toEqual(['release-notes.md']);
  });

  test('Save As always asks, and the new file is what Save means afterwards', async ({ page }) => {
    await installFakeDisk(page);
    await writeDocument(page, 'Release notes', 'Original');

    await page.keyboard.press('ControlOrMeta+s');
    await expect
      .poll(async () => (await readDisk(page)).files['release-notes.md'])
      .toContain('Original');

    await page.evaluate(() => {
      (window as unknown as { __notoDisk: FakeDisk }).__notoDisk.nextSaveName = 'copy.txt';
    });

    await page.keyboard.press('ControlOrMeta+Shift+s');

    // Asked again, and offered the name the document already has.
    await expect
      .poll(async () => (await readDisk(page)).savePrompts)
      .toEqual(['release-notes.md', 'release-notes.md']);
    // Saved as .txt, so it was written as plain text rather than Markdown.
    await expect
      .poll(async () => (await readDisk(page)).files['copy.txt'])
      .toBe('Release notes\n\nOriginal\n');

    await body(page).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' more');
    await page.keyboard.press('ControlOrMeta+s');

    // Save now means the copy, with no further dialog.
    await expect
      .poll(async () => (await readDisk(page)).files['copy.txt'])
      .toContain('Original more');
    expect((await readDisk(page)).savePrompts).toHaveLength(2);
    // The original is left exactly as it was.
    expect((await readDisk(page)).files['release-notes.md']).not.toContain('more');
  });

  test('Save As does not cross out the selection on the way', async ({ page }) => {
    /*
     * Tiptap binds Ctrl+Shift+S to strikethrough by default. Noto's registry
     * gives that key to Save As, and the editor's keymap has to decline it —
     * otherwise saving would silently reformat the document being saved.
     */
    await installFakeDisk(page);
    const editor = await writeDocument(page, 'Intact', 'Nothing struck through');
    await page.keyboard.press('ControlOrMeta+a');

    await page.keyboard.press('ControlOrMeta+Shift+s');

    await expect.poll(async () => (await readDisk(page)).savePrompts).toHaveLength(1);
    await expect(editor.locator('s')).toHaveCount(0);

    // Strikethrough still works, on the key it moved to.
    await page.keyboard.press('ControlOrMeta+Shift+x');
    await expect(editor.locator('s')).toHaveText('Nothing struck through');
  });

  test('opens a file from disk, and writes back to it', async ({ page }) => {
    await installFakeDisk(page, { 'notes.md': '# Notes\n\nFrom the disk\n' });
    await openNoto(page);

    await page.keyboard.press('ControlOrMeta+o');

    // The file is a document now, named after itself and open in front.
    await expect(page.getByRole('textbox', { name: 'Document title' })).toHaveValue('notes');
    await expect(body(page)).toContainText('From the disk');
    await expect(page.getByLabel('Saved to notes.md')).toBeVisible();

    await body(page).click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' plus an edit');

    await page.keyboard.press('ControlOrMeta+s');

    // Straight back to the file it came from: no dialog, and the edit lands.
    await expect
      .poll(async () => (await readDisk(page)).files['notes.md'])
      .toContain('plus an edit');
    expect((await readDisk(page)).savePrompts).toEqual([]);
  });

  test('a dismissed dialog changes nothing', async ({ page }) => {
    await installFakeDisk(page);
    await writeDocument(page, 'Unsaved', 'Still only in Noto');

    // A cancelled picker rejects with an AbortError, which is a decision.
    await page.evaluate(() => {
      Object.assign(window, {
        showSaveFilePicker: () =>
          Promise.reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })),
      });
    });

    await page.keyboard.press('ControlOrMeta+s');

    await expect(page.getByText(/^Saved/)).toHaveCount(0);
    expect((await readDisk(page)).files).toEqual({});
    // And nothing was said about it, because nothing went wrong.
    await expect(page.getByText(/could not save/i)).toHaveCount(0);
  });
});
