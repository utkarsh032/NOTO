import { brand, dark, neutral, semantic, semanticDark, shadow, shadowDark } from './tokens';

/**
 * Semantic colour roles. UI code references these, never raw palette values, so
 * a theme change is a single mapping change rather than a sweep through components.
 */
export interface ThemeColors {
  /** The application background. Cards and the editor sit on top of it. */
  background: string;
  /** Cards, the editing canvas, dialogs — anything focused. */
  surface: string;
  /** Secondary panels such as the sidebar. */
  surfaceSecondary: string;
  /** Inputs and other subtly recessed areas. */
  surfaceTertiary: string;

  border: string;
  borderStrong: string;

  /** Headings and body copy. */
  textPrimary: string;
  /** Supporting text. */
  textSecondary: string;
  /** Metadata and timestamps. */
  textTertiary: string;
  textDisabled: string;
  /** Text on a filled dark surface. */
  textInverted: string;

  /** Primary buttons, active navigation, selected states. */
  brand: string;
  brandHover: string;
  /** Text and icons that sit on `brandSoft`. */
  brandStrong: string;
  /** The tint behind an active navigation item. */
  brandSoft: string;
  /** A selected row or a highlighted search match. */
  brandMuted: string;
  /** A hairline around a brand-tinted surface. */
  brandSubtle: string;
  /** Text on a filled `brand` surface. */
  onBrand: string;

  success: string;
  info: string;
  warning: string;
  danger: string;
  /** AI features. Recognisable, never a large surface. */
  ai: string;
  aiSoft: string;
  /** Noto Memory. */
  memory: string;
  /** Clipboard and capture. */
  capture: string;

  /** Overlay behind modals. */
  scrim: string;
}

export interface ThemeShadows {
  sm: string;
  md: string;
  lg: string;
}

export const lightTheme: ThemeColors = {
  background: neutral[25],
  surface: neutral[0],
  surfaceSecondary: neutral[50],
  surfaceTertiary: neutral[100],

  border: neutral[200],
  borderStrong: neutral[300],

  textPrimary: neutral[900],
  textSecondary: neutral[600],
  textTertiary: neutral[500],
  textDisabled: neutral[400],
  textInverted: neutral[0],

  brand: brand[600],
  brandHover: brand[700],
  brandStrong: brand[800],
  brandSoft: brand[50],
  brandMuted: brand[100],
  brandSubtle: brand[200],
  onBrand: neutral[0],

  ...semantic,

  scrim: 'rgba(17, 24, 39, 0.45)',
};

export const darkTheme: ThemeColors = {
  background: dark[950],
  surface: dark[900],
  surfaceSecondary: dark[850],
  surfaceTertiary: dark[800],

  border: dark[700],
  borderStrong: dark[600],

  textPrimary: dark[50],
  textSecondary: dark[300],
  textTertiary: dark[400],
  textDisabled: dark[500],
  textInverted: dark[950],

  /*
   * A step lighter than the light theme's, and filled buttons take near-black
   * text rather than white: `brand600` on a near-black surface is too dark to
   * separate from it, and white on `brand500` does not clear 4.5:1.
   */
  brand: brand[500],
  brandHover: brand[400],
  brandStrong: brand[300],
  brandSoft: '#132a1c',
  brandMuted: '#17351f',
  brandSubtle: '#1f4d2e',
  onBrand: '#052e16',

  ...semanticDark,

  scrim: 'rgba(0, 0, 0, 0.6)',
};

export const lightShadows: ThemeShadows = shadow;
export const darkShadows: ThemeShadows = shadowDark;

export const themes = { light: lightTheme, dark: darkTheme } as const;
export const shadows = { light: lightShadows, dark: darkShadows } as const;

export type ResolvedTheme = keyof typeof themes;

export function getTheme(theme: ResolvedTheme): ThemeColors {
  return themes[theme];
}

export function getShadows(theme: ResolvedTheme): ThemeShadows {
  return shadows[theme];
}
