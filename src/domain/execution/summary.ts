import { type ExecExercise, type ExecState } from './types';

/** Top set of the most recent completed session with this exercise ("Last time 60×10"). */
export type LastPerformance = {
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
};

export type Prefill = { reps: number; weightKg: number; durationSeconds: number };

/**
 * Stepper values for a set (FS §76, one tap in the common case): planned target →
 * the previous logged set of this session → last time → exercise defaults.
 */
export function prefill(
  ex: ExecExercise,
  setIndex: number,
  last: LastPerformance | undefined,
  defaults: { reps: number | null; durationSeconds: number | null },
): Prefill {
  const set = ex.sets[setIndex];
  const prev = ex.sets
    .slice(0, setIndex)
    .reverse()
    .find((s) => s.status === 'done');
  return {
    reps: set?.plannedReps ?? prev?.actualReps ?? last?.reps ?? defaults.reps ?? 10,
    weightKg: set?.plannedWeightKg ?? prev?.actualWeightKg ?? last?.weightKg ?? 0,
    durationSeconds:
      set?.plannedDurationSeconds ??
      prev?.actualDurationSeconds ??
      last?.durationSeconds ??
      defaults.durationSeconds ??
      30,
  };
}

export type Summary = {
  doneSets: number;
  plannedSets: number;
  /** Σ reps × kg over logged sets (canonical kg). */
  volumeKg: number;
  exercisesDone: number;
  exercisesTotal: number;
};

export function summarize(s: ExecState): Summary {
  const sets = s.exercises.flatMap((e) => e.sets);
  const done = sets.filter((x) => x.status === 'done');
  return {
    doneSets: done.length,
    plannedSets: sets.filter((x) => !x.isExtra).length,
    volumeKg: done.reduce((v, x) => v + (x.actualReps ?? 0) * (x.actualWeightKg ?? 0), 0),
    exercisesDone: s.exercises.filter((e) => e.sets.some((x) => x.status === 'done')).length,
    exercisesTotal: s.exercises.length,
  };
}

export type SetsSummary = {
  sets: number;
  reps: number[];
  weightsKg: number[];
  durationsSeconds: number[];
};

export type ExerciseDiff = {
  id: string;
  exerciseId: string;
  /** Set when the performed exercise differs from the planned one. */
  plannedExerciseId: string | null;
  substituted: boolean;
  added: boolean;
  skipped: boolean;
  planned: SetsSummary;
  actual: SetsSummary;
  changed: boolean;
};

const nums = (xs: (number | null)[]) => xs.filter((x): x is number => x !== null);

/** Planned vs actual per exercise for the completion screen and history (FS §14). */
export function plannedVsActual(s: ExecState): ExerciseDiff[] {
  return s.exercises.map((e) => {
    const plannedSets = e.sets.filter((x) => !x.isExtra);
    const done = e.sets.filter((x) => x.status === 'done');
    const planned: SetsSummary = {
      sets: plannedSets.length,
      reps: nums(plannedSets.map((x) => x.plannedReps)),
      weightsKg: nums(plannedSets.map((x) => x.plannedWeightKg)),
      durationsSeconds: nums(plannedSets.map((x) => x.plannedDurationSeconds)),
    };
    const actual: SetsSummary = {
      sets: done.length,
      reps: nums(done.map((x) => x.actualReps)),
      weightsKg: nums(done.map((x) => x.actualWeightKg)),
      durationsSeconds: nums(done.map((x) => x.actualDurationSeconds)),
    };
    const added = e.plannedExerciseId === null;
    const substituted = !added && e.exerciseId !== e.plannedExerciseId;
    const skipped = done.length === 0;
    const differs = (a: number[], b: number[]) =>
      b.length > 0 && (a.length !== b.length || a.some((v, i) => Math.abs(v - b[i]!) > 1e-6));
    const changed =
      added ||
      substituted ||
      actual.sets !== planned.sets ||
      differs(actual.reps, planned.reps) ||
      differs(actual.weightsKg, planned.weightsKg) ||
      differs(actual.durationsSeconds, planned.durationsSeconds);
    return {
      id: e.id,
      exerciseId: e.exerciseId,
      plannedExerciseId: e.plannedExerciseId,
      substituted,
      added,
      skipped,
      planned,
      actual,
      changed,
    };
  });
}

/** Circuit progress: the lowest round with pending work. */
export function roundOf(s: ExecState): { round: number; rounds: number } {
  const rounds = s.exercises.reduce((m, e) => Math.max(m, e.sets.length), 0);
  const pending = s.exercises
    .filter((e) => e.status !== 'skipped')
    .map((e) => e.sets.findIndex((x) => x.status === 'pending'))
    .filter((i) => i >= 0);
  return { round: pending.length ? Math.min(...pending) + 1 : rounds, rounds };
}

export type RunSummary = {
  /** Σ actual durations of run intervals (s). */
  totalSeconds: number;
  /** Estimated Σ speed × duration (km). */
  distanceKm: number;
  /** Distance / time (km/h), 0 when nothing ran. */
  avgSpeedKmh: number;
  intervalsDone: number;
  intervalsTotal: number;
};

/** Running totals from the actual interval logs (speed falls back to planned). */
export function runSummary(s: ExecState): RunSummary {
  let seconds = 0;
  let km = 0;
  for (const iv of s.intervals) {
    const d = iv.actualDurationSeconds ?? 0;
    seconds += d;
    km += ((iv.actualSpeedKmh ?? iv.plannedSpeedKmh ?? 0) * d) / 3600;
  }
  return {
    totalSeconds: seconds,
    distanceKm: km,
    avgSpeedKmh: seconds > 0 ? km / (seconds / 3600) : 0,
    intervalsDone: s.intervals.filter((i) => i.status === 'done' || i.status === 'partial').length,
    intervalsTotal: s.intervals.length,
  };
}
