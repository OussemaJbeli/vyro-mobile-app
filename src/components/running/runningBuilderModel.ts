/** Running builder model (step 15): flat intervals in canonical km/h, validation, conversion. */
import { invalidIntervals, totalDuration, type RunInterval } from '@/domain/running/intervals';
import { type TemplateDetail, type TemplateInput } from '@/hooks/data';
import { newId } from '@/utils/id';
import { fromCanonical, roundToStep, toCanonical, type UnitPrefs } from '@/utils/units';

export type BuilderInterval = RunInterval & { key: string };

export type RunningState = {
  name: string;
  description: string;
  /** In the user's distance unit, as typed. */
  distanceTarget: string;
  intervals: BuilderInterval[];
};

export type RunningErrors = { name?: true; intervals?: true; invalid?: number[] };

export const withKey = (i: RunInterval): BuilderInterval => ({ ...i, key: newId() });

export const emptyRunning = (): RunningState => ({
  name: '',
  description: '',
  distanceTarget: '',
  intervals: [],
});

export function runningFromTemplate(tpl: TemplateDetail, units: UnitPrefs): RunningState {
  return {
    name: tpl.name,
    description: tpl.description ?? '',
    distanceTarget:
      tpl.distanceTargetKm == null
        ? ''
        : String(roundToStep(fromCanonical(tpl.distanceTargetKm, units.distance), 0.1)),
    intervals: tpl.intervals.map((i) => ({
      key: i.id,
      kind: i.kind,
      durationSeconds: i.durationSeconds,
      speedKmh: i.speedKmh,
      inclinePercent: i.inclinePercent,
      label: i.label,
    })),
  };
}

export function validateRunning(s: RunningState): RunningErrors {
  const e: RunningErrors = {};
  if (!s.name.trim()) e.name = true;
  if (s.intervals.length === 0) e.intervals = true;
  const bad = invalidIntervals(s.intervals);
  if (bad.length) e.invalid = bad;
  return e;
}

export const runningValid = (e: RunningErrors) => !e.name && !e.intervals && !e.invalid?.length;

export function runningToInput(s: RunningState, units: UnitPrefs): TemplateInput {
  const distance = Number(s.distanceTarget.replace(',', '.'));
  return {
    name: s.name.trim(),
    type: 'running',
    description: s.description.trim() || null,
    durationMinutes: Math.max(1, Math.round(totalDuration(s.intervals) / 60)),
    difficulty: null,
    coverKey: null,
    distanceTargetKm:
      s.distanceTarget.trim() && Number.isFinite(distance) && distance > 0
        ? Math.round(toCanonical(distance, units.distance) * 1000) / 1000
        : null,
    notes: null,
    exercises: [],
    intervals: s.intervals.map(({ key: _key, ...i }) => ({
      kind: i.kind,
      durationSeconds: Math.round(i.durationSeconds),
      speedKmh: i.speedKmh,
      inclinePercent: i.inclinePercent,
      label: i.label?.trim() || null,
    })),
  };
}

export function moveInterval(
  list: BuilderInterval[],
  index: number,
  dir: -1 | 1,
): BuilderInterval[] {
  const to = index + dir;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(index, 1);
  next.splice(to, 0, x!);
  return next;
}
