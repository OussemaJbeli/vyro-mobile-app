import { useEffect, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { useLockStore } from '@/store/lockStore';
import { useSettingsStore } from '@/store/settingsStore';

import { LockScreen } from './LockScreen';

/**
 * Photo screens: screenshots always blocked (Android FLAG_SECURE), and with the
 * "Photos only" lock scope the lock screen replaces the content until unlocked.
 */
export function PhotoPrivacy({ children }: { children: ReactNode }) {
  const scope = useSettingsStore((s) => s.values['lock.scope']);
  const locked = useLockStore((s) => s.locked);
  useEffect(() => {
    if (Platform.OS === 'web') return; // screen capture control is native only
    let active = true;
    void import('expo-screen-capture')
      .then(async (c) => {
        if (active) await c.preventScreenCaptureAsync('vyro-photos');
      })
      .catch(() => {});
    return () => {
      active = false;
      void import('expo-screen-capture')
        .then((c) => c.allowScreenCaptureAsync('vyro-photos'))
        .catch(() => {});
    };
  }, []);
  if (scope === 'photos' && locked) return <LockScreen />;
  return children;
}
