/**
 * Goal progress (step 24, FS §34). The app never changes a goal's status on its own; it
 * only suggests "Mark achieved?" when the target is reached. Estimates (FS §80) exist only
 * for weight/measurement goals with a sufficient trend, as a range of weeks, and never when
 * the trend points away from the target.
 */
export type GoalLike = {
  type: string;
  targetValue: number | null;
  startValue: number | null;
};

export type GoalProgress = {
  current: number | null;
  start: number | null;
  target: number | null;
  /** 0–1 */
  fraction: number | null;
  remaining: number | null;
  reached: boolean;
};

/** `current`: latest weight/measurement, sessions per week, completion %, km per week. */
export function goalProgress(goal: GoalLike, current: number | null): GoalProgress {
  const target = goal.targetValue;
  if (target === null || current === null) {
    return {
      current,
      start: goal.startValue,
      target,
      fraction: null,
      remaining: null,
      reached: false,
    };
  }
  // Weight/measurement move from a start towards a target (up or down).
  if ((goal.type === 'weight' || goal.type === 'measurement') && goal.startValue !== null) {
    const span = target - goal.startValue;
    const done = current - goal.startValue;
    const fraction = span === 0 ? 1 : Math.min(1, Math.max(0, done / span));
    const reached = span >= 0 ? current >= target : current <= target;
    return {
      current,
      start: goal.startValue,
      target,
      fraction,
      remaining: Math.abs(target - current),
      reached,
    };
  }
  // Rate goals (per week / %): higher is better.
  const fraction = target > 0 ? Math.min(1, Math.max(0, current / target)) : null;
  return {
    current,
    start: goal.startValue,
    target,
    fraction,
    remaining: Math.max(0, target - current),
    reached: current >= target,
  };
}

/** Weeks to target as [low, high] at the recorded trend, or null when not meaningful. */
export function estimateWeeks(
  current: number,
  target: number,
  perWeek: number | null,
): [number, number] | null {
  if (perWeek === null || Math.abs(perWeek) < 1e-6) return null;
  const gap = target - current;
  if (gap === 0 || Math.sign(gap) !== Math.sign(perWeek)) return null;
  const weeks = gap / perWeek;
  if (!Number.isFinite(weeks) || weeks > 156) return null;
  return [Math.max(1, Math.floor(weeks * 0.95)), Math.ceil(weeks * 1.1)];
}
