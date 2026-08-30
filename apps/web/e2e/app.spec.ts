import { type Locator, type Page, expect, test } from '@playwright/test';

/*
 * Three controls offer to create a document: the sidebar's button, Home's
 * quick-action card, and the empty state under Recent Documents. Each is
 * located inside the region it belongs to, and the two inside `main` are told
 * apart by an exact match — Playwright's exact matching is case-sensitive,
 * which is the only thing separating the card's "New Document" from the empty
 * state's "New document".
 */
const sidebarNew = (page: Page) =>
  page.getByRole('complementary').getByRole('button', { name: 'New Document', exact: true });

const emptyStateNew = (page: Page) =>
  page.getByRole('main').getByRole('button', { name: 'New document', exact: true });

/** Title a freshly created document carries — `UNTITLED_DOCUMENT_TITLE`. */
const UNTITLED = 'Untitled';

/**
 * The sidebar row for a document.
 *
 * Scoped to the document list and anchored to the start of the name: the same
 * title also appears on a tab, under Recent, and on the row's own "Move
 * <title> to trash" button, any of which a looser match picks up.
 */
const documentRow = (page: Page, title: string) =>
  page.getByRole('list', { name: 'All documents' }).getByRole('button', {
    name: new RegExp(`^${title}`),
  });

/**
 * Waits for a freshly created document to be ready to type into.
 *
 * Two things have to have happened, and a person doing this by hand cannot
 * outrun either of them:
 *
 * 1. The title field is re-bound to the new record. Typing before that
 *    re-render writes into the previous document's input, and the controlled
 *    value is discarded when it re-renders.
 * 2. The editor has taken its autofocus. It grabs focus once, on mount — and
 *    if that lands between focusing the title field and the text going in, the
 *    text goes to the body instead, and the title stays "Untitled".
 */
async function openedNewDocument(page: Page, title: Locator) {
  await expect(title).toHaveValue(UNTITLED);
  await expect(page.locator('#noto-document-body .ProseMirror')).toBeFocused();
}

test.describe('Noto web shell', () => {
  test('creates the offline workspace and opens an editor on first visit', async ({ page }) => {
    await page.goto('/');

    // The local workspace is created on first launch, with no account needed.
    await expect(sidebarNew(page)).toBeVisible();
    await expect(page.getByText('No documents yet')).toBeVisible();

    await emptyStateNew(page).click();

    await expect(page.getByRole('textbox', { name: 'Document title' })).toBeVisible();
  });

  test('persists a document across a reload', async ({ page }) => {
    await page.goto('/');

    await emptyStateNew(page).click();

    const title = page.getByRole('textbox', { name: 'Document title' });
    await openedNewDocument(page, title);
    await title.fill('Persisted note');

    // The sidebar renders from the stored documents, so the new title appearing
    // there is proof the debounced autosave reached the database. The "Saved"
    // indicator is not: it is already showing before the edit, so asserting on
    // it would let the reload race the save.
    await expect(documentRow(page, 'Persisted note')).toBeVisible({ timeout: 15_000 });

    await page.reload();

    await expect(documentRow(page, 'Persisted note')).toBeVisible({ timeout: 15_000 });
    await expect(title).toHaveValue('Persisted note');
  });

  test('lists a second document in the sidebar', async ({ page }) => {
    await page.goto('/');

    const title = page.getByRole('textbox', { name: 'Document title' });

    await emptyStateNew(page).click();
    await openedNewDocument(page, title);
    await title.fill('First');
    await expect(documentRow(page, 'First')).toBeVisible({ timeout: 15_000 });

    await sidebarNew(page).click();
    await openedNewDocument(page, title);
    await title.fill('Second');

    await expect(documentRow(page, 'First')).toBeVisible({ timeout: 15_000 });
    await expect(documentRow(page, 'Second')).toBeVisible({ timeout: 15_000 });
  });
});
