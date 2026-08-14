import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

import { baseConfig } from './base.js';

/**
 * ESLint flat config for React Native / Expo packages: apps/mobile.
 * Deliberately excludes browser globals and react-refresh (Metro uses Fast Refresh).
 * @type {import('typescript-eslint').ConfigArray}
 */
export const reactNativeConfig = tseslint.config(...baseConfig, {
  files: ['**/*.{ts,tsx,js,jsx}'],
  languageOptions: {
    globals: {
      ...globals.es2023,
      __DEV__: 'readonly',
      fetch: 'readonly',
      console: 'readonly',
      setTimeout: 'readonly',
      clearTimeout: 'readonly',
      setInterval: 'readonly',
      clearInterval: 'readonly',
      requestAnimationFrame: 'readonly',
      cancelAnimationFrame: 'readonly',
    },
  },
  settings: { react: { version: 'detect' } },
  plugins: {
    react: reactPlugin,
    'react-hooks': reactHooks,
  },
  rules: {
    ...reactPlugin.configs.flat.recommended.rules,
    ...reactPlugin.configs.flat['jsx-runtime'].rules,
    ...reactHooks.configs.recommended.rules,
  },
});

export default reactNativeConfig;
