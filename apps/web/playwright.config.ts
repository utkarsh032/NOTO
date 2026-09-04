import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    /*
     * Every test starts as a returning visitor.
     *
     * Noto shows the sign-in screen once, on the first launch of an
     * installation, and records that in `localStorage`. A fresh browser context
     * is a first launch every time, so without this each test would open on
     * that screen rather than on the workspace it is about. The one test that
     * cares overrides this with an empty state.
     */
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://127.0.0.1:4173',
          localStorage: [{ name: 'noto.welcomed', value: '2026-01-01T00:00:00.000Z' }],
        },
      ],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Tests run against a production build, which is what users actually get.
  // The host is pinned because `localhost` resolves to ::1 first on Windows,
  // which the preview server does not listen on.
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
