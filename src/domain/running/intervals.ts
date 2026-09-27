/**
 * Running plan maths (step 15, FS §19, §69). Canonical units: seconds and km/h.
 * Everything is pure so the builder, the timeline and execution (step 19) share it.
 */
export type IntervalKind = 'warmup' | 'run' | 'walk' | 'sprint' | 'recovery' | 'cooldown';

export type RunInterval = {
  kind: IntervalKind;
  durationSeconds: number;
  speedKmh: number | null;
  inclinePercent: number | null;
  label: string | null;
};

export const totalDuration = (intervals: readonly RunInterval[]): number =>
  intervals.reduce((s, i) => s + Math.max(0, i.durationSeconds), 0);

/** Σ speed × time. Intervals without a speed count as 0 km. */
export const estimatedDistanceKm = (intervals: readonly RunInterval[]): number =>
  intervals.reduce((s, i) => s + ((i.speedKmh ?? 0) * Math.max(0, i.durationSeconds)) / 3600, 0);

/** Time-weighted average speed (km/h); 0 for an empty plan. */
export function averageSpeed(intervals: readonly RunInterval[]): number {
  const t = totalDuration(intervals);
  return t > 0 ? (estimatedDistanceKm(intervals) * 3600) / t : 0;
}

export const maxSpeed = (intervals: readonly RunInterval[]): number =>
  intervals.reduce((m, i) => Math.max(m, i.speedKmh ?? 0), 0);

export type RepeatBlock = {
  times: number;
  work: Omit<RunInterval, 'label'>;
  recover: Omit<RunInterval, 'label'>;
};

/**
 * "Repeat 6× [run 2:00, walk 1:00]" → 12 flat rows. The stored model stays flat so
 * execution needs no special logic; labels ("3/6") keep the grouping readable.
 */
export function expandRepeatBlock(block: RepeatBlock): RunInterval[] {
  const times = Math.max(1, Math.floor(block.times));
  return Array.from({ length: times }, (_, i) => [
    { ...block.work, label: `${i + 1}/${times}` },
    { ...block.recover, label: `${i + 1}/${times}` },
  ]).flat();
}

export type TimelinePosition = {
  /** Index of the current interval, or intervals.length once finished. */
  index: number;
  /** Seconds elapsed within the current interval. */
  elapsedInInterval: number;
  remainingInInterval: number;
  finished: boolean;
};

/** Where a run stands after `elapsedSec` seconds of active (unpaused) time. */
export function timelineAt(
  intervals: readonly RunInterval[],
  elapsedSec: number,
): TimelinePosition {
  let start = 0;
  const t = Math.max(0, elapsedSec);
  for (let i = 0; i < intervals.length; i++) {
    const d = Math.max(0, intervals[i]!.durationSeconds);
    if (t < start + d) {
      return {
        index: i,
        elapsedInInterval: t - start,
        remainingInInterval: start + d - t,
        finished: false,
      };
    }
    start += d;
  }
  return { index: intervals.length, elapsedInInterval: 0, remainingInInterval: 0, finished: true };
}

/** "35:00", "1:05:30". */
export function formatMinSec(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export const SPEED_MAX_KMH = 30;

/** Builder validation: at least one interval, positive durations, speed 0–30 km/h. */
export function invalidIntervals(intervals: readonly RunInterval[]): number[] {
  return intervals
    .map((i, idx) =>
      i.durationSeconds <= 0 ||
      (i.speedKmh !== null && (i.speedKmh < 0 || i.speedKmh > SPEED_MAX_KMH))
        ? idx
        : -1,
    )
    .filter((i) => i >= 0);
}
