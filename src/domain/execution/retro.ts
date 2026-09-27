import { reduce } from './reducer';
import { type DbChange, type Event, type ExecState } from './types';

export type RetroSet = {
  done: boolean;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
};
export type RetroInterval = { done: boolean; durationSeconds: number; speedKmh: number | null };

/**
 * Retroactive log (FS §76, step 21): the user's actuals are replayed through the same
 * reducer as a live workout, so outcomes and invariants are identical. Returns the final
 * state and every row change, to be committed in one transaction.
 */
export function retroLog(
  initial: ExecState,
  input: { sets: RetroSet[][]; intervals: RetroInterval[]; endMs: number },
): { state: ExecState; changes: DbChange[] } {
  let s = initial;
  const changes: DbChange[] = [];
  const apply = (e: Event) => {
    const t = reduce(s, e);
    s = t.state;
    changes.push(...t.changes);
  };
  const start = initial.startedAt;

  if (s.kind === 'running') {
    let at = start;
    input.intervals.forEach((iv, i) => {
      if (!s.current || s.current.index !== i) return;
      const planned = s.intervals[i]!;
      if (!iv.done) return apply({ type: 'INTERVAL_NEXT', now: at });
      if (iv.speedKmh !== null && iv.speedKmh !== planned.plannedSpeedKmh) {
        apply({ type: 'INTERVAL_ADJUST_SPEED', now: at, speedKmh: iv.speedKmh });
      }
      const d = Math.max(1, Math.round(iv.durationSeconds));
      if (d !== planned.targetSeconds) {
        apply({
          type: 'INTERVAL_ADJUST_DURATION',
          now: at,
          deltaSeconds: d - planned.targetSeconds,
        });
      }
      at += d * 1000;
      apply({ type: 'TICK', now: at });
    });
    apply({ type: 'FINISH', now: at });
    return { state: s, changes };
  }

  if (s.circuit) apply({ type: 'SET_CIRCUIT', now: start, on: false });
  const total = input.sets.reduce((n, x) => n + x.length, 0);
  const step = total > 0 ? Math.max(0, (input.endMs - start) / (total + 1)) : 0;
  let k = 0;
  input.sets.forEach((sets, e) => {
    if (!s.exercises[e]?.sets.some((x) => x.status === 'pending')) return;
    apply({ type: 'JUMP_TO_EXERCISE', now: start + step * k, index: e });
    sets.forEach((set) => {
      k++;
      const now = start + step * k;
      if (!s.cursor || s.cursor.exercise !== e) return;
      if (set.done) {
        apply({
          type: 'COMPLETE_SET',
          now,
          reps: set.reps,
          weightKg: set.weightKg,
          durationSeconds: set.durationSeconds,
        });
        if (s.rest) apply({ type: 'REST_SKIP', now });
      } else apply({ type: 'SKIP_SET', now });
    });
  });
  apply({ type: 'FINISH', now: Math.max(input.endMs, start) });
  return { state: s, changes };
}
