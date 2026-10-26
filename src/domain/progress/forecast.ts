/**
 * Simple, explainable fat-loss forecast (1.3.0). Not a model: calories from MET values,
 * adherence from planned vs completed sessions, pace from the measured weight trend when it
 * exists (it includes diet), otherwise from training calories alone. Pure.
 */
export const KCAL_PER_KG = 7700;

/** MET by activity: HIIT runs ~9.5, easy runs ~7, machine/weights ~5. */
export function metFor(type: string, title = ''): number {
  if (type === 'running') return /easy/i.test(title) ? 7 : 9.5;
  if (type === 'gym') return 5;
  if (type === 'abs' || type === 'home') return 4;
  if (type === 'recovery') return 2.5;
  return 4;
}

/** kcal = MET × body weight (kg) × hours. */
export const kcal = (met: number, weightKg: number, minutes: number) =>
  Math.round(met * weightKg * (minutes / 60));

export type ForecastInput = {
  weightKg: number | null;
  targetKg: number | null;
  /** Measured trend (kg per week, negative = losing); null when not enough weigh-ins. */
  measuredPerWeek: number | null;
  done: { type: string; title: string; minutes: number; daysAgo: number }[];
  /** Past 28 days: planned training sessions (completed + missed/skipped). */
  pastPlanned: number;
  /** Next 28 days of planned sessions (the cycle). */
  upcoming: { type: string; title: string; minutes: number }[];
};

export type Forecast = {
  burned7: number;
  sessions7: number;
  adherence: number | null;
  missed28: number;
  plannedPerWeek: number;
  /** kg per week the forecast uses (negative = losing). */
  perWeek: number | null;
  basis: 'measured' | 'training' | null;
  weeksToGoal: number | null;
};

export function forecast(i: ForecastInput): Forecast {
  const kg = i.weightKg ?? 0;
  const last7 = i.done.filter((d) => d.daysAgo < 7);
  const burned7 = last7.reduce((s, d) => s + kcal(metFor(d.type, d.title), kg, d.minutes), 0);
  const done28 = i.done.filter((d) => d.daysAgo < 28).length;
  const adherence = i.pastPlanned > 0 ? Math.min(1, done28 / i.pastPlanned) : null;
  const plannedPerWeek = Math.round(
    i.upcoming.reduce((s, d) => s + kcal(metFor(d.type, d.title), kg, d.minutes), 0) / 4,
  );
  const trainingPerWeek = -((plannedPerWeek * (adherence ?? 1)) / KCAL_PER_KG);
  const basis =
    i.measuredPerWeek !== null && i.measuredPerWeek < 0
      ? 'measured'
      : kg > 0 && plannedPerWeek > 0
        ? 'training'
        : null;
  const perWeek =
    basis === 'measured' ? i.measuredPerWeek : basis === 'training' ? trainingPerWeek : null;
  const toLose = i.weightKg !== null && i.targetKg !== null ? i.weightKg - i.targetKg : null;
  const weeksToGoal =
    toLose !== null && toLose > 0 && perWeek !== null && perWeek < 0
      ? Math.ceil(toLose / -perWeek)
      : toLose !== null && toLose <= 0
        ? 0
        : null;
  return {
    burned7,
    sessions7: last7.length,
    adherence,
    missed28: Math.max(0, i.pastPlanned - done28),
    plannedPerWeek,
    perWeek: perWeek === null ? null : Math.round(perWeek * 100) / 100,
    basis,
    weeksToGoal,
  };
}

/** Weekly points for the chart: the projection from today, stopping at the target (≤ 26 weeks). */
export function projectWeights(
  fromKg: number,
  perWeek: number,
  targetKg: number | null,
  maxWeeks = 26,
): number[] {
  const out: number[] = [];
  for (let w = 1; w <= maxWeeks; w++) {
    const v = Math.round((fromKg + perWeek * w) * 10) / 10;
    if (targetKg !== null && perWeek < 0 && v <= targetKg) {
      out.push(targetKg);
      break;
    }
    out.push(v);
  }
  return out;
}
