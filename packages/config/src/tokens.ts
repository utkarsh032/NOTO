/**
 * Platform-neutral design tokens.
 *
 * These are plain values so React Native can consume them directly. The web and
 * desktop apps re-expose the same values as CSS custom properties in
 * `tokens.css`, which Tailwind then reads — one source of truth, two consumers.
 *
 * The values come from the Noto Design System: emerald brand, warm-neutral
 * surfaces, cool dark text, and semantic colours reserved for meaning.
 */

/**
 * Emerald — Noto's brand ramp.
 *
 * `brand600` is the one to reach for: primary buttons, active navigation,
 * selected states. Most of the interface stays neutral, so the lighter steps do
 * far more work than the saturated ones.
 */
export const brand = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
} as const;

/**
 * Warm-neutral surfaces with cool dark text.
 *
 * The warmth is slight and deliberate: `neutral25` under `neutral0` cards
 * separates them without a heavy border, which pure white on white cannot do.
 */
export const neutral = {
  0: '#ffffff',
  25: '#fafbfa',
  50: '#f7f9f7',
  100: '#f1f4f1',
  200: '#e5e9e5',
  300: '#d5dbd5',
  400: '#9ca3af',
  500: '#6b7280',
  600: '#4b5563',
  700: '#374151',
  900: '#111827',
} as const;

/**
 * The dark theme's own ramp.
 *
 * Green-shifted rather than a flipped copy of the light neutrals: inverting the
 * light theme gives a blue-grey that reads as a different product.
 */
export const dark = {
  950: '#0f1411',
  900: '#151b17',
  850: '#1b231e',
  800: '#222c26',
  700: '#28332c',
  600: '#3a4740',
  500: '#5c665f',
  400: '#7c877f',
  300: '#a7b0aa',
  50: '#f3f4f6',
} as const;

/**
 * Colours that carry meaning rather than brand.
 *
 * They are functional indicators only and must not become secondary brand
 * colours. Each has a dark-theme counterpart lifted for contrast, because the
 * light-theme value on a near-black surface fails against text beside it.
 */
export const semantic = {
  success: '#16a34a',
  info: '#2563eb',
  warning: '#d97706',
  danger: '#dc2626',
  /** AI features: assistant, smart paste, generated suggestions. */
  ai: '#7c3aed',
  aiSoft: '#f5f3ff',
  /** Noto Memory and capture surfaces. */
  memory: '#0f766e',
  /** Clipboard and capture emphasis. */
  capture: '#ea580c',
} as const;

export const semanticDark = {
  success: '#22c55e',
  info: '#60a5fa',
  warning: '#fbbf24',
  danger: '#f87171',
  ai: '#a78bfa',
  aiSoft: '#1e1b33',
  memory: '#2dd4bf',
  capture: '#fb923c',
} as const;

/**
 * The full colour vocabulary, for anything that needs a raw value.
 *
 * UI code should reach for a semantic role from `theme.ts` instead; this exists
 * for the places that legitimately need a specific step of a ramp.
 */
export const palette = {
  ...semantic,
  white: neutral[0],
  black: dark[950],
} as const;

/**
 * The 8px spacing system.
 *
 * Keys are the step in 4px units, which is also the Tailwind utility number —
 * `spacing[6]` here and `p-6` on the web are the same 24px.
 */
export const spacing = {
  none: 0,
  /** Micro spacing. */
  1: 4,
  /** Icon-to-text spacing. */
  2: 8,
  /** Compact spacing. */
  3: 12,
  /** Standard spacing. */
  4: 16,
  /** Control spacing. */
  5: 20,
  /** Card padding. */
  6: 24,
  /** Section spacing. */
  8: 32,
  /** Major section spacing. */
  10: 40,
  /** Page spacing. */
  12: 48,
  /** Large layout spacing. */
  16: 64,
} as const;

/** Moderately rounded, never bubbly. */
export const radius = {
  none: 0,
  /** Small controls. */
  sm: 6,
  /** Inputs and buttons. */
  md: 8,
  /** Cards. */
  lg: 12,
  /** Large panels. */
  xl: 14,
  /** Dialogs and floating windows. */
  '2xl': 16,
  /** Pills and badges. */
  full: 9999,
} as const;

/**
 * The type scale.
 *
 * Hierarchy is made with size and weight, not colour — a heading is a heading
 * because it is bigger, not because it is green.
 *
 * `h2` is specified at weight 650. Inter Variable can hit that intermediate
 * weight and `tokens.css` asks for it; React Native's `fontWeight` only accepts
 * hundreds, so the shared value below rounds to 600.
 */
export const typeScale = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' },
  h1: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  h2: { fontSize: 22, lineHeight: 30, fontWeight: '600' },
  h3: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
  h4: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  bodyLarge: { fontSize: 16, lineHeight: 26, fontWeight: '400' },
  body: { fontSize: 14, lineHeight: 22, fontWeight: '400' },
  bodySmall: { fontSize: 13, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '500' },
  button: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/**
 * Very soft shadows. A card is separated by its border first and its shadow
 * second — the reverse reads as a floating dialog.
 */
export const shadow = {
  sm: '0 1px 3px rgba(15, 23, 42, 0.06)',
  md: '0 4px 16px rgba(15, 23, 42, 0.08)',
  lg: '0 16px 40px rgba(15, 23, 42, 0.14)',
} as const;

/** Dark surfaces do not catch light the same way; the same alphas disappear. */
export const shadowDark = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.4)',
  md: '0 4px 16px rgba(0, 0, 0, 0.45)',
  lg: '0 16px 40px rgba(0, 0, 0, 0.6)',
} as const;

/** Noto should feel fast; motion is feedback, never decoration. */
export const duration = {
  fast: 150,
  normal: 200,
  slow: 300,
} as const;

/** Layout constants shared by the web, desktop and mobile shells. */
export const layout = {
  sidebarWidth: 248,
  sidebarCollapsedWidth: 72,
  sidebarMinWidth: 200,
  sidebarMaxWidth: 480,
  contextPanelWidth: 320,
  headerHeight: 72,
  toolbarHeight: 48,
  titleBarHeight: 38,
  /** Comfortable measure for the editing canvas. */
  editorMaxWidth: 800,
  navItemHeight: 40,
  /** The smallest target a finger can reliably hit. */
  minTouchTarget: 44,
  controlHeight: 40,
  controlHeightSmall: 32,
} as const;

export type Spacing = keyof typeof spacing;
export type Radius = keyof typeof radius;
export type TypeStyle = keyof typeof typeScale;
