/**
 * Data summarizer (step 31, FS §41): pure, local. Turns raw app data into the minimal
 * payload each AI method needs. Excluded by default: names, notes (opt-in), date of birth
 * (age bracket only), photos and any file path (never), exact timestamps (days only).
 */

export type SessionFact = {
  date: string; // YYYY-MM-DD
  weekday: number; // 1 = Monday … 7 = Sunday
  type: string; // gym | running | abs | rest | …
  status: string; // planned | completed | modified | skipped | cancelled | in_progress
  progress: number | null; // 0…1 of planned work, null when not counted
};

export type StrengthFact = {
  exercise: string;
  bestWeightKg: number | null;
  bestReps: number | null;
  sets: number;
};
export type RunFact = {
  date: string;
  minutes: number;
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  completion: number;
};
export type Substitution = { from: string; to: string; count: number };

/** Everything the data layer may hand to the summarizer. Nothing else can reach a provider. */
export type CoachData = {
  period: { start: string; end: string };
  units: { weight: 'kg' | 'lb'; distance: 'km' | 'mi'; speed: 'kmh' | 'mph' };
  ageBracket: string | null; // e.g. "30-39", never the date of birth
  goal: {
    type: string;
    target: number | null;
    unit: string | null;
    start: number | null;
    targetDate: string | null;
  } | null;
  weights: { date: string; kg: number }[];
  sessions: SessionFact[];
  strength: StrengthFact[];
  runs: RunFact[];
  substitutions: Substitution[];
  /** Upcoming planned sessions (opaque ids, no titles) so schedule advice can name one. */
  upcoming: { id: string; date: string; startTime: string | null; type: string }[];
  /** Only filled when the user opted in to "Include my workout notes". */
  notes: string[];
};

export type AIMethod =
  | 'summarizeWeek'
  | 'analyzeProgress'
  | 'analyzeTraining'
  | 'analyzeRunning'
  | 'estimateTrend'
  | 'improveSchedule'
  | 'adaptWorkout'
  | 'suggestAlternative'
  | 'chat';

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Weight trend in kg per week from the first and last entries of the period. */
export function weightTrend(weights: CoachData['weights']) {
  if (!weights.length) return { currentKg: null, changeKg: null, perWeekKg: null, entries: 0 };
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0]!;
  const last = sorted.at(-1)!;
  const days = Math.max(1, (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000);
  const change = last.kg - first.kg;
  return {
    currentKg: round(last.kg),
    changeKg: round(change),
    perWeekKg: sorted.length > 1 ? round((change / days) * 7, 2) : null,
    entries: sorted.length,
  };
}

/** Counts per activity type: planned, done, partly done, skipped, missed; completion %. */
export function sessionCounts(sessions: SessionFact[], today: string) {
  const byType: Record<
    string,
    { planned: number; done: number; partial: number; skipped: number; missed: number }
  > = {};
  const progress: number[] = [];
  for (const s of sessions) {
    if (s.type === 'rest' || s.status === 'cancelled') continue;
    const c = (byType[s.type] ??= { planned: 0, done: 0, partial: 0, skipped: 0, missed: 0 });
    c.planned += 1;
    if (s.status === 'completed') c.done += 1;
    else if (s.status === 'modified' || (s.progress ?? 0) > 0) c.partial += 1;
    else if (s.status === 'skipped') c.skipped += 1;
    else if (s.date < today) c.missed += 1;
    if (s.date <= today && s.progress !== null) progress.push(s.progress);
  }
  const rate = avg(progress);
  return { byType, completionPct: rate === null ? null : Math.round(rate * 100) };
}

/** Completion per weekday (for schedule advice): what usually gets done on which day. */
export function weekdayPattern(sessions: SessionFact[], today: string) {
  const out: Record<number, { planned: number; completionPct: number | null }> = {};
  for (let d = 1; d <= 7; d++) {
    const list = sessions.filter(
      (s) => s.weekday === d && s.type !== 'rest' && s.status !== 'cancelled' && s.date <= today,
    );
    const p = avg(list.map((s) => s.progress ?? 0));
    out[d] = { planned: list.length, completionPct: p === null ? null : Math.round(p * 100) };
  }
  return out;
}

export function runningSummary(runs: RunFact[]) {
  const speeds = runs.map((r) => r.avgSpeedKmh).filter((v): v is number => v !== null);
  const maxes = runs.map((r) => r.maxSpeedKmh).filter((v): v is number => v !== null);
  const first = speeds[0];
  const last = speeds.at(-1);
  return {
    runs: runs.length,
    totalMinutes: Math.round(runs.reduce((a, r) => a + r.minutes, 0)),
    avgSpeedKmh: speeds.length ? round(avg(speeds)!) : null,
    bestSpeedKmh: maxes.length ? round(Math.max(...maxes)) : null,
    speedChangeKmh: first !== undefined && last !== undefined ? round(last - first) : null,
    avgCompletionPct: runs.length ? Math.round(avg(runs.map((r) => r.completion))! * 100) : null,
  };
}

export function strengthSummary(strength: StrengthFact[]) {
  const top = [...strength].sort((a, b) => b.sets - a.sets).slice(0, 8);
  return {
    exercises: strength.length,
    totalSets: strength.reduce((a, s) => a + s.sets, 0),
    top: top.map((s) => ({
      exercise: s.exercise,
      sets: s.sets,
      bestWeightKg: s.bestWeightKg === null ? null : round(s.bestWeightKg),
      bestReps: s.bestReps,
    })),
  };
}

export type Extra = {
  /** adaptWorkout: the workout's exercises (names, sets, reps) and the user's constraints. */
  workout?: {
    templateId: string;
    name: string;
    exercises: { exerciseId: string; exercise: string; sets: number; reps: number | null }[];
  };
  /** Exercises the user can do with their equipment (ids the AI may suggest). */
  candidates?: { id: string; name: string }[];
  constraints?: string;
  /** suggestAlternative: the exercise and the equipment the user has. */
  exercise?: { name: string; muscles: string[] };
  equipment?: string[];
  /** chat: the user's question. */
  question?: string;
};

/**
 * The payload for one method. Only whitelisted, aggregated keys; `notes` appear only when
 * the caller opted in (CoachData.notes is empty otherwise).
 */
export function buildPayload(method: AIMethod, data: CoachData, today: string, extra: Extra = {}) {
  const period = { start: data.period.start, end: data.period.end };
  const units = data.units;
  const counts = sessionCounts(data.sessions, today);
  const notes = data.notes.length ? { notes: data.notes.slice(0, 10) } : {};
  const goal = data.goal ? { goal: data.goal } : {};
  switch (method) {
    case 'summarizeWeek':
    case 'chat':
      return {
        period,
        units,
        ...goal,
        weight: weightTrend(data.weights),
        sessions: counts,
        running: runningSummary(data.runs),
        strength: strengthSummary(data.strength),
        substitutions: data.substitutions.slice(0, 3),
        ...(method === 'chat' && extra.question ? { question: extra.question.slice(0, 1000) } : {}),
        ...notes,
      };
    case 'analyzeProgress':
    case 'estimateTrend':
      return {
        period,
        units,
        ...goal,
        ...(data.ageBracket ? { ageBracket: data.ageBracket } : {}),
        weight: weightTrend(data.weights),
        sessions: { completionPct: counts.completionPct },
      };
    case 'analyzeTraining':
      return {
        period,
        units,
        sessions: counts,
        strength: strengthSummary(data.strength),
        substitutions: data.substitutions.slice(0, 3),
        ...notes,
      };
    case 'analyzeRunning':
      return { period, units, running: runningSummary(data.runs), ...notes };
    case 'improveSchedule':
      return {
        period,
        sessions: counts,
        weekdays: weekdayPattern(data.sessions, today),
        upcoming: data.upcoming.slice(0, 21),
      };
    case 'adaptWorkout':
      return {
        units,
        ...(extra.workout ? { workout: extra.workout } : {}),
        ...(extra.constraints ? { constraints: extra.constraints.slice(0, 500) } : {}),
        ...(extra.equipment ? { equipment: extra.equipment } : {}),
        ...(extra.candidates ? { candidates: extra.candidates.slice(0, 40) } : {}),
      };
    case 'suggestAlternative':
      return {
        ...(extra.exercise ? { exercise: extra.exercise } : {}),
        ...(extra.equipment ? { equipment: extra.equipment } : {}),
        ...(extra.candidates ? { candidates: extra.candidates.slice(0, 40) } : {}),
      };
  }
}

export type Payload = ReturnType<typeof buildPayload>;

/** Stable stringify (sorted keys): the cache key and what the preview shows. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
