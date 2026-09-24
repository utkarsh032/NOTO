import { type Page, expect, test } from '@playwright/test';

/*
 * Noto Memory, from storage.
 *
 * Memory used to render a fixture; these check the real thing: a note kept
 * in one place is listed in another, survives a reload, and pinning and
 * removing it are written down rather than held in React state.
 */

const composer = (page: Page) =>
  page.getByRole('main').getByRole('textbox', { name: 'Quick note' });

test.describe('Noto Memory', () => {
  test('starts empty, with no fixture pretending otherwise', async ({ page }) => {
    await page.goto('/#/memory');
    await expect(page.getByText('Nothing captured yet')).toBeVisible();
  });

  test('keeps a quick note, lists it, and still has it after a reload', async ({ page }) => {
    await page.goto('/#/quick-note');

    await composer(page).fill('Call the printer about the proofs\nBefore Friday');
    await page.getByRole('button', { name: 'Keep note' }).click();

    await expect(page.getByText('Kept in Quick Notes')).toBeVisible();
    await expect(composer(page)).toHaveValue('');

    const card = page
      .getByRole('main')
      .getByRole('heading', { name: 'Call the printer about the proofs' });
    await expect(card).toBeVisible();

    await page.reload();
    await expect(card).toBeVisible();

    // The same note, in Memory proper.
    await page.goto('/#/memory');
    await expect(
      page.getByRole('main').getByRole('heading', { name: 'Call the printer about the proofs' }),
    ).toBeVisible();
    await expect(page.getByText('Nothing captured yet')).toHaveCount(0);
  });

  test('keeps a note from the floating window with the keyboard', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('banner').getByRole('button', { name: 'New document' }),
    ).toBeVisible();

    await page.keyboard.press('ControlOrMeta+Alt+n');
    const window = page.getByRole('dialog', { name: 'Quick Note' });
    await expect(window).toBeVisible();

    await window.getByRole('textbox', { name: 'Quick note' }).fill('From the floating window');
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(window).toHaveCount(0);
    await page.goto('/#/quick-note');
    await expect(
      page.getByRole('main').getByRole('heading', { name: 'From the floating window' }),
    ).toBeVisible();
  });

  test('pins and removes, and remembers both', async ({ page }) => {
    await page.goto('/#/quick-note');
    await composer(page).fill('Pin me');
    await page.getByRole('button', { name: 'Keep note' }).click();
    await composer(page).fill('Remove me');
    await page.getByRole('button', { name: 'Keep note' }).click();

    await page.goto('/#/memory');
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Remove me' })).toBeVisible();

    await main.getByRole('button', { name: 'Pin Pin me' }).click();
    await expect(main.getByRole('button', { name: 'Unpin Pin me' })).toBeVisible();

    await page.getByRole('button', { name: 'Pinned', exact: true }).click();
    await expect(main.getByRole('heading', { name: 'Pin me' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Remove me' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Pinned', exact: true }).click();

    await main.getByRole('button', { name: 'Actions for Remove me' }).click();
    await page.getByRole('menuitem', { name: 'Remove from Memory' }).click();
    // Said once the tombstone is on disk, which is what makes the reload fair.
    await expect(page.getByText('Removed from Memory')).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Remove me' })).toHaveCount(0);

    await page.reload();
    await expect(main.getByRole('button', { name: 'Unpin Pin me' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Remove me' })).toHaveCount(0);
  });
});
