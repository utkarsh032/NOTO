import { baseConfig } from '@noto/eslint-config/base';

/** Lints only root-level tooling files; apps and packages own their own configs. */
export default [
  ...baseConfig,
  {
    ignores: ['apps/**', 'packages/**', 'tooling/**', 'R&D/**'],
  },
];
