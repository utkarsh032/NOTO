import { expect, test } from '@playwright/test';

/*
 * A screen that fails must not take the window with it.
 *
 * The cheapest real failure to produce is the one a deployment causes: a lazy
 * chunk that is no longer there. Blocking the Settings chunk reproduces it.
 */

test.describe('a screen that fails to load', () => {
  test('says so, keeps the window, and recovers on navigation', async ({ page }) => {
    await page.route(/\/assets\/SettingsScreen-[^/]+\.js$/, (route) => route.abort());

    await page.goto('/#/settings');

    await expect(page.getByText('Noto has been updated')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload Noto' })).toBeVisible();
    await expect(page.getByText('Your documents are saved on this device')).toBeVisible();

    // The rest of the window still works: going Home replaces the failed screen.
    await page.goto('/#/documents');
    await expect(page.getByText('Noto has been updated')).toHaveCount(0);
  });
});
