import { type Page, expect, test } from '@playwright/test';

/*
 * Version history, from storage.
 *
 * A version is kept when a document that has rested for ten minutes changes.
 * The page clock is moved on rather than waited on, so the test says exactly
 * what the policy says: rest, then edit, then there is a version to go back to.
 */

const body = (page: Page) => page.locator('#noto-document-body .ProseMirror');
const titleField = (page: Page) => page.getByRole('textbox', { name: 'Document title' });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Document details' });
const documentRow = (page: Page, title: string) =>
  page.getByRole('list', { name: 'All documents' }).getByRole('button', {
    name: new RegExp(`^${title}`),
  });

async function writeFirstDraft(page: Page) {
  await page.clock.install({ time: new Date('2026-09-23T09:00:00Z') });
  await page.goto('/');
  await page.getByRole('main').getByRole('button', { name: 'New document', exact: true }).click();
  await expect(titleField(page)).toHaveValue('Untitled');
  await expect(body(page)).toBeFocused();

  await titleField(page).fill('Proposal');
  await body(page).click();
  await page.keyboard.type('The first draft');

  // Autosave is debounced on the page clock; run it forward to let it land.
  await page.clock.runFor(2_000);
  await expect(documentRow(page, 'Proposal')).toBeVisible();
}

async function editAfterResting(page: Page, text: string) {
  await page.clock.fastForward('11:00');
  await body(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(text);
  await page.clock.runFor(2_000);
}

test.describe('version history', () => {
  test('says there is nothing yet, rather than showing a fixture', async ({ page }) => {
    await writeFirstDraft(page);
    await panel(page).getByRole('tab', { name: 'Versions' }).click();

    await expect(panel(page).getByText('No earlier versions yet')).toBeVisible();
  });

  test('keeps the text a document rested in, and restores it', async ({ page }) => {
    await writeFirstDraft(page);
    await editAfterResting(page, ' and a rewrite');
    await expect(body(page)).toContainText('The first draft and a rewrite');

    await panel(page).getByRole('tab', { name: 'Versions' }).click();
    const versions = panel(page).getByRole('list', { name: /^Versions from/ });
    await expect(versions.getByRole('listitem')).toHaveCount(1);
    await expect(versions.getByText('Autosave')).toBeVisible();

    // Preview shows the old text.
    await versions.getByRole('button', { name: 'Preview' }).click();
    const preview = page.getByRole('dialog');
    await expect(preview.getByLabel('Version text')).toHaveText('The first draft');
    await preview.getByRole('button', { name: 'Close' }).click();

    // Compare shows the line that changed.
    await versions.getByRole('button', { name: 'Compare' }).click();
    const compare = page.getByRole('dialog', { name: 'Compare with now' });
    await expect(compare.getByText('The first draft and a rewrite')).toBeVisible();
    await expect(compare).toContainText('1 added, 1 removed');
    await compare.getByRole('button', { name: 'Close' }).click();

    // Restore puts it back, and keeps what was there as a version of its own.
    await versions.getByRole('button', { name: 'Restore' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Restore' }).click();

    await expect(body(page)).toHaveText('The first draft');
    await expect(page.getByText(/^Restored the version from/)).toBeVisible();
    await expect(panel(page).getByText('Before a restore')).toBeVisible();

    // And it is what storage holds, not only what the editor shows.
    await page.reload();
    await documentRow(page, 'Proposal').click();
    await expect(body(page)).toHaveText('The first draft');
  });
});
