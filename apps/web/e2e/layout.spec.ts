import { type Page, expect, test } from '@playwright/test';

/**
 * The page control: a text file by default, paper when it is asked for.
 *
 * Noto opens as a notepad — the text starts at the left edge of the window and
 * runs its width — and page size and margins are a choice made afterwards, for
 * a document that is going to be printed. Both halves of that are proved here,
 * from what the editor actually draws rather than from the state of a control:
 * a menu that says Narrow over a page with inch margins is the bug worth
 * catching.
 */

const body = (page: Page) => page.locator('#noto-document-body .ProseMirror');
const titleField = (page: Page) => page.getByRole('textbox', { name: 'Document title' });
const sheet = (page: Page) => page.locator('main .noto-page');

async function firstVisit(page: Page) {
  await page.goto('/');
  await page.getByRole('main').getByRole('button', { name: 'New document', exact: true }).click();
  await expect(titleField(page)).toHaveValue('Untitled');
}

async function choosePageOption(page: Page, name: string) {
  await page.getByRole('button', { name: 'Page layout' }).click();
  await page.getByRole('menuitem', { name }).click();
}

/**
 * A margin, in pixels, as the browser resolved it.
 *
 * CSS defines an inch as 96px, so a half-inch margin is 48 of them — which is
 * what makes the sheet on screen the sheet that comes out of the printer.
 */
async function padding(page: Page, edge: 'left' | 'top'): Promise<number> {
  const value = await sheet(page).evaluate(
    (element, name) => getComputedStyle(element).getPropertyValue(name),
    `padding-${edge}`,
  );

  return Math.round(Number.parseFloat(value));
}

/** The sheet's width across the border box: the page as it is measured on paper. */
async function sheetWidth(page: Page): Promise<number> {
  const box = await sheet(page).boundingBox();
  expect(box).not.toBeNull();
  return Math.round(box!.width);
}

test.describe('page layout', () => {
  test('opens as a plain text file, with the text against the left edge', async ({ page }) => {
    await firstVisit(page);

    await expect(sheet(page)).toHaveCount(0);

    /*
     * The measure is the window's. A document that starts a third of the way
     * across a wide screen is the thing this default exists to avoid, so the
     * text is checked against the pane it is in rather than against a number:
     * the gap on the left is a gutter, not a margin.
     */
    const pane = await page.locator('main').boundingBox();
    const text = await body(page).boundingBox();
    expect(pane).not.toBeNull();
    expect(text).not.toBeNull();

    expect(text!.x - pane!.x).toBeLessThan(80);
    expect(text!.width).toBeGreaterThan(pane!.width * 0.8);
  });

  test('draws a sheet at its printed size when a margin is chosen', async ({ page }) => {
    /* Wide enough for a Letter page to stand at its true size beside the
       sidebar and the context panel; the narrow window is the test below. */
    await page.setViewportSize({ width: 1600, height: 900 });
    await firstVisit(page);
    await choosePageOption(page, 'Narrow');

    // Letter, in CSS inches: 8.5 × 96.
    await expect(sheet(page)).toHaveCount(1);
    expect(await sheetWidth(page)).toBe(816);
    expect(await padding(page, 'left')).toBe(48);
    expect(await padding(page, 'top')).toBe(48);

    // Choosing paper is the request for a page; the size is the size chosen.
    await choosePageOption(page, 'A4');
    expect(await sheetWidth(page)).toBe(Math.round(8.27 * 96));
  });

  test('shrinks the page rather than letting it run off a narrow window', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await firstVisit(page);
    await choosePageOption(page, 'Normal');

    /*
     * The editor's scroller only moves vertically, by design — a sheet wider
     * than the pane would be a document with a piece permanently out of sight.
     * The margins stay the inch they were set to; it is the column between them
     * that gives way.
     */
    const pane = await page.locator('main').boundingBox();
    expect(await sheetWidth(page)).toBeLessThanOrEqual(Math.round(pane!.width));
    expect(await padding(page, 'left')).toBe(96);
  });

  test('takes typed margins, and keeps the document under them', async ({ page }) => {
    await firstVisit(page);
    await body(page).click();
    await page.keyboard.type('still here');

    await choosePageOption(page, 'Custom margins');
    const form = page.getByRole('form', { name: 'Custom margins' });
    await form.getByLabel('Left margin, in inches').fill('2');
    await form.getByRole('button', { name: 'Apply' }).click();

    expect(await padding(page, 'left')).toBe(192);
    await expect(body(page)).toHaveText('still here');
  });

  test('is a setting, so the page survives a reload — and can be put away', async ({ page }) => {
    await firstVisit(page);
    await choosePageOption(page, 'Wide');
    await expect(sheet(page)).toHaveCount(1);

    await page.reload();
    await expect(sheet(page)).toHaveCount(1);
    expect(await padding(page, 'left')).toBe(192);

    await choosePageOption(page, 'Simple text');
    await expect(sheet(page)).toHaveCount(0);
  });
});
