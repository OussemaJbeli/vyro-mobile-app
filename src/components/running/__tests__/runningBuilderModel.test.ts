import { intervalTitle } from '../intervalTitle';
import { RUNNING_PRESETS } from '@/domain/running/presets';
import { toCanonical, fromCanonical, DEFAULT_UNITS, type UnitPrefs } from '@/utils/units';

import {
  emptyRunning,
  moveInterval,
  runningToInput,
  runningValid,
  validateRunning,
  withKey,
} from '../runningBuilderModel';

const IMPERIAL: UnitPrefs = { weight: 'lb', length: 'in', distance: 'mi', speed: 'mph' };

describe('running builder model', () => {
  it('validates name, intervals and per-interval values', () => {
    expect(validateRunning(emptyRunning())).toEqual({ name: true, intervals: true });
    const bad = withKey({
      kind: 'run',
      durationSeconds: 0,
      speedKmh: 10,
      inclinePercent: 1,
      label: null,
    });
    expect(validateRunning({ ...emptyRunning(), name: 'Run', intervals: [bad] }).invalid).toEqual([
      0,
    ]);
    const ok = {
      ...emptyRunning(),
      name: 'Run',
      intervals: RUNNING_PRESETS.intervals35.map(withKey),
    };
    expect(runningValid(validateRunning(ok))).toBe(true);
  });

  it('stores km/h so mph entries come back unchanged, and computes minutes and target', () => {
    const sixMph = toCanonical(6, 'mph');
    const state = {
      ...emptyRunning(),
      name: ' Tempo ',
      distanceTarget: '3.1',
      intervals: [
        withKey({
          kind: 'run' as const,
          durationSeconds: 1500,
          speedKmh: sixMph,
          inclinePercent: 1,
          label: ' ',
        }),
      ],
    };
    const input = runningToInput(state, IMPERIAL);
    expect(input).toMatchObject({
      name: 'Tempo',
      type: 'running',
      durationMinutes: 25,
      exercises: [],
    });
    expect(input.distanceTargetKm).toBeCloseTo(4.989, 3);
    expect(fromCanonical(input.intervals![0]!.speedKmh!, 'mph')).toBeCloseTo(6, 10);
    expect(input.intervals![0]!.label).toBeNull();
    expect(
      runningToInput({ ...state, distanceTarget: '' }, DEFAULT_UNITS).distanceTargetKm,
    ).toBeNull();
  });

  it('reorders within bounds', () => {
    const [a, b] = RUNNING_PRESETS.easy30.map(withKey);
    expect(moveInterval([a!, b!], 1, -1)).toEqual([b, a]);
    expect(moveInterval([a!, b!], 1, 1)).toEqual([a, b]);
  });
});

describe('interval titles', () => {
  const t = ((k: string) =>
    ({ 'kinds.warmup': 'Échauffement', 'kinds.sprint': 'Sprint' })[k] ?? k) as never;
  it('hides labels that only repeat the interval type', () => {
    expect(intervalTitle({ kind: 'warmup', label: 'Warmup' }, 0, t)).toBe('1. Échauffement');
    expect(intervalTitle({ kind: 'sprint', label: '3/6' }, 4, t)).toBe('5. Sprint · 3/6');
    expect(intervalTitle({ kind: 'sprint', label: null }, 1, t)).toBe('2. Sprint');
  });
});
