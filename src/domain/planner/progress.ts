/**
 * Day and month scores for the Plan screen: how much of the planned work was done.
 * Pure: sessions + per-session work fractions (from logged sets / intervals).
 */
export type ScoreSession = { id: string; type: string; status: string; scheduledDate: string };

export type Rating = 'excellent' | 'good' | 'bad';

/** Logged work of one session's latest execution: done units over planned units. */
export type WorkCount = { done: number; total: number };

/** 0…1 progress of one session. Rest days and cancelled sessions don't count (null). */
export function sessionProgress(s: ScoreSession, work: WorkCount | undefined): number | null {
  if (s.type === 'rest' || s.status === 'cancelled') return null;
  if (s.status === 'completed') return 1;
  if (work && work.total > 0) return Math.min(1, work.done / work.total);
  // Finished with changes but nothing countable (e.g. logged afterwards): mostly done.
  if (s.status === 'modified') return 0.75;
  return 0;
}

/** Average progress of a day's counted sessions; null when nothing counts (rest/empty). */
export function dayProgress(
  sessions: readonly ScoreSession[],
  work: ReadonlyMap<string, WorkCount>,
): number | null {
  const values = sessions
    .map((s) => sessionProgress(s, work.get(s.id)))
    .filter((v): v is number => v !== null);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** ≥ 85 % excellent, ≥ 50 % good, below that bad. */
export function rating(progress: number): Rating {
  return progress >= 0.85 ? 'excellent' : progress >= 0.5 ? 'good' : 'bad';
}

export type PeriodSummary = {
  progress: number | null;
  rating: Rating | null;
  days: Record<Rating, number>;
  restDays: number;
  sessionsDone: number;
  sessionsTotal: number;
};

/**
 * Summary of the days in [from, to] up to `today` (future days are not judged yet).
 * The period score is the average of the day scores.
 */
export function periodSummary(
  sessions: readonly ScoreSession[],
  work: ReadonlyMap<string, WorkCount>,
  { from, to, today }: { from: string; to: string; today: string },
): PeriodSummary {
  const byDay = new Map<string, ScoreSession[]>();
  for (const s of sessions) {
    if (s.scheduledDate < from || s.scheduledDate > to || s.scheduledDate > today) continue;
    byDay.set(s.scheduledDate, [...(byDay.get(s.scheduledDate) ?? []), s]);
  }
  const days: Record<Rating, number> = { excellent: 0, good: 0, bad: 0 };
  const scores: number[] = [];
  let restDays = 0;
  let sessionsDone = 0;
  let sessionsTotal = 0;
  for (const list of byDay.values()) {
    const p = dayProgress(list, work);
    if (p === null) {
      if (list.some((s) => s.type === 'rest')) restDays += 1;
      continue;
    }
    scores.push(p);
    days[rating(p)] += 1;
    for (const s of list) {
      const v = sessionProgress(s, work.get(s.id));
      if (v === null) continue;
      sessionsTotal += 1;
      if (v >= 1) sessionsDone += 1;
    }
  }
  const progress = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  return {
    progress,
    rating: progress === null ? null : rating(progress),
    days,
    restDays,
    sessionsDone,
    sessionsTotal,
  };
}
