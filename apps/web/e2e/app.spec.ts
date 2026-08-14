import { expect, test } from '@playwright/test';

/** The sidebar's create button; `exact` distinguishes it from "New document". */
const sidebarNew = { role: 'button' as const, name: 'New', exact: true };

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
    await title.fill('Persisted note');

    // Wait for the debounced autosave to land before reloading.
    await expect(page.getByText('Saved')).toBeVisible();

    await page.reload();

    await expect(page.getByRole('button', { name: /Persisted note/ })).toBeVisible();
    await expect(title).toHaveValue('Persisted note');
  });

  test('lists a second document in the sidebar', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'New document' }).click();
    await page.getByRole('textbox', { name: 'Document title' }).fill('First');
    await expect(page.getByText('Saved')).toBeVisible();

    await page.getByRole(sidebarNew.role, sidebarNew).click();
    await page.getByRole('textbox', { name: 'Document title' }).fill('Second');
    await expect(page.getByText('Saved')).toBeVisible();

    await expect(page.getByRole('button', { name: /First/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Second/ })).toBeVisible();
  });
});
