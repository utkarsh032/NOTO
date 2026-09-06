import { expect, test } from '@playwright/test';

/*
 * These run against whatever the build was given.
 *
 * With Supabase credentials the account screen is a protected route and a
 * signed-out visitor is sent to sign in; without them there is nothing to sign
 * into, and the screen says so instead. Both are supported, and CI builds the
 * second one — so the assertions here are about what must be true either way,
 * and the branch is taken only where the two genuinely differ.
 */

test.describe('the account screen, signed out', () => {
  test('never renders an account belonging to nobody', async ({ page }) => {
    await page.goto('/#/account');

    const signIn = page.getByRole('heading', { name: 'Welcome back' });
    const noService = page.getByText('There is no account to manage here');

    await expect(signIn.or(noService)).toBeVisible();

    // Whichever answer it gave, the profile, the devices and the security
    // history are not on screen. This is the failure worth catching: those
    // sections used to render from a fixture, and later from whatever the last
    // session left behind.
    await expect(page.getByRole('heading', { name: 'Profile' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /Devices/ })).toHaveCount(0);
  });

  test('sends a visitor to sign in, and remembers what for', async ({ page }) => {
    await page.goto('/#/account');

    const signIn = page.getByRole('heading', { name: 'Welcome back' });
    await expect(signIn.or(page.getByText('There is no account to manage here'))).toBeVisible();

    // The build has no account service, so there is no redirect to test.
    test.skip(!(await signIn.isVisible()), 'built without an account service');

    await expect(page).toHaveURL(/#\/login\/account$/);

    // And it says why it moved them, rather than appearing for no reason.
    await expect(page.getByText(/That screen is about your account/)).toBeVisible();
  });

  test('does not trap anyone on the sign-in screen', async ({ page }) => {
    await page.goto('/#/account');

    /* Waited for rather than polled: the sign-in screen is a lazy chunk, and
       an immediate visibility check races it and reads as "not there". */
    const signIn = page.getByRole('heading', { name: 'Welcome back' });
    await expect(signIn.or(page.getByText('There is no account to manage here'))).toBeVisible();

    test.skip(!(await signIn.isVisible()), 'built without an account service');

    await page.getByRole('button', { name: 'Continue without an account' }).click();

    // Noto works signed out, so declining is a real answer and it leads to the
    // workspace rather than back around to the screen that was refused.
    await expect(page).toHaveURL(/#\/home$/);
    await expect(
      page.getByRole('complementary').getByRole('button', { name: 'New Document', exact: true }),
    ).toBeVisible();
  });
});

test.describe('everything that is not about the account', () => {
  test('stays open to everyone', async ({ page }) => {
    // Noto is local-first. A guard that reached past the one screen describing
    // a person would be gating somebody's own documents on somebody's server.
    for (const [hash, heading] of [
      ['#/documents', 'Documents'],
      ['#/settings', 'Settings'],
      ['#/quick-note', 'Quick Notes'],
    ] as const) {
      await page.goto(`/${hash}`);

      await expect(page).toHaveURL(new RegExp(`${hash.replace('/', '\\/')}$`));
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    }
  });
});
