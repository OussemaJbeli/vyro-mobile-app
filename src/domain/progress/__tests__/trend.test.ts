import { bmi, changes, rate28, smooth, weeklyChange } from '../trend';

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-26T08:00:00Z');
const at = (daysAgo: number, value: number) => ({ t: NOW - daysAgo * DAY, value });

describe('trend', () => {
  // Losing 0.1 kg/day with ±0.4 kg daily noise.
  const noisy = Array.from({ length: 28 }, (_, i) =>
    at(27 - i, 80 - 0.1 * i + (i % 2 === 0 ? 0.4 : -0.4)),
  );

  it('smoothing follows the trend and damps noise and a single outlier', () => {
    const s = smooth(noisy);
    const last = s.at(-1)!;
    expect(Math.abs(last.smooth - 77.3)).toBeLessThan(0.8);
    const spike = smooth([...noisy.slice(0, -1), at(0, 90)]).at(-1)!;
    expect(spike.smooth - last.smooth).toBeLessThan(4); // a 12 kg outlier moves the line < 4 kg
  });

  it('a long gap lets the next reading count almost fully', () => {
    const s = smooth([at(40, 80), at(0, 75)]);
    expect(s.at(-1)!.smooth).toBeCloseTo(75, 0);
  });

  it('weekly change needs ≥ 3 readings in 14 days', () => {
    expect(weeklyChange([at(20, 80), at(1, 79), at(0, 78.8)], NOW)).toBeNull();
    const w = weeklyChange(noisy, NOW)!;
    expect(w).toBeLessThan(0);
    expect(w).toBeGreaterThan(-1.2);
  });

  it('28-day rate is a regression slope, flagged when insufficient', () => {
    const r = rate28(noisy, NOW);
    expect(r.insufficient).toBe(false);
    expect(r.perWeek!).toBeCloseTo(-0.7, 0);
    expect(rate28([at(5, 80), at(3, 79), at(2, 79), at(0, 78)], NOW)).toEqual({
      perWeek: null,
      insufficient: true,
    });
    expect(rate28(noisy.slice(-3), NOW).insufficient).toBe(true);
  });

  it('values are canonical kg, so a display unit switch changes nothing', () => {
    const kg = weeklyChange(noisy, NOW)!;
    const lbDisplay = kg * 2.20462;
    expect(lbDisplay / 2.20462).toBeCloseTo(kg, 10);
  });

  it('BMI and measurement changes', () => {
    expect(bmi(74.6, 180)).toBeCloseTo(23.0, 1);
    expect(bmi(74.6, null)).toBeNull();
    expect(changes([at(30, 40), at(10, 39), at(0, 38.5)])).toEqual({
      sincePrevious: -0.5,
      sinceFirst: -1.5,
    });
    expect(changes([at(0, 38)])).toEqual({ sincePrevious: null, sinceFirst: null });
  });
});
