import { type Page, expect, test } from '@playwright/test';

/**
 * Rich formatting, exercised through the browser.
 *
 * These assert on the HTML ProseMirror renders rather than on the toolbar's own
 * pressed state, because the document is what actually gets stored: a button
 * that lights up without changing the content would still be a bug.
 */

/** The document body. The title field is the other textbox on the page. */
const body = (page: Page) => page.locator('#noto-document-body .ProseMirror');

async function openBlankDocument(page: Page) {
  await page.goto('/');
  // The empty state's button, not the sidebar's: their labels differ only in
  // case, which Playwright's name matching ignores.
  await page.getByRole('main').getByRole('button', { name: 'New document' }).click();

  const title = page.getByRole('textbox', { name: 'Document title' });
  await expect(title).toHaveValue('Untitled');

  return body(page);
}

/** Types `text` into the document and selects all of it. */
async function typeAndSelect(page: Page, text: string) {
  const editor = body(page);
  await editor.click();
  await page.keyboard.type(text);
  await page.keyboard.press('ControlOrMeta+a');

  return editor;
}

test.describe('rich formatting', () => {
  test('applies marks from the toolbar', async ({ page }) => {
    await openBlankDocument(page);
    const editor = await typeAndSelect(page, 'Formatted');

    await page.getByRole('button', { name: 'Bold' }).click();
    await expect(editor.locator('strong')).toHaveText('Formatted');

    await page.getByRole('button', { name: 'Italic' }).click();
    await expect(editor.locator('em')).toHaveText('Formatted');

    await page.getByRole('button', { name: 'Underline' }).click();
    await expect(editor.locator('u')).toHaveText('Formatted');

    await page.getByRole('button', { name: 'Strikethrough' }).click();
    await expect(editor.locator('s')).toHaveText('Formatted');

    // The controls report what the selection already is, not just what was
    // clicked last.
    await expect(page.getByRole('button', { name: 'Bold' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('applies marks from the keyboard', async ({ page }) => {
    await openBlankDocument(page);
    const editor = await typeAndSelect(page, 'Shortcut');

    await page.keyboard.press('ControlOrMeta+b');
    await expect(editor.locator('strong')).toHaveText('Shortcut');

    // Pressed once, applied once: the accelerator is bound in the editor only,
    // so it does not also run through the window-level command listener and
    // toggle straight back off.
    await page.keyboard.press('ControlOrMeta+b');
    await expect(editor.locator('strong')).toHaveCount(0);
  });

  test('changes the block type of the block the caret is in', async ({ page }) => {
    const editor = await openBlankDocument(page);
    await editor.click();
    await page.keyboard.type('A heading');

    const blockType = page.getByLabel('Block type');
    await expect(blockType).toHaveValue('format.paragraph');

    await blockType.selectOption('format.heading2');
    await expect(editor.locator('h2')).toHaveText('A heading');
    await expect(blockType).toHaveValue('format.heading2');

    await page.getByRole('button', { name: 'Bullet List' }).click();
    await expect(editor.locator('ul li')).toHaveText('A heading');
  });

  test('says nothing rather than guessing when the selection is mixed', async ({ page }) => {
    const editor = await openBlankDocument(page);
    await editor.click();
    await page.keyboard.type('A heading');
    await page.getByLabel('Block type').selectOption('format.heading2');

    // Tiptap keeps an empty paragraph after a trailing heading so the user can
    // type past it, which makes select-all a genuinely mixed selection.
    await page.keyboard.press('ControlOrMeta+a');
    await expect(page.getByLabel('Block type')).toHaveValue('');
  });

  test('aligns text', async ({ page }) => {
    await openBlankDocument(page);
    const editor = await typeAndSelect(page, 'Centred');

    await page.getByRole('button', { name: 'Align Center' }).click();
    await expect(editor.locator('p')).toHaveCSS('text-align', 'center');

    // Left is an unset, so the attribute goes away rather than being written.
    await page.getByRole('button', { name: 'Align Left' }).click();
    await expect(editor.locator('p')).not.toHaveAttribute('style', /text-align/);
  });

  test('links a selection, and refuses one that would execute', async ({ page }) => {
    await openBlankDocument(page);
    const editor = await typeAndSelect(page, 'Noto');

    await page.getByRole('button', { name: 'Link', exact: true }).click();

    const address = page.getByRole('textbox', { name: 'Link address' });
    await address.fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Apply' }).click();

    // The prompt stays open and says so rather than quietly inserting nothing.
    await expect(page.getByText(/not a web, mail or telephone address/)).toBeVisible();
    await expect(editor.locator('a')).toHaveCount(0);

    await address.fill('noto.app/docs');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(editor.locator('a')).toHaveAttribute('href', 'https://noto.app/docs');
  });

  test('inserts a table and shows its controls', async ({ page }) => {
    await openBlankDocument(page);
    const editor = body(page);
    await editor.click();

    await page.getByRole('button', { name: 'Insert Table' }).click();
    await page.getByRole('button', { name: 'Insert', exact: true }).click();

    await expect(editor.locator('table')).toHaveCount(1);
    await expect(editor.locator('table th')).toHaveCount(3);
    await expect(editor.locator('table tr')).toHaveCount(3);

    // Row and column controls appear only while the caret is in a table.
    const addRow = page.getByRole('button', { name: 'Row +' });
    await expect(addRow).toBeVisible();

    await addRow.click();
    await expect(editor.locator('table tr')).toHaveCount(4);
  });

  test('inserts an image by address', async ({ page }) => {
    await openBlankDocument(page);
    const editor = body(page);
    await editor.click();

    await page.getByRole('button', { name: 'Insert Image' }).click();
    await page
      .getByRole('textbox', { name: 'Image address' })
      .fill('data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==');
    await page.getByRole('textbox', { name: 'Image description' }).fill('A dot');
    await page.getByRole('button', { name: 'Insert', exact: true }).click();

    await expect(editor.locator('img')).toHaveAttribute('alt', 'A dot');
  });

  test('keeps formatting across a reload', async ({ page }) => {
    await openBlankDocument(page);
    await typeAndSelect(page, 'Durable');

    await page.getByRole('button', { name: 'Bold' }).click();
    await page.getByLabel('Block type').selectOption('format.heading1');

    /*
     * The sidebar row shows the document's title and then its excerpt, and the
     * excerpt is derived from the stored content — so the row reading "Durable"
     * instead of "Empty document" is proof the debounced autosave landed.
     */
    await expect(page.getByRole('button', { name: 'Untitled Durable' })).toBeVisible();

    await page.reload();

    const editor = body(page);
    await expect(editor.locator('h1 strong')).toHaveText('Durable');
  });
});
