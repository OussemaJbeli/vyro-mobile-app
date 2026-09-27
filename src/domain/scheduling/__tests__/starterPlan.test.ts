import { planStarter, planToRules, type IsoWeekday, type StarterGoal } from '../starterPlan';

const days = (...d: number[]) => d as IsoWeekday[];

describe('planStarter', () => {
  it('follows the roadmap table for a full gym', () => {
    expect(
      planStarter({ goal: 'build_muscle', trainingDays: days(1, 3, 5), equipment: 'full_gym' }),
    ).toEqual({
      days: [
        { weekday: 1, template: 'push' },
        { weekday: 3, template: 'pull' },
        { weekday: 5, template: 'leg_day' },
      ],
      restDays: [2, 4, 6, 7],
    });
    expect(
      planStarter({
        goal: 'lose_weight',
        trainingDays: days(2, 4),
        equipment: 'full_gym',
      }).days.map((d) => d.template),
    ).toEqual(['full_body', 'interval_run_35']);
    expect(
      planStarter({
        goal: 'consistency',
        trainingDays: days(1, 2, 4, 6),
        equipment: 'full_gym',
      }).days.map((d) => d.template),
    ).toEqual(['upper_body', 'leg_day', 'run_30', 'abs']);
  });

  it('treats run_better like lose_weight and custom like consistency', () => {
    const run = planStarter({
      goal: 'run_better',
      trainingDays: days(1, 3, 5),
      equipment: 'full_gym',
    });
    const lose = planStarter({
      goal: 'lose_weight',
      trainingDays: days(1, 3, 5),
      equipment: 'full_gym',
    });
    expect(run).toEqual(lose);
    const custom = planStarter({ goal: 'custom', trainingDays: days(1, 3), equipment: 'full_gym' });
    expect(custom.days.map((d) => d.template)).toEqual(['full_body', 'run_30']);
  });

  it('replaces gym templates without a full gym and keeps runs', () => {
    const plan = planStarter({
      goal: 'build_muscle',
      trainingDays: days(1, 2, 3, 4, 5),
      equipment: 'bodyweight',
    });
    const t = plan.days.map((d) => d.template);
    expect(t.some((x) => ['upper_body', 'leg_day', 'push', 'pull', 'full_body'].includes(x))).toBe(
      false,
    );
    expect(t).toEqual(['home_workout', 'home_workout', 'abs', 'home_workout', 'abs']);
    const cardio = planStarter({
      goal: 'lose_weight',
      trainingDays: days(1, 3),
      equipment: 'home_dumbbells',
    });
    expect(cardio.days.map((d) => d.template)).toEqual(['home_workout', 'interval_run_35']);
  });

  it('handles 0, 1, 6 and 7 days, duplicates and order', () => {
    expect(planStarter({ goal: 'consistency', trainingDays: [], equipment: 'full_gym' })).toEqual({
      days: [],
      restDays: [1, 2, 3, 4, 5, 6, 7],
    });
    expect(
      planStarter({ goal: 'build_muscle', trainingDays: days(3), equipment: 'full_gym' }).days,
    ).toEqual([{ weekday: 3, template: 'full_body' }]);
    const seven = planStarter({
      goal: 'build_muscle',
      trainingDays: days(7, 1, 2, 3, 4, 5, 6, 6),
      equipment: 'full_gym',
    });
    expect(seven.days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(seven.days.map((d) => d.template)).toEqual([
      'push',
      'pull',
      'leg_day',
      'upper_body',
      'abs',
      'full_body',
      'abs',
    ]);
    expect(seven.restDays).toEqual([]);
    for (const goal of ['lose_weight', 'consistency'] as StarterGoal[]) {
      expect(
        planStarter({ goal, trainingDays: days(1, 2, 3, 4, 5, 6), equipment: 'full_gym' }).days,
      ).toHaveLength(6);
    }
  });

  it('groups a plan into weekly rules plus one rest rule', () => {
    const plan = planStarter({
      goal: 'build_muscle',
      trainingDays: days(1, 4),
      equipment: 'full_gym',
    });
    expect(planToRules(plan)).toEqual([
      { template: 'full_body', weekdays: [1, 4] },
      { template: 'rest', weekdays: [2, 3, 5, 6, 7] },
    ]);
    expect(planToRules({ days: [{ weekday: 1, template: 'abs' }], restDays: [] })).toEqual([
      { template: 'abs', weekdays: [1] },
    ]);
  });
});
