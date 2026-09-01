import { baseConfig } from '@noto/eslint-config/base';

/** Lints only root-level tooling files; apps and packages own their own configs. */
export default [
  ...baseConfig,
  {
    // supabase/functions is Deno, not Node: it is checked by `deno lint`
    // and `deno check`, which understand its globals and its .ts imports.
    ignores: ['apps/**', 'packages/**', 'tooling/**', 'R&D/**', 'supabase/**'],
  },
];
