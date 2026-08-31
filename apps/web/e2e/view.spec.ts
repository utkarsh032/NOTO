import { type Page, expect, test } from '@playwright/test';

/**
 * Show Characters, scrolling and print — PRD 5.9 to 5.11.
 *
 * All three are about presentation, so every assertion here checks two things:
 * that the presentation changed, and that the document did not.
 */

const body = (page: Page) => page.locator('#noto-document-body .ProseMirror');
const canvas = (page: Page) => page.locator('#noto-document-body');
/*
 * The editor pane's scroller. Scoped to `main`, because the sidebar's document
 * list carries the same scrollbar treatment and so the same class.
 */
const scroller = (page: Page) => page.locator('main .noto-scroll');
const titleField = (page: Page) => page.getByRole('textbox', { name: 'Document title' });
const tabList = (page: Page) => page.getByRole('tablist', { name: 'Open documents' });

const documentRow = (page: Page, title: string) =>
  page.getByRole('list', { name: 'All documents' }).getByRole('button', {
    name: new RegExp(`^${title}`),
  });

async function setTitle(page: Page, title: string) {
  await expect(body(page)).toBeFocused();
  await titleField(page).fill(title);
  await expect(documentRow(page, title)).toBeVisible({ timeout: 15_000 });
}

async function newDocument(page: Page, title: string) {
  await page.getByRole('button', { name: 'New Document', exact: true }).click();
  await expect(titleField(page)).toHaveValue('Untitled');
  await setTitle(page, title);
}

async function firstVisit(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New document', exact: true }).click();
  await expect(titleField(page)).toHaveValue('Untitled');
}

/**
 * Runs a command that lives behind the toolbar's overflow menu.
 *
 * Show Characters, word wrap and print are all one menu deep: the bar keeps the
 * controls a writer reaches for while writing, and these wait behind "More
 * formatting". Every action re-focuses the editor before it runs, so the caret
 * is back in the document by the time the menu closes.
 */
async function runOverflowCommand(page: Page, name: string) {
  await page.getByRole('button', { name: 'More formatting' }).click();
  await page.getByRole('menuitem', { name }).click();
}

/** Types `count` short paragraphs, enough to overflow a short window. */
async function typeParagraphs(page: Page, count: number) {
  await body(page).click();
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.type(`line ${index}`);
    await page.keyboard.press('Enter');
  }
}

test.describe('show characters', () => {
  test('marks spaces without changing the text', async ({ page }) => {
    await firstVisit(page);
    await body(page).click();
    await page.keyboard.type('two words here');

    const spaces = body(page).locator('.noto-invisible-space');
    await expect(spaces).toHaveCount(0);

    await runOverflowCommand(page, 'Show Characters');

    await expect(spaces).toHaveCount(2);
    await expect(body(page)).toContainText('two words here');

    /*
     * The markers are painted over the document, never written into it. The
     * pilcrows are real elements while the setting is on — that is how they are
     * visible at all — so the proof is that switching it off leaves exactly the
     * characters that were typed, with nothing added and nothing lost.
     */
    await runOverflowCommand(page, 'Show Characters');
    await expect(body(page)).toHaveText('two words here');
  });

  test('marks the end of every block', async ({ page }) => {
    await firstVisit(page);
    await body(page).click();
    await page.keyboard.type('first');
    await page.keyboard.press('Enter');
    await page.keyboard.type('second');

    await runOverflowCommand(page, 'Show Characters');

    await expect(body(page).locator('.noto-invisible-paragraph')).toHaveCount(2);
  });

  test('keeps up as the document is edited', async ({ page }) => {
    await firstVisit(page);
    await body(page).click();
    await page.keyboard.type('one two');

    await runOverflowCommand(page, 'Show Characters');
    await expect(body(page).locator('.noto-invisible-space')).toHaveCount(1);

    // The decorations are maintained incrementally, so a keystroke after the
    // set was built is the case worth proving.
    await page.keyboard.type(' three');
    await expect(body(page).locator('.noto-invisible-space')).toHaveCount(2);
  });

  test('is a setting, so it survives a reload', async ({ page }) => {
    await firstVisit(page);
    await body(page).click();
    await page.keyboard.type('a b');

    await runOverflowCommand(page, 'Show Characters');
    await expect(body(page).locator('.noto-invisible-space')).toHaveCount(1);

    await page.reload();

    // Proved by what the editor draws rather than by the state of a control:
    // the setting is only worth persisting if it still changes the page.
    await body(page).click();
    await page.keyboard.type(' c d');
    await expect(body(page).locator('.noto-invisible-space')).not.toHaveCount(0);
  });
});

test.describe('scrolling', () => {
  /*
   * Short enough that a handful of paragraphs overflows it, and still wide
   * enough to keep the desktop layout — the sidebar collapses below 1024px,
   * and with it the document list these tests navigate by.
   */
  test.use({ viewport: { width: 1200, height: 460 } });

  test('scrolls the pane while the toolbar stays put', async ({ page }) => {
    await firstVisit(page);
    await typeParagraphs(page, 24);

    const toolbarBefore = await page
      .getByRole('toolbar', { name: 'Formatting' })
      .boundingBox()
      .then((box) => box?.y);

    await scroller(page).evaluate((element) => element.scrollTo({ top: 300 }));
    await expect
      .poll(() => scroller(page).evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);

    const toolbarAfter = await page
      .getByRole('toolbar', { name: 'Formatting' })
      .boundingBox()
      .then((box) => box?.y);

    expect(toolbarAfter).toBe(toolbarBefore);
  });

  test('returns a document to where it was left', async ({ page }) => {
    await firstVisit(page);
    await setTitle(page, 'Long');
    await typeParagraphs(page, 24);

    await scroller(page).evaluate((element) => element.scrollTo({ top: 250 }));
    await expect
      .poll(() => scroller(page).evaluate((element) => element.scrollTop))
      .toBeGreaterThan(200);

    await newDocument(page, 'Other');
    // A fresh document opens at the top, not at the last document's offset.
    await expect.poll(() => scroller(page).evaluate((element) => element.scrollTop)).toBe(0);

    await tabList(page).getByRole('button', { name: 'Long', exact: true }).click();
    await expect(titleField(page)).toHaveValue('Long');

    await expect
      .poll(() => scroller(page).evaluate((element) => element.scrollTop))
      .toBeGreaterThan(200);
  });

  test('keeps sideways movement inside the document body', async ({ page }) => {
    await firstVisit(page);
    await body(page).click();
    await page.keyboard.type('x'.repeat(400));

    await runOverflowCommand(page, 'Toggle Word Wrap');
    await expect(canvas(page)).toHaveClass(/noto-prose-nowrap/);

    // The unwrapped line overflows its own box, not the pane's — otherwise the
    // sticky toolbar would slide out of the window with it.
    await expect
      .poll(() => canvas(page).evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBeGreaterThan(0);
    await expect
      .poll(() => scroller(page).evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBe(0);
  });
});

test.describe('print', () => {
  /* The real dialog would block the run, so the call is recorded instead. */
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { notoPrintCalls: number }).notoPrintCalls = 0;
      window.print = () => {
        (window as unknown as { notoPrintCalls: number }).notoPrintCalls += 1;
      };
    });
  });

  const printCalls = (page: Page) =>
    page.evaluate(() => (window as unknown as { notoPrintCalls: number }).notoPrintCalls);

  test('prints from the toolbar and from the accelerator', async ({ page }) => {
    await firstVisit(page);
    await body(page).click();
    await page.keyboard.type('on paper');

    await runOverflowCommand(page, 'Print Document');
    await expect.poll(() => printCalls(page)).toBe(1);

    await page.keyboard.press('ControlOrMeta+p');
    await expect.poll(() => printCalls(page)).toBe(2);
  });

  test('puts the document on the page and leaves the application off it', async ({ page }) => {
    await firstVisit(page);
    await body(page).click();
    await page.keyboard.type('printed content');

    await page.emulateMedia({ media: 'print' });

    await expect(body(page)).toBeVisible();
    await expect(body(page)).toContainText('printed content');

    await expect(page.getByRole('toolbar', { name: 'Formatting' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'New Document', exact: true })).toBeHidden();

    // The pane cannot clip, or only the first screenful would reach the paper.
    await expect
      .poll(() => scroller(page).evaluate((element) => getComputedStyle(element).overflowY))
      .toBe('visible');
  });

  test('does not print the invisible-character markers', async ({ page }) => {
    await firstVisit(page);
    await body(page).click();
    await page.keyboard.type('a b');
    await runOverflowCommand(page, 'Show Characters');
    await expect(body(page).locator('.noto-invisible-space')).toHaveCount(1);

    await page.emulateMedia({ media: 'print' });

    await expect
      .poll(() =>
        body(page)
          .locator('.noto-invisible-space')
          .first()
          .evaluate((element) => getComputedStyle(element).display),
      )
      .toBe('none');
  });
});
