import { type Locator, expect, test } from '@playwright/test';

/** The sidebar's create button; `exact` distinguishes it from "New document". */
const sidebarNew = { role: 'button' as const, name: 'New', exact: true };

/** Title a freshly created document carries — `UNTITLED_DOCUMENT_TITLE`. */
const UNTITLED = 'Untitled';

/**
 * Creating a document re-binds the title field to the new record. Typing before
 * that re-render lands writes into the previous document's input, and the
 * controlled value is discarded when it re-renders — so wait for the field to
 * show the new document before filling it.
 *
 * A person cannot type inside that window; Playwright can.
 */
async function openedNewDocument(title: Locator) {
  await expect(title).toHaveValue(UNTITLED);
}

test.describe('Noto web shell', () => {
  test('creates the offline workspace and opens an editor on first visit', async ({ page }) => {
    await page.goto('/');

    // The local workspace is created on first launch, with no account needed.
    await expect(page.getByRole(sidebarNew.role, sidebarNew)).toBeVisible();
    await expect(page.getByText('No documents yet')).toBeVisible();

    await page.getByRole('button', { name: 'New document' }).click();

    await expect(page.getByRole('textbox', { name: 'Document title' })).toBeVisible();
  });

  test('persists a document across a reload', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'New document' }).click();

    const title = page.getByRole('textbox', { name: 'Document title' });
    await openedNewDocument(title);
    await title.fill('Persisted note');

    // The sidebar renders from the stored documents, so the new title appearing
    // there is proof the debounced autosave reached the database. The "Saved"
    // indicator is not: it is already showing before the edit, so asserting on
    // it would let the reload race the save.
    await expect(page.getByRole('button', { name: /Persisted note/ })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('button', { name: /Persisted note/ })).toBeVisible();
    await expect(title).toHaveValue('Persisted note');
  });

  test('lists a second document in the sidebar', async ({ page }) => {
    await page.goto('/');

    const title = page.getByRole('textbox', { name: 'Document title' });

    await page.getByRole('button', { name: 'New document' }).click();
    await openedNewDocument(title);
    await title.fill('First');
    await expect(page.getByRole('button', { name: /First/ })).toBeVisible();

    await page.getByRole(sidebarNew.role, sidebarNew).click();
    await openedNewDocument(title);
    await title.fill('Second');

    await expect(page.getByRole('button', { name: /First/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Second/ })).toBeVisible();
  });
});
