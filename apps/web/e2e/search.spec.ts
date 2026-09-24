import { type Page, expect, test } from '@playwright/test';

/*
 * Search, over the local index: documents and Memory together, words matched
 * by their start, and text inside a word still found.
 */

const body = (page: Page) => page.locator('#noto-document-body .ProseMirror');
const titleField = (page: Page) => page.getByRole('textbox', { name: 'Document title' });

async function newDocument(page: Page, title: string, text: string) {
  await page
    .getByRole('complementary')
    .first()
    .getByRole('button', { name: 'New Document', exact: true })
    .click();
  await expect(titleField(page)).toHaveValue('Untitled');
  await expect(body(page)).toBeFocused();
  await titleField(page).fill(title);
  await body(page).click();
  await page.keyboard.type(text);
  await expect(
    page.getByRole('list', { name: 'All documents' }).getByRole('button', {
      name: new RegExp(`^${title}`),
    }),
  ).toContainText(text.slice(0, 10), { timeout: 15_000 });
}

async function search(page: Page, query: string) {
  const field = page
    .getByRole('main')
    .getByRole('searchbox', { name: 'Search notes, docs, memory' });
  await field.fill(query);
}

test('searches documents and Memory together, by the start of words', async ({ page }) => {
  await page.goto('/');
  await newDocument(page, 'Project proposal', 'Budget for the third quarter');
  await newDocument(page, 'Groceries', 'Milk and bread');

  await page.goto('/#/quick-note');
  await page
    .getByRole('main')
    .getByRole('textbox', { name: 'Quick note' })
    .fill('Proposal ideas for the offsite');
  await page.getByRole('button', { name: 'Keep note' }).click();
  await expect(page.getByText('Kept in Quick Notes')).toBeVisible();

  await page.goto('/#/search');
  const main = page.getByRole('main');

  await search(page, 'prop');
  await expect(main).toContainText('Project proposal');
  await expect(main).toContainText('Proposal ideas for the offsite');
  await expect(main).not.toContainText('Groceries');

  // Every word must match.
  await search(page, 'prop budg');
  await expect(main).toContainText('Project proposal');
  await expect(main).not.toContainText('Proposal ideas for the offsite');

  // The middle of a word is still found.
  await search(page, 'ilk');
  await expect(main).toContainText('Groceries');

  await search(page, 'nothing like this');
  await expect(main.getByText('No results for “nothing like this”')).toBeVisible();
});
