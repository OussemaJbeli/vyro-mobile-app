import { Redirect, Stack } from 'expo-router';

import { routes } from '@/constants/routes';

/** Dev tools are unreachable in release builds (step 30). */
export default function DevLayout() {
  if (!__DEV__) return <Redirect href={routes.home} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
