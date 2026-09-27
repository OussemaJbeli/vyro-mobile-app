import { hydrate, upcomingAlarms } from '../hydrate';
import { plannedVsActual, prefill, roundOf, runSummary, summarize } from '../summary';
import { MIN, S, T0, play, runningRows, start, strengthRows } from '../testing/fixtures';
import { activeMs } from '../time';

describe('circuit mode', () => {
  it('is on by default for home/abs and moves through exercises before sets', () => {
    const rows = {
      ...strengthRows([
        { sets: 2, reps: 10 },
        { sets: 2, reps: 15 },
        { sets: 2, duration: 30, tracking: 'duration' },
      ]),
      type: 'abs' as const,
    };
    const s = hydrate(rows, { autoRest: false });
    expect(s.circuit).toBe(true);
    expect(roundOf(s)).toEqual({ round: 1, rounds: 2 });
    const r = play(
      s,
      { type: 'COMPLETE_SET', now: T0 + S },
      { type: 'COMPLETE_SET', now: T0 + 2 * S },
    );
    expect(r.state.cursor).toEqual({ exercise: 2, set: 0 });
    const round2 = play(r.state, { type: 'COMPLETE_SET', now: T0 + 3 * S });
    expect(round2.state.cursor).toEqual({ exercise: 0, set: 1 });
    expect(roundOf(round2.state)).toEqual({ round: 2, rounds: 2 });
    // Skipping a set also moves on to the next exercise in circuit mode.
    expect(play(round2.state, { type: 'SKIP_SET', now: T0 + 4 * S }).state.cursor).toEqual({
      exercise: 1,
      set: 1,
    });
  });

  it('can be toggled and is persisted in the runtime state', () => {
    const s = start(
      strengthRows([
        { sets: 2, reps: 10 },
        { sets: 2, reps: 10 },
      ]),
    );
    expect(s.circuit).toBe(false);
    const on = play(s, { type: 'SET_CIRCUIT', now: T0, on: true }).state;
    expect(on.circuit).toBe(true);
    expect(play(on, { type: 'SET_CIRCUIT', now: T0, on: true }).state).toBe(on);
    expect(play(on, { type: 'COMPLETE_SET', now: T0 + S }).state.cursor).toEqual({
      exercise: 1,
      set: 0,
    });
    const done = play(
      on,
      ...[1, 2, 3, 4].map((k) => ({ type: 'COMPLETE_SET' as const, now: T0 + k * S })),
    ).state;
    expect(roundOf(done)).toEqual({ round: 2, rounds: 2 });
  });
});

describe('prefill', () => {
  const s = start(strengthRows([{ sets: 3, reps: 10, weight: 60 }, { sets: 2 }]));

  it('uses the planned target first', () => {
    expect(
      prefill(
        s.exercises[0]!,
        0,
        { reps: 8, weightKg: 70, durationSeconds: null },
        { reps: 12, durationSeconds: null },
      ),
    ).toEqual({
      reps: 10,
      weightKg: 60,
      durationSeconds: 30,
    });
  });

  it('then the previous set of this session, then last time, then defaults', () => {
    const logged = play(
      s,
      { type: 'JUMP_TO_EXERCISE', now: T0, index: 1 },
      { type: 'COMPLETE_SET', now: T0 + S, reps: 7, weightKg: 22.5 },
    ).state;
    const ex = logged.exercises[1]!;
    expect(
      prefill(
        ex,
        1,
        { reps: 5, weightKg: 30, durationSeconds: null },
        { reps: 12, durationSeconds: 40 },
      ),
    ).toEqual({
      reps: 7,
      weightKg: 22.5,
      durationSeconds: 40,
    });
    expect(
      prefill(
        s.exercises[1]!,
        0,
        { reps: 5, weightKg: 30, durationSeconds: 20 },
        { reps: 12, durationSeconds: null },
      ),
    ).toEqual({
      reps: 5,
      weightKg: 30,
      durationSeconds: 20,
    });
    expect(prefill(s.exercises[1]!, 0, undefined, { reps: null, durationSeconds: null })).toEqual({
      reps: 10,
      weightKg: 0,
      durationSeconds: 30,
    });
  });
});

describe('summary and planned vs actual', () => {
  it('computes volume and the per-exercise diff', () => {
    const s = start(
      strengthRows([
        { sets: 2, reps: 10, weight: 60 },
        { sets: 1, reps: 10, weight: 40 },
        { sets: 1, duration: 45, tracking: 'duration' },
      ]),
    );
    const r = play(
      s,
      { type: 'COMPLETE_SET', now: T0 + S },
      { type: 'COMPLETE_SET', now: T0 + 2 * S, reps: 8, weightKg: 62.5 },
      {
        type: 'SUBSTITUTE_EXERCISE',
        now: T0 + 3 * S,
        exerciseId: 'alt',
        tracking: 'weight_reps',
        reason: null,
      },
      { type: 'COMPLETE_SET', now: T0 + 4 * S },
      { type: 'SKIP_EXERCISE', now: T0 + 5 * S },
      {
        type: 'ADD_EXERCISE',
        now: T0 + 6 * S,
        id: 'new',
        exerciseId: 'pushup',
        tracking: 'reps',
        restSeconds: null,
        sets: [{ id: 'n1', reps: 15, weightKg: null, durationSeconds: null }],
      },
      { type: 'COMPLETE_SET', now: T0 + MIN },
      { type: 'FINISH', now: T0 + 2 * MIN },
    ).state;
    expect(summarize(r)).toEqual({
      doneSets: 4,
      plannedSets: 4,
      volumeKg: 600 + 500 + 400,
      exercisesDone: 3,
      exercisesTotal: 4,
    });
    const [bench, swapped, plank, added] = plannedVsActual(r);
    expect(bench).toMatchObject({
      changed: true,
      substituted: false,
      planned: { sets: 2, reps: [10, 10], weightsKg: [60, 60] },
      actual: { sets: 2, reps: [10, 8], weightsKg: [60, 62.5] },
    });
    expect(swapped).toMatchObject({
      substituted: true,
      plannedExerciseId: 'ex1',
      exerciseId: 'alt',
      changed: true,
    });
    expect(plank).toMatchObject({
      skipped: true,
      changed: true,
      planned: { durationsSeconds: [45] },
    });
    expect(added).toMatchObject({ added: true, changed: true, actual: { reps: [15] } });
  });

  it('an untouched exercise is unchanged', () => {
    const r = play(start(strengthRows([{ sets: 1, reps: 10 }])), {
      type: 'COMPLETE_SET',
      now: T0,
    }).state;
    expect(plannedVsActual(r)[0]!.changed).toBe(false);
  });
});

describe('running: countdown, distance, alarms', () => {
  it('starts after the countdown (skippable), estimates distance and lists upcoming changes', () => {
    const rows = runningRows();
    const s = hydrate(
      { ...rows, startedAt: new Date(T0 + 3 * S).toISOString() },
      { autoRest: false },
    );
    expect(activeMs(s, T0 + S)).toBe(0); // counting down
    const started = play(s, { type: 'SKIP_COUNTDOWN', now: T0 + S }).state;
    expect(started.startedAt).toBe(T0 + S);
    expect(play(started, { type: 'SKIP_COUNTDOWN', now: T0 + 2 * S }).state).toBe(started);
    const alarms = upcomingAlarms(started, T0 + S, 3);
    expect(alarms.map((a) => [a.at - T0, a.nextIndex])).toEqual([
      [S + 5 * MIN, 1],
      [S + 15 * MIN, 2],
      [S + 20 * MIN, 3],
    ]);
    const r = play(
      started,
      { type: 'TICK', now: T0 + S + 5 * MIN },
      { type: 'FINISH', now: T0 + S + 5 * MIN },
    );
    // Warmup 5 min @ 8.05 km/h ≈ 0.671 km.
    expect(runSummary(r.state).distanceKm).toBeCloseTo(0.6708, 3);
    expect(r.changes.at(-1)).toMatchObject({ kind: 'complete', distanceKm: 0.671 });
  });
});
