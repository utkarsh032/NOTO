import { type Page, expect, test } from '@playwright/test';

/*
 * Folders and tags: made in the sidebar and the Info tab, and kept.
 */

const body = (page: Page) => page.locator('#noto-document-body .ProseMirror');
const titleField = (page: Page) => page.getByRole('textbox', { name: 'Document title' });
const sidebar = (page: Page) => page.getByRole('complementary').first();
const panel = (page: Page) => page.getByRole('complementary', { name: 'Document details' });

const rowIn = (page: Page, list: string, title: string) =>
  page.getByRole('list', { name: list }).getByRole('button', { name: new RegExp(`^${title}`) });

async function newDocument(page: Page, title: string) {
  await sidebar(page).getByRole('button', { name: 'New Document', exact: true }).click();
  await expect(titleField(page)).toHaveValue('Untitled');
  await expect(body(page)).toBeFocused();
  await titleField(page).fill(title);
  await expect(rowIn(page, 'All documents', title)).toBeVisible({ timeout: 15_000 });
}

async function newFolder(page: Page, name: string) {
  await page.getByRole('button', { name: 'New folder', exact: true }).click();
  const field = page.getByRole('textbox', { name: 'Rename folder New folder' });
  await field.fill(name);
  await field.press('Enter');
  await expect(
    page
      .getByRole('list', { name: 'Folders' })
      .getByRole('button', { name: new RegExp(`^${name}`) }),
  ).toBeVisible();
}

test.describe('folders', () => {
  test('moves a document into a folder from the Info tab, and remembers it', async ({ page }) => {
    await page.goto('/');
    await newDocument(page, 'Budget');
    await newFolder(page, 'Finance');

    await panel(page).getByRole('tab', { name: 'Info' }).click();
    await panel(page).getByLabel('Folder').selectOption({ label: 'Finance' });

    await expect(rowIn(page, 'Documents in Finance', 'Budget')).toBeVisible();
    await expect(rowIn(page, 'All documents', 'Budget')).toHaveCount(0);
    await expect(panel(page).getByText('My Workspace / Finance').first()).toBeVisible();

    await page.reload();
    await expect(rowIn(page, 'Documents in Finance', 'Budget')).toBeVisible();
  });

  test('moves a document by dragging it onto a folder', async ({ page }) => {
    // Tall enough that both rows sit inside the sidebar's scroll area: a drag
    // starts from what is under the pointer, and at 720px the Quick Note card
    // is under the lower row's centre.
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto('/');
    await newDocument(page, 'Receipts');
    await newFolder(page, 'Archive');

    const folderRow = page
      .getByRole('list', { name: 'Folders' })
      .getByRole('button', { name: /^Archive/ });
    await rowIn(page, 'All documents', 'Receipts').dragTo(folderRow);

    await expect(rowIn(page, 'Documents in Archive', 'Receipts')).toBeVisible();
  });

  test('nests folders, and removing one moves its contents up', async ({ page }) => {
    await page.goto('/');
    await newDocument(page, 'Plan');
    await newFolder(page, 'Work');

    await panel(page).getByRole('tab', { name: 'Info' }).click();
    await panel(page).getByLabel('Folder').selectOption({ label: 'Work' });
    await expect(rowIn(page, 'Documents in Work', 'Plan')).toBeVisible();

    await page.getByRole('button', { name: 'Remove folder Work' }).click();

    await expect(page.getByRole('list', { name: 'Folders' })).toHaveCount(0);
    await expect(rowIn(page, 'All documents', 'Plan')).toBeVisible();
  });
});

test.describe('tags', () => {
  test('adds and removes tags on a document, and keeps them', async ({ page }) => {
    await page.goto('/');
    await newDocument(page, 'Tagged');

    await panel(page).getByRole('tab', { name: 'Info' }).click();
    // A combobox, not a textbox: it offers the workspace's existing tags.
    const field = panel(page).getByRole('combobox', { name: 'Add a tag' });

    await field.fill('work');
    await field.press('Enter');
    await field.fill('#Ideas, later');
    await field.press('Enter');

    const tags = panel(page).getByRole('list', { name: 'Tags' });
    await expect(tags.getByRole('listitem')).toHaveText(['work', 'Ideas', 'later']);

    await panel(page).getByRole('button', { name: 'Remove tag work' }).click();
    await expect(tags.getByRole('listitem')).toHaveText(['Ideas', 'later']);

    await page.reload();
    await rowIn(page, 'All documents', 'Tagged').click();
    await panel(page).getByRole('tab', { name: 'Info' }).click();
    await expect(panel(page).getByRole('list', { name: 'Tags' }).getByRole('listitem')).toHaveText([
      'Ideas',
      'later',
    ]);
  });
});
