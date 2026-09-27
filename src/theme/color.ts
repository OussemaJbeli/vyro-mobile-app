import { brand } from './brand';

export type Rgb = { r: number; g: number; b: number };

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Parses `#RGB` or `#RRGGBB`. Throws on anything else so bad tokens fail loudly in tests. */
export function hexToRgb(hex: string): Rgb {
  const match = HEX.exec(hex.trim());
  if (!match?.[1]) throw new Error(`Invalid hex colour: ${hex}`);
  const raw = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
  const n = parseInt(raw, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const toHex2 = (v: number) => clampByte(v).toString(16).padStart(2, '0');

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`.toUpperCase();
}

/** Linear mix: amount 0 returns `a`, 1 returns `b`. */
export function mix(a: string, b: string, amount: number): string {
  const t = Math.max(0, Math.min(1, amount));
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

export const lighten = (hex: string, amount: number) => mix(hex, brand.white, amount);
export const darken = (hex: string, amount: number) => mix(hex, brand.black, amount);

/** `rgba()` string for translucent fills (glows, tinted borders). */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/** Shades used to render the V mark in any accent. Lime reproduces the supplied logo. */
export function markShades(accent: string) {
  return {
    deep: darken(accent, 0.5),
    mid: darken(accent, 0.3),
    base: accent,
    tip: lighten(accent, 0.06),
    faceStart: lighten(accent, 0.12),
    faceEnd: lighten(accent, 0.3),
    foldLine: lighten(accent, 0.6),
  };
}
