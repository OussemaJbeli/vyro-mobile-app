/**
 * Brand primitives from docs/template/template.png ("Main Colors" and
 * "Customize the main color"). Step 03 builds the full token system on top of these.
 */
export const brand = {
  primary: '#7EFF00',
  background: '#01070C',
  white: '#FFFFFF',
  black: '#000000',
} as const;

/** Accent presets offered in Appearance settings (AD-14). `lime` is the default. */
export const accentPresets = {
  lime: '#7EFF00',
  blue: '#3B82F6',
  purple: '#A855F7',
  orange: '#FF8A1F',
  red: '#FF4D5E',
  teal: '#14E0D0',
} as const;

export type AccentName = keyof typeof accentPresets;
export const accentNames = Object.keys(accentPresets) as AccentName[];
