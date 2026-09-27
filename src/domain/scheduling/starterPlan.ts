/**
 * Starter weekly plan proposed during onboarding (step 11). Pure: goal + training days +
 * equipment level → which seed template runs on which weekday. Unselected days become
 * planned rest, so Home shows a Recovery Day instead of "nothing" (UI §5).
 */

export type StarterGoal = 'lose_weight' | 'build_muscle' | 'run_better' | 'consistency' | 'custom';
export type EquipmentLevel = 'full_gym' | 'home_dumbbells' | 'bodyweight';

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Seed template keys (src/db/seed/data/content.ts). */
export type StarterTemplateKey =
  | 'upper_body'
  | 'leg_day'
  | 'push'
  | 'pull'
  | 'full_body'
  | 'abs'
  | 'home_workout'
  | 'recovery'
  | 'run_30'
  | 'interval_run_35';

export type StarterPlan = {
  days: { weekday: IsoWeekday; template: StarterTemplateKey }[];
  restDays: IsoWeekday[];
};

const GYM: ReadonlySet<StarterTemplateKey> = new Set([
  'upper_body',
  'leg_day',
  'push',
  'pull',
  'full_body',
]);

/** Rotation per goal, indexed by number of training days (2, 3, 4, 5+). */
const ROTATIONS: Record<
  'muscle' | 'cardio' | 'consistency',
  Record<2 | 3 | 4 | 5, StarterTemplateKey[]>
> = {
  muscle: {
    2: ['full_body', 'full_body'],
    3: ['push', 'pull', 'leg_day'],
    4: ['upper_body', 'leg_day', 'push', 'pull'],
    5: ['push', 'pull', 'leg_day', 'upper_body', 'abs'],
  },
  cardio: {
    2: ['full_body', 'interval_run_35'],
    3: ['full_body', 'interval_run_35', 'abs'],
    4: ['upper_body', 'run_30', 'leg_day', 'interval_run_35'],
    5: ['upper_body', 'run_30', 'abs', 'leg_day', 'interval_run_35'],
  },
  consistency: {
    2: ['full_body', 'run_30'],
    3: ['upper_body', 'leg_day', 'run_30'],
    4: ['upper_body', 'leg_day', 'run_30', 'abs'],
    5: ['upper_body', 'leg_day', 'run_30', 'abs', 'full_body'],
  },
};

const family = (goal: StarterGoal) =>
  goal === 'build_muscle'
    ? 'muscle'
    : goal === 'lose_weight' || goal === 'run_better'
      ? 'cardio'
      : 'consistency';

/** Extra days beyond five cycle through these, so 6–7 day plans stay varied. */
const EXTRA: Record<ReturnType<typeof family>, StarterTemplateKey[]> = {
  muscle: ['full_body', 'abs'],
  cardio: ['abs', 'run_30'],
  consistency: ['run_30', 'abs'],
};

export function planStarter(input: {
  goal: StarterGoal;
  trainingDays: IsoWeekday[];
  equipment: EquipmentLevel;
}): StarterPlan {
  const days = [...new Set(input.trainingDays)].sort((a, b) => a - b) as IsoWeekday[];
  const restDays = ([1, 2, 3, 4, 5, 6, 7] as IsoWeekday[]).filter((d) => !days.includes(d));
  if (days.length === 0) return { days: [], restDays };

  const fam = family(input.goal);
  const base =
    days.length === 1
      ? [ROTATIONS[fam][2][0]!]
      : ROTATIONS[fam][Math.min(days.length, 5) as 2 | 3 | 4 | 5];
  const rotation = [...base];
  for (let i = rotation.length; i < days.length; i++) rotation.push(EXTRA[fam][(i - 5) % 2]!);

  // Without a full gym, gym sessions become home workouts, alternating with abs from the
  // third one on so the week isn't the same session every day.
  let homeCount = 0;
  const adapted = rotation.map((t) => {
    if (input.equipment === 'full_gym' || !GYM.has(t)) return t;
    homeCount += 1;
    return homeCount >= 3 && homeCount % 2 === 1 ? 'abs' : 'home_workout';
  });

  return { days: days.map((weekday, i) => ({ weekday, template: adapted[i]! })), restDays };
}

/** Groups the plan into one weekly rule per template (plus one rest rule). */
export function planToRules(
  plan: StarterPlan,
): { template: StarterTemplateKey | 'rest'; weekdays: IsoWeekday[] }[] {
  const byTemplate = new Map<StarterTemplateKey, IsoWeekday[]>();
  for (const { weekday, template } of plan.days) {
    byTemplate.set(template, [...(byTemplate.get(template) ?? []), weekday]);
  }
  const rules: { template: StarterTemplateKey | 'rest'; weekdays: IsoWeekday[] }[] = [
    ...byTemplate,
  ].map(([template, weekdays]) => ({ template, weekdays }));
  if (plan.restDays.length) rules.push({ template: 'rest', weekdays: plan.restDays });
  return rules;
}
