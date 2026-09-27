/** Built-in running presets (step 15). Speeds in km/h, durations in seconds. */
import { expandRepeatBlock, type RunInterval } from './intervals';

export type RunningPresetKey = 'easy30' | 'intervals35' | 'pyramid' | 'hiit20' | 'prep5k';

const MPH = 1.609344;
const i = (
  kind: RunInterval['kind'],
  min: number,
  kmh: number,
  incline = 1,
  label: string | null = null,
): RunInterval => ({
  kind,
  durationSeconds: Math.round(min * 60),
  speedKmh: kmh,
  inclinePercent: incline,
  label,
});

export const RUNNING_PRESETS: Record<RunningPresetKey, RunInterval[]> = {
  easy30: [i('warmup', 5, 7), i('run', 20, 9), i('cooldown', 5, 6, 0)],
  // FS §19: 5 → 6 → 8 → 6 → 9 → 5 mph.
  intervals35: [
    i('warmup', 5, 5 * MPH),
    i('run', 10, 6 * MPH),
    i('sprint', 5, 8 * MPH),
    i('run', 5, 6 * MPH),
    i('sprint', 5, 9 * MPH),
    i('cooldown', 5, 5 * MPH, 0),
  ],
  pyramid: [
    i('warmup', 5, 7),
    i('run', 3, 9),
    i('run', 3, 10),
    i('sprint', 3, 11.5),
    i('run', 3, 10),
    i('run', 3, 9),
    i('cooldown', 5, 6, 0),
  ],
  hiit20: [
    i('warmup', 4, 7),
    ...expandRepeatBlock({
      times: 6,
      work: { kind: 'sprint', durationSeconds: 60, speedKmh: 13, inclinePercent: 1 },
      recover: { kind: 'walk', durationSeconds: 60, speedKmh: 6, inclinePercent: 1 },
    }),
    i('cooldown', 4, 5.5, 0),
  ],
  prep5k: [i('warmup', 5, 7.5), i('run', 25, 10), i('cooldown', 5, 6, 0)],
};
