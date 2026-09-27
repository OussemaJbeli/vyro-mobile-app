import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { VyroMark } from '@/components/brand';
import { LockScreen } from '@/components/security/LockScreen';
import { hasPin } from '@/services/security/lock';
import { shouldLock } from '@/services/security/policy';
import { useExecutionStore } from '@/store/executionStore';
import { useLockStore } from '@/store/lockStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';
import { logger } from '@/utils/logger';

const capture = () => import('expo-screen-capture');

/**
 * App lock boundary (step 26, FS §28). Locks on cold start and when returning after the
 * timeout; the lock renders over the app, so navigation is preserved underneath. While
 * the app is inactive/backgrounded a branded shield hides content from the app switcher.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const enabled = useSettingsStore((s) => s.values['lock.enabled']);
  const scope = useSettingsStore((s) => s.values['lock.scope']);
  const hidePreviews = useSettingsStore((s) => s.values['lock.hidePreviews']);
  const blockScreenshots = useSettingsStore((s) => s.values['privacy.blockScreenshots']);
  const armed = useLockStore((s) => s.armed);
  const locked = useLockStore((s) => s.locked);
  const [shield, setShield] = useState(false);

  // Armed = setting on AND a PIN exists; lock at cold start when armed.
  useEffect(() => {
    let alive = true;
    void hasPin().then((pin) => {
      if (!alive) return;
      const store = useLockStore.getState();
      const wasArmed = store.armed;
      store.setArmed(enabled && pin);
      if (enabled && pin && !wasArmed && store.backgroundAt === null && !started) {
        started = true;
        store.lock();
      }
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const store = useLockStore.getState();
      if (state === 'active') {
        setShield(false);
        const v = useSettingsStore.getState().values;
        if (
          shouldLock({
            enabled: store.armed,
            backgroundAt: store.backgroundAt,
            now: Date.now(),
            timeoutS: v['lock.timeout'],
            workoutActive: !!useExecutionStore.getState().state,
            extendDuringWorkout: v['lock.extendDuringWorkout'],
          })
        ) {
          store.lock();
        }
        store.setBackgroundAt(null);
      } else {
        const v = useSettingsStore.getState().values;
        if (store.armed && v['lock.hidePreviews']) setShield(true);
        if (state === 'background' && store.backgroundAt === null)
          store.setBackgroundAt(Date.now());
      }
    });
    return () => sub.remove();
  }, []);

  // Android FLAG_SECURE (switcher thumbnail + screenshots) / iOS switcher blur. Native only.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const protect = armed && hidePreviews;
    void capture()
      .then(async (c) => {
        if (blockScreenshots || (protect && Platform.OS === 'android'))
          await c.preventScreenCaptureAsync('vyro-app');
        else await c.allowScreenCaptureAsync('vyro-app');
        if (Platform.OS === 'ios') {
          if (protect) await c.enableAppSwitcherProtectionAsync(0.9);
          else await c.disableAppSwitcherProtectionAsync();
        }
      })
      .catch((error: unknown) => logger.warn('Screen capture control unavailable', { error }));
  }, [armed, hidePreviews, blockScreenshots]);

  return (
    <View style={styles.fill}>
      {children}
      {locked && scope === 'app' ? (
        <View style={StyleSheet.absoluteFill}>
          <LockScreen />
        </View>
      ) : null}
      {shield ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.center,
            { backgroundColor: theme.colors.bg, pointerEvents: 'none' },
          ]}
        >
          <VyroMark size={96} color={theme.colors.primary} glow />
        </View>
      ) : null}
    </View>
  );
}

/** Cold-start lock happens once per process (not on every settings change). */
let started = false;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
