import { formatMinSec } from '@/domain/running/intervals';
import { type SetsSummary } from '@/domain/execution';
import { formatQuantity, type UnitPrefs } from '@/utils/units';

type Tracking = 'weight_reps' | 'reps' | 'duration' | 'distance_duration';

const uniform = (xs: number[]) => xs.length > 0 && xs.every((x) => x === xs[0]);

/** "60 kg × 10", "× 20", "0:45". */
export function setDetail(
  tracking: Tracking,
  v: { reps: number | null; weightKg: number | null; durationSeconds: number | null },
  prefs: UnitPrefs,
  locale: string,
): string {
  if (tracking === 'duration' || tracking === 'distance_duration') {
    return formatMinSec(v.durationSeconds ?? 0);
  }
  const reps = `× ${v.reps ?? 0}`;
  if (tracking === 'reps' || !v.weightKg) return reps;
  return `${formatQuantity(v.weightKg, 'load', prefs, locale)} ${reps}`;
}

/** "4×10 @ 60 kg", "3 × 10/10/8 @ 60–62.5 kg", "3 × 0:45". */
export function setsText(
  s: SetsSummary,
  tracking: Tracking,
  prefs: UnitPrefs,
  locale: string,
): string {
  if (s.sets === 0) return '0';
  if (tracking === 'duration' || tracking === 'distance_duration') {
    const d = s.durationsSeconds;
    return `${s.sets} × ${uniform(d) ? formatMinSec(d[0]!) : d.map((x) => formatMinSec(x)).join('/')}`;
  }
  const reps = uniform(s.reps) ? `${s.sets}×${s.reps[0]}` : `${s.sets} × ${s.reps.join('/')}`;
  if (tracking === 'reps' || s.weightsKg.length === 0 || s.weightsKg.every((w) => w === 0)) {
    return reps;
  }
  const lo = Math.min(...s.weightsKg);
  const hi = Math.max(...s.weightsKg);
  const load =
    lo === hi
      ? formatQuantity(lo, 'load', prefs, locale)
      : `${formatQuantity(lo, 'load', prefs, locale).split(' ')[0]}–${formatQuantity(hi, 'load', prefs, locale)}`;
  return `${reps} @ ${load}`;
}
