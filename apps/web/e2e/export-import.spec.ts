import { type Page, expect, test } from '@playwright/test';

/*
 * PRD 6.16: a document out as Word, and HTML in with its formatting kept.
 */

const body = (page: Page) => page.locator('#noto-document-body .ProseMirror');
const titleField = (page: Page) => page.getByRole('textbox', { name: 'Document title' });

test('exports a document as a Word file', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('main').getByRole('button', { name: 'New document', exact: true }).click();
  await expect(body(page)).toBeFocused();
  await titleField(page).fill('Quarterly plan');
  await body(page).click();
  await page.keyboard.type('Ship the thing');

  await page.getByRole('button', { name: 'Document menu' }).click();
  await page.getByRole('menuitem', { name: 'Export…' }).click();

  const dialog = page.getByRole('dialog', { name: 'Export document' });
  await dialog.getByText('Word (DOCX)').click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Export' }).click(),
  ]);

  expect(download.suggestedFilename()).toBe('quarterly-plan.docx');

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const file = Buffer.concat(chunks);

  // A ZIP, with the document part inside and the text in it.
  expect(file.subarray(0, 2).toString()).toBe('PK');
  expect(file.toString('utf8')).toContain('word/document.xml');
  expect(file.toString('utf8')).toContain('Ship the thing');
});

test('imports HTML with its formatting, and without its scripts', async ({ page }) => {
  await page.goto('/#/documents');
  await page.getByRole('button', { name: 'Import', exact: true }).click();

  await page.getByLabel('Files to import').setInputFiles({
    name: 'notes.html',
    mimeType: 'text/html',
    buffer: Buffer.from(
      '<html><head><title>Meeting notes</title><script>window.__pwned = true</script></head>' +
        '<body><h2>Decisions</h2><p>We will <strong>ship</strong> on <em>Friday</em>.</p>' +
        '<ul><li>First</li><li>Second</li></ul>' +
        '<p><a href="javascript:alert(1)">bad link</a> <img src="x" onerror="window.__pwned = true"></p>' +
        '</body></html>',
    ),
  });

  const row = page
    .getByRole('main')
    .getByRole('button', { name: /Meeting notes/ })
    .first();
  await expect(row).toBeVisible();
  await row.click();

  await expect(titleField(page)).toHaveValue('Meeting notes');
  await expect(body(page).locator('h2')).toHaveText('Decisions');
  await expect(body(page).locator('strong')).toHaveText('ship');
  await expect(body(page).locator('em')).toHaveText('Friday');
  await expect(body(page).locator('ul > li')).toHaveCount(2);
  await expect(body(page).locator('a[href^="javascript"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as { __pwned?: boolean }).__pwned)).toBeUndefined();
});
