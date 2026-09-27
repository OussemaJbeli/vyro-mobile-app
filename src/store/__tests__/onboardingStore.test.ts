import { presetEquipmentSlugs, unitsForLocale } from '@/domain/onboarding/defaults';
import { defaultSettings } from '@/types/settings';

import { newDraft, nextStep, prevStep, useOnboardingStore } from '../onboardingStore';
import { bindSettingsPersistence, useSettingsStore } from '../settingsStore';

afterEach(() => {
  bindSettingsPersistence(null);
  useSettingsStore.setState({ values: defaultSettings, hydrated: false });
});

describe('onboarding store', () => {
  it('saves the draft after every change', async () => {
    const persist = jest.fn(async () => {});
    bindSettingsPersistence(persist);
    useOnboardingStore.getState().begin();
    useOnboardingStore.getState().update({ name: 'Alex', step: 'goal' });
    expect(persist).toHaveBeenLastCalledWith(
      'onboarding.draft',
      expect.objectContaining({ name: 'Alex', step: 'goal' }),
    );
  });

  it('resumes a saved draft on the step where it stopped', () => {
    const saved = { ...newDraft(), step: 'goal' as const, name: 'Sam', weightKg: 80 };
    useSettingsStore.setState({ values: { ...defaultSettings, 'onboarding.draft': saved } });
    const draft = useOnboardingStore.getState().begin();
    expect(draft).toMatchObject({ step: 'goal', name: 'Sam', weightKg: 80 });
  });

  it('walks steps in order', () => {
    expect(nextStep('name')).toBe('units');
    expect(nextStep('lock')).toBe('done');
    expect(nextStep('done')).toBe('done');
    expect(prevStep('name')).toBeNull();
    expect(prevStep('units')).toBe('name');
  });
});

describe('onboarding defaults', () => {
  it('derives units from the locale measurement system', () => {
    expect(unitsForLocale('us')).toEqual({
      weight: 'lb',
      length: 'in',
      distance: 'mi',
      speed: 'mph',
    });
    expect(unitsForLocale('uk')).toMatchObject({ weight: 'kg', distance: 'mi' });
    expect(unitsForLocale('metric')).toMatchObject({ weight: 'kg', distance: 'km' });
    expect(unitsForLocale(null)).toMatchObject({ weight: 'kg' });
  });

  it('maps equipment presets onto the available slugs', () => {
    const all = ['dumbbells', 'barbell', 'exercise_mat', 'flat_bench'];
    expect(presetEquipmentSlugs('full_gym', all)).toEqual(all);
    expect(presetEquipmentSlugs('bodyweight', all)).toEqual(['exercise_mat']);
    // Preset order is kept (dumbbells, bench, … mat), filtered to what exists.
    expect(presetEquipmentSlugs('home_dumbbells', all)).toEqual([
      'dumbbells',
      'flat_bench',
      'exercise_mat',
    ]);
  });
});
