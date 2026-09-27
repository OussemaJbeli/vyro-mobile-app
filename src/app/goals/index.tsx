import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { formatTarget } from '@/components/goals/goalUnits';
import {
  Button,
  Card,
  Divider,
  EmptyState,
  Header,
  IconTile,
  ListRow,
  ScreenContainer,
  SectionHeader,
  Skeleton,
  Text,
  type IconName,
} from '@/components/ui';
import { useGoals, useMeasurementTypes, useUnitPrefs } from '@/hooks/data';
import { makeStyles } from '@/theme';
import { type Goal } from '@/types/domain';

export const GOAL_ICON: Record<Goal['type'], IconName> = {
  weight: 'weight',
  measurement: 'measure',
  consistency: 'streak',
  running: 'running',
  frequency: 'plan',
  muscle: 'gym',
  custom: 'trophy',
};

/** Goals (FS §9): active first, history kept. */
export default function GoalsScreen() {
  const { t } = useTranslation('goals');
  const styles = useStyles();
  const goals = useGoals();
  const types = useMeasurementTypes().data ?? [];
  const units = useUnitPrefs();
  const all = goals.data ?? [];
  const active = all.filter((g) => g.status === 'active' || g.status === 'paused');
  const past = all.filter((g) => g.status === 'achieved' || g.status === 'abandoned');

  const row = (g: Goal, i: number) => {
    const m = types.find((x) => x.id === g.measurementTypeId) ?? null;
    const target = formatTarget(g, units, m);
    return (
      <View key={g.id}>
        {i > 0 ? <Divider /> : null}
        <ListRow
          title={g.title}
          subtitle={[t(`types.${g.type}`), target].filter(Boolean).join(' · ')}
          leading={
            <IconTile
              icon={GOAL_ICON[g.type]}
              size={40}
              tone={g.status === 'active' ? 'accent' : 'default'}
            />
          }
          trailing={
            <Text variant="caption" tone="muted">
              {t(`status.${g.status}`)}
            </Text>
          }
          onPress={() => router.push({ pathname: '/goals/[id]', params: { id: g.id } })}
          testID={`goal-row-${g.id}`}
        />
      </View>
    );
  };

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('title')} onBack={() => goBack(routes.settings)} />
      {goals.isLoading ? (
        <Skeleton preset="card" />
      ) : all.length === 0 ? (
        <Card>
          <EmptyState
            icon="trophy"
            title={t('empty.title')}
            body={t('empty.body')}
            actionLabel={t('empty.action')}
            onAction={() => router.push({ pathname: '/goals/[id]', params: { id: 'new' } })}
          />
        </Card>
      ) : (
        <>
          {active.length ? (
            <View style={styles.section}>
              <SectionHeader title={t('sections.active')} />
              <Card>{active.map(row)}</Card>
            </View>
          ) : null}
          {past.length ? (
            <View style={styles.section}>
              <SectionHeader title={t('sections.other')} />
              <Card>{past.map(row)}</Card>
            </View>
          ) : null}
          <Button
            label={t('add')}
            icon="add"
            fullWidth
            onPress={() => router.push({ pathname: '/goals/[id]', params: { id: 'new' } })}
            testID="goal-add"
          />
        </>
      )}
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({ section: { gap: t.spacing.sm } }));
