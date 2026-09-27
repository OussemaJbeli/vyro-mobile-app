import { DEFAULT_UNITS, type UnitPrefs } from '@/utils/units';

import {
  emptyState,
  isValid,
  itemFromExercise,
  moveItem,
  toTemplateInput,
  validate,
  type BuilderState,
} from '../builderModel';

const TRACKING: Record<string, 'weight_reps' | 'reps' | 'duration'> = {
  bench: 'weight_reps',
  plank: 'duration',
};
const tracking = (id: string) => TRACKING[id];
const bench = {
  id: 'bench',
  tracking: 'weight_reps' as const,
  defaultSets: 4,
  defaultReps: 10,
  defaultDurationSeconds: null,
  defaultRestSeconds: 90,
};
const plank = {
  id: 'plank',
  tracking: 'duration' as const,
  defaultSets: 3,
  defaultReps: null,
  defaultDurationSeconds: 45,
  defaultRestSeconds: null,
};

describe('builder model', () => {
  it('creates items from exercise defaults, with the settings rest as fallback', () => {
    expect(itemFromExercise(bench, 60)).toMatchObject({
      sets: '4',
      reps: '10',
      duration: '',
      rest: '90',
    });
    expect(itemFromExercise(plank, 60)).toMatchObject({
      sets: '3',
      reps: '',
      duration: '45',
      rest: '60',
    });
  });

  it('validates name, exercise count and per-item targets', () => {
    const s = emptyState();
    expect(validate(s, tracking)).toEqual({ name: true, exercises: true });
    const item = { ...itemFromExercise(bench, 60), reps: '' };
    const e = validate({ ...s, name: 'Upper', items: [item] }, tracking);
    expect(e.targets).toEqual([item.key]);
    expect(
      isValid(validate({ ...s, name: 'Upper', items: [itemFromExercise(bench, 60)] }, tracking)),
    ).toBe(true);
  });

  it('converts to canonical template input (lb → kg, estimate or override)', () => {
    const imperial: UnitPrefs = { ...DEFAULT_UNITS, weight: 'lb' };
    const state: BuilderState = {
      ...emptyState('gym'),
      name: '  Upper  ',
      items: [{ ...itemFromExercise(bench, 60), weight: '135' }, itemFromExercise(plank, 60)],
    };
    const input = toTemplateInput(state, imperial, tracking);
    expect(input.name).toBe('Upper');
    expect(input.exercises?.[0]).toMatchObject({
      sets: 4,
      targetReps: 10,
      targetDurationSeconds: null,
      targetWeightKg: 61.23,
    });
    expect(input.exercises?.[1]).toMatchObject({
      targetReps: null,
      targetDurationSeconds: 45,
      targetWeightKg: null,
    });
    // Bench 450 s + plank (3×45 + 2×60 rest + 60) 315 s = 765 s ≈ 13 min.
    expect(input.durationMinutes).toBe(13);
    expect(
      toTemplateInput({ ...state, durationOverride: 50 }, imperial, tracking).durationMinutes,
    ).toBe(50);
  });

  it('moves items within bounds', () => {
    const a = itemFromExercise(bench, 60);
    const b = itemFromExercise(plank, 60);
    expect(moveItem([a, b], 0, 1)).toEqual([b, a]);
    expect(moveItem([a, b], 0, -1)).toEqual([a, b]);
  });
});
