import { type ExecState, type Outcome } from './types';

export const REPS_TOLERANCE = 0.1;
export const DURATION_TOLERANCE = 0.15;

const within = (actual: number | null, planned: number | null, tol: number) =>
  planned === null || actual === null || Math.abs(actual - planned) <= planned * tol + 1e-9;
const same = (actual: number | null, planned: number | null) =>
  planned === null || actual === null || Math.abs(actual - planned) < 1e-6;

/**
 * FS §14 outcome of a closed execution:
 * - partial: planned work skipped or finished early (or nothing done at all);
 * - modified: all done, but substitutions, extras, changed load/speed or out of tolerance;
 * - as_planned: otherwise.
 */
export function deriveOutcome(s: ExecState): Outcome {
  if (s.kind === 'running') {
    const planned = s.intervals.filter((i) => !i.isRepeat);
    if (!planned.length || planned.some((i) => i.status !== 'done')) return 'partial';
    const modified =
      s.intervals.some((i) => i.isRepeat) ||
      s.intervals.some(
        (i) =>
          !within(i.actualDurationSeconds, i.plannedDurationSeconds, DURATION_TOLERANCE) ||
          !same(i.actualSpeedKmh, i.plannedSpeedKmh) ||
          !same(i.actualInclinePercent, i.plannedInclinePercent),
      );
    return modified ? 'modified' : 'as_planned';
  }
  const sets = s.exercises.flatMap((e) => e.sets);
  if (!sets.some((x) => x.status === 'done')) return 'partial';
  if (sets.some((x) => !x.isExtra && x.status !== 'done')) return 'partial';
  const modified =
    s.exercises.some((e) => e.plannedExerciseId === null || e.exerciseId !== e.plannedExerciseId) ||
    sets.some((x) => x.isExtra && x.status === 'done') ||
    sets.some(
      (x) =>
        !x.isExtra &&
        (!within(x.actualReps, x.plannedReps, REPS_TOLERANCE) ||
          !same(x.actualWeightKg, x.plannedWeightKg) ||
          !within(x.actualDurationSeconds, x.plannedDurationSeconds, DURATION_TOLERANCE)),
    );
  return modified ? 'modified' : 'as_planned';
}
