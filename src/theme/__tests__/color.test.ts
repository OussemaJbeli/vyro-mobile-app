import { accentPresets, brand } from '../brand';
import { darken, hexToRgb, lighten, markShades, mix, rgbToHex, withAlpha } from '../color';

describe('colour helpers', () => {
  it('parses short and long hex', () => {
    expect(hexToRgb('#7EFF00')).toEqual({ r: 126, g: 255, b: 0 });
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('rejects invalid colours', () => {
    expect(() => hexToRgb('lime')).toThrow('Invalid hex colour');
    expect(() => hexToRgb('#12345')).toThrow();
  });

  it('round-trips through rgbToHex', () => {
    expect(rgbToHex(hexToRgb(brand.background))).toBe('#01070C');
  });

  it('mixes linearly and clamps the amount', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#000000', '#FFFFFF', 2)).toBe('#FFFFFF');
    expect(lighten('#000000', 1)).toBe('#FFFFFF');
    expect(darken('#FFFFFF', 1)).toBe('#000000');
  });

  it('builds rgba strings', () => {
    expect(withAlpha('#7EFF00', 0.35)).toBe('rgba(126, 255, 0, 0.35)');
  });

  it('derives valid mark shades for every accent preset', () => {
    for (const accent of Object.values(accentPresets)) {
      const shades = markShades(accent);
      Object.values(shades).forEach((c) => expect(c).toMatch(/^#[0-9A-F]{6}$/));
      // Deep must be darker than the accent, face highlight lighter.
      const lum = (c: string) => Object.values(hexToRgb(c)).reduce((a, b) => a + b, 0);
      expect(lum(shades.deep)).toBeLessThan(lum(accent));
      expect(lum(shades.faceEnd)).toBeGreaterThan(lum(accent));
    }
  });
});
