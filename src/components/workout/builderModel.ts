/**
 * Workout builder model (step 14): form state as typed text, conversion to the template
 * input the repository stores, validation, and the live duration estimate.
 */
import { estimateMinutes, type DurationItem } from '@/domain/workouts/duration';
import { type TemplateDetail, type TemplateInput } from '@/hooks/data';
import { type Exercise } from '@/types/domain';
import { type TemplateType } from '@/types/enums';
import { newId } from '@/utils/id';
import { fromCanonical, roundToStep, toCanonical, type UnitPrefs } from '@/utils/units';

export type BuilderItem = {
  key: string;
  exerciseId: string;
  sets: string;
  reps: string;
  duration: string;
  /** In the user's weight unit. */
  weight: string;
  rest: string;
  notes: string;
};

export type BuilderState = {
  name: string;
  type: Exclude<TemplateType, 'running'>;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
  coverKey: string | null;
  /** null = use the estimate. */
  durationOverride: number | null;
  items: BuilderItem[];
};

export type BuilderErrors = { name?: true; exercises?: true; targets?: string[] };

type ExerciseLike = Pick<
  Exercise,
  | 'id'
  | 'tracking'
  | 'defaultSets'
  | 'defaultReps'
  | 'defaultDurationSeconds'
  | 'defaultRestSeconds'
>;

const int = (v: string): number | null => {
  const n = Number(v.trim().replace(',', '.'));
  return v.trim() === '' || !Number.isFinite(n) ? null : Math.round(n);
};
const num = (v: string): number | null => {
  const n = Number(v.trim().replace(',', '.'));
  return v.trim() === '' || !Number.isFinite(n) ? null : n;
};

export const usesDuration = (tracking: Exercise['tracking']) =>
  tracking === 'duration' || tracking === 'distance_duration';

export function emptyState(type: BuilderState['type'] = 'gym'): BuilderState {
  return {
    name: '',
    type,
    description: '',
    difficulty: 'intermediate',
    coverKey: null,
    durationOverride: null,
    items: [],
  };
}

/** New builder item from an exercise's defaults (settings default rest as fallback). */
export function itemFromExercise(ex: ExerciseLike, defaultRest: number): BuilderItem {
  const duration = usesDuration(ex.tracking);
  return {
    key: newId(),
    exerciseId: ex.id,
    sets: String(ex.defaultSets ?? 3),
    reps: duration ? '' : String(ex.defaultReps ?? 10),
    duration: duration ? String(ex.defaultDurationSeconds ?? 30) : '',
    weight: '',
    rest: String(ex.defaultRestSeconds ?? defaultRest),
    notes: '',
  };
}

export function stateFromTemplate(tpl: TemplateDetail, units: UnitPrefs): BuilderState {
  return {
    name: tpl.name,
    type: tpl.type === 'running' ? 'other' : tpl.type,
    description: tpl.description ?? '',
    difficulty: tpl.difficulty,
    coverKey: tpl.coverKey,
    durationOverride: null,
    items: tpl.exercises.map((e) => ({
      key: e.id,
      exerciseId: e.exerciseId,
      sets: String(e.sets),
      reps: e.targetReps?.toString() ?? '',
      duration: e.targetDurationSeconds?.toString() ?? '',
      weight:
        e.targetWeightKg == null
          ? ''
          : String(roundToStep(fromCanonical(e.targetWeightKg, units.weight), 0.5)),
      rest: e.restSeconds?.toString() ?? '',
      notes: e.notes ?? '',
    })),
  };
}

export function durationItems(
  state: BuilderState,
  tracking: (id: string) => Exercise['tracking'] | undefined,
): DurationItem[] {
  return state.items.map((i) => {
    const d = usesDuration(tracking(i.exerciseId) ?? 'weight_reps');
    return {
      sets: int(i.sets) ?? 1,
      targetReps: d ? null : int(i.reps),
      targetDurationSeconds: d ? int(i.duration) : null,
      restSeconds: int(i.rest),
    };
  });
}

export function validate(
  state: BuilderState,
  tracking: (id: string) => Exercise['tracking'] | undefined,
): BuilderErrors {
  const errors: BuilderErrors = {};
  if (!state.name.trim()) errors.name = true;
  if (state.items.length === 0) errors.exercises = true;
  const bad = state.items
    .filter((i) => {
      const d = usesDuration(tracking(i.exerciseId) ?? 'weight_reps');
      const sets = int(i.sets);
      const target = d ? int(i.duration) : int(i.reps);
      return !sets || sets < 1 || !target || target < 1;
    })
    .map((i) => i.key);
  if (bad.length) errors.targets = bad;
  return errors;
}

export const isValid = (e: BuilderErrors) => !e.name && !e.exercises && !e.targets?.length;

export function toTemplateInput(
  state: BuilderState,
  units: UnitPrefs,
  tracking: (id: string) => Exercise['tracking'] | undefined,
): TemplateInput {
  const estimate = estimateMinutes(durationItems(state, tracking));
  return {
    name: state.name.trim(),
    type: state.type,
    description: state.description.trim() || null,
    durationMinutes: state.durationOverride ?? (estimate || null),
    difficulty: state.difficulty,
    coverKey: state.coverKey,
    distanceTargetKm: null,
    notes: null,
    exercises: state.items.map((i) => {
      const d = usesDuration(tracking(i.exerciseId) ?? 'weight_reps');
      const weight = num(i.weight);
      return {
        exerciseId: i.exerciseId,
        sets: Math.max(1, int(i.sets) ?? 1),
        targetReps: d ? null : int(i.reps),
        targetDurationSeconds: d ? int(i.duration) : null,
        targetWeightKg:
          weight && weight > 0 ? Math.round(toCanonical(weight, units.weight) * 100) / 100 : null,
        restSeconds: int(i.rest),
        supersetGroup: null,
        notes: i.notes.trim() || null,
      };
    }),
  };
}

export function moveItem(items: BuilderItem[], index: number, dir: -1 | 1): BuilderItem[] {
  const to = index + dir;
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [x] = next.splice(index, 1);
  next.splice(to, 0, x!);
  return next;
}
