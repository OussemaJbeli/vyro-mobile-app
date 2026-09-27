import {
  runtimeStateSchema,
  type ExerciseSet,
  type IntervalLog,
  type RuntimeState,
  type SessionExecution,
  type SessionExercise,
} from '@/types/domain';

import { nextCursor } from './strength';
import { type ExecState, type Tracking } from './types';

export type ExecutionRows = SessionExecution & {
  exercises: (SessionExercise & { sets: ExerciseSet[] })[];
  intervals: IntervalLog[];
};

const ms = (iso: string | null) => (iso === null ? null : Date.parse(iso));

/**
 * Rebuilds the engine state from the actual rows plus `runtime_state` (crash-safe resume).
 * Without a valid runtime state (fresh start or unreadable), a new one is derived.
 */
export function hydrate(rows: ExecutionRows, opts: { autoRest: boolean }): ExecState {
  const circuitByDefault = rows.type === 'home' || rows.type === 'abs';
  const parsed = runtimeStateSchema.safeParse(rows.runtimeState);
  const rt = parsed.success ? parsed.data : null;
  const kind = rows.type === 'running' ? 'running' : 'strength';
  const snapshotTracking = new Map<number, Tracking>(
    rows.plannedSnapshot.exercises.map((e) => [e.orderIndex, e.tracking]),
  );
  const exercises = rows.exercises.map((e) => ({
    id: e.id,
    exerciseId: e.exerciseId,
    plannedExerciseId: e.plannedExerciseId,
    tracking: rt?.tracking[e.id] ?? snapshotTracking.get(e.orderIndex) ?? 'weight_reps',
    restSeconds: e.plannedRestSeconds,
    status: e.status,
    substitutionReason: e.substitutionReason,
    sets: e.sets.map((s) => ({
      id: s.id,
      index: s.setIndex,
      plannedReps: s.plannedReps,
      plannedWeightKg: s.plannedWeightKg,
      plannedDurationSeconds: s.plannedDurationSeconds,
      actualReps: s.actualReps,
      actualWeightKg: s.actualWeightKg,
      actualDurationSeconds: s.actualDurationSeconds,
      restTakenSeconds: s.restTakenSeconds,
      status: s.status,
      isExtra: s.isExtra,
      completedAt: ms(s.completedAt),
    })),
  }));
  const intervals = rows.intervals.map((iv) => {
    const planned = iv.plannedDurationSeconds ?? 60;
    return {
      id: iv.id,
      kind: iv.kind,
      label: iv.label,
      plannedDurationSeconds: planned,
      plannedSpeedKmh: iv.plannedSpeedKmh,
      plannedInclinePercent: iv.plannedInclinePercent,
      targetSeconds: rt?.targets[iv.id] ?? planned,
      actualDurationSeconds: iv.actualDurationSeconds,
      actualSpeedKmh: iv.actualSpeedKmh,
      actualInclinePercent: iv.actualInclinePercent,
      status: iv.status,
      isRepeat: iv.isRepeat,
      startedAt: ms(iv.startedAt),
      endedAt: ms(iv.endedAt),
    };
  });

  if (rt) {
    return {
      schemaVersion: 1,
      executionId: rows.id,
      title: rows.title,
      kind,
      lifecycle: rt.lifecycle,
      startedAt: rt.startedAt,
      pausedAt: rt.pausedAt,
      accumulatedPauseMs: rt.accumulatedPauseMs,
      autoRest: rt.autoRest,
      circuit: rt.circuit,
      exercises,
      cursor: rt.cursor,
      phase: rt.phase,
      rest: rt.rest,
      workTimer: rt.workTimer,
      intervals,
      current: rt.current,
    };
  }

  const startedAt = Date.parse(rows.startedAt);
  const cursor = kind === 'strength' ? nextCursor(exercises, 0) : null;
  const first = intervals.findIndex((i) => i.status === 'pending');
  const current =
    kind === 'running' && first >= 0 ? { index: first, startActiveMs: 0, startedAt } : null;
  return {
    schemaVersion: 1,
    executionId: rows.id,
    title: rows.title,
    kind,
    lifecycle: 'active',
    startedAt,
    pausedAt: null,
    accumulatedPauseMs: 0,
    autoRest: opts.autoRest,
    circuit: circuitByDefault,
    exercises,
    cursor,
    phase: cursor || current ? 'working' : 'all_done',
    rest: null,
    workTimer: null,
    intervals,
    current,
  };
}

/** The part of the state that the rows do not hold. Saved with every transition. */
export function toRuntime(s: ExecState): RuntimeState {
  return {
    schemaVersion: 1,
    kind: s.kind,
    lifecycle: s.lifecycle,
    startedAt: s.startedAt,
    pausedAt: s.pausedAt,
    accumulatedPauseMs: s.accumulatedPauseMs,
    autoRest: s.autoRest,
    circuit: s.circuit,
    cursor: s.cursor,
    phase: s.phase,
    rest: s.rest,
    workTimer: s.workTimer,
    current: s.current,
    tracking: Object.fromEntries(s.exercises.map((e) => [e.id, e.tracking])),
    targets: Object.fromEntries(
      s.intervals
        .filter((i) => i.targetSeconds !== i.plannedDurationSeconds)
        .map((i) => [i.id, i.targetSeconds]),
    ),
  };
}

export type Alarm = {
  /** Wall-clock time of the change. */
  at: number;
  reason: 'rest' | 'work' | 'interval';
  /** Running: the interval that starts at `at` (null = the run ends). */
  nextIndex: number | null;
};

/**
 * Upcoming timer ends (rest, timed set, then up to `limit` interval changes), for
 * background notifications. Recomputed from state, so it can never drift.
 */
export function upcomingAlarms(s: ExecState, now: number, limit = 10): Alarm[] {
  if (s.lifecycle !== 'active') return [];
  const elapsed = Math.max(0, now - s.startedAt - s.accumulatedPauseMs);
  const at = (endActiveMs: number) => now + Math.max(0, endActiveMs - elapsed);
  if (s.rest)
    return [{ at: at(s.rest.startActiveMs + s.rest.durationMs), reason: 'rest', nextIndex: null }];
  if (s.workTimer && s.workTimer.targetMs > 0) {
    return [
      { at: at(s.workTimer.startActiveMs + s.workTimer.targetMs), reason: 'work', nextIndex: null },
    ];
  }
  if (!s.current) return [];
  const out: Alarm[] = [];
  let end = s.current.startActiveMs;
  for (let i = s.current.index; i < s.intervals.length && out.length < limit; i++) {
    end += s.intervals[i]!.targetSeconds * 1000;
    out.push({
      at: at(end),
      reason: 'interval',
      nextIndex: i + 1 < s.intervals.length ? i + 1 : null,
    });
  }
  return out;
}

/** Wall-clock time of the next timer end (rest, timed set or interval), for notifications. */
export function nextAlarmAt(s: ExecState, now: number): number | null {
  return upcomingAlarms(s, now, 1)[0]?.at ?? null;
}
