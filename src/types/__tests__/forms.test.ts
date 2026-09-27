import {
  canonicalUnit,
  formatTarget,
  toCanonicalTarget,
  toDisplayTarget,
} from '@/components/goals/goalUnits';
import { type Goal } from '@/types/domain';
import { DEFAULT_UNITS, type UnitPrefs } from '@/utils/units';

import { goalFormSchema, isRealDate, profileFormSchema } from '../forms';

const IMPERIAL: UnitPrefs = { weight: 'lb', length: 'in', distance: 'mi', speed: 'mph' };
const valid = {
  type: 'weight' as const,
  title: 'Reach 70 kg',
  target: '70',
  start: '74.6',
  measurementTypeId: null,
  startDate: '2026-09-24',
  targetDate: '',
  notes: '',
};

describe('form schemas', () => {
  it('validates real calendar dates only', () => {
    expect(isRealDate('2026-02-28')).toBe(true);
    expect(isRealDate('2026-02-30')).toBe(false);
    expect(isRealDate('26-2-3')).toBe(false);
  });

  it('checks profile fields', () => {
    expect(
      profileFormSchema.safeParse({ name: '', height: '', dateOfBirth: '', weekStartsOn: 1 })
        .success,
    ).toBe(true);
    expect(
      profileFormSchema.safeParse({ name: '', height: 'abc', dateOfBirth: '', weekStartsOn: 1 })
        .success,
    ).toBe(false);
    expect(
      profileFormSchema.safeParse({
        name: '',
        height: '180',
        dateOfBirth: '1990-13-01',
        weekStartsOn: 0,
      }).success,
    ).toBe(false);
  });

  it('requires targets for numeric goals, not for muscle/custom goals', () => {
    expect(goalFormSchema.safeParse(valid).success).toBe(true);
    expect(goalFormSchema.safeParse({ ...valid, target: '' }).success).toBe(false);
    expect(goalFormSchema.safeParse({ ...valid, type: 'muscle', target: '' }).success).toBe(true);
    expect(goalFormSchema.safeParse({ ...valid, type: 'custom', target: '' }).success).toBe(true);
    expect(goalFormSchema.safeParse({ ...valid, title: '  ' }).success).toBe(false);
  });

  it('needs a measurement type and a target date after the start', () => {
    expect(goalFormSchema.safeParse({ ...valid, type: 'measurement' }).success).toBe(false);
    expect(goalFormSchema.safeParse({ ...valid, targetDate: '2026-09-01' }).success).toBe(false);
    expect(goalFormSchema.safeParse({ ...valid, targetDate: '2026-12-01' }).success).toBe(true);
  });
});

describe('goal units', () => {
  it('stores canonical targets and shows them in the user units', () => {
    expect(toCanonicalTarget(154, 'weight', IMPERIAL)).toBeCloseTo(69.85, 2);
    expect(toDisplayTarget(69.853168, 'weight', IMPERIAL)).toBe(154);
    expect(toCanonicalTarget(12, 'running', IMPERIAL)).toBeCloseTo(19.31, 2);
    expect(toCanonicalTarget(4, 'frequency', IMPERIAL)).toBe(4);
    expect(canonicalUnit('weight')).toBe('kg');
    expect(canonicalUnit('muscle')).toBeNull();
    const goal = { type: 'weight', targetValue: 70 } as Goal;
    expect(formatTarget(goal, DEFAULT_UNITS)).toBe('70 kg');
    expect(formatTarget(goal, IMPERIAL)).toBe('154.3 lb');
  });
});
