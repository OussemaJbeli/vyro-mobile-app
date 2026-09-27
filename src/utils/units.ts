/**
 * Unit conversion (AD-06). Storage is always canonical metric:
 * kg, cm, km, km/h, incline %. Conversion happens only at input and display.
 * Canonical values are stored unrounded so round trips are exact (165 lb → kg → 165.0 lb).
 */
export type WeightUnit = 'kg' | 'lb';
export type LengthUnit = 'cm' | 'in';
export type DistanceUnit = 'km' | 'mi';
export type SpeedUnit = 'kmh' | 'mph';

export type UnitPrefs = {
  weight: WeightUnit;
  length: LengthUnit;
  distance: DistanceUnit;
  speed: SpeedUnit;
};

export const DEFAULT_UNITS: UnitPrefs = {
  weight: 'kg',
  length: 'cm',
  distance: 'km',
  speed: 'kmh',
};

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;
const KM_PER_MI = 1.609344;

export type Unit = WeightUnit | LengthUnit | DistanceUnit | SpeedUnit | 'percent';

/** Entered value in `unit` → canonical metric. */
export function toCanonical(value: number, unit: Unit): number {
  switch (unit) {
    case 'lb':
      return value * KG_PER_LB;
    case 'in':
      return value * CM_PER_IN;
    case 'mi':
      return value * KM_PER_MI;
    case 'mph':
      return value * KM_PER_MI;
    default:
      return value;
  }
}

/** Canonical metric → value in `unit`. */
export function fromCanonical(value: number, unit: Unit): number {
  switch (unit) {
    case 'lb':
      return value / KG_PER_LB;
    case 'in':
      return value / CM_PER_IN;
    case 'mi':
      return value / KM_PER_MI;
    case 'mph':
      return value / KM_PER_MI;
    default:
      return value;
  }
}

/** Kinds of quantity shown in the UI, each with its own unit preference and rounding. */
export type QuantityKind =
  'bodyWeight' | 'load' | 'length' | 'height' | 'distance' | 'speed' | 'incline';

export function unitFor(kind: QuantityKind, prefs: UnitPrefs): Unit {
  switch (kind) {
    case 'bodyWeight':
    case 'load':
      return prefs.weight;
    case 'length':
    case 'height':
      return prefs.length;
    case 'distance':
      return prefs.distance;
    case 'speed':
      return prefs.speed;
    case 'incline':
      return 'percent';
  }
}

/** Display rounding step per kind and unit. */
export function roundingStep(kind: QuantityKind, unit: Unit): number {
  if (kind === 'load') return unit === 'lb' ? 1 : 0.5;
  if (kind === 'length' || kind === 'height') return unit === 'in' ? 0.25 : 0.1;
  if (kind === 'incline') return 0.5;
  return 0.1;
}

export const roundToStep = (value: number, step: number): number =>
  Math.round(Math.round(value / step) * step * 1e6) / 1e6;

const UNIT_LABEL: Record<Unit, string> = {
  kg: 'kg',
  lb: 'lb',
  cm: 'cm',
  in: 'in',
  km: 'km',
  mi: 'mi',
  kmh: 'km/h',
  mph: 'mph',
  percent: '%',
};

export const unitLabel = (unit: Unit): string => UNIT_LABEL[unit];

/** Canonical value → display number in the user's unit, rounded for its kind. */
export function displayValue(canonical: number, kind: QuantityKind, prefs: UnitPrefs): number {
  const unit = unitFor(kind, prefs);
  return roundToStep(fromCanonical(canonical, unit), roundingStep(kind, unit));
}

/**
 * "74.6 kg", "165 lb", "8.5 km/h", "5′11″". Height in inches is shown as feet and inches.
 * Numbers use the locale's decimal separator.
 */
export function formatQuantity(
  canonical: number,
  kind: QuantityKind,
  prefs: UnitPrefs,
  locale = 'en',
): string {
  const unit = unitFor(kind, prefs);
  if (kind === 'height' && unit === 'in') {
    const totalIn = Math.round(fromCanonical(canonical, 'in'));
    return `${Math.floor(totalIn / 12)}′${totalIn % 12}″`;
  }
  const value = displayValue(canonical, kind, prefs);
  const step = roundingStep(kind, unit);
  const decimals = step >= 1 ? 0 : step === 0.25 ? 2 : 1;
  const text = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
  return unit === 'percent' ? `${text} %` : `${text} ${UNIT_LABEL[unit]}`;
}

/** Speed (km/h canonical) → pace in seconds per km or per mile. Null when not moving. */
export function paceSeconds(speedKmh: number, distance: DistanceUnit): number | null {
  if (!(speedKmh > 0)) return null;
  const perKm = 3600 / speedKmh;
  return distance === 'mi' ? perKm * KM_PER_MI : perKm;
}

/** "5:30 /km". */
export function formatPace(speedKmh: number, distance: DistanceUnit): string {
  const s = paceSeconds(speedKmh, distance);
  if (s === null) return '—';
  const total = Math.round(s);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} /${distance}`;
}
