import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Each integration file creates and drops its own database; argon2 and
    // migrations make them slower than unit tests.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
