/**
 * Body trend maths (step 22, FS §24). Single readings mislead, so the app shows a smoothed
 * weight and only states a trend with enough data.
 *
 * Smoothing: gap-aware exponentially weighted moving average, α = 0.25 per day. For a gap
 * of Δ days the weight of the new reading is 1 − (1 − α)^Δ, so a reading after a long
 * break counts almost fully and several readings on one day barely move the line.
 * Values are canonical kg (AD-06): a kg ↔ lb display switch never changes the maths.
 */
export const ALPHA_PER_DAY = 0.25;
const DAY = 86_400_000;

export type Reading = { t: number; value: number };
export type SmoothedPoint = Reading & { smooth: number };

export function smooth(readings: readonly Reading[]): SmoothedPoint[] {
  const sorted = [...readings].sort((a, b) => a.t - b.t);
  const out: SmoothedPoint[] = [];
  let s: number | null = null;
  let last = 0;
  for (const r of sorted) {
    if (s === null) s = r.value;
    else {
      const days = Math.max(0, (r.t - last) / DAY);
      const w = 1 - (1 - ALPHA_PER_DAY) ** Math.max(days, 1 / 24);
      s += w * (r.value - s);
    }
    last = r.t;
    out.push({ ...r, smooth: s });
  }
  return out;
}

/** Smoothed value as of `at` (the last point at or before it), or null. */
function smoothAt(points: readonly SmoothedPoint[], at: number): number | null {
  let v: number | null = null;
  for (const p of points) {
    if (p.t <= at) v = p.smooth;
    else break;
  }
  return v;
}

/**
 * "This week" = smoothed now − smoothed 7 days ago. Null (show "log a few more") unless
 * there are ≥ 3 readings in the last 14 days and a smoothed value 7 days ago.
 */
export function weeklyChange(readings: readonly Reading[], now: number): number | null {
  const recent = readings.filter((r) => r.t > now - 14 * DAY && r.t <= now);
  if (recent.length < 3) return null;
  const points = smooth(readings.filter((r) => r.t <= now));
  const current = smoothAt(points, now);
  const before = smoothAt(points, now - 7 * DAY);
  if (current === null || before === null) return null;
  return current - before;
}

export type Rate = { perWeek: number; insufficient: false } | { perWeek: null; insufficient: true };

/** Least-squares slope over the last 28 days, in units per week. */
export function rate28(readings: readonly Reading[], now: number): Rate {
  const pts = readings.filter((r) => r.t > now - 28 * DAY && r.t <= now);
  if (pts.length < 4) return { perWeek: null, insufficient: true };
  const t0 = Math.min(...pts.map((p) => p.t));
  const span = (Math.max(...pts.map((p) => p.t)) - t0) / DAY;
  if (span < 10) return { perWeek: null, insufficient: true };
  const xs = pts.map((p) => (p.t - t0) / DAY);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = pts.reduce((a, p) => a + p.value, 0) / pts.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (pts[i]!.value - my);
    den += (x - mx) ** 2;
  });
  return { perWeek: (num / den) * 7, insufficient: false };
}

/** BMI = kg / m². Only with a height; no judgement attached (FS §44). */
export function bmi(
  kg: number | null | undefined,
  heightCm: number | null | undefined,
): number | null {
  if (!kg || !heightCm || heightCm <= 0) return null;
  const m = heightCm / 100;
  return kg / (m * m);
}

/** Latest-vs-previous and latest-vs-first changes for a measurement history. */
export function changes(readings: readonly Reading[]): {
  sincePrevious: number | null;
  sinceFirst: number | null;
} {
  const s = [...readings].sort((a, b) => a.t - b.t);
  const last = s.at(-1);
  if (!last || s.length < 2) return { sincePrevious: null, sinceFirst: null };
  return { sincePrevious: last.value - s.at(-2)!.value, sinceFirst: last.value - s[0]!.value };
}
