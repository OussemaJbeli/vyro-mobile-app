import { retroLog } from '../retro';
import { MIN, T0, runningRows, start, strengthRows } from '../testing/fixtures';

describe('retroLog', () => {
  it('replays strength actuals through the reducer (skips → partial)', () => {
    const s = start(
      strengthRows([
        { sets: 2, reps: 10, weight: 60, rest: 90 },
        { sets: 1, reps: 12 },
      ]),
    );
    const r = retroLog(s, {
      sets: [
        [
          { done: true, reps: 10, weightKg: 60, durationSeconds: null },
          { done: true, reps: 8, weightKg: 62.5, durationSeconds: null },
        ],
        [{ done: false, reps: 12, weightKg: null, durationSeconds: null }],
      ],
      intervals: [],
      endMs: T0 + 45 * MIN,
    });
    expect(r.state.lifecycle).toBe('completed');
    expect(
      r.state.exercises[0]!.sets.map((x) => [x.status, x.actualReps, x.actualWeightKg]),
    ).toEqual([
      ['done', 10, 60],
      ['done', 8, 62.5],
    ]);
    expect(r.changes.at(-1)).toMatchObject({
      kind: 'complete',
      outcome: 'partial',
      activeSeconds: 45 * 60,
    });
  });

  it('replays a run with edited duration/speed and a skipped interval', () => {
    const s = start(runningRows());
    const intervals = s.intervals.map((iv) => ({
      done: true,
      durationSeconds: iv.plannedDurationSeconds,
      speedKmh: iv.plannedSpeedKmh,
    }));
    intervals[1] = { done: true, durationSeconds: 480, speedKmh: 10 };
    intervals[2] = { done: false, durationSeconds: 300, speedKmh: null };
    const r = retroLog(s, { sets: [], intervals, endMs: 0 });
    expect(r.state.intervals.map((i) => i.status)).toEqual([
      'done',
      'done',
      'skipped',
      'done',
      'done',
      'done',
    ]);
    expect(r.state.intervals[1]).toMatchObject({ actualDurationSeconds: 480, actualSpeedKmh: 10 });
    expect(r.changes.at(-1)).toMatchObject({
      kind: 'complete',
      outcome: 'partial',
      activeSeconds: 300 + 480 + 900,
    });
  });
});
