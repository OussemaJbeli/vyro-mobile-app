/**
 * Execution engine types (step 17, AD-10, AD-11). Times are epoch milliseconds; the
 * "active clock" is elapsed time excluding pauses, so pausing never eats rest or intervals.
 */
export type Tracking = 'weight_reps' | 'reps' | 'duration' | 'distance_duration';
export type IntervalKind = 'warmup' | 'run' | 'walk' | 'sprint' | 'recovery' | 'cooldown';

export type ExecSet = {
  id: string;
  index: number;
  plannedReps: number | null;
  plannedWeightKg: number | null;
  plannedDurationSeconds: number | null;
  actualReps: number | null;
  actualWeightKg: number | null;
  actualDurationSeconds: number | null;
  restTakenSeconds: number | null;
  status: 'pending' | 'done' | 'skipped';
  isExtra: boolean;
  completedAt: number | null;
};

export type ExecExercise = {
  id: string; // session_exercises.id
  exerciseId: string;
  plannedExerciseId: string | null;
  tracking: Tracking;
  restSeconds: number | null;
  status: 'pending' | 'active' | 'done' | 'skipped';
  substitutionReason: string | null;
  sets: ExecSet[];
};

export type ExecInterval = {
  id: string; // running_interval_logs.id
  kind: IntervalKind;
  label: string | null;
  plannedDurationSeconds: number;
  plannedSpeedKmh: number | null;
  plannedInclinePercent: number | null;
  /** Target for this run of the interval (planned ± adjustments). */
  targetSeconds: number;
  actualDurationSeconds: number | null;
  actualSpeedKmh: number | null;
  actualInclinePercent: number | null;
  status: 'pending' | 'done' | 'partial' | 'skipped';
  isRepeat: boolean;
  startedAt: number | null;
  endedAt: number | null;
};

export type ExecState = {
  schemaVersion: 1;
  executionId: string;
  /** From the execution row (not part of runtime_state). */
  title: string;
  kind: 'strength' | 'running';
  lifecycle: 'active' | 'paused' | 'completed' | 'abandoned';
  startedAt: number;
  pausedAt: number | null;
  accumulatedPauseMs: number;
  autoRest: boolean;
  /** Circuit mode (home/abs): advance through exercises before sets, shown as rounds. */
  circuit: boolean;
  // strength
  exercises: ExecExercise[];
  cursor: { exercise: number; set: number } | null;
  phase: 'working' | 'resting' | 'all_done';
  rest: { startActiveMs: number; durationMs: number; forSetId: string } | null;
  workTimer: { startActiveMs: number; targetMs: number } | null;
  // running
  intervals: ExecInterval[];
  /** Running interval in progress; `startedAt` is wall-clock, written to the row when it closes. */
  current: { index: number; startActiveMs: number; startedAt: number } | null;
};

export type Outcome = 'as_planned' | 'modified' | 'partial';

export type Event =
  | {
      type: 'COMPLETE_SET';
      now: number;
      reps?: number | null;
      weightKg?: number | null;
      durationSeconds?: number | null;
    }
  | {
      type: 'EDIT_SET';
      now: number;
      setId: string;
      reps?: number | null;
      weightKg?: number | null;
      durationSeconds?: number | null;
    }
  | { type: 'SKIP_SET'; now: number }
  | { type: 'ADD_SET'; now: number; id: string }
  | { type: 'SKIP_EXERCISE'; now: number }
  | {
      type: 'SUBSTITUTE_EXERCISE';
      now: number;
      exerciseId: string;
      tracking: Tracking;
      reason: string | null;
      /** Defaults to the current exercise (pre-start swaps target any pending one). */
      exerciseIndex?: number;
    }
  | { type: 'JUMP_TO_EXERCISE'; now: number; index: number }
  | { type: 'REORDER_REMAINING'; now: number; order: string[] }
  | {
      type: 'ADD_EXERCISE';
      now: number;
      id: string;
      exerciseId: string;
      tracking: Tracking;
      restSeconds: number | null;
      sets: {
        id: string;
        reps: number | null;
        weightKg: number | null;
        durationSeconds: number | null;
      }[];
    }
  | { type: 'SET_CIRCUIT'; now: number; on: boolean }
  | { type: 'REST_SKIP'; now: number }
  | { type: 'REST_ADJUST'; now: number; deltaMs: number }
  | { type: 'START_WORK_TIMER'; now: number }
  | { type: 'STOP_WORK_TIMER'; now: number }
  | { type: 'INTERVAL_NEXT'; now: number }
  | { type: 'INTERVAL_REPEAT'; now: number; id: string }
  | { type: 'INTERVAL_ADJUST_SPEED'; now: number; speedKmh: number }
  | { type: 'INTERVAL_ADJUST_INCLINE'; now: number; inclinePercent: number }
  | { type: 'INTERVAL_ADJUST_DURATION'; now: number; deltaSeconds: number }
  | { type: 'SKIP_COUNTDOWN'; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'FINISH' | 'FINISH_EARLY'; now: number }
  | { type: 'ABANDON'; now: number };

/** Database writes, applied by the runner in ONE transaction with the runtime state. */
export type DbChange =
  | { kind: 'set'; id: string; patch: Partial<Omit<ExecSet, 'id' | 'index' | 'isExtra'>> }
  | { kind: 'insertSet'; exerciseRowId: string; set: ExecSet }
  | {
      kind: 'exercise';
      id: string;
      patch: Partial<Pick<ExecExercise, 'status' | 'exerciseId' | 'substitutionReason'>>;
    }
  | { kind: 'insertExercise'; exercise: ExecExercise; orderIndex: number }
  | { kind: 'reorderExercises'; ids: string[] }
  | {
      kind: 'interval';
      id: string;
      patch: Partial<Omit<ExecInterval, 'id' | 'isRepeat' | 'targetSeconds'>>;
    }
  | { kind: 'insertInterval'; interval: ExecInterval; orderIndex: number }
  | { kind: 'reorderIntervals'; ids: string[] }
  | {
      kind: 'complete';
      outcome: Outcome;
      /** Running: estimated Σ speed × duration; null for strength. */
      distanceKm: number | null;
      endedAt: number;
      activeSeconds: number;
      pausedSeconds: number;
    }
  | { kind: 'abandon'; endedAt: number };

export type SideEffect =
  { kind: 'haptic'; style: 'tap' | 'success' | 'warning' } | { kind: 'keepAwake'; on: boolean };

/**
 * `state` is the same reference when nothing changed (nothing to persist).
 * `caughtUp` counts intervals auto-completed by one settle beyond the first (resume banner).
 */
export type Transition = {
  state: ExecState;
  changes: DbChange[];
  effects: SideEffect[];
  caughtUp: number;
};
