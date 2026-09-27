import { type Draft, secs } from './internal';
import { type ExecExercise, type ExecSet, type ExecState } from './types';

type SetActuals = {
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
};

/** First pending set: current exercise first, then following exercises, then earlier ones. */
export function nextCursor(exercises: ExecExercise[], from: number): ExecState['cursor'] {
  const n = exercises.length;
  for (let k = 0; k < n; k++) {
    const e = (from + k) % n;
    const ex = exercises[e]!;
    if (ex.status === 'skipped') continue;
    const s = ex.sets.findIndex((x) => x.status === 'pending');
    if (s >= 0) return { exercise: e, set: s };
  }
  return null;
}

/** Exercise status implied by its sets. */
function statusFor(ex: ExecExercise): ExecExercise['status'] {
  const done = ex.sets.some((s) => s.status === 'done');
  if (ex.sets.some((s) => s.status === 'pending')) return done ? 'active' : 'pending';
  return done ? 'done' : 'skipped';
}

function replaceExercise(d: Draft, index: number, ex: ExecExercise) {
  const exercises = d.state.exercises.slice();
  const before = exercises[index]!;
  const status = statusFor(ex);
  const next = { ...ex, status };
  exercises[index] = next;
  d.update({ exercises });
  if (status !== before.status) d.change({ kind: 'exercise', id: ex.id, patch: { status } });
}

function patchSet(d: Draft, e: number, s: number, patch: Partial<ExecSet>) {
  const ex = d.state.exercises[e]!;
  const sets = ex.sets.slice();
  sets[s] = { ...sets[s]!, ...patch };
  replaceExercise(d, e, { ...ex, sets });
  d.change({ kind: 'set', id: sets[s]!.id, patch });
}

/** Circuit mode moves on to the next exercise after each set; otherwise stay on this one. */
const from = (d: Draft, exercise: number) => (d.state.circuit ? exercise + 1 : exercise);

/** Moves the cursor from `from`, or finishes the strength part. */
function advance(d: Draft, from: number) {
  const cursor = nextCursor(d.state.exercises, from);
  d.update({ cursor, phase: cursor ? 'working' : 'all_done', workTimer: null });
}

/** Ends the current rest, recording how long it actually lasted on the set before it. */
export function endRest(d: Draft) {
  const rest = d.state.rest;
  if (!rest) return;
  const taken = secs(Math.min(d.active - rest.startActiveMs, rest.durationMs));
  d.update({ rest: null, phase: d.state.cursor ? 'working' : 'all_done' });
  const e = d.state.exercises.findIndex((x) => x.sets.some((s) => s.id === rest.forSetId));
  if (e < 0) return;
  const s = d.state.exercises[e]!.sets.findIndex((x) => x.id === rest.forSetId);
  patchSet(d, e, s, { restTakenSeconds: taken });
}

/** Default actuals: planned values, else the previous logged set (one tap, FS §76). */
function defaults(ex: ExecExercise, set: ExecSet) {
  const prev = ex.sets
    .slice(0, set.index)
    .reverse()
    .find((s) => s.status === 'done');
  return {
    reps: set.plannedReps ?? prev?.actualReps ?? null,
    weightKg: set.plannedWeightKg ?? prev?.actualWeightKg ?? null,
    durationSeconds: set.plannedDurationSeconds ?? prev?.actualDurationSeconds ?? null,
  };
}

export function completeSet(d: Draft, actuals: SetActuals) {
  const c = d.state.cursor;
  if (!c) return;
  if (d.state.rest) endRest(d);
  const ex = d.state.exercises[c.exercise]!;
  const set = ex.sets[c.set]!;
  const def = defaults(ex, set);
  const timer = d.state.workTimer;
  const timed = timer ? secs(d.active - timer.startActiveMs) : null;
  const pick = <T>(v: T | undefined, fallback: T) => (v === undefined ? fallback : v);
  patchSet(d, c.exercise, c.set, {
    status: 'done',
    actualReps: ex.tracking === 'duration' ? null : pick(actuals.reps, def.reps),
    actualWeightKg: ex.tracking === 'weight_reps' ? pick(actuals.weightKg, def.weightKg) : null,
    actualDurationSeconds:
      ex.tracking === 'duration' || ex.tracking === 'distance_duration'
        ? pick(actuals.durationSeconds, timed ?? def.durationSeconds)
        : null,
    completedAt: d.now,
  });
  d.effect({ kind: 'haptic', style: 'success' });
  advance(d, from(d, c.exercise));
  const rest = ex.restSeconds;
  if (d.state.cursor && d.state.autoRest && rest && rest > 0) {
    d.update({
      phase: 'resting',
      rest: { startActiveMs: d.active, durationMs: rest * 1000, forSetId: set.id },
    });
  }
}

export function editSet(d: Draft, setId: string, actuals: SetActuals) {
  const e = d.state.exercises.findIndex((x) => x.sets.some((s) => s.id === setId));
  if (e < 0) return;
  const s = d.state.exercises[e]!.sets.findIndex((x) => x.id === setId);
  const patch: Partial<ExecSet> = {};
  if (actuals.reps !== undefined) patch.actualReps = actuals.reps;
  if (actuals.weightKg !== undefined) patch.actualWeightKg = actuals.weightKg;
  if (actuals.durationSeconds !== undefined) patch.actualDurationSeconds = actuals.durationSeconds;
  if (Object.keys(patch).length) patchSet(d, e, s, patch);
}

export function skipSet(d: Draft) {
  const c = d.state.cursor;
  if (!c) return;
  endRest(d);
  patchSet(d, c.exercise, c.set, { status: 'skipped' });
  advance(d, from(d, c.exercise));
}

export function addSet(d: Draft, id: string) {
  const e = d.state.cursor?.exercise ?? d.state.exercises.length - 1;
  const ex = d.state.exercises[e];
  if (!ex) return;
  const set: ExecSet = {
    id,
    index: ex.sets.reduce((m, s) => Math.max(m, s.index), -1) + 1,
    plannedReps: null,
    plannedWeightKg: null,
    plannedDurationSeconds: null,
    actualReps: null,
    actualWeightKg: null,
    actualDurationSeconds: null,
    restTakenSeconds: null,
    status: 'pending',
    isExtra: true,
    completedAt: null,
  };
  replaceExercise(d, e, { ...ex, sets: [...ex.sets, set] });
  d.change({ kind: 'insertSet', exerciseRowId: ex.id, set });
  if (!d.state.cursor) {
    d.update({ cursor: { exercise: e, set: ex.sets.length }, phase: 'working' });
  }
}

export function skipExercise(d: Draft) {
  const c = d.state.cursor;
  if (!c) return;
  endRest(d);
  const ex = d.state.exercises[c.exercise]!;
  ex.sets.forEach((s, i) => {
    if (s.status === 'pending') patchSet(d, c.exercise, i, { status: 'skipped' });
  });
  advance(d, c.exercise);
}

export function substitute(
  d: Draft,
  exerciseId: string,
  tracking: ExecExercise['tracking'],
  reason: string | null,
  index?: number,
) {
  const target = index ?? d.state.cursor?.exercise;
  const ex = target === undefined ? undefined : d.state.exercises[target];
  if (target === undefined || !ex || !ex.sets.some((s) => s.status === 'pending')) return;
  replaceExercise(d, target, { ...ex, exerciseId, tracking, substitutionReason: reason });
  d.change({ kind: 'exercise', id: ex.id, patch: { exerciseId, substitutionReason: reason } });
  d.update({ workTimer: null });
}

export function jumpTo(d: Draft, index: number) {
  const ex = d.state.exercises[index];
  if (!ex) return;
  const s = ex.sets.findIndex((x) => x.status === 'pending');
  if (s < 0) return;
  endRest(d);
  d.update({ cursor: { exercise: index, set: s }, phase: 'working', workTimer: null });
}

export function reorder(d: Draft, order: string[]) {
  const byId = new Map(d.state.exercises.map((e) => [e.id, e]));
  if (order.length !== byId.size || !order.every((id) => byId.has(id))) return;
  const currentId = d.state.cursor ? d.state.exercises[d.state.cursor.exercise]!.id : null;
  const exercises = order.map((id) => byId.get(id)!);
  const cursor = d.state.cursor
    ? { ...d.state.cursor, exercise: exercises.findIndex((e) => e.id === currentId) }
    : null;
  d.update({ exercises, cursor });
  d.change({ kind: 'reorderExercises', ids: order });
}

export function addExercise(
  d: Draft,
  input: {
    id: string;
    exerciseId: string;
    tracking: ExecExercise['tracking'];
    restSeconds: number | null;
    sets: {
      id: string;
      reps: number | null;
      weightKg: number | null;
      durationSeconds: number | null;
    }[];
  },
) {
  const exercise: ExecExercise = {
    id: input.id,
    exerciseId: input.exerciseId,
    plannedExerciseId: null,
    tracking: input.tracking,
    restSeconds: input.restSeconds,
    status: 'pending',
    substitutionReason: null,
    sets: input.sets.map((s, index) => ({
      id: s.id,
      index,
      plannedReps: s.reps,
      plannedWeightKg: s.weightKg,
      plannedDurationSeconds: s.durationSeconds,
      actualReps: null,
      actualWeightKg: null,
      actualDurationSeconds: null,
      restTakenSeconds: null,
      status: 'pending',
      isExtra: true,
      completedAt: null,
    })),
  };
  const index = d.state.exercises.length;
  d.update({ exercises: [...d.state.exercises, exercise] });
  d.change({ kind: 'insertExercise', exercise, orderIndex: index });
  if (!d.state.cursor && exercise.sets.length) {
    d.update({ cursor: { exercise: index, set: 0 }, phase: 'working' });
  }
}

export function adjustRest(d: Draft, deltaMs: number) {
  const rest = d.state.rest;
  if (!rest) return;
  const elapsed = d.active - rest.startActiveMs;
  d.update({ rest: { ...rest, durationMs: Math.max(elapsed, rest.durationMs + deltaMs) } });
}

export function startWorkTimer(d: Draft) {
  const c = d.state.cursor;
  if (!c || d.state.workTimer) return;
  endRest(d);
  const set = d.state.exercises[c.exercise]!.sets[c.set]!;
  d.update({
    workTimer: { startActiveMs: d.active, targetMs: (set.plannedDurationSeconds ?? 0) * 1000 },
  });
}

/** Rest expiry and timed-set auto-complete, derived from the clock. Idempotent. */
export function settleStrength(d: Draft) {
  const { rest, workTimer } = d.state;
  if (rest && d.active >= rest.startActiveMs + rest.durationMs) {
    endRest(d);
    d.effect({ kind: 'haptic', style: 'warning' });
  }
  if (
    workTimer &&
    workTimer.targetMs > 0 &&
    d.active >= workTimer.startActiveMs + workTimer.targetMs
  ) {
    completeSet(d, { durationSeconds: secs(workTimer.targetMs) });
  }
}

/** FINISH: pending sets become skipped; nothing is deleted. */
export function closeStrength(d: Draft) {
  endRest(d);
  d.state.exercises.forEach((ex, e) =>
    ex.sets.forEach((s, i) => {
      if (s.status === 'pending') patchSet(d, e, i, { status: 'skipped' });
    }),
  );
  d.update({ cursor: null, phase: 'all_done', workTimer: null });
}
