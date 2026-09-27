import {
  averageSpeed,
  estimatedDistanceKm,
  expandRepeatBlock,
  formatMinSec,
  invalidIntervals,
  maxSpeed,
  timelineAt,
  totalDuration,
  type RunInterval,
} from '../intervals';
import { RUNNING_PRESETS } from '../presets';

const fs19 = RUNNING_PRESETS.intervals35;

describe('running maths', () => {
  it('FS §19 plan totals 35:00', () => {
    expect(totalDuration(fs19)).toBe(2100);
    expect(formatMinSec(totalDuration(fs19))).toBe('35:00');
    // (5×5 + 10×6 + 5×8 + 5×6 + 5×9 + 5×5) mph·min = 225/60 = 3.75 mi ≈ 6.035 km.
    expect(estimatedDistanceKm(fs19)).toBeCloseTo(6.035, 2);
    expect(averageSpeed(fs19)).toBeCloseTo(6.035 / (35 / 60), 1);
    expect(maxSpeed(fs19)).toBeCloseTo(14.48, 2);
  });

  it('expands a repeat block into flat labelled rows', () => {
    const rows = expandRepeatBlock({
      times: 6,
      work: { kind: 'run', durationSeconds: 120, speedKmh: 12, inclinePercent: 1 },
      recover: { kind: 'walk', durationSeconds: 60, speedKmh: 6, inclinePercent: 1 },
    });
    expect(rows).toHaveLength(12);
    expect(totalDuration(rows)).toBe(18 * 60);
    expect(rows.slice(0, 3).map((r) => [r.kind, r.label])).toEqual([
      ['run', '1/6'],
      ['walk', '1/6'],
      ['run', '2/6'],
    ]);
  });

  it('locates the current interval from elapsed active time', () => {
    expect(timelineAt(fs19, 0)).toEqual({
      index: 0,
      elapsedInInterval: 0,
      remainingInInterval: 300,
      finished: false,
    });
    expect(timelineAt(fs19, 900 + 20)).toMatchObject({
      index: 2,
      elapsedInInterval: 20,
      remainingInInterval: 280,
    });
    expect(timelineAt(fs19, 2100)).toMatchObject({ index: 6, finished: true });
    expect(timelineAt(fs19, -5).index).toBe(0);
    expect(timelineAt([], 10).finished).toBe(true);
  });

  it('handles empty plans and formatting', () => {
    expect(averageSpeed([])).toBe(0);
    expect(formatMinSec(3930)).toBe('1:05:30');
    expect(formatMinSec(59.6)).toBe('1:00');
  });

  it('flags invalid intervals', () => {
    const ok: RunInterval = {
      kind: 'run',
      durationSeconds: 60,
      speedKmh: 10,
      inclinePercent: null,
      label: null,
    };
    expect(
      invalidIntervals([
        ok,
        { ...ok, durationSeconds: 0 },
        { ...ok, speedKmh: 31 },
        { ...ok, speedKmh: null },
      ]),
    ).toEqual([1, 2]);
  });

  it('keeps every preset valid', () => {
    for (const plan of Object.values(RUNNING_PRESETS)) {
      expect(plan.length).toBeGreaterThan(2);
      expect(invalidIntervals(plan)).toEqual([]);
    }
    expect(totalDuration(RUNNING_PRESETS.hiit20)).toBe(20 * 60);
  });
});
