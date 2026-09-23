import { type Page, expect, test } from '@playwright/test';

/*
 * Tab controls — PRD 6.11 to 6.15: pin, duplicate, move and reopen, from the
 * tab's own menu.
 */

const body = (page: Page) => page.locator('#noto-document-body .ProseMirror');
const titleField = (page: Page) => page.getByRole('textbox', { name: 'Document title' });
const tabList = (page: Page) => page.getByRole('tablist', { name: 'Open documents' });

async function newDocument(page: Page, title: string) {
  await page
    .getByRole('complementary')
    .first()
    .getByRole('button', { name: 'New Document', exact: true })
    .click();
  await expect(titleField(page)).toHaveValue('Untitled');
  await expect(body(page)).toBeFocused();
  await titleField(page).fill(title);
  await expect(
    page.getByRole('list', { name: 'All documents' }).getByRole('button', {
      name: new RegExp(`^${title}`),
    }),
  ).toBeVisible({ timeout: 15_000 });
}

/** The titles on the tabs, left to right. */
async function order(page: Page): Promise<string[]> {
  return tabList(page)
    .getByRole('tab')
    .evaluateAll((tabs) =>
      tabs.map((tab) => tab.querySelector('button')?.getAttribute('title') ?? ''),
    );
}

async function tabMenu(page: Page, title: string, item: string) {
  await tabList(page)
    .getByRole('tab', { name: new RegExp(title) })
    .click({ button: 'right' });
  await page.getByRole('menu').getByRole('menuitem', { name: item }).click();
}

test.describe('tab controls', () => {
  test('pins a tab to the front, and Close All keeps it', async ({ page }) => {
    await page.goto('/');
    await newDocument(page, 'Alpha');
    await newDocument(page, 'Beta');
    expect(await order(page)).toEqual(['Alpha', 'Beta']);

    await tabMenu(page, 'Beta', 'Pin tab');
    expect(await order(page)).toEqual(['Beta', 'Alpha']);
    await expect(tabList(page).getByLabel('Pinned')).toHaveCount(1);

    await page.keyboard.press('ControlOrMeta+Shift+w');
    await expect.poll(() => order(page)).toEqual(['Beta']);

    // And it is remembered.
    await page.reload();
    await expect.poll(() => order(page)).toEqual(['Beta']);
    await expect(tabList(page).getByLabel('Pinned')).toHaveCount(1);
  });

  test('reopens the tab that was closed last', async ({ page }) => {
    await page.goto('/');
    await newDocument(page, 'Kept');
    await newDocument(page, 'Closed');

    await tabList(page).getByRole('button', { name: 'Close Closed' }).click();
    await expect.poll(() => order(page)).toEqual(['Kept']);

    await tabMenu(page, 'Kept', 'Reopen closed tab');
    await expect.poll(() => order(page)).toEqual(['Kept', 'Closed']);
  });

  test('duplicates a document beside the original, and moves tabs', async ({ page }) => {
    await page.goto('/');
    await newDocument(page, 'Original');
    await body(page).click();
    await page.keyboard.type('Body text');
    await newDocument(page, 'Other');

    await tabMenu(page, 'Original', 'Duplicate');
    await expect.poll(() => order(page)).toEqual(['Original', 'Original (copy)', 'Other']);
    await expect(body(page)).toHaveText('Body text');

    await tabMenu(page, 'Other', 'Move left');
    await expect.poll(() => order(page)).toEqual(['Original', 'Other', 'Original (copy)']);
  });
});
