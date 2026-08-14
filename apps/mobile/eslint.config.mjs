import { reactNativeConfig } from '@noto/eslint-config/react-native';

export default [
  ...reactNativeConfig,
  {
    ignores: ['.expo/**', 'android/**', 'ios/**'],
  },
];
