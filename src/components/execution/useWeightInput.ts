import { useUnitPrefs } from '@/hooks/data';
import { useSettingsStore } from '@/store/settingsStore';
import { fromCanonical, roundToStep, toCanonical } from '@/utils/units';

/**
 * Weight stepper in the user's unit (canonical kg stored, AD-06). Step = setting
 * (2.5 kg) or 5 lb. What is logged is exactly what the stepper showed.
 */
export function useWeightInput() {
  const prefs = useUnitPrefs();
  const incKg = useSettingsStore((s) => s.values['training.weightIncrementKg']);
  const unit = prefs.weight;
  const lb = unit === 'lb';
  const step = lb ? 5 : incKg;
  return {
    unit,
    step,
    max: lb ? 1000 : 500,
    toDisplay: (kg: number) => (lb ? roundToStep(fromCanonical(kg, 'lb'), 1) : kg),
    toKg: (display: number) => (lb ? toCanonical(display, 'lb') : display),
  };
}
