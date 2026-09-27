import { estimateWeeks, goalProgress } from '@/domain/goals/progress';

import { muscleFrequency, plannedStats, reschedulingStats, runningTotals } from '../metrics';
import { epley, exerciseRecords, runningRecords } from '../records';

const s = (
  type: string,
  status: string,
  extra: Partial<{ rescheduleCount: number; originalDate: string; date: string }> = {},
) => ({
  date: '2026-09-22',
  type,
  status,
  rescheduleCount: 0,
  originalDate: '2026-09-22',
  ...extra,
});

describe('planned vs completed (FS §33)', () => {
  it('8 planned, 6 completed → 75 % with the per-type breakdown; rest/cancelled excluded; ad-hoc = extra', () => {
    const sessions = [
      s('gym', 'completed'),
      s('gym', 'modified'),
      s('gym', 'completed'),
      s('running', 'completed'),
      s('running', 'skipped'),
      s('abs', 'completed'),
      s('home', 'completed'),
      s('abs', 'planned'),
      s('rest', 'planned'),
      s('gym', 'cancelled'),
    ];
    const r = plannedStats(sessions, [
      {
        date: '2026-09-22',
        type: 'gym',
        scheduledSessionId: null,
        activeSeconds: 100,
        distanceKm: null,
        outcome: null,
      },
    ]);
    expect(r).toMatchObject({ planned: 8, completed: 6, extra: 1, rate: 0.75 });
    expect(r.perType).toEqual({
      gym: { planned: 3, completed: 3 },
      running: { planned: 2, completed: 1 },
      abs: { planned: 3, completed: 2 },
    });
    expect(plannedStats([s('rest', 'planned')], []).rate).toBeNull();
  });

  it('muscle frequency, running totals, rescheduling', () => {
    expect(
      muscleFrequency([
        { primaryMuscle: 'chest', secondaryMuscles: ['triceps'] },
        { primaryMuscle: 'chest', secondaryMuscles: [] },
        { primaryMuscle: 'back', secondaryMuscles: [] },
      ]),
    ).toEqual([
      { muscle: 'chest', sets: 2 },
      { muscle: 'back', sets: 1 },
      { muscle: 'triceps', sets: 0.5 },
    ]);
    const run = { date: 'd', type: 'running', scheduledSessionId: null, outcome: null };
    expect(
      runningTotals([
        { ...run, activeSeconds: 1800, distanceKm: 5 },
        { ...run, activeSeconds: 1800, distanceKm: 4 },
      ]),
    ).toEqual({ runs: 2, distanceKm: 9, seconds: 3600, avgSpeedKmh: 9 });
    expect(
      reschedulingStats([
        s('gym', 'planned', { rescheduleCount: 1, originalDate: '2026-09-20', date: '2026-09-22' }),
        s('gym', 'planned'),
      ]),
    ).toEqual({ moved: 1, avgShiftDays: 2 });
  });
});

describe('personal records', () => {
  it('heaviest, estimated 1RM, reps and holds; the first session is a baseline', () => {
    const set = (
      executionId: string,
      date: string,
      reps: number | null,
      weightKg: number | null,
      durationSeconds: number | null = null,
    ) => ({ exerciseId: 'bench', executionId, date, reps, weightKg, durationSeconds });
    const [r] = exerciseRecords([
      set('a', '2026-09-01', 10, 60),
      set('b', '2026-09-08', 8, 65),
      set('c', '2026-09-15', 12, 60),
    ]);
    expect(r).toMatchObject({ heaviestKg: 65, best1RmKg: epley(60, 12) });
    expect(r!.setIn).toEqual({ b: ['weight', '1rm'], c: ['1rm'] });
    expect(epley(100, 1)).toBe(100);
    expect(
      runningRecords([
        { executionId: 'r1', activeSeconds: 1800, distanceKm: 5 },
        { executionId: 'r2', activeSeconds: 1200, distanceKm: 4 },
      ]),
    ).toEqual({
      longest: { executionId: 'r1', seconds: 1800 },
      fastest: { executionId: 'r2', kmh: 12 },
    });
  });
});

describe('goal progress and estimates', () => {
  it('weight goal going down; rate goals; suggestion when reached', () => {
    const g = goalProgress({ type: 'weight', startValue: 79.2, targetValue: 70 }, 74.6);
    expect(g.fraction).toBeCloseTo(0.5, 6);
    expect(g.remaining).toBeCloseTo(4.6, 6);
    expect(g.reached).toBe(false);
    expect(goalProgress({ type: 'weight', startValue: 79.2, targetValue: 70 }, 69.8).reached).toBe(
      true,
    );
    expect(goalProgress({ type: 'frequency', startValue: null, targetValue: 4 }, 3)).toMatchObject({
      fraction: 0.75,
      remaining: 1,
    });
    expect(
      goalProgress({ type: 'custom', startValue: null, targetValue: null }, null).fraction,
    ).toBeNull();
  });

  it('estimates only toward the target, as a range', () => {
    expect(estimateWeeks(74.6, 70, -0.4)).toEqual([10, 13]);
    expect(estimateWeeks(74.6, 70, 0.3)).toBeNull(); // trend points away
    expect(estimateWeeks(74.6, 70, null)).toBeNull();
    expect(estimateWeeks(74.6, 70, -0.001)).toBeNull(); // > 3 years: not meaningful
  });
});
