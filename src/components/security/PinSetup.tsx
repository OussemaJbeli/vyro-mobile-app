import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { setPin } from '@/services/security/lock';
import { makeStyles } from '@/theme';
import { logger } from '@/utils/logger';

import { PinBusy } from './PinBusy';
import { PinPad } from './PinPad';

/** Choose + confirm a PIN, then store its salted hash (never the PIN). */
export function PinSetup({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation('settings');
  const styles = useStyles();
  const [first, setFirst] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (v: string) => {
    if (first === null) {
      setFirst(v);
      setValue('');
      return;
    }
    if (v !== first) {
      setFirst(null);
      setValue('');
      setError(t('lock.mismatch'));
      return;
    }
    setBusy(true);
    try {
      await setPin(v);
      onDone();
    } catch (e) {
      logger.error('PIN setup failed', { error: e });
      setBusy(false);
    }
  };
  return (
    <View style={styles.wrap} testID="pin-setup">
      <Text variant="heading">
        {first === null ? t('lock.setupTitle') : t('lock.confirmTitle')}
      </Text>
      <Text tone={error ? 'danger' : 'muted'}>{error ?? t('lock.setupHint')}</Text>
      <PinPad
        value={value}
        onChange={(v) => {
          setError(null);
          setValue(v);
        }}
        onSubmit={(v) => void submit(v)}
        disabled={busy}
      />
      {busy ? <PinBusy label={t('lock.saving')} /> : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.md },
}));
