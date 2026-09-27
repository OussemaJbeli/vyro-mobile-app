import { router } from 'expo-router';
import { useEffect } from 'react';

import { routes } from '@/constants/routes';
import { nextStep, prevStep, stepIndex, useOnboardingStore } from '@/store/onboardingStore';
import { type OnboardingDraft, type OnboardingStep } from '@/types/onboarding';

/** Question steps shown in the progress bar (the summary is not counted). */
export const QUESTION_COUNT = 9;

/** Navigation helpers for one step; keeps the saved draft pointing at the visible step. */
export function useStepNav(step: OnboardingStep) {
  const draft = useOnboardingStore((s) => s.draft);
  const update = useOnboardingStore((s) => s.update);

  useEffect(() => {
    if (useOnboardingStore.getState().draft.step !== step) useOnboardingStore.getState().goTo(step);
  }, [step]);

  const next = (patch: Partial<OnboardingDraft> = {}) => {
    const to = nextStep(step);
    update({ ...patch, step: to });
    router.push(routes.setupStep(to));
  };

  const back = () => {
    const prev = prevStep(step);
    if (router.canGoBack()) router.back();
    else router.replace(prev ? routes.setupStep(prev) : routes.welcome);
  };

  return { draft, update, next, back, index: stepIndex(step) + 1, total: QUESTION_COUNT };
}
