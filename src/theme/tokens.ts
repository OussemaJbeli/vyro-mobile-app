/**
 * Raw design primitives (roadmap step 03, FS §46). Components never use these directly:
 * they read semantic values from `useTheme()`. Values follow docs/template/template.png.
 */
import { accentPresets, brand, type AccentName } from './brand';
import { fontFamily } from './fonts';

export const palette = {
  ink950: brand.background,
  ink900: '#050E15',
  ink850: '#0A151E',
  ink800: '#0F1C26',
  ink700: '#1A2A36',
  ink600: '#2A3B48',
  ink400: '#5E707D',
  ink300: '#8A9BA8',
  ink100: '#E6ECEF',
  white: brand.white,
  paper50: '#F5F8F6',
  paper100: '#EDF2EF',
  paper200: '#DDE5E0',
  danger: '#FF4D5E',
  dangerInk: '#C81E32',
  warning: '#FFB020',
  warningInk: '#A15C00',
  info: '#38BDF8',
  infoInk: '#0369A1',
} as const;

export type Accent = {
  /** Fills: buttons, FAB, progress, chart lines. */
  base: string;
  /** Text/icons in the accent colour on light surfaces (≥ 4.5:1 on paper50). */
  ink: string;
  /** Text/icons placed on top of `base`. Dark for every preset: white fails contrast on all six. */
  onBase: string;
};

export const accents: Record<AccentName, Accent> = {
  lime: { base: accentPresets.lime, ink: '#3A7D00', onBase: palette.ink950 },
  blue: { base: accentPresets.blue, ink: '#1D4ED8', onBase: palette.ink950 },
  purple: { base: accentPresets.purple, ink: '#7E22CE', onBase: palette.ink950 },
  orange: { base: accentPresets.orange, ink: '#B24A06', onBase: palette.ink950 },
  red: { base: accentPresets.red, ink: '#C81E32', onBase: palette.ink950 },
  teal: { base: accentPresets.teal, ink: '#0B7A72', onBase: palette.ink950 },
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

type TextToken = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: 'uppercase';
  fontVariant?: 'tabular-nums'[];
};

export const typography = {
  display: { fontFamily: fontFamily.extrabold, fontSize: 34, lineHeight: 40 },
  title: { fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18 },
  overline: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  metric: {
    fontFamily: fontFamily.extrabold,
    fontSize: 32,
    lineHeight: 38,
    fontVariant: ['tabular-nums'],
  },
  timer: {
    fontFamily: fontFamily.extrabold,
    fontSize: 64,
    lineHeight: 72,
    fontVariant: ['tabular-nums'],
  },
} as const satisfies Record<string, TextToken>;

export type TypographyVariant = keyof typeof typography;

/** Minimum touch sizes. Execution screens use `execution` (UI §42). */
export const touch = { min: 44, comfortable: 52, execution: 64 } as const;

export const motion = {
  fast: 150,
  base: 220,
  slow: 320,
  /** Standard easing as cubic-bezier control points, for Reanimated `Easing.bezier`. */
  easing: [0.2, 0, 0, 1] as const,
} as const;

export const iconSize = { sm: 16, md: 20, lg: 24, xl: 32 } as const;

/** Colour choices for custom activity tiles (Settings → Activities). */
export const activitySwatches = [
  '#7EFF00',
  '#2ECC71',
  '#14B8A6',
  '#38BDF8',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#FF4D5E',
  '#FF8A00',
  '#FFB020',
  '#A3A3A3',
  '#64748B',
] as const;
