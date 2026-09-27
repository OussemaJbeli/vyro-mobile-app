import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { Card, Header, ScreenContainer, SegmentedControl, Text } from '@/components/ui';
import { invalidates, useProfile, useRepoMutation, useUnitPrefs } from '@/hooks/data';
import { makeStyles } from '@/theme';
import { type ProfileInput } from '@/types/forms';
import { formatQuantity, type UnitPrefs } from '@/utils/units';

const OPTIONS = {
  weight: ['kg', 'lb'],
  length: ['cm', 'in'],
  distance: ['km', 'mi'],
  speed: ['kmh', 'mph'],
} as const;

const FIELD = {
  weight: 'weightUnit',
  length: 'lengthUnit',
  distance: 'distanceUnit',
  speed: 'speedUnit',
} as const;

/** Units (step 12): display only; stored values are canonical metric and never change. */
export default function UnitsScreen() {
  const { t } = useTranslation(['settings', 'onboarding']);
  const styles = useStyles();
  const units = useUnitPrefs();
  useProfile();
  const save = useRepoMutation(
    (r, patch: Partial<Record<(typeof FIELD)[keyof typeof FIELD], string>>) =>
      r.profile.upsert(patch as never),
    { invalidate: [...invalidates.profile, ['weights'], ['measurements'], ['goals']] },
  );

  const change = (key: keyof UnitPrefs, value: string) =>
    save.mutate({ [FIELD[key]]: value } as ProfileInput);

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('units.title')} onBack={() => goBack(routes.settings)} large={false} />
      <Text tone="muted">{t('units.subtitle')}</Text>
      <Card style={styles.card}>
        {(Object.keys(OPTIONS) as (keyof UnitPrefs)[]).map((key) => (
          <View key={key} style={styles.row}>
            <Text variant="caption" tone="muted">
              {t(`units.${key}`)}
            </Text>
            <SegmentedControl
              segments={OPTIONS[key].map((v) => ({ value: v, label: t(`onboarding:units.${v}`) }))}
              value={units[key]}
              onChange={(v) => change(key, v)}
              testID={`units-${key}`}
            />
          </View>
        ))}
      </Card>
      <Text variant="caption" tone="muted" align="center" testID="units-preview">
        {t('units.preview', {
          weight: formatQuantity(74.6, 'bodyWeight', units),
          height: formatQuantity(180, 'height', units),
          distance: formatQuantity(5, 'distance', units),
          speed: formatQuantity(10, 'speed', units),
        })}
      </Text>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({ card: { gap: t.spacing.lg }, row: { gap: t.spacing.sm } }));
