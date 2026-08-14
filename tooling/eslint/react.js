import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

import { baseConfig } from './base.js';

/**
 * ESLint flat config for React (DOM) packages: apps/web, apps/desktop, packages/ui.
 * @type {import('typescript-eslint').ConfigArray}
 */
export const reactConfig = tseslint.config(...baseConfig, {
  files: ['**/*.{ts,tsx,js,jsx}'],
  languageOptions: {
    globals: { ...globals.browser, ...globals.es2023 },
  },
  settings: { react: { version: 'detect' } },
  plugins: {
    react: reactPlugin,
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
  },
  rules: {
    ...reactPlugin.configs.flat.recommended.rules,
    ...reactPlugin.configs.flat['jsx-runtime'].rules,
    ...reactHooks.configs.recommended.rules,
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
});

export default reactConfig;
