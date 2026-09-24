import { type Page, expect, test } from '@playwright/test';

/*
 * What the device keeps for itself: crash-recovery snapshots and the Quick
 * Note draft. Both used to live only in localStorage; they now live in the
 * database, so a cleared localStorage no longer loses them.
 */

const body = (page: Page) => page.locator('#noto-document-body .ProseMirror');
const titleField = (page: Page) => page.getByRole('textbox', { name: 'Document title' });
const documentRow = (page: Page, title: string) =>
  page.getByRole('list', { name: 'All documents' }).getByRole('button', {
    name: new RegExp(`^${title}`),
  });

test('offers a snapshot an older release left in localStorage', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('main').getByRole('button', { name: 'New document', exact: true }).click();
  await expect(body(page)).toBeFocused();
  await titleField(page).fill('Crashed');
  await expect(documentRow(page, 'Crashed')).toBeVisible();

  const id = /#\/workspace\/([^/]+)/.exec(page.url())?.[1];
  expect(id).toBeTruthy();

  // What the previous release wrote on every keystroke before a crash.
  await page.evaluate((documentId) => {
    localStorage.setItem(
      `noto.recovery.${documentId}`,
      JSON.stringify({
        documentId,
        title: 'Crashed',
        content: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Typed before it died' }] },
          ],
        },
        savedAt: Date.now() + 60_000,
      }),
    );
  }, id!);

  await page.reload();
  await documentRow(page, 'Crashed').click();

  await expect(
    page.getByText('Noto kept changes to this document that were never saved'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Restore them' }).click();
  await expect(body(page)).toHaveText('Typed before it died');

  // Moved out of localStorage as it was read.
  expect(
    await page.evaluate((documentId) => localStorage.getItem(`noto.recovery.${documentId}`), id!),
  ).toBeNull();
});

test('brings the Quick Note draft back after localStorage is cleared', async ({ page }) => {
  await page.goto('/#/quick-note');
  const composer = page.getByRole('main').getByRole('textbox', { name: 'Quick note' });

  await composer.fill('A thought worth keeping');
  // The durable copy is written a moment after the last keystroke.
  await page.waitForTimeout(1_000);

  // Only the draft's key: clearing everything would also reset first launch.
  await page.evaluate(() => localStorage.removeItem('noto.quick-note.draft'));
  await page.reload();

  await expect(composer).toHaveValue('A thought worth keeping');
});
