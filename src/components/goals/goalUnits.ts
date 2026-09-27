/** Goal target units (step 12). Stored canonically; entered and shown in the user's units. */
import { type Goal, type MeasurementType } from '@/types/domain';
import { type GoalForm } from '@/types/forms';
import {
  formatQuantity,
  fromCanonical,
  roundToStep,
  toCanonical,
  type UnitPrefs,
} from '@/utils/units';

export type GoalType = GoalForm['type'];

/** Canonical unit stored in goals.unit. */
export function canonicalUnit(type: GoalType, measurement?: MeasurementType | null): string | null {
  switch (type) {
    case 'weight':
      return 'kg';
    case 'measurement':
      return measurement?.kind === 'percent' ? '%' : 'cm';
    case 'frequency':
      return 'sessions/week';
    case 'consistency':
      return '%';
    case 'running':
      return 'km/week';
    case 'muscle':
    case 'custom':
      return null;
  }
}

/** Label of the unit the user types in. */
export function inputUnit(
  type: GoalType,
  prefs: UnitPrefs,
  measurement?: MeasurementType | null,
): string {
  if (type === 'weight') return prefs.weight;
  if (type === 'measurement') return measurement?.kind === 'percent' ? '%' : prefs.length;
  if (type === 'running') return `${prefs.distance}/wk`;
  if (type === 'consistency') return '%';
  if (type === 'frequency') return '×/wk';
  return '';
}

const factorUnit = (type: GoalType, prefs: UnitPrefs, m?: MeasurementType | null) =>
  type === 'weight'
    ? prefs.weight
    : type === 'measurement' && m?.kind !== 'percent'
      ? prefs.length
      : type === 'running'
        ? prefs.distance
        : null;

export function toCanonicalTarget(
  value: number,
  type: GoalType,
  prefs: UnitPrefs,
  m?: MeasurementType | null,
) {
  const u = factorUnit(type, prefs, m);
  return u ? toCanonical(value, u) : value;
}

export function toDisplayTarget(
  value: number,
  type: GoalType,
  prefs: UnitPrefs,
  m?: MeasurementType | null,
) {
  const u = factorUnit(type, prefs, m);
  return u ? roundToStep(fromCanonical(value, u), 0.1) : value;
}

/** "70 kg", "82 cm", "4 ×/wk", "80 %", "20 km/wk". */
export function formatTarget(goal: Goal, prefs: UnitPrefs, m?: MeasurementType | null): string {
  if (goal.targetValue == null) return '';
  const type = goal.type as GoalType;
  if (type === 'weight') return formatQuantity(goal.targetValue, 'bodyWeight', prefs);
  if (type === 'measurement') {
    return m?.kind === 'percent'
      ? `${goal.targetValue} %`
      : formatQuantity(goal.targetValue, 'length', prefs);
  }
  return `${toDisplayTarget(goal.targetValue, type, prefs, m)} ${inputUnit(type, prefs, m)}`;
}
