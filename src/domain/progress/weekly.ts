/**
 * Home "This Week" counts (step 21). The streak lives in domain/streaks (step 24).
 */
export type DoneExecution = {
  /** Local date of the start (AD-05). */
  date: string;
  type: string;
  activeSeconds: number | null;
};

export type WeekSession = { date: string; type: string; status: string };

export type WeekSummary = {
  gym: number;
  runs: number;
  /** Abs + home workouts. */
  abs: number;
  other: number;
  totalSeconds: number;
  plannedCount: number;
  plannedDone: number;
  /** Days of the week with at least one completed activity. */
  activeDays: number;
};

/** Executions and sessions are expected to be within the week already. */
export function weekSummary(
  done: readonly DoneExecution[],
  sessions: readonly WeekSession[],
): WeekSummary {
  const count = (types: string[]) => done.filter((x) => types.includes(x.type)).length;
  const planned = sessions.filter((s) => s.type !== 'rest' && s.status !== 'cancelled');
  return {
    gym: count(['gym']),
    runs: count(['running']),
    abs: count(['abs', 'home']),
    other: count(['recovery', 'other']),
    totalSeconds: done.reduce((s, x) => s + (x.activeSeconds ?? 0), 0),
    plannedCount: planned.length,
    plannedDone: planned.filter((s) => s.status === 'completed' || s.status === 'modified').length,
    activeDays: new Set(done.map((x) => x.date)).size,
  };
}
