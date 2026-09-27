import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AuthSheet } from '@/components/security/AuthSheet';
import { PinSetup } from '@/components/security/PinSetup';
import {
  BottomSheet,
  Button,
  Card,
  Chip,
  Divider,
  Header,
  ScreenContainer,
  Text,
  Toggle,
} from '@/components/ui';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { biometricsAvailable, clearPin, hasPin } from '@/services/security/lock';
import { useLockStore } from '@/store/lockStore';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';

const TIMEOUTS = [0, 60, 300, 900] as const;

/** Settings → App lock (step 26): enable (PIN setup), change PIN, method, timeout, scope. */
export function AppLockSettings() {
  const { t } = useTranslation('settings');
  const styles = useStyles();
  const values = useSettingsStore((s) => s.values);
  const set = useSettingsStore((s) => s.set);
  const armed = useLockStore((s) => s.armed);
  const [bio, setBio] = useState(false);
  const [setup, setSetup] = useState(false);
  const [auth, setAuth] = useState<null | 'disable' | 'change'>(null);
  useEffect(() => {
    let alive = true;
    void biometricsAvailable().then((v) => alive && setBio(v));
    return () => {
      alive = false;
    };
  }, []);

  const turnOn = async () => {
    setSetup(false);
    await set('lock.enabled', true);
    useLockStore.getState().setArmed(await hasPin());
    toast.success(t('lock.set'));
  };
  const turnOff = async () => {
    setAuth(null);
    await clearPin();
    await set('lock.enabled', false);
    useLockStore.getState().setArmed(false);
  };

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('appLock.enable')} onBack={() => goBack(routes.settings)} large={false} />
      <Card style={styles.gap}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{t('appLock.enable')}</Text>
            <Text variant="caption" tone="muted">
              {t('appLock.enableHint')}
            </Text>
          </View>
          <Toggle
            value={armed}
            onChange={(v) => (v ? setSetup(true) : setAuth('disable'))}
            accessibilityLabel={t('appLock.enable')}
            testID="lock-toggle"
          />
        </View>
        {armed ? (
          <Button
            size="md"
            variant="secondary"
            label={t('appLock.changePin')}
            onPress={() => setAuth('change')}
          />
        ) : null}
      </Card>
      {armed ? (
        <Card style={styles.gap}>
          <Text variant="bodyStrong">{t('appLock.method')}</Text>
          <View style={styles.chips}>
            {(['biometric', 'pin'] as const).map((m) => (
              <Chip
                key={m}
                label={t(`appLock.methods.${m}`)}
                selected={values['lock.method'] === m}
                onPress={() => void set('lock.method', m)}
              />
            ))}
          </View>
          {!bio ? (
            <Text variant="caption" tone="muted">
              {t('appLock.noBiometrics')}
            </Text>
          ) : null}
          <Divider />
          <Text variant="bodyStrong">{t('appLock.timeout')}</Text>
          <View style={styles.chips}>
            {TIMEOUTS.map((s) => (
              <Chip
                key={s}
                label={t(`appLock.timeouts.${s}`)}
                selected={values['lock.timeout'] === s}
                onPress={() => void set('lock.timeout', s)}
              />
            ))}
          </View>
          <Divider />
          <Text variant="bodyStrong">{t('appLock.scope')}</Text>
          <View style={styles.chips}>
            {(['app', 'photos'] as const).map((s) => (
              <Chip
                key={s}
                label={t(`appLock.scopes.${s}`)}
                selected={values['lock.scope'] === s}
                onPress={() => void set('lock.scope', s)}
              />
            ))}
          </View>
          <Divider />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{t('appLock.workout')}</Text>
              <Text variant="caption" tone="muted">
                {t('appLock.workoutHint')}
              </Text>
            </View>
            <Toggle
              value={values['lock.extendDuringWorkout']}
              onChange={(v) => void set('lock.extendDuringWorkout', v)}
              accessibilityLabel={t('appLock.workout')}
            />
          </View>
        </Card>
      ) : null}
      <Text variant="caption" tone="muted">
        {t('privacy.honest')}
      </Text>

      <BottomSheet visible={setup} onClose={() => setSetup(false)} title={t('lock.setupTitle')}>
        <PinSetup key={`setup-${setup}`} onDone={() => void turnOn()} />
      </BottomSheet>
      <AuthSheet
        visible={auth !== null}
        onClose={() => setAuth(null)}
        onSuccess={() => {
          if (auth === 'disable') void turnOff();
          else {
            setAuth(null);
            setSetup(true);
          }
        }}
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  gap: { gap: t.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, minHeight: 44 },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs },
}));
