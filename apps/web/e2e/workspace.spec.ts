import { type Page, expect, test } from '@playwright/test';

/**
 * Tabs, files, history, find/replace, word wrap and zoom — PRD 5.3 to 5.8.
 *
 * Assertions land on the document and on what storage kept, rather than on the
 * controls: a tab that highlights without switching documents, or a zoom
 * control that counts up without changing anything, would both still be bugs.
 */

const body = (page: Page) => page.locator('#noto-document-body .ProseMirror');
const titleField = (page: Page) => page.getByRole('textbox', { name: 'Document title' });
const tabList = (page: Page) => page.getByRole('tablist', { name: 'Open documents' });
const recentList = (page: Page) => page.getByRole('region', { name: 'Recent' });

/**
 * A row in the sidebar's document list.
 *
 * Scoped to that list, because the same title also appears on a tab and under
 * Recent — three buttons whose accessible names all begin with it.
 */
const documentRow = (page: Page, title: string) =>
  page.getByRole('list', { name: 'All documents' }).getByRole('button', {
    name: new RegExp(`^${title}`),
  });

/**
 * Titles the open document and waits for the write to land.
 *
 * The sidebar renders from storage, so the row carrying the new title is proof
 * the debounced write arrived. It gets a long timeout rather than the default:
 * a full parallel run puts eight browsers and eight IndexedDB stores on one
 * machine, and 600ms of debounce becomes rather more than that.
 */
async function setTitle(page: Page, title: string) {
  /*
   * The editor autofocuses when a document opens, and it does so a beat after
   * the title field exists. Filling the title before that lands lets the caret
   * be taken mid-word and the rest of the name arrive in the document body.
   */
  await expect(body(page)).toBeFocused();

  await titleField(page).fill(title);
  await expect(documentRow(page, title)).toBeVisible({ timeout: 15_000 });
}

/** Creates a document, waits for it to open, and gives it `title`. */
async function newDocument(page: Page, title: string) {
  await page.getByRole('button', { name: 'New Document', exact: true }).click();
  await expect(titleField(page)).toHaveValue('Untitled');
  await setTitle(page, title);
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

async function firstVisit(page: Page) {
  await page.goto('/');
  // `exact` makes the match case-sensitive, which is what separates the empty
  // state's "New document" from the sidebar's "New Document".
  await page.getByRole('button', { name: 'New document', exact: true }).click();
  await expect(titleField(page)).toHaveValue('Untitled');
}

test.describe('tabs', () => {
  test('opens a tab per document and switches between them', async ({ page }) => {
    await firstVisit(page);
    await setTitle(page, 'First');

    // The strip is drawn as soon as anything is open, including for one
    // document: it is what says which document the pane below belongs to.
    await expect(tabList(page).getByRole('tab')).toHaveCount(1);

    await newDocument(page, 'Second');
    await expect(tabList(page)).toBeVisible();

    const tabs = tabList(page).getByRole('tab');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.filter({ hasText: 'Second' })).toHaveAttribute('aria-selected', 'true');

    await tabList(page).getByRole('button', { name: 'First', exact: true }).click();
    await expect(titleField(page)).toHaveValue('First');
    await expect(tabs.filter({ hasText: 'First' })).toHaveAttribute('aria-selected', 'true');
  });

  test('closing a tab hands the front to a neighbour', async ({ page }) => {
    await firstVisit(page);
    await setTitle(page, 'One');
    await newDocument(page, 'Two');
    await newDocument(page, 'Three');

    await page.getByRole('button', { name: 'Close Three' }).click();

    await expect(tabList(page).getByRole('tab')).toHaveCount(2);
    await expect(titleField(page)).toHaveValue('Two');
  });

  test('closes every tab and stays closed', async ({ page }) => {
    await firstVisit(page);
    await setTitle(page, 'One');
    await newDocument(page, 'Two');

    // Close All. Selection used to fall back to the newest document, which made
    // this impossible — something reopened immediately.
    await page.keyboard.press('ControlOrMeta+Shift+W');

    await expect(page.getByText('Nothing open')).toBeVisible();
    await expect(tabList(page)).toHaveCount(0);
    await expect(documentRow(page, 'One')).toBeVisible();
  });

  test('restores the open tabs after a reload', async ({ page }) => {
    await firstVisit(page);
    await setTitle(page, 'Alpha');
    await newDocument(page, 'Beta');

    await page.reload();

    await expect(tabList(page).getByRole('tab')).toHaveCount(2);
    await expect(titleField(page)).toHaveValue('Beta');
  });

  test('marks a tab while its document has unsaved work', async ({ page }) => {
    await firstVisit(page);
    await setTitle(page, 'One');
    await newDocument(page, 'Two');

    await body(page).click();
    await page.keyboard.type('typing');

    const activeTab = tabList(page).getByRole('tab').filter({ hasText: 'Two' });
    await expect(activeTab.getByRole('button', { name: 'Close Two' })).toBeVisible();

    // The dot goes once the debounced write lands.
    await expect(page.getByText('Saved')).toBeVisible();
  });
});

test.describe('files', () => {
  test('renames a document from the sidebar', async ({ page }) => {
    await firstVisit(page);
    await setTitle(page, 'Before');

    await page.getByRole('button', { name: 'Rename Before' }).click();

    const field = page.getByRole('textbox', { name: 'Rename Before' });
    await field.fill('After');
    await field.press('Enter');

    await expect(documentRow(page, 'After')).toBeVisible();
    await expect(titleField(page)).toHaveValue('After');
  });

  test('offers a closed document under Recent', async ({ page }) => {
    await firstVisit(page);
    await setTitle(page, 'Archived');
    await newDocument(page, 'Current');

    await page.getByRole('button', { name: 'Close Archived' }).click();

    await expect(recentList(page).getByRole('button', { name: 'Archived' })).toBeVisible();

    await recentList(page).getByRole('button', { name: 'Archived' }).click();
    await expect(titleField(page)).toHaveValue('Archived');
  });
});

test.describe('undo and redo', () => {
  test('walks the editor history', async ({ page }) => {
    await firstVisit(page);
    const editor = body(page);
    await editor.click();
    await page.keyboard.type('first');

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(editor).not.toContainText('first');

    await page.getByRole('button', { name: 'Redo' }).click();
    await expect(editor).toContainText('first');
  });

  test('undoes once per keypress', async ({ page }) => {
    await firstVisit(page);
    const editor = body(page);
    await editor.click();
    await page.keyboard.type('kept');

    // Bound in the editor only. A second binding on the window would undo
    // twice for one press.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(editor).not.toContainText('kept');

    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(editor).toContainText('kept');
  });
});

test.describe('find and replace', () => {
  test('counts matches and steps through them', async ({ page }) => {
    await firstVisit(page);
    await body(page).click();
    await page.keyboard.type('alpha beta alpha gamma alpha');

    await page.keyboard.press('ControlOrMeta+f');

    const find = page.getByRole('textbox', { name: 'Find', exact: true });
    await find.fill('alpha');

    // Nothing is stepped to yet, so the bar reports the tally rather than
    // claiming the caret is on the first match.
    await expect(page.getByText('3 matches')).toBeVisible();

    await page.getByRole('button', { name: 'Find next' }).click();
    await expect(page.getByText('1 of 3')).toBeVisible();

    await page.getByRole('button', { name: 'Find next' }).click();
    await expect(page.getByText('2 of 3')).toBeVisible();

    await page.getByRole('button', { name: 'Find previous' }).click();
    await expect(page.getByText('1 of 3')).toBeVisible();

    // Highlighted in the document, not just counted in the bar.
    await expect(body(page).locator('.ProseMirror-search-match')).not.toHaveCount(0);
  });

  test('honours match case', async ({ page }) => {
    await firstVisit(page);
    await body(page).click();
    await page.keyboard.type('Noto and noto');

    await page.keyboard.press('ControlOrMeta+f');
    await page.getByRole('textbox', { name: 'Find', exact: true }).fill('Noto');
    await expect(page.getByText('2 matches')).toBeVisible();

    await page.getByRole('checkbox', { name: 'Match case' }).check();
    await expect(page.getByText('1 match')).toBeVisible();
  });

  test('says so when there is nothing to find', async ({ page }) => {
    await firstVisit(page);
    await body(page).click();
    await page.keyboard.type('present');

    await page.keyboard.press('ControlOrMeta+f');
    await page.getByRole('textbox', { name: 'Find', exact: true }).fill('absent');

    await expect(page.getByText('No results')).toBeVisible();
  });

  test('replaces one match and then all of them', async ({ page }) => {
    await firstVisit(page);
    const editor = body(page);
    await editor.click();
    await page.keyboard.type('one one one');

    await page.keyboard.press('ControlOrMeta+h');
    await page.getByRole('textbox', { name: 'Find', exact: true }).fill('one');
    await page.getByRole('textbox', { name: 'Replace with' }).fill('two');

    await page.getByRole('button', { name: 'Replace', exact: true }).click();
    await expect(editor).toContainText('two one one');

    await page.getByRole('button', { name: 'Replace all' }).click();
    await expect(editor).toContainText('two two two');
  });

  test('clears its highlights when closed', async ({ page }) => {
    await firstVisit(page);
    await body(page).click();
    await page.keyboard.type('findme');

    await page.keyboard.press('ControlOrMeta+f');
    await page.getByRole('textbox', { name: 'Find', exact: true }).fill('findme');
    await expect(body(page).locator('.ProseMirror-search-match')).not.toHaveCount(0);

    await page.getByRole('button', { name: 'Close find' }).click();
    await expect(body(page).locator('.ProseMirror-search-match')).toHaveCount(0);
  });
});

test.describe('view', () => {
  test('zooms the editor without touching the document', async ({ page }) => {
    await firstVisit(page);
    await body(page).click();
    await page.keyboard.type('unchanged');

    const canvas = page.locator('#noto-document-body');
    const before = await canvas.evaluate((el) => getComputedStyle(el).fontSize);

    await page.getByRole('button', { name: /^Zoom In/ }).click();
    const after = await canvas.evaluate((el) => getComputedStyle(el).fontSize);
    expect(parseFloat(after)).toBeGreaterThan(parseFloat(before));

    // Presentation only: the text is exactly what it was.
    await expect(body(page)).toContainText('unchanged');

    await page.getByRole('button', { name: /^Reset Zoom/ }).click();
    const reset = await canvas.evaluate((el) => getComputedStyle(el).fontSize);
    expect(reset).toBe(before);
  });

  test('remembers the zoom across a reload', async ({ page }) => {
    await firstVisit(page);
    await page.getByRole('button', { name: /^Zoom In/ }).click();
    await expect(page.getByRole('button', { name: /Currently 110%/ })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('button', { name: /Currently 110%/ })).toBeVisible();
  });

  test('toggles word wrap', async ({ page }) => {
    await firstVisit(page);
    const canvas = page.locator('#noto-document-body');

    await expect(canvas).not.toHaveClass(/noto-prose-nowrap/);

    await runOverflowCommand(page, 'Toggle Word Wrap');
    await expect(canvas).toHaveClass(/noto-prose-nowrap/);

    await page.keyboard.press('Alt+z');
    await expect(canvas).not.toHaveClass(/noto-prose-nowrap/);
  });
});
