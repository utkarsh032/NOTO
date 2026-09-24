import { existsSync, readFileSync } from 'node:fs';

import { defineConfig } from 'vitest/config';

/**
 * `NOTO_TEST_DATABASE_URL` from the environment, or else from the git-ignored
 * `.env.test.local` — unless that still holds its placeholder password, in
 * which case the Postgres suites skip rather than fail to connect.
 */
function testDatabaseUrl(): string | undefined {
  const fromEnvironment = process.env['NOTO_TEST_DATABASE_URL'];
  if (fromEnvironment) return fromEnvironment;

  const file = new URL('.env.test.local', import.meta.url);
  if (!existsSync(file)) return undefined;

  const match = /^NOTO_TEST_DATABASE_URL=(.+)$/m.exec(readFileSync(file, 'utf8'));
  const url = match?.[1]?.trim();
  return url && !url.includes(':PASSWORD@') ? url : undefined;
}

const databaseUrl = testDatabaseUrl();

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Each integration file creates and drops its own database; argon2 and
    // migrations make them slower than unit tests.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    ...(databaseUrl ? { env: { NOTO_TEST_DATABASE_URL: databaseUrl } } : {}),
  },
});
