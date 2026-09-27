import { getLocales } from 'expo-localization';
import { create } from 'zustand';

import {
  DEFAULT_TRAINING_DAYS,
  DEFAULT_TRAINING_TIME,
  unitsForLocale,
} from '@/domain/onboarding/defaults';
import { ONBOARDING_STEPS, type OnboardingDraft, type OnboardingStep } from '@/types/onboarding';

import { useSettingsStore } from './settingsStore';

export function newDraft(): OnboardingDraft {
  return {
    mode: 'first',
    step: 'name',
    name: null,
    units: { ...unitsForLocale(getLocales()[0]?.measurementSystem) },
    heightCm: null,
    weightKg: null,
    goal: null,
    equipmentPreset: 'full_gym',
    equipmentIds: null,
    trainingDays: [...DEFAULT_TRAINING_DAYS],
    trainingTime: DEFAULT_TRAINING_TIME,
    acceptPlan: true,
    notifications: false,
    appLock: false,
  };
}

type OnboardingState = {
  draft: OnboardingDraft;
  /** Starts a fresh draft, or resumes the one saved in settings (killed mid-flow). */
  begin: (prefill?: Partial<OnboardingDraft>) => OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
  goTo: (step: OnboardingStep) => void;
};

const persist = (draft: OnboardingDraft) => {
  useSettingsStore
    .getState()
    .set('onboarding.draft', draft)
    .catch(() => {
      // Losing the draft only costs re-answering; the final commit is what matters.
    });
};

/** Onboarding answers (step 11). Saved after every change, committed once at the end. */
export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  draft: newDraft(),
  begin: (prefill) => {
    const saved = useSettingsStore.getState().values['onboarding.draft'];
    // A redo (prefill given) always starts fresh from the current profile.
    const draft = prefill ? { ...newDraft(), ...prefill } : (saved ?? newDraft());
    set({ draft });
    persist(draft);
    return draft;
  },
  update: (patch) => {
    const draft = { ...get().draft, ...patch };
    set({ draft });
    persist(draft);
  },
  goTo: (step) => get().update({ step }),
}));

export const stepIndex = (step: OnboardingStep) => ONBOARDING_STEPS.indexOf(step);
export const nextStep = (step: OnboardingStep): OnboardingStep =>
  ONBOARDING_STEPS[Math.min(stepIndex(step) + 1, ONBOARDING_STEPS.length - 1)]!;
export const prevStep = (step: OnboardingStep): OnboardingStep | null =>
  stepIndex(step) > 0 ? ONBOARDING_STEPS[stepIndex(step) - 1]! : null;
