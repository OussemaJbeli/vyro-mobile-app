/**
 * Deterministic alternative engine (step 13, FS §12, UI §16). No AI: explicit mappings
 * first, then same-muscle exercises the user can actually do with their equipment.
 */

export type EngineExercise = {
  id: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  tracking: 'weight_reps' | 'reps' | 'duration' | 'distance_duration';
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
  /** Required equipment ids; ALL are needed. Empty = bodyweight. */
  equipmentIds: string[];
  archivedAt: string | null;
};

export type AlternativeMapping = { exerciseId: string; alternativeId: string; priority: number };

export type Suggestion = {
  exerciseId: string;
  reason: 'mapped' | 'same_muscle';
  score: number;
};

export type EngineContext = {
  available: ReadonlySet<string>;
  library: readonly EngineExercise[];
  mappings: readonly AlternativeMapping[];
};

/** True when every required equipment item is available (bodyweight is always available). */
export const isAvailable = (
  e: Pick<EngineExercise, 'equipmentIds'>,
  available: ReadonlySet<string>,
) => e.equipmentIds.every((id) => available.has(id));

/** Weight+reps and reps-only are interchangeable; duration and distance are their own families. */
const family = (t: EngineExercise['tracking']) =>
  t === 'weight_reps' || t === 'reps' ? 'strength' : t;

const LEVEL = { beginner: 0, intermediate: 1, advanced: 2 } as const;

function heuristicScore(
  target: EngineExercise,
  c: EngineExercise,
  available: ReadonlySet<string>,
): number {
  const targetMuscles = new Set(target.secondaryMuscles);
  const shared = c.secondaryMuscles.filter((m) => targetMuscles.has(m)).length;
  const levelGap =
    target.difficulty && c.difficulty
      ? Math.abs(LEVEL[target.difficulty] - LEVEL[c.difficulty])
      : 1;
  const difficulty = (2 - levelGap) * 0.5;
  // Bodyweight options matter most when the user has little equipment.
  const bodyweight = c.equipmentIds.length === 0 ? (available.size <= 1 ? 1.5 : 0.5) : 0;
  return shared + difficulty + bodyweight;
}

export function suggestAlternatives(
  exercise: EngineExercise,
  ctx: EngineContext,
  limit = 3,
): Suggestion[] {
  const byId = new Map(ctx.library.map((e) => [e.id, e]));
  const usable = (e: EngineExercise | undefined): e is EngineExercise =>
    !!e && e.id !== exercise.id && !e.archivedAt && isAvailable(e, ctx.available);

  const mapped: Suggestion[] = ctx.mappings
    .filter((m) => m.exerciseId === exercise.id)
    .sort((a, b) => a.priority - b.priority)
    .map((m) => byId.get(m.alternativeId))
    .filter(usable)
    .map((e, i) => ({ exerciseId: e.id, reason: 'mapped' as const, score: 100 - i }));

  if (mapped.length >= limit) return mapped.slice(0, limit);

  const taken = new Set(mapped.map((s) => s.exerciseId));
  const heuristic: Suggestion[] = ctx.library
    .filter(
      (c) =>
        usable(c) &&
        !taken.has(c.id) &&
        c.primaryMuscle === exercise.primaryMuscle &&
        family(c.tracking) === family(exercise.tracking),
    )
    .map((c) => ({
      exerciseId: c.id,
      reason: 'same_muscle' as const,
      score: heuristicScore(exercise, c, ctx.available),
    }))
    // Stable order: best score, then id, so suggestions don't shuffle between renders.
    .sort((a, b) => b.score - a.score || a.exerciseId.localeCompare(b.exerciseId));

  return [...mapped, ...heuristic].slice(0, limit);
}
