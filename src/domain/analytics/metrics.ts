/**
 * Training analytics (step 24, FS §32–§33). Definitions (also shown in-app):
 * - planned = scheduled sessions with type ≠ rest and status ≠ cancelled;
 * - completed = those with status completed/modified; ad-hoc executions count as "extra";
 * - completion rate = completed / planned, only when planned > 0;
 * - training time = Σ active seconds of completed executions (partial included);
 * - muscle frequency = done sets per primary muscle (+0.5 per secondary muscle).
 */
export type PSession = {
  date: string;
  type: string;
  status: string;
  rescheduleCount: number;
  originalDate: string;
};
export type PExecution = {
  date: string;
  type: string;
  scheduledSessionId: string | null;
  activeSeconds: number | null;
  distanceKm: number | null;
  outcome: string | null;
};

const DONE = new Set(['completed', 'modified']);

export type PlannedStats = {
  planned: number;
  completed: number;
  extra: number;
  rate: number | null;
  perType: Record<string, { planned: number; completed: number }>;
};

export function plannedStats(
  sessions: readonly PSession[],
  executions: readonly PExecution[],
): PlannedStats {
  const planned = sessions.filter((s) => s.type !== 'rest' && s.status !== 'cancelled');
  const perType: PlannedStats['perType'] = {};
  for (const s of planned) {
    const k = s.type === 'home' ? 'abs' : s.type;
    const e = (perType[k] ??= { planned: 0, completed: 0 });
    e.planned++;
    if (DONE.has(s.status)) e.completed++;
  }
  const completed = planned.filter((s) => DONE.has(s.status)).length;
  return {
    planned: planned.length,
    completed,
    extra: executions.filter((x) => x.scheduledSessionId === null).length,
    rate: planned.length ? completed / planned.length : null,
    perType,
  };
}

export const trainingSeconds = (executions: readonly PExecution[]) =>
  executions.reduce((s, x) => s + (x.activeSeconds ?? 0), 0);

export type WeekBucket = {
  week: string;
  sessions: number;
  seconds: number;
  distanceKm: number;
  runSeconds: number;
};

/** Executions bucketed by week start (`weekOf` maps a date to its week start). */
export function weekly(
  executions: readonly PExecution[],
  weeks: readonly string[],
  weekOf: (date: string) => string,
): WeekBucket[] {
  const map = new Map(
    weeks.map((w) => [w, { week: w, sessions: 0, seconds: 0, distanceKm: 0, runSeconds: 0 }]),
  );
  for (const x of executions) {
    const b = map.get(weekOf(x.date));
    if (!b) continue;
    b.sessions++;
    b.seconds += x.activeSeconds ?? 0;
    if (x.type === 'running') {
      b.distanceKm += x.distanceKm ?? 0;
      b.runSeconds += x.activeSeconds ?? 0;
    }
  }
  return [...map.values()];
}

/** Weekly completion rate series (null when nothing was planned that week). */
export function weeklyRate(
  sessions: readonly PSession[],
  weeks: readonly string[],
  weekOf: (d: string) => string,
) {
  return weeks.map(
    (w) =>
      plannedStats(
        sessions.filter((s) => weekOf(s.date) === w),
        [],
      ).rate,
  );
}

export type MuscleSet = { primaryMuscle: string; secondaryMuscles: readonly string[] };

export function muscleFrequency(sets: readonly MuscleSet[]): { muscle: string; sets: number }[] {
  const m = new Map<string, number>();
  for (const s of sets) {
    m.set(s.primaryMuscle, (m.get(s.primaryMuscle) ?? 0) + 1);
    for (const x of s.secondaryMuscles) m.set(x, (m.get(x) ?? 0) + 0.5);
  }
  return [...m.entries()]
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets);
}

export function runningTotals(executions: readonly PExecution[]) {
  const runs = executions.filter((x) => x.type === 'running');
  const km = runs.reduce((s, x) => s + (x.distanceKm ?? 0), 0);
  const sec = runs.reduce((s, x) => s + (x.activeSeconds ?? 0), 0);
  return {
    runs: runs.length,
    distanceKm: km,
    seconds: sec,
    avgSpeedKmh: sec > 0 ? km / (sec / 3600) : null,
  };
}

/** Moved sessions and the average shift in days (from original_date). */
export function reschedulingStats(sessions: readonly (PSession & { date: string })[]) {
  const moved = sessions.filter((s) => s.rescheduleCount > 0);
  const shift = moved.reduce(
    (a, s) => a + Math.abs(Date.parse(s.date) - Date.parse(s.originalDate)) / 86_400_000,
    0,
  );
  return { moved: moved.length, avgShiftDays: moved.length ? shift / moved.length : 0 };
}
