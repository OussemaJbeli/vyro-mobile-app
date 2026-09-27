import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { VyroMark } from '@/components/brand';
import { Button, ConfirmDialog, Text } from '@/components/ui';
import {
  authenticateBiometric,
  biometricsAvailable,
  clearPin,
  verifyPin,
  waitMs,
} from '@/services/security/lock';
import { useLockStore } from '@/store/lockStore';
import { useSettingsStore } from '@/store/settingsStore';
import { makeStyles, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

import { PinBusy } from './PinBusy';
import { PinPad } from './PinPad';

const fmtWait = (ms: number) =>
  ms >= 60_000 ? `${Math.ceil(ms / 60_000)} min` : `${Math.ceil(ms / 1000)} s`;

/** Unlock VYRO (UI §38): biometrics first when enabled, PIN with backoff as fallback. */
export function LockScreen({ onUnlocked }: { onUnlocked?: () => void }) {
  const { t } = useTranslation(['settings', 'common']);
  const styles = useStyles();
  const theme = useTheme();
  const method = useSettingsStore((s) => s.values['lock.method']);
  const unlock = useLockStore((s) => s.unlock);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState(false);
  const [reset, setReset] = useState<0 | 1>(0);

  const done = () => {
    haptics.success();
    unlock();
    onUnlocked?.();
  };

  const tryBiometric = async () => {
    if (await authenticateBiometric()) done();
  };

  useEffect(() => {
    let alive = true;
    void biometricsAvailable().then((ok) => {
      if (!alive) return;
      setBio(ok);
      if (ok && method === 'biometric')
        void authenticateBiometric().then((r) => r && alive && done());
    });
    void waitMs().then((w) => alive && w > 0 && setMessage(t('lock.wait', { time: fmtWait(w) })));
    return () => {
      alive = false;
    };
    // Prompt once when the lock screen appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (value: string) => {
    setBusy(true);
    const r = await verifyPin(value);
    setBusy(false);
    setPin('');
    if (r.ok) return done();
    haptics.warning();
    setMessage(r.waitMs > 0 ? t('lock.wait', { time: fmtWait(r.waitMs) }) : t('lock.wrong'));
  };

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.colors.bg }]}
      accessibilityViewIsModal
      testID="lock-screen"
    >
      <VyroMark size={72} color={theme.colors.primary} glow />
      <Text variant="title" accessibilityRole="header">
        {t('lock.title')}
      </Text>
      <Text tone={message ? 'danger' : 'muted'} accessibilityLiveRegion="polite">
        {message ?? t('lock.enterPin')}
      </Text>
      <PinPad
        value={pin}
        onChange={(v) => {
          setMessage(null);
          setPin(v);
        }}
        onSubmit={(v) => void submit(v)}
        disabled={busy}
      />
      {busy ? <PinBusy label={t('lock.checking')} /> : null}
      {bio ? (
        <Button
          size="lg"
          variant="secondary"
          icon="lock"
          label={t('lock.biometric')}
          onPress={() => void tryBiometric()}
          testID="lock-biometric"
        />
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        label={t('lock.forgot')}
        onPress={() => (bio ? void tryBiometric() : setReset(1))}
      />
      <ConfirmDialog
        visible={reset === 1}
        title={t('lock.resetTitle')}
        message={t('lock.resetBody')}
        confirmLabel={t('lock.reset')}
        cancelLabel={t('common:cancel')}
        destructive
        onCancel={() => setReset(0)}
        onConfirm={() => {
          setReset(0);
          void clearPin()
            .then(() => useSettingsStore.getState().set('lock.enabled', false))
            .finally(done);
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.md,
    padding: t.spacing.lg,
  },
}));
