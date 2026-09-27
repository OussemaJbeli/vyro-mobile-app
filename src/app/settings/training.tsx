import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Card,
  Divider,
  Header,
  ListRow,
  NumberStepper,
  ScreenContainer,
  Text,
  Toggle,
} from '@/components/ui';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { useUnitPrefs } from '@/hooks/data';
import { useSettingsStore } from '@/store/settingsStore';
import { makeStyles } from '@/theme';
import { type SettingKey } from '@/types/settings';
import { formatQuantity, fromCanonical, toCanonical } from '@/utils/units';

const TOGGLES: { key: SettingKey; label: string }[] = [
  { key: 'training.autoStartRest', label: 'autoRest' },
  { key: 'training.keepAwake', label: 'keepAwake' },
  { key: 'haptics', label: 'haptics' },
  { key: 'training.countdownBeeps', label: 'beeps' },
  { key: 'training.voiceCues', label: 'voice' },
];

/** Training preferences (step 12): defaults used by the execution screens. */
export default function TrainingPreferencesScreen() {
  const { t } = useTranslation('settings');
  const styles = useStyles();
  const values = useSettingsStore((s) => s.values);
  const set = useSettingsStore((s) => s.set);
  const units = useUnitPrefs();
  const lb = units.weight === 'lb';
  const increment = lb
    ? Math.round(fromCanonical(values['training.weightIncrementKg'], 'lb'))
    : values['training.weightIncrementKg'];

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('training.title')} onBack={() => goBack(routes.settings)} large={false} />
      <Card style={styles.card}>
        <Text variant="caption" tone="muted">
          {t('training.defaultRest')}
        </Text>
        <NumberStepper
          label={t('training.defaultRest')}
          value={values['training.defaultRestSeconds']}
          onChange={(v) => set('training.defaultRestSeconds', v).catch(() => {})}
          step={15}
          min={0}
          max={600}
          unit={t('training.seconds')}
        />
        <Divider />
        <Text variant="caption" tone="muted">
          {t('training.weightIncrement')} ·{' '}
          {formatQuantity(values['training.weightIncrementKg'], 'load', units)}
        </Text>
        <NumberStepper
          label={t('training.weightIncrement')}
          value={increment}
          onChange={(v) =>
            set('training.weightIncrementKg', lb ? toCanonical(v, 'lb') : v).catch(() => {})
          }
          step={lb ? 1 : 0.5}
          min={lb ? 1 : 0.5}
          max={lb ? 25 : 10}
          unit={units.weight}
        />
      </Card>
      <Card>
        {TOGGLES.map((item, i) => (
          <View key={item.key}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              title={t(`training.${item.label}` as 'training.haptics')}
              trailing={
                <Toggle
                  value={values[item.key] as boolean}
                  onChange={(v) => set(item.key, v as never).catch(() => {})}
                  accessibilityLabel={t(`training.${item.label}` as 'training.haptics')}
                />
              }
            />
          </View>
        ))}
      </Card>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({ card: { gap: t.spacing.md } }));
