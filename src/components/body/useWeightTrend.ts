import { rate28, smooth, weeklyChange, type Reading } from '@/domain/progress/trend';
import { useGoals, useWeights } from '@/hooks/data';
import { now as clockNow } from '@/utils/clock';

/** Weight readings (canonical kg) in a range + trend figures and the goal direction. */
export function useWeightTrend(fromIso?: string) {
  const weights = useWeights(fromIso ? { from: fromIso } : {});
  const goals = useGoals('active');
  const entries = weights.data ?? [];
  const readings: Reading[] = entries.map((w) => ({
    t: Date.parse(w.recordedAt),
    value: w.valueKg,
  }));
  const now = clockNow().getTime();
  const goal = (goals.data ?? []).find(
    (g) => g.type === 'weight' && g.targetValue !== null && g.startValue !== null,
  );
  const goalDirection = goal ? (Math.sign(goal.targetValue! - goal.startValue!) as -1 | 0 | 1) : 0;
  return {
    isLoading: weights.isLoading,
    entries,
    readings,
    points: smooth(readings),
    weekly: weeklyChange(readings, now),
    rate: rate28(readings, now),
    goalDirection,
  };
}
