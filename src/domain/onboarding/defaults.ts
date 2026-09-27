/** Pure onboarding defaults (step 11). */
import { type EquipmentLevel } from '../scheduling/starterPlan';

export type MeasurementSystem = 'metric' | 'us' | 'uk' | null | undefined;

/** Smart unit defaults from the device locale (US → imperial, UK → kg/cm but miles). */
export function unitsForLocale(system: MeasurementSystem) {
  if (system === 'us') return { weight: 'lb', length: 'in', distance: 'mi', speed: 'mph' } as const;
  if (system === 'uk') return { weight: 'kg', length: 'cm', distance: 'mi', speed: 'mph' } as const;
  return { weight: 'kg', length: 'cm', distance: 'km', speed: 'kmh' } as const;
}

/** Equipment slugs available in each preset (all seeded slugs for a full gym). */
export type EquipmentPreset = EquipmentLevel | 'travel';

export const EQUIPMENT_PRESETS: Record<Exclude<EquipmentPreset, 'full_gym'>, string[]> = {
  home_dumbbells: [
    'dumbbells',
    'flat_bench',
    'adjustable_bench',
    'resistance_bands',
    'exercise_mat',
    'jump_rope',
    'foam_roller',
  ],
  bodyweight: ['exercise_mat'],
  travel: ['resistance_bands', 'jump_rope', 'exercise_mat'],
};

export function presetEquipmentSlugs(level: EquipmentPreset, allSlugs: string[]): string[] {
  return level === 'full_gym'
    ? allSlugs
    : EQUIPMENT_PRESETS[level].filter((s) => allSlugs.includes(s));
}

/** Default 3 training days (Mon/Wed/Fri) — a common, sustainable starting point. */
export const DEFAULT_TRAINING_DAYS = [1, 3, 5];
export const DEFAULT_TRAINING_TIME = '18:00';

/** What applying a preset would change: ids to switch on and off (step 12 "diff first"). */
export function presetDiff(
  items: { id: string; slug: string | null; available: boolean }[],
  preset: EquipmentPreset,
): { turnOn: string[]; turnOff: string[]; ids: string[] } {
  const slugs = presetEquipmentSlugs(preset, items.map((i) => i.slug ?? '').filter(Boolean));
  // Custom equipment (no slug) stays as it is in every preset.
  const ids = items.filter((i) => (i.slug ? slugs.includes(i.slug) : i.available)).map((i) => i.id);
  return {
    ids,
    turnOn: items.filter((i) => !i.available && ids.includes(i.id)).map((i) => i.id),
    turnOff: items.filter((i) => i.available && !ids.includes(i.id)).map((i) => i.id),
  };
}
