/**
 * Personal records (step 24): heaviest weight (reps ≥ 1), best estimated 1RM (Epley:
 * w × (1 + reps / 30), labelled "estimated"), most reps (bodyweight or at the heaviest
 * weight), longest hold. Running: longest duration, highest average speed.
 */
export type RecordSet = {
  exerciseId: string;
  executionId: string;
  date: string;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
};

export type ExerciseRecords = {
  exerciseId: string;
  heaviestKg: number | null;
  best1RmKg: number | null;
  mostReps: number | null;
  longestSeconds: number | null;
  /** executionId → which records it set (for "PRs achieved" badges). */
  setIn: Record<string, ('weight' | '1rm' | 'reps' | 'hold')[]>;
};

export const epley = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));

export function exerciseRecords(sets: readonly RecordSet[]): ExerciseRecords[] {
  const by = new Map<string, RecordSet[]>();
  for (const s of sets) by.set(s.exerciseId, [...(by.get(s.exerciseId) ?? []), s]);
  return [...by.entries()].map(([exerciseId, list]) => {
    const chrono = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const r: ExerciseRecords = {
      exerciseId,
      heaviestKg: null,
      best1RmKg: null,
      mostReps: null,
      longestSeconds: null,
      setIn: {},
    };
    const mark = (id: string, k: 'weight' | '1rm' | 'reps' | 'hold') => {
      const arr = (r.setIn[id] ??= []);
      if (!arr.includes(k)) arr.push(k);
    };
    for (const s of chrono) {
      const reps = s.reps ?? 0;
      if (s.weightKg && reps >= 1) {
        if (r.heaviestKg === null || s.weightKg > r.heaviestKg) {
          r.heaviestKg = s.weightKg;
          mark(s.executionId, 'weight');
        }
        const e = epley(s.weightKg, reps);
        if (r.best1RmKg === null || e > r.best1RmKg + 1e-9) {
          r.best1RmKg = e;
          mark(s.executionId, '1rm');
        }
      } else if (reps > 0 && (r.mostReps === null || reps > r.mostReps)) {
        r.mostReps = reps;
        mark(s.executionId, 'reps');
      }
      if (
        s.durationSeconds &&
        (r.longestSeconds === null || s.durationSeconds > r.longestSeconds)
      ) {
        r.longestSeconds = s.durationSeconds;
        mark(s.executionId, 'hold');
      }
    }
    // The first session is a baseline, not a record.
    const first = chrono[0]?.executionId;
    if (first) delete r.setIn[first];
    return r;
  });
}

export function runningRecords(
  runs: readonly { executionId: string; activeSeconds: number | null; distanceKm: number | null }[],
) {
  let longest: { executionId: string; seconds: number } | null = null;
  let fastest: { executionId: string; kmh: number } | null = null;
  for (const r of runs) {
    const sec = r.activeSeconds ?? 0;
    if (sec > 0 && (!longest || sec > longest.seconds))
      longest = { executionId: r.executionId, seconds: sec };
    if (sec > 0 && r.distanceKm) {
      const kmh = r.distanceKm / (sec / 3600);
      if (!fastest || kmh > fastest.kmh) fastest = { executionId: r.executionId, kmh };
    }
  }
  return { longest, fastest };
}
