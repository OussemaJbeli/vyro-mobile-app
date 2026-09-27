import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BottomSheet, Button, Text } from '@/components/ui';
import { authenticateBiometric, biometricsAvailable, verifyPin } from '@/services/security/lock';
import { makeStyles } from '@/theme';

import { PinBusy } from './PinBusy';
import { PinPad } from './PinPad';

/** "Confirm it's you" before sensitive lock changes (disable, change PIN). */
export function AuthSheet({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation('settings');
  const styles = useStyles();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bio, setBio] = useState<boolean | null>(null);
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void biometricsAvailable().then((v) => alive && setBio(v));
    return () => {
      alive = false;
    };
  }, [visible]);
  const ok = () => {
    setPin('');
    onSuccess();
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('appLock.confirmDisable')}>
      <View style={styles.wrap}>
        {error ? <Text tone="danger">{error}</Text> : null}
        <PinPad
          value={pin}
          onChange={setPin}
          disabled={busy}
          onSubmit={(v) => {
            setBusy(true);
            void verifyPin(v).then((r) => {
              setBusy(false);
              setPin('');
              if (r.ok) ok();
              else setError(t('lock.wrong'));
            });
          }}
        />
        {busy ? <PinBusy label={t('lock.checking')} /> : null}
        {bio ? (
          <Button
            size="md"
            variant="secondary"
            label={t('lock.biometric')}
            onPress={() => void authenticateBiometric().then((r) => r && ok())}
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles((t) => ({ wrap: { alignItems: 'center', gap: t.spacing.md } }));
