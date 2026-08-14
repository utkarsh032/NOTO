/**
 * Platform-neutral design tokens.
 *
 * These are plain values so React Native can consume them directly. The web and
 * desktop apps re-expose the same values as CSS custom properties in
 * `tokens.css`, which Tailwind then reads — one source of truth, two consumers.
 */

export const palette = {
  // Neutral ramp — the surface and text scale.
  neutral0: '#ffffff',
  neutral50: '#f7f7f8',
  neutral100: '#ededf0',
  neutral200: '#dcdce2',
  neutral300: '#bfbfc9',
  neutral400: '#9494a1',
  neutral500: '#6f6f7e',
  neutral600: '#55555f',
  neutral700: '#3f3f47',
  neutral800: '#27272c',
  neutral900: '#18181b',
  neutral950: '#0d0d0f',

  // Accent ramp — Noto's primary interactive colour.
  accent100: '#e0e9ff',
  accent300: '#a3bcff',
  accent500: '#4f6bed',
  accent600: '#3d55d1',
  accent700: '#2f41a8',

  success500: '#2f9e5f',
  warning500: '#c98a1a',
  danger500: '#d0453c',
} as const;

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
} as const;

export const duration = {
  fast: 120,
  normal: 200,
  slow: 320,
} as const;

/** Layout constants shared by the web and desktop application shells. */
export const layout = {
  sidebarWidth: 260,
  sidebarMinWidth: 180,
  sidebarMaxWidth: 480,
  titleBarHeight: 38,
  editorMaxWidth: 720,
} as const;

export type Spacing = keyof typeof spacing;
export type Radius = keyof typeof radius;
export type FontSize = keyof typeof fontSize;
