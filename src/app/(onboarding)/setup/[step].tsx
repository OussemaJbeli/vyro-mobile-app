import { Redirect, useLocalSearchParams } from 'expo-router';

import {
  DaysStep,
  DoneStep,
  EquipmentStep,
  GoalStep,
  HeightStep,
  LockStep,
  NameStep,
  NotificationsStep,
  UnitsStep,
  WeightStep,
} from '@/components/onboarding/steps';
import { routes } from '@/constants/routes';
import { type OnboardingStep } from '@/types/onboarding';

const SCREENS: Record<OnboardingStep, () => React.JSX.Element> = {
  name: NameStep,
  units: UnitsStep,
  height: HeightStep,
  weight: WeightStep,
  goal: GoalStep,
  equipment: EquipmentStep,
  days: DaysStep,
  notifications: NotificationsStep,
  lock: LockStep,
  done: DoneStep,
};

/** One route for every setup step: /setup/<step>. */
export default function SetupStepScreen() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const Screen = SCREENS[step as OnboardingStep];
  if (!Screen) return <Redirect href={routes.welcome} />;
  return <Screen />;
}
