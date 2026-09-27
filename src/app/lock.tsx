import { router } from 'expo-router';

import { LockScreen } from '@/components/security/LockScreen';

/** Standalone lock route (the LockGate overlay is the normal path). */
export default function LockRoute() {
  return (
    <LockScreen onUnlocked={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />
  );
}
