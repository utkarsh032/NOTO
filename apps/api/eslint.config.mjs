import { baseConfig } from '@noto/eslint-config/base';

export default [
  ...baseConfig,
  {
    // The server logs through the console on purpose: structured lines to
    // stdout are what a Node host collects.
    files: ['src/**/*.ts', 'db/**/*.ts'],
    rules: { 'no-console': ['warn', { allow: ['warn', 'error'] }] },
  },
  {
    // The rule from plan §1.1: one file may import the driver.
    files: ['**/*.ts'],
    ignores: ['src/db/pool.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'pg', message: 'Only src/db/pool.ts may import pg (plan §1.1).' }] },
      ],
    },
  },
];
