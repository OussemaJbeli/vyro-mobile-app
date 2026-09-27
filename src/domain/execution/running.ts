import { timelineAt } from '@/domain/running/intervals';

import { type Draft, secs } from './internal';
import { type ExecInterval } from './types';

function patchInterval(d: Draft, index: number, patch: Partial<ExecInterval>) {
  const intervals = d.state.intervals.slice();
  intervals[index] = { ...intervals[index]!, ...patch };
  d.update({ intervals });
  // targetSeconds lives in runtime_state, not in the row.
  const row: Partial<ExecInterval> = { ...patch };
  delete row.targetSeconds;
  if (Object.keys(row).length) d.change({ kind: 'interval', id: intervals[index]!.id, patch: row });
}

/** Closes the current interval and starts the next one at `startActiveMs`. */
function close(
  d: Draft,
  status: ExecInterval['status'],
  durationMs: number,
  nextStartActiveMs: number,
  nextStartedAt: number,
) {
  const cur = d.state.current;
  if (!cur) return;
  const iv = d.state.intervals[cur.index]!;
  patchInterval(d, cur.index, {
    status,
    actualDurationSeconds: status === 'skipped' ? null : secs(durationMs),
    actualSpeedKmh:
      status === 'skipped' ? iv.actualSpeedKmh : (iv.actualSpeedKmh ?? iv.plannedSpeedKmh),
    actualInclinePercent:
      status === 'skipped'
        ? iv.actualInclinePercent
        : (iv.actualInclinePercent ?? iv.plannedInclinePercent),
    startedAt: cur.startedAt,
    endedAt: status === 'skipped' ? cur.startedAt : nextStartedAt,
  });
  const next = cur.index + 1;
  if (next < d.state.intervals.length) {
    d.update({
      current: { index: next, startActiveMs: nextStartActiveMs, startedAt: nextStartedAt },
    });
    d.effect({ kind: 'haptic', style: 'warning' });
  } else {
    d.update({ current: null, phase: 'all_done' });
    d.effect({ kind: 'haptic', style: 'success' });
  }
}

/**
 * Auto-advance through every interval whose time is up (TICK, or resume after a kill).
 * The position comes from the shared timeline math over the remaining intervals.
 */
export function settleRunning(d: Draft) {
  const cur = d.state.current;
  if (!cur) return;
  const remaining = d.state.intervals.slice(cur.index).map((iv) => ({
    kind: iv.kind,
    durationSeconds: iv.targetSeconds,
    speedKmh: iv.plannedSpeedKmh,
    inclinePercent: iv.plannedInclinePercent,
    label: iv.label,
  }));
  const pos = timelineAt(remaining, (d.active - cur.startActiveMs) / 1000);
  let advanced = 0;
  while (advanced < pos.index && d.state.current) {
    const c = d.state.current;
    const targetMs = d.state.intervals[c.index]!.targetSeconds * 1000;
    close(d, 'done', targetMs, c.startActiveMs + targetMs, c.startedAt + targetMs);
    advanced++;
  }
  if (advanced > 1) d.caughtUp = advanced - 1;
}

/** Skip: nothing done yet → `skipped`, otherwise `partial` with the time actually run. */
export function nextInterval(d: Draft) {
  const cur = d.state.current;
  if (!cur) return;
  const elapsed = d.active - cur.startActiveMs;
  close(d, secs(elapsed) === 0 ? 'skipped' : 'partial', elapsed, d.active, d.now);
}

/** Inserts a copy of the current (or last) interval right after it (`is_repeat`). */
export function repeatInterval(d: Draft, id: string) {
  const cur = d.state.current;
  const srcIndex = cur ? cur.index : d.state.intervals.length - 1;
  const src = d.state.intervals[srcIndex];
  if (!src) return;
  const copy: ExecInterval = {
    ...src,
    id,
    targetSeconds: src.plannedDurationSeconds,
    actualDurationSeconds: null,
    actualSpeedKmh: null,
    actualInclinePercent: null,
    status: 'pending',
    isRepeat: true,
    startedAt: null,
    endedAt: null,
  };
  const intervals = d.state.intervals.slice();
  intervals.splice(srcIndex + 1, 0, copy);
  d.update({ intervals });
  d.change({ kind: 'insertInterval', interval: copy, orderIndex: srcIndex + 1 });
  d.change({ kind: 'reorderIntervals', ids: intervals.map((i) => i.id) });
  if (!cur) {
    d.update({
      current: { index: srcIndex + 1, startActiveMs: d.active, startedAt: d.now },
      phase: 'working',
    });
  }
}

export function adjustInterval(
  d: Draft,
  patch: { speedKmh?: number; inclinePercent?: number; deltaSeconds?: number },
) {
  const cur = d.state.current;
  if (!cur) return;
  const iv = d.state.intervals[cur.index]!;
  if (patch.speedKmh !== undefined) {
    patchInterval(d, cur.index, { actualSpeedKmh: Math.max(0, patch.speedKmh) });
  }
  if (patch.inclinePercent !== undefined) {
    patchInterval(d, cur.index, { actualInclinePercent: patch.inclinePercent });
  }
  if (patch.deltaSeconds !== undefined) {
    const elapsed = secs(d.active - cur.startActiveMs);
    patchInterval(d, cur.index, {
      targetSeconds: Math.max(1, elapsed, iv.targetSeconds + patch.deltaSeconds),
    });
  }
}

/** FINISH: the running interval becomes partial, the rest skipped. */
export function closeRunning(d: Draft) {
  const cur = d.state.current;
  if (cur) {
    const elapsed = d.active - cur.startActiveMs;
    close(d, secs(elapsed) === 0 ? 'skipped' : 'partial', elapsed, d.active, d.now);
  }
  d.state.intervals.forEach((iv, i) => {
    if (iv.status === 'pending') patchInterval(d, i, { status: 'skipped' });
  });
  d.update({ current: null, phase: 'all_done' });
}
