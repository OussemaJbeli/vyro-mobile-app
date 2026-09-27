import { plannedStats, type PExecution, type PSession } from '@/domain/analytics/metrics';
import { addDaysIso, weekStart } from '@/domain/scheduling/recurrence';
import { streaks } from '@/domain/streaks/streak';
import { useCompletedBetween, useProfile, useSessionsForRange } from '@/hooks/data';
import { toLocalDate, today } from '@/utils/dates';

export const toPSession = (s: {
  scheduledDate: string;
  type: string;
  status: string;
  rescheduleCount: number;
  originalDate: string;
}): PSession => ({
  date: s.scheduledDate,
  type: s.type,
  status: s.status,
  rescheduleCount: s.rescheduleCount,
  originalDate: s.originalDate,
});

export const toPExecution = (x: {
  startedAt: string;
  type: string;
  scheduledSessionId: string | null;
  activeSeconds: number | null;
  distanceKm: number | null;
  outcome: string | null;
}): PExecution => ({
  date: toLocalDate(x.startedAt),
  type: x.type,
  scheduledSessionId: x.scheduledSessionId,
  activeSeconds: x.activeSeconds,
  distanceKm: x.distanceKm,
  outcome: x.outcome,
});

export function useWeekBounds() {
  const profile = useProfile();
  const day = today();
  const startsOn: 0 | 1 = profile.data?.weekStartsOn === 0 ? 0 : 1;
  const from = weekStart(day, startsOn);
  return { day, from, to: addDaysIso(from, 6), startsOn };
}

/** Sessions + completed executions in [from, to] as analytics rows. */
export function usePeriod(from: string, to: string) {
  const sessions = useSessionsForRange(from, to);
  const executions = useCompletedBetween(from, to);
  return {
    isLoading: sessions.isLoading || executions.isLoading,
    sessions: (sessions.data ?? []).map(toPSession),
    executions: (executions.data ?? []).map(toPExecution),
  };
}

export function useThisWeek() {
  const { from, to } = useWeekBounds();
  const p = usePeriod(from, to);
  return { ...p, stats: plannedStats(p.sessions, p.executions) };
}

/** Current and longest streak over the last year (step 24 definition). */
export function useStreaks() {
  const day = today();
  const since = addDaysIso(day, -365);
  const p = usePeriod(since, day);
  return {
    isLoading: p.isLoading,
    ...streaks({
      sessions: p.sessions,
      adhocDates: p.executions.filter((x) => x.scheduledSessionId === null).map((x) => x.date),
      today: day,
      since,
    }),
  };
}
