import { deriveOutcome } from '../outcome';
import { hydrate, nextAlarmAt, toRuntime } from '../hydrate';
import { reduce } from '../reducer';
import { buildSnapshot } from '../snapshot';
import {
  activeMs,
  intervalElapsedMs,
  intervalRemainingMs,
  isStale,
  pausedMs,
  restRemainingMs,
  STALE_MS,
  workElapsedMs,
} from '../time';
import { type ExecState } from '../types';

import { MIN, S, T0, outcomeOf, play, runningRows, start, strengthRows } from '../testing/fixtures';

const upperBody = () =>
  start(
    strengthRows([
      { sets: 3, reps: 10, weight: 60, rest: 90 },
      { sets: 3, reps: 10, weight: 50, rest: 60 },
    ]),
  );

const sets = (s: ExecState) => s.exercises.flatMap((e) => e.sets);

describe('strength', () => {
  it('happy path: every set with planned values → as_planned', () => {
    let s = upperBody();
    expect(s.cursor).toEqual({ exercise: 0, set: 0 });
    let t = T0;
    const all = [];
    for (let i = 0; i < 6; i++) {
      t += 100 * S; // longer than any rest: the rest expires on its own
      const r = play(s, { type: 'COMPLETE_SET', now: t });
      s = r.state;
      all.push(...r.changes);
    }
    expect(s.phase).toBe('all_done');
    expect(s.cursor).toBeNull();
    expect(sets(s).every((x) => x.status === 'done')).toBe(true);
    expect(sets(s)[0]).toMatchObject({ actualReps: 10, actualWeightKg: 60, restTakenSeconds: 90 });
    expect(sets(s)[3]).toMatchObject({ actualWeightKg: 50, restTakenSeconds: 60 });
    expect(s.exercises.map((e) => e.status)).toEqual(['done', 'done']);
    const done = play(s, { type: 'FINISH', now: t + 5 * S });
    expect(done.state.lifecycle).toBe('completed');
    expect(outcomeOf(done.changes)).toBe('as_planned');
    expect(done.changes.at(-1)).toMatchObject({ activeSeconds: 605, pausedSeconds: 0 });
    // Completing again after the finish is ignored.
    expect(reduce(done.state, { type: 'COMPLETE_SET', now: t + 9 * S }).state).toBe(done.state);
  });

  it('substitution plus an extra set → modified, planned exercise kept', () => {
    const r = play(
      upperBody(),
      {
        type: 'SUBSTITUTE_EXERCISE',
        now: T0,
        exerciseId: 'db-press',
        tracking: 'weight_reps',
        reason: 'busy',
      },
      { type: 'COMPLETE_SET', now: T0 + 10 * S },
      { type: 'COMPLETE_SET', now: T0 + 120 * S },
      { type: 'COMPLETE_SET', now: T0 + 240 * S },
      { type: 'ADD_SET', now: T0 + 250 * S, id: 'extra' },
      { type: 'COMPLETE_SET', now: T0 + 300 * S, reps: 8, weightKg: 55 },
    );
    const bench = r.state.exercises[0]!;
    expect(bench).toMatchObject({
      exerciseId: 'db-press',
      plannedExerciseId: 'ex0',
      substitutionReason: 'busy',
    });
    expect(r.changes).toContainEqual({
      kind: 'exercise',
      id: 'se0',
      patch: { exerciseId: 'db-press', substitutionReason: 'busy' },
    });
    // ADD_SET appends to the current exercise (row), not the finished bench.
    expect(r.changes).toContainEqual(
      expect.objectContaining({ kind: 'insertSet', exerciseRowId: 'se1' }),
    );
    const rest = play(
      r.state,
      { type: 'COMPLETE_SET', now: T0 + 400 * S },
      { type: 'COMPLETE_SET', now: T0 + 500 * S },
      { type: 'COMPLETE_SET', now: T0 + 600 * S },
      { type: 'FINISH', now: T0 + 700 * S },
    );
    expect(outcomeOf(rest.changes)).toBe('modified');
  });

  it('finishing early marks remaining sets skipped → partial', () => {
    const six = start(strengthRows(Array.from({ length: 6 }, () => ({ sets: 2, reps: 8 }))));
    const events = Array.from({ length: 6 }, (_, i) => ({
      type: 'COMPLETE_SET' as const,
      now: T0 + i * MIN,
    }));
    const r = play(six, ...events, { type: 'FINISH_EARLY', now: T0 + 10 * MIN });
    expect(r.state.exercises.map((e) => e.status)).toEqual([
      'done',
      'done',
      'done',
      'skipped',
      'skipped',
      'skipped',
    ]);
    expect(r.changes.filter((c) => c.kind === 'set' && c.patch.status === 'skipped')).toHaveLength(
      6,
    );
    expect(outcomeOf(r.changes)).toBe('partial');
  });

  it('pausing 10 minutes during rest leaves the remaining rest unchanged', () => {
    const r = play(
      upperBody(),
      { type: 'COMPLETE_SET', now: T0 + 10 * S },
      { type: 'PAUSE', now: T0 + 40 * S },
    );
    expect(r.state.lifecycle).toBe('paused');
    expect(restRemainingMs(r.state, T0 + 40 * S)).toBe(60 * S);
    expect(restRemainingMs(r.state, T0 + 5 * MIN)).toBe(60 * S); // frozen while paused
    // Ignored while paused.
    expect(reduce(r.state, { type: 'COMPLETE_SET', now: T0 + MIN }).state).toBe(r.state);
    const resumed = play(r.state, { type: 'RESUME', now: T0 + 40 * S + 10 * MIN });
    expect(restRemainingMs(resumed.state, T0 + 40 * S + 10 * MIN)).toBe(60 * S);
    expect(pausedMs(resumed.state, T0 + 11 * MIN)).toBe(10 * MIN);
    const expired = play(resumed.state, { type: 'TICK', now: T0 + 100 * S + 10 * MIN });
    expect(expired.state.phase).toBe('working');
    expect(sets(expired.state)[0]!.restTakenSeconds).toBe(90);
    expect(expired.effects).toContainEqual({ kind: 'haptic', style: 'warning' });
    const finished = play(r.state, { type: 'FINISH', now: T0 + 20 * MIN });
    expect(finished.changes.at(-1)).toMatchObject({ pausedSeconds: 1160, activeSeconds: 40 });
  });

  it('rest can be extended, shortened and skipped', () => {
    const s = play(upperBody(), { type: 'COMPLETE_SET', now: T0 }).state;
    const longer = play(s, { type: 'REST_ADJUST', now: T0, deltaMs: 15 * S }).state;
    expect(restRemainingMs(longer, T0)).toBe(105 * S);
    const shorter = play(s, { type: 'REST_ADJUST', now: T0 + 50 * S, deltaMs: -60 * S });
    expect(shorter.state.rest).toBeNull(); // clamped to elapsed → ended
    const skipped = play(s, { type: 'REST_SKIP', now: T0 + 30 * S });
    expect(skipped.state.phase).toBe('working');
    expect(sets(skipped.state)[0]!.restTakenSeconds).toBe(30);
    expect(nextAlarmAt(s, T0 + 10 * S)).toBe(T0 + 90 * S);
  });

  it('no automatic rest when auto-rest is off', () => {
    const s = hydrate(strengthRows([{ sets: 2, reps: 5, rest: 60 }]), { autoRest: false });
    expect(play(s, { type: 'COMPLETE_SET', now: T0 }).state.phase).toBe('working');
  });

  it('timed sets: work timer auto-completes at target, or stops early', () => {
    const plank = start(strengthRows([{ sets: 2, duration: 45, tracking: 'duration' }]));
    const running = play(plank, { type: 'START_WORK_TIMER', now: T0 }).state;
    expect(workElapsedMs(running, T0 + 20 * S)).toBe(20 * S);
    expect(nextAlarmAt(running, T0)).toBe(T0 + 45 * S);
    const auto = play(running, { type: 'TICK', now: T0 + 46 * S });
    expect(auto.state.exercises[0]!.sets[0]).toMatchObject({
      status: 'done',
      actualDurationSeconds: 45,
      actualReps: null,
    });
    const early = play(
      auto.state,
      { type: 'START_WORK_TIMER', now: T0 + MIN },
      { type: 'STOP_WORK_TIMER', now: T0 + 90 * S },
    );
    expect(early.state.exercises[0]!.sets[1]!.actualDurationSeconds).toBe(30);
    expect(outcomeOf(play(early.state, { type: 'FINISH', now: T0 + 2 * MIN }).changes)).toBe(
      'modified',
    );
  });

  it('skip set, skip exercise, jump, reorder and edit keep every log', () => {
    let r = play(
      upperBody(),
      { type: 'SKIP_SET', now: T0 },
      { type: 'JUMP_TO_EXERCISE', now: T0, index: 1 },
    );
    expect(r.state.cursor).toEqual({ exercise: 1, set: 0 });
    r = play(
      r.state,
      { type: 'COMPLETE_SET', now: T0 + S, reps: 12 },
      { type: 'REST_SKIP', now: T0 + 2 * S },
    );
    const logged = sets(r.state).find((x) => x.status === 'done')!;
    r = play(r.state, {
      type: 'EDIT_SET',
      now: T0 + 3 * S,
      setId: logged.id,
      reps: 11,
      weightKg: 52.5,
      durationSeconds: null,
    });
    expect(sets(r.state).find((x) => x.id === logged.id)).toMatchObject({
      actualReps: 11,
      actualWeightKg: 52.5,
    });
    r = play(r.state, { type: 'REORDER_REMAINING', now: T0 + 4 * S, order: ['se1', 'se0'] });
    expect(r.state.exercises[0]!.id).toBe('se1');
    expect(r.state.cursor).toEqual({ exercise: 0, set: 1 });
    expect(r.changes).toContainEqual({ kind: 'reorderExercises', ids: ['se1', 'se0'] });
    r = play(r.state, { type: 'SKIP_EXERCISE', now: T0 + 5 * S });
    expect(r.state.exercises[0]!.status).toBe('done'); // one set done, rest skipped
    expect(r.state.cursor).toEqual({ exercise: 1, set: 1 });
    // Invalid inputs are ignored.
    const same = r.state;
    expect(reduce(same, { type: 'REORDER_REMAINING', now: T0, order: ['se1'] }).state).toBe(same);
    expect(reduce(same, { type: 'JUMP_TO_EXERCISE', now: T0, index: 9 }).state).toBe(same);
    expect(reduce(same, { type: 'EDIT_SET', now: T0, setId: 'nope', reps: 1 }).state).toBe(same);
    expect(reduce(same, { type: 'EDIT_SET', now: T0, setId: logged.id }).state).toBe(same);
  });

  it('empty workout: exercises and extra sets added on the fly', () => {
    let s = start(strengthRows([]));
    expect(s.phase).toBe('all_done');
    expect(reduce(s, { type: 'ADD_SET', now: T0, id: 'x' }).state).toBe(s);
    const r = play(s, {
      type: 'ADD_EXERCISE',
      now: T0,
      id: 'new1',
      exerciseId: 'pushup',
      tracking: 'reps',
      restSeconds: null,
      sets: [{ id: 'n1', reps: 15, weightKg: null, durationSeconds: null }],
    });
    s = r.state;
    expect(r.changes[0]).toMatchObject({ kind: 'insertExercise', orderIndex: 0 });
    expect(s.cursor).toEqual({ exercise: 0, set: 0 });
    s = play(s, { type: 'COMPLETE_SET', now: T0 + S }).state;
    expect(s.phase).toBe('all_done');
    s = play(
      s,
      { type: 'ADD_SET', now: T0 + 2 * S, id: 'n2' },
      { type: 'COMPLETE_SET', now: T0 + 3 * S },
    ).state;
    // Extra set defaults to the previous logged reps (one tap).
    expect(s.exercises[0]!.sets[1]).toMatchObject({
      actualReps: 15,
      isExtra: true,
      actualWeightKg: null,
    });
    expect(outcomeOf(play(s, { type: 'FINISH', now: T0 + MIN }).changes)).toBe('modified');
  });

  it('abandon keeps logs and closes the execution', () => {
    const r = play(
      upperBody(),
      { type: 'COMPLETE_SET', now: T0 },
      { type: 'ABANDON', now: T0 + MIN },
    );
    expect(r.state.lifecycle).toBe('abandoned');
    expect(r.changes.at(-1)).toEqual({ kind: 'abandon', endedAt: T0 + MIN });
    expect(sets(r.state)[0]!.status).toBe('done');
    expect(r.effects).toContainEqual({ kind: 'keepAwake', on: false });
  });
});

describe('running (FS §19 plan)', () => {
  const boundaries = [5, 15, 20, 25, 30, 35].map((m) => T0 + m * MIN);

  it('TICK through every interval → six logs with actual durations → as_planned', () => {
    const r = play(
      start(runningRows()),
      ...boundaries.map((now) => ({ type: 'TICK' as const, now })),
    );
    expect(r.state.phase).toBe('all_done');
    expect(r.state.intervals.map((i) => [i.status, i.actualDurationSeconds])).toEqual([
      ['done', 300],
      ['done', 600],
      ['done', 300],
      ['done', 300],
      ['done', 300],
      ['done', 300],
    ]);
    expect(r.state.intervals[1]).toMatchObject({
      actualSpeedKmh: 9.66,
      startedAt: T0 + 5 * MIN,
      endedAt: T0 + 15 * MIN,
    });
    expect(r.caughtUp).toBe(0);
    expect(outcomeOf(play(r.state, { type: 'FINISH', now: T0 + 36 * MIN }).changes)).toBe(
      'as_planned',
    );
  });

  it('resume after a kill catches up several intervals at once', () => {
    const s = start(runningRows());
    expect(intervalRemainingMs(s, T0 + MIN)).toBe(4 * MIN);
    const r = play(s, { type: 'TICK', now: T0 + 22 * MIN });
    expect(r.state.current).toMatchObject({ index: 3, startActiveMs: 20 * MIN });
    expect(r.caughtUp).toBe(2);
    expect(intervalElapsedMs(r.state, T0 + 22 * MIN)).toBe(2 * MIN);
  });

  it('skipping interval 3 logs skipped → partial', () => {
    const r = play(
      start(runningRows()),
      { type: 'TICK', now: boundaries[0]! },
      { type: 'TICK', now: boundaries[1]! },
      { type: 'INTERVAL_NEXT', now: boundaries[1]! },
      ...[20, 25, 30].map((m) => ({ type: 'TICK' as const, now: T0 + m * MIN })),
    );
    expect(r.state.intervals[2]).toMatchObject({ status: 'skipped', actualDurationSeconds: null });
    expect(r.state.intervals[3]).toMatchObject({ status: 'done', actualDurationSeconds: 300 });
    expect(r.state.phase).toBe('all_done');
    expect(outcomeOf(play(r.state, { type: 'FINISH', now: T0 + 31 * MIN }).changes)).toBe(
      'partial',
    );
  });

  it('skipping mid-interval logs partial with the time run', () => {
    const r = play(start(runningRows()), { type: 'INTERVAL_NEXT', now: T0 + 2 * MIN });
    expect(r.state.intervals[0]).toMatchObject({ status: 'partial', actualDurationSeconds: 120 });
    expect(r.state.current).toMatchObject({ index: 1, startActiveMs: 2 * MIN });
  });

  it('repeat inserts is_repeat, speed changes log actual speed → modified', () => {
    const r = play(
      start(runningRows()),
      { type: 'INTERVAL_ADJUST_SPEED', now: T0 + MIN, speedKmh: 10 },
      { type: 'INTERVAL_ADJUST_INCLINE', now: T0 + MIN, inclinePercent: 2 },
      { type: 'INTERVAL_REPEAT', now: T0 + 2 * MIN, id: 'rep' },
    );
    expect(r.changes).toContainEqual({
      kind: 'interval',
      id: 'iv0',
      patch: { actualSpeedKmh: 10 },
    });
    expect(r.state.intervals[1]).toMatchObject({
      id: 'rep',
      isRepeat: true,
      kind: 'warmup',
      status: 'pending',
    });
    expect(r.changes).toContainEqual(
      expect.objectContaining({ kind: 'insertInterval', orderIndex: 1 }),
    );
    const end = play(
      r.state,
      ...[5, 10, 20, 25, 30, 35, 40].map((m) => ({ type: 'TICK' as const, now: T0 + m * MIN })),
    );
    expect(end.state.intervals).toHaveLength(7);
    expect(end.state.intervals[0]).toMatchObject({ actualSpeedKmh: 10, actualInclinePercent: 2 });
    expect(end.state.intervals.every((i) => i.status === 'done')).toBe(true);
    const fin = play(end.state, { type: 'FINISH', now: T0 + 41 * MIN });
    expect(outcomeOf(fin.changes)).toBe('modified');
    // Repeating after the end restarts the last interval right away.
    const again = play(end.state, { type: 'INTERVAL_REPEAT', now: T0 + 41 * MIN, id: 'rep2' });
    expect(again.state.current).toMatchObject({ index: 7, startActiveMs: 41 * MIN });
  });

  it('duration adjustments move the boundary and persist in runtime targets', () => {
    const s = start(runningRows());
    const longer = play(s, {
      type: 'INTERVAL_ADJUST_DURATION',
      now: T0 + MIN,
      deltaSeconds: 60,
    }).state;
    expect(longer.intervals[0]!.targetSeconds).toBe(360);
    expect(toRuntime(longer).targets).toEqual({ iv0: 360 });
    expect(play(longer, { type: 'TICK', now: T0 + 5 * MIN }).state.current!.index).toBe(0);
    const shorter = play(s, {
      type: 'INTERVAL_ADJUST_DURATION',
      now: T0 + 2 * MIN,
      deltaSeconds: -600,
    });
    expect(shorter.state.intervals[0]).toMatchObject({
      status: 'done',
      actualDurationSeconds: 120,
    });
    expect(nextAlarmAt(longer, T0 + MIN)).toBe(T0 + 6 * MIN);
  });

  it('finishing mid-run marks the current interval partial and the rest skipped', () => {
    const r = play(
      start(runningRows()),
      { type: 'TICK', now: T0 + 8 * MIN },
      { type: 'FINISH', now: T0 + 8 * MIN },
    );
    expect(r.state.intervals.map((i) => i.status)).toEqual([
      'done',
      'partial',
      'skipped',
      'skipped',
      'skipped',
      'skipped',
    ]);
    expect(r.state.intervals[1]!.actualDurationSeconds).toBe(180);
    expect(outcomeOf(r.changes)).toBe('partial');
  });
});

describe('time and resume', () => {
  it('clock skew: now before startedAt clamps to zero, never negative', () => {
    const s = upperBody();
    const past = T0 - 3600 * S;
    expect(activeMs(s, past)).toBe(0);
    const r = play(s, { type: 'COMPLETE_SET', now: past }, { type: 'PAUSE', now: past - MIN });
    expect(r.state.rest!.startActiveMs).toBe(0);
    expect(r.state.pausedAt).toBe(T0);
    expect(restRemainingMs(r.state, past)).toBe(90 * S);
    const resumed = play(r.state, { type: 'RESUME', now: past });
    expect(resumed.state.accumulatedPauseMs).toBe(0);
    expect(pausedMs(resumed.state, past)).toBe(0);
    expect(intervalElapsedMs(s, past)).toBe(0);
    expect(intervalRemainingMs(s, past)).toBe(0);
    expect(workElapsedMs(s, past)).toBe(0);
    expect(restRemainingMs(s, past)).toBe(0);
  });

  it('runtime round-trip restores the exact state', () => {
    const s = play(upperBody(), { type: 'PAUSE', now: T0 + MIN }).state;
    const rows = {
      ...strengthRows([
        { sets: 3, reps: 10, weight: 60, rest: 90 },
        { sets: 3, reps: 10, weight: 50, rest: 60 },
      ]),
      runtimeState: toRuntime(s),
    };
    expect(hydrate(rows, { autoRest: false })).toEqual(s);
    // An unreadable runtime state falls back to a fresh one instead of crashing.
    const broken = hydrate(
      { ...rows, runtimeState: { schemaVersion: 1 } as never },
      { autoRest: true },
    );
    expect(broken.lifecycle).toBe('active');
  });

  it('flags stale executions after 12 hours and has no alarm while paused', () => {
    const s = upperBody();
    expect(isStale(s, T0 + STALE_MS - 1)).toBe(false);
    expect(isStale(s, T0 + STALE_MS + 1)).toBe(true);
    expect(nextAlarmAt(s, T0)).toBeNull();
    expect(nextAlarmAt(play(s, { type: 'PAUSE', now: T0 }).state, T0)).toBeNull();
    // Pause/resume twice are no-ops.
    expect(reduce(s, { type: 'RESUME', now: T0 }).state).toBe(s);
  });
});

describe('deriveOutcome tolerances', () => {
  const finishWith = (reps: number, weight = 60) =>
    outcomeOf(
      play(
        start(strengthRows([{ sets: 1, reps: 10, weight: 60 }])),
        { type: 'COMPLETE_SET', now: T0, reps, weightKg: weight },
        { type: 'FINISH', now: T0 + MIN },
      ).changes,
    );

  it('reps within ±10 % stay as planned; load changes are modifications', () => {
    expect(finishWith(9)).toBe('as_planned');
    expect(finishWith(11)).toBe('as_planned');
    expect(finishWith(8)).toBe('modified');
    expect(finishWith(10, 62.5)).toBe('modified');
  });

  it('nothing done is partial', () => {
    expect(deriveOutcome(upperBody())).toBe('partial');
    expect(deriveOutcome(start(runningRows()))).toBe('partial');
  });
});

describe('buildSnapshot', () => {
  it('freezes a template in order with exercise names and tracking', () => {
    const meta = { id: '', createdAt: '', updatedAt: '', deletedAt: null, templateId: 't' };
    const snap = buildSnapshot(
      {
        id: 't',
        name: 'Mix',
        type: 'gym',
        exercises: [
          {
            ...meta,
            exerciseId: 'b',
            orderIndex: 1,
            sets: 2,
            targetReps: 8,
            targetDurationSeconds: null,
            targetWeightKg: 40,
            restSeconds: 60,
            supersetGroup: null,
            notes: null,
          },
          {
            ...meta,
            exerciseId: 'a',
            orderIndex: 0,
            sets: 3,
            targetReps: null,
            targetDurationSeconds: 45,
            targetWeightKg: null,
            restSeconds: null,
            supersetGroup: null,
            notes: null,
          },
        ],
        intervals: [
          {
            ...meta,
            orderIndex: 0,
            kind: 'run',
            durationSeconds: 60,
            speedKmh: 9,
            inclinePercent: null,
            label: null,
          },
        ],
      },
      (id) => (id === 'a' ? { name: 'Plank', tracking: 'duration' } : undefined),
    );
    expect(snap.exercises.map((e) => [e.exerciseId, e.name, e.tracking, e.orderIndex])).toEqual([
      ['a', 'Plank', 'duration', 0],
      ['b', 'b', 'weight_reps', 1],
    ]);
    expect(snap.intervals[0]).toMatchObject({ kind: 'run', durationSeconds: 60 });
  });
});
