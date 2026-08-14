import { palette } from './tokens';

/**
 * Semantic colour roles. UI code references these, never raw palette values, so
 * a theme change is a single mapping change rather than a sweep through components.
 */
export interface ThemeColors {
  /** Page background. */
  surface: string;
  /** Cards, panels and popovers that sit above the page. */
  surfaceRaised: string;
  /** Sidebar and other chrome. */
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  textInverted: string;
  accent: string;
  accentHover: string;
  accentText: string;
  accentSubtle: string;
  success: string;
  warning: string;
  danger: string;
  /** Overlay behind modals. */
  scrim: string;
}

export const lightTheme: ThemeColors = {
  surface: palette.neutral0,
  surfaceRaised: palette.neutral0,
  surfaceSunken: palette.neutral50,
  border: palette.neutral200,
  borderStrong: palette.neutral300,
  text: palette.neutral900,
  textMuted: palette.neutral600,
  textSubtle: palette.neutral400,
  textInverted: palette.neutral0,
  accent: palette.accent500,
  accentHover: palette.accent600,
  accentText: palette.neutral0,
  accentSubtle: palette.accent100,
  success: palette.success500,
  warning: palette.warning500,
  danger: palette.danger500,
  scrim: 'rgba(13, 13, 15, 0.45)',
};

export const darkTheme: ThemeColors = {
  surface: palette.neutral950,
  surfaceRaised: palette.neutral900,
  surfaceSunken: palette.neutral900,
  border: palette.neutral800,
  borderStrong: palette.neutral700,
  text: palette.neutral50,
  textMuted: palette.neutral400,
  textSubtle: palette.neutral500,
  textInverted: palette.neutral950,
  accent: palette.accent500,
  accentHover: palette.accent300,
  accentText: palette.neutral0,
  accentSubtle: palette.accent700,
  success: palette.success500,
  warning: palette.warning500,
  danger: palette.danger500,
  scrim: 'rgba(0, 0, 0, 0.6)',
};

export const themes = { light: lightTheme, dark: darkTheme } as const;

export type ResolvedTheme = keyof typeof themes;

export function getTheme(theme: ResolvedTheme): ThemeColors {
  return themes[theme];
}
