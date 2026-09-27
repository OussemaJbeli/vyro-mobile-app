import { type MeasurementType } from '@/types/domain';
import { formatQuantity, fromCanonical, toCanonical, type UnitPrefs } from '@/utils/units';

/** Measurement values: length is canonical cm (AD-06); percent and custom are as entered. */
export function measurementText(
  type: Pick<MeasurementType, 'kind' | 'unitOther'>,
  value: number,
  prefs: UnitPrefs,
  locale: string,
): string {
  if (type.kind === 'length') return formatQuantity(value, 'length', prefs, locale);
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  return type.kind === 'percent' ? `${n} %` : `${n}${type.unitOther ? ` ${type.unitOther}` : ''}`;
}

/** Display number in the user's unit, for inputs. */
export const measurementDisplay = (
  type: Pick<MeasurementType, 'kind'>,
  value: number,
  prefs: UnitPrefs,
) => (type.kind === 'length' ? Math.round(fromCanonical(value, prefs.length) * 10) / 10 : value);

/** Typed value → canonical value + the unit it was entered in. */
export function measurementCanonical(
  type: Pick<MeasurementType, 'kind'>,
  typed: number,
  prefs: UnitPrefs,
) {
  if (type.kind === 'length')
    return { value: toCanonical(typed, prefs.length), unitEntered: prefs.length };
  return {
    value: typed,
    unitEntered: type.kind === 'percent' ? ('percent' as const) : ('other' as const),
  };
}

export const unitHint = (type: Pick<MeasurementType, 'kind' | 'unitOther'>, prefs: UnitPrefs) =>
  type.kind === 'length' ? prefs.length : type.kind === 'percent' ? '%' : (type.unitOther ?? '');
