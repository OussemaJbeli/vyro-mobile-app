import { isAvailable, suggestAlternatives, type EngineExercise } from '../alternatives';

const ex = (id: string, over: Partial<EngineExercise> = {}): EngineExercise => ({
  id,
  primaryMuscle: 'chest',
  secondaryMuscles: ['triceps'],
  tracking: 'weight_reps',
  difficulty: 'intermediate',
  equipmentIds: [],
  archivedAt: null,
  ...over,
});

const library = [
  ex('cable_fly', { equipmentIds: ['cable'], secondaryMuscles: ['front_delts'] }),
  ex('dumbbell_fly', {
    equipmentIds: ['db', 'bench'],
    secondaryMuscles: ['front_delts'],
    difficulty: 'beginner',
  }),
  ex('pec_deck', { equipmentIds: ['pec'], secondaryMuscles: ['front_delts'] }),
  ex('push_up', {
    tracking: 'reps',
    secondaryMuscles: ['triceps', 'front_delts'],
    difficulty: 'beginner',
  }),
  ex('db_press', { equipmentIds: ['db', 'bench'], secondaryMuscles: ['triceps', 'front_delts'] }),
  ex('plank', { primaryMuscle: 'abs', tracking: 'duration' }),
  ex('old_press', { archivedAt: '2026-01-01T00:00:00.000Z' }),
];
const mappings = [
  { exerciseId: 'cable_fly', alternativeId: 'dumbbell_fly', priority: 1 },
  { exerciseId: 'cable_fly', alternativeId: 'pec_deck', priority: 2 },
];

describe('alternative engine', () => {
  it('checks availability: every required item, bodyweight always', () => {
    expect(isAvailable(library[1]!, new Set(['db']))).toBe(false);
    expect(isAvailable(library[1]!, new Set(['db', 'bench']))).toBe(true);
    expect(isAvailable(library[3]!, new Set())).toBe(true);
  });

  it('cable fly without a cable machine → dumbbell fly first (mapped), then same-muscle picks', () => {
    const result = suggestAlternatives(library[0]!, {
      available: new Set(['db', 'bench']),
      library,
      mappings,
    });
    expect(result[0]).toMatchObject({ exerciseId: 'dumbbell_fly', reason: 'mapped' });
    expect(result.map((s) => s.exerciseId)).not.toContain('pec_deck'); // no pec deck available
    expect(result.every((s) => s.exerciseId !== 'cable_fly' && s.exerciseId !== 'old_press')).toBe(
      true,
    );
    expect(result.slice(1).every((s) => s.reason === 'same_muscle')).toBe(true);
  });

  it('with no equipment at all, falls back to bodyweight', () => {
    const result = suggestAlternatives(library[0]!, { available: new Set(), library, mappings });
    expect(result).toEqual([
      expect.objectContaining({ exerciseId: 'push_up', reason: 'same_muscle' }),
    ]);
  });

  it('never mixes tracking families (a plank is not a chest press)', () => {
    const result = suggestAlternatives(library[4]!, {
      available: new Set(['db', 'bench']),
      library,
      mappings,
    });
    expect(result.map((s) => s.exerciseId)).not.toContain('plank');
  });

  it('respects the limit and is stable', () => {
    const ctx = { available: new Set(['db', 'bench', 'pec']), library, mappings };
    const a = suggestAlternatives(library[0]!, ctx, 2);
    expect(a).toHaveLength(2);
    expect(suggestAlternatives(library[0]!, ctx, 2)).toEqual(a);
  });

  it('handles cyclical mappings without loops or self-suggestions', () => {
    const cyclic = [
      { exerciseId: 'push_up', alternativeId: 'db_press', priority: 1 },
      { exerciseId: 'db_press', alternativeId: 'push_up', priority: 1 },
      { exerciseId: 'push_up', alternativeId: 'push_up', priority: 2 },
    ];
    const result = suggestAlternatives(library[3]!, {
      available: new Set(['db', 'bench']),
      library,
      mappings: cyclic,
    });
    expect(result[0]).toMatchObject({ exerciseId: 'db_press', reason: 'mapped' });
    expect(result.map((s) => s.exerciseId)).not.toContain('push_up');
  });
});
