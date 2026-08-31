import { type Page, expect, test } from '@playwright/test';

/*
 * Updating, from the outside.
 *
 * The state this covers is the one nobody can see by running Noto: it only
 * exists once a release newer than the running build has been published, which
 * by definition has not happened yet for the build under test. So GitHub's
 * answer is the thing that gets faked, and everything downstream of it — the
 * comparison, the prompt, the sidebar row, the "later" that has to stick — is
 * the real code.
 */

/** A release far enough ahead that no real version will ever overtake it. */
const NEWER = '9.9.0';

/** The endpoint the update check asks — `LATEST_RELEASE_API_URL`. */
const RELEASE_API = 'https://api.github.com/repos/*/**';

async function serveRelease(page: Page, version: string | null): Promise<void> {
  await page.route(RELEASE_API, (route) =>
    version === null
      ? route.fulfill({ status: 404, body: '{}' })
      : route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            tag_name: `v${version}`,
            html_url: `https://github.com/utkarsh032/NOTO/releases/tag/v${version}`,
            published_at: '2026-08-20T10:00:00Z',
          }),
        }),
  );
}

const sidebar = (page: Page) => page.getByRole('complementary');

test.describe('Updates', () => {
  test('offers the new version, and the offer survives being declined', async ({ page }) => {
    await serveRelease(page, NEWER);
    await page.goto('/');

    // The background check runs a few seconds after opening, so that the first
    // moments of a launch belong to the documents.
    const dialog = page.getByRole('dialog', { name: `Noto ${NEWER} is available` });
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // Both versions are named, so the reader can tell how far behind they are.
    await expect(dialog.getByRole('link', { name: `What is new in ${NEWER}` })).toBeVisible();

    await dialog.getByRole('button', { name: 'Later' }).click();
    await expect(dialog).toBeHidden();

    // "Later" stops the asking, not the offering: the sidebar keeps the way back.
    const update = sidebar(page).getByRole('button', { name: `Update to ${NEWER}` });
    await expect(update).toBeVisible();

    await update.click();
    await expect(dialog).toBeVisible();
  });

  test('does not ask again about a version already declined', async ({ page }) => {
    await serveRelease(page, NEWER);
    await page.goto('/');

    const dialog = page.getByRole('dialog', { name: `Noto ${NEWER} is available` });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole('button', { name: 'Later' }).click();

    await page.reload();

    // The row is still there; the dialog is not put in front of them twice.
    await expect(sidebar(page).getByRole('button', { name: `Update to ${NEWER}` })).toBeVisible({
      timeout: 15_000,
    });
    await expect(dialog).toBeHidden();
  });

  test('says so when the running version is the newest one', async ({ page }) => {
    await serveRelease(page, '0.0.1');
    await page.goto('/');

    // The version in the sidebar is how a check is asked for by hand.
    await sidebar(page)
      .getByRole('button', { name: /check for updates/ })
      .click();

    await expect(page.getByText(/is the latest version/)).toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});
