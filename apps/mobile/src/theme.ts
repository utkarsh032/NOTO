import { type ThemeColors, darkTheme, lightTheme } from '@noto/config';
import { useColorScheme } from 'react-native';

/**
 * Resolves the Noto colour roles for the device appearance.
 *
 * The values come from `@noto/config`, which the web and desktop stylesheets
 * also read, so all three platforms stay on one palette.
 */
export function useThemeColors(): ThemeColors {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}
