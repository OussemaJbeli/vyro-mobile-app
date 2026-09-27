import { Redirect } from 'expo-router';

import { routes } from '@/constants/routes';
import { useAppStore } from '@/store/appStore';

/** Entry: first-time users go to onboarding, everyone else to Home (step 11). */
export default function Index() {
  const done = useAppStore((s) => s.onboardingCompleted);
  return <Redirect href={done ? routes.home : routes.welcome} />;
}
