import {
  DEFAULT_UNITS,
  displayValue,
  formatPace,
  formatQuantity,
  fromCanonical,
  paceSeconds,
  roundToStep,
  roundingStep,
  toCanonical,
  unitFor,
  unitLabel,
  type UnitPrefs,
} from '../units';

const IMPERIAL: UnitPrefs = { weight: 'lb', length: 'in', distance: 'mi', speed: 'mph' };

describe('units', () => {
  it('round-trips 165 lb exactly through canonical kg', () => {
    const kg = toCanonical(165, 'lb');
    expect(kg).toBeCloseTo(74.8427, 3);
    expect(displayValue(kg, 'bodyWeight', IMPERIAL)).toBe(165);
    expect(formatQuantity(kg, 'bodyWeight', IMPERIAL)).toBe('165 lb');
  });

  it('converts every unit both ways', () => {
    for (const [v, u] of [
      [10, 'in'],
      [5, 'mi'],
      [6, 'mph'],
      [70, 'kg'],
      [12, 'percent'],
    ] as const) {
      expect(fromCanonical(toCanonical(v, u), u)).toBeCloseTo(v, 9);
    }
    expect(toCanonical(1, 'in')).toBe(2.54);
    expect(toCanonical(1, 'mi')).toBeCloseTo(1.609344, 6);
  });

  it('picks the unit per quantity kind', () => {
    expect(unitFor('load', IMPERIAL)).toBe('lb');
    expect(unitFor('height', IMPERIAL)).toBe('in');
    expect(unitFor('distance', IMPERIAL)).toBe('mi');
    expect(unitFor('speed', IMPERIAL)).toBe('mph');
    expect(unitFor('incline', IMPERIAL)).toBe('percent');
    expect(unitFor('length', DEFAULT_UNITS)).toBe('cm');
  });

  it('rounds per kind', () => {
    expect(roundingStep('load', 'kg')).toBe(0.5);
    expect(roundingStep('load', 'lb')).toBe(1);
    expect(roundingStep('length', 'in')).toBe(0.25);
    expect(roundingStep('incline', 'percent')).toBe(0.5);
    expect(roundingStep('speed', 'kmh')).toBe(0.1);
    expect(roundToStep(62.3, 0.5)).toBe(62.5);
    expect(roundToStep(0.1 + 0.2, 0.1)).toBe(0.3);
  });

  it('formats quantities with units and locale separators', () => {
    expect(formatQuantity(74.6, 'bodyWeight', DEFAULT_UNITS)).toBe('74.6 kg');
    expect(formatQuantity(62.3, 'load', DEFAULT_UNITS)).toBe('62.5 kg');
    expect(formatQuantity(8.5, 'speed', DEFAULT_UNITS)).toBe('8.5 km/h');
    expect(formatQuantity(74.6, 'bodyWeight', DEFAULT_UNITS, 'fr')).toBe('74,6 kg');
    expect(formatQuantity(3, 'incline', DEFAULT_UNITS)).toBe('3 %');
    expect(formatQuantity(180, 'height', IMPERIAL)).toBe('5′11″');
    expect(formatQuantity(9.656064, 'speed', IMPERIAL)).toBe('6 mph');
    expect(unitLabel('kmh')).toBe('km/h');
  });

  it('computes pace', () => {
    expect(paceSeconds(12, 'km')).toBe(300);
    expect(paceSeconds(0, 'km')).toBeNull();
    expect(formatPace(12, 'km')).toBe('5:00 /km');
    expect(formatPace(0, 'km')).toBe('—');
    expect(formatPace(9.656064, 'mi')).toBe('10:00 /mi');
  });
});
