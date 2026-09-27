import { hydrate, type ExecutionRows } from '../hydrate';
import { reduce } from '../reducer';
import {
  type DbChange,
  type Event as EngineEventInput,
  type ExecState,
  type SideEffect,
  type Tracking,
} from '../types';

export const T0 = Date.parse('2026-09-26T14:00:00.000Z');
export const S = 1000;
export const MIN = 60 * S;

const base = (id: string) => ({
  id,
  createdAt: '2026-09-26T14:00:00.000Z',
  updatedAt: '2026-09-26T14:00:00.000Z',
  deletedAt: null,
});

export type ExSpec = {
  sets: number;
  reps?: number | null;
  weight?: number | null;
  duration?: number | null;
  rest?: number | null;
  tracking?: Tracking;
};

export function strengthRows(specs: ExSpec[]): ExecutionRows {
  return {
    ...base('x1'),
    scheduledSessionId: null,
    templateId: null,
    type: 'gym',
    title: 'Upper Body',
    status: 'in_progress',
    outcome: null,
    startedAt: new Date(T0).toISOString(),
    endedAt: null,
    activeSeconds: null,
    pausedSeconds: null,
    plannedSnapshot: {
      schemaVersion: 1,
      templateId: null,
      name: 'Upper Body',
      type: 'gym',
      exercises: specs.map((s, i) => ({
        exerciseId: `ex${i}`,
        name: `Exercise ${i}`,
        tracking: s.tracking ?? 'weight_reps',
        orderIndex: i,
        sets: s.sets,
        targetReps: s.reps ?? null,
        targetDurationSeconds: s.duration ?? null,
        targetWeightKg: s.weight ?? null,
        restSeconds: s.rest ?? null,
        notes: null,
      })),
      intervals: [],
    },
    runtimeState: null,
    isRetroactive: false,
    perceivedEffort: null,
    distanceKm: null,
    notes: null,
    exercises: specs.map((s, i) => ({
      ...base(`se${i}`),
      executionId: 'x1',
      exerciseId: `ex${i}`,
      plannedExerciseId: `ex${i}`,
      orderIndex: i,
      plannedSets: s.sets,
      plannedReps: s.reps ?? null,
      plannedDurationSeconds: s.duration ?? null,
      plannedWeightKg: s.weight ?? null,
      plannedRestSeconds: s.rest ?? null,
      status: 'pending' as const,
      substitutionReason: null,
      notes: null,
      sets: Array.from({ length: s.sets }, (_, k) => ({
        ...base(`se${i}-s${k}`),
        sessionExerciseId: `se${i}`,
        setIndex: k,
        plannedReps: s.reps ?? null,
        plannedWeightKg: s.weight ?? null,
        plannedDurationSeconds: s.duration ?? null,
        actualReps: null,
        actualWeightKg: null,
        actualDurationSeconds: null,
        restTakenSeconds: null,
        status: 'pending' as const,
        isExtra: false,
        completedAt: null,
      })),
    })),
    intervals: [],
  };
}

/** FS §19: 5 → 6 → 8 → 6 → 9 → 5 mph over 35 minutes. */
export const FS19 = [
  { kind: 'warmup', min: 5, speed: 8.05 },
  { kind: 'run', min: 10, speed: 9.66 },
  { kind: 'sprint', min: 5, speed: 12.87 },
  { kind: 'run', min: 5, speed: 9.66 },
  { kind: 'sprint', min: 5, speed: 14.48 },
  { kind: 'cooldown', min: 5, speed: 8.05 },
] as const;

export function runningRows(): ExecutionRows {
  const rows = strengthRows([]);
  return {
    ...rows,
    type: 'running',
    title: 'Intervals 35',
    plannedSnapshot: {
      ...rows.plannedSnapshot,
      type: 'running',
      intervals: FS19.map((iv, i) => ({
        orderIndex: i,
        kind: iv.kind,
        durationSeconds: iv.min * 60,
        speedKmh: iv.speed,
        inclinePercent: 1,
        label: null,
      })),
    },
    intervals: FS19.map((iv, i) => ({
      ...base(`iv${i}`),
      executionId: 'x1',
      orderIndex: i,
      kind: iv.kind,
      label: null,
      plannedDurationSeconds: iv.min * 60,
      plannedSpeedKmh: iv.speed,
      plannedInclinePercent: 1,
      actualDurationSeconds: null,
      actualSpeedKmh: null,
      actualInclinePercent: null,
      status: 'pending' as const,
      isRepeat: false,
      startedAt: null,
      endedAt: null,
    })),
  };
}

export const start = (rows: ExecutionRows, autoRest = true) => hydrate(rows, { autoRest });

/** Applies events in order, collecting everything the runner would receive. */
export function play(state: ExecState, ...events: EngineEventInput[]) {
  const changes: DbChange[] = [];
  const effects: SideEffect[] = [];
  let caughtUp = 0;
  let s = state;
  for (const e of events) {
    const t = reduce(s, e);
    s = t.state;
    changes.push(...t.changes);
    effects.push(...t.effects);
    caughtUp += t.caughtUp;
  }
  return { state: s, changes, effects, caughtUp };
}

export const outcomeOf = (changes: DbChange[]) =>
  changes.find((c): c is Extract<DbChange, { kind: 'complete' }> => c.kind === 'complete')?.outcome;
