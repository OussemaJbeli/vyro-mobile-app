/**
 * Workout duration estimate (step 14). Deliberately simple and explainable:
 * work time per set (≈3 s per rep, or the set duration) + rest between sets
 * + about a minute per exercise for setup and transitions.
 */
export type DurationItem = {
  sets: number;
  targetReps: number | null;
  targetDurationSeconds: number | null;
  restSeconds: number | null;
};

export const SECONDS_PER_REP = 3;
export const TRANSITION_SECONDS = 60;

export function estimateSeconds(items: readonly DurationItem[]): number {
  return items.reduce((total, e) => {
    const sets = Math.max(1, e.sets);
    const work = e.targetDurationSeconds ?? (e.targetReps ?? 10) * SECONDS_PER_REP;
    // Rest happens between sets, not after the last one.
    const rest = (e.restSeconds ?? 0) * (sets - 1);
    return total + sets * work + rest + TRANSITION_SECONDS;
  }, 0);
}

/** Rounded to whole minutes, at least 1 for a non-empty workout. */
export function estimateMinutes(items: readonly DurationItem[]): number {
  if (items.length === 0) return 0;
  return Math.max(1, Math.round(estimateSeconds(items) / 60));
}
