import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { measurementText } from '@/components/body/format';
import { useWeightTrend } from '@/components/body/useWeightTrend';
import {
  BottomSheet,
  Button,
  Card,
  IconButton,
  ListRow,
  ProgressBar,
  ProgressRing,
  SectionHeader,
  StatTile,
  Text,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import { exerciseRecords } from '@/domain/analytics/records';
import { estimateWeeks, goalProgress } from '@/domain/goals/progress';
import { rate28 } from '@/domain/progress/trend';
import {
  invalidates,
  useDoneSets,
  useGoals,
  useMeasurements,
  useMeasurementTypes,
  useRepoMutation,
  useUnitPrefs,
} from '@/hooks/data';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { makeStyles } from '@/theme';
import { type Goal } from '@/types/domain';
import { now } from '@/utils/clock';
import { formatDuration } from '@/utils/dates';
import { formatQuantity } from '@/utils/units';

import { useStreaks, useThisWeek } from './useProgressData';

/** ⓘ definitions sheet (FS §32: honest, explained metrics). */
export function InfoButton({
  keys,
}: {
  keys: ('planned' | 'completed' | 'rate' | 'time' | 'muscles' | 'streak' | 'distance')[];
}) {
  const { t } = useTranslation('progress');
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        icon="info"
        variant="plain"
        size={36}
        accessibilityLabel={t('analytics.info')}
        onPress={() => setOpen(true)}
      />
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={t('definitions.title')}>
        <View style={styles.gap}>
          {keys.map((k) => (
            <Text key={k}>{t(`definitions.${k}`)}</Text>
          ))}
        </View>
      </BottomSheet>
    </>
  );
}

export function WeekPlannedCard() {
  const { t } = useTranslation('progress');
  const styles = useStyles();
  const { stats, executions } = useThisWeek();
  const seconds = executions.reduce((s, x) => s + (x.activeSeconds ?? 0), 0);
  return (
    <Card style={styles.gap} testID="week-planned">
      <View style={styles.head}>
        <Text variant="heading" style={styles.flex}>
          {t('week.title')}
        </Text>
        <InfoButton keys={['planned', 'completed', 'rate', 'time']} />
      </View>
      {stats.planned ? (
        <View style={styles.row}>
          <ProgressRing
            value={stats.rate ?? 0}
            size={88}
            accessibilityLabel={t('week.planned', { done: stats.completed, total: stats.planned })}
          >
            <Text variant="bodyStrong">
              {t('week.rate', { value: Math.round((stats.rate ?? 0) * 100) })}
            </Text>
          </ProgressRing>
          <View style={styles.flex}>
            <Text variant="bodyStrong">
              {t('week.planned', { done: stats.completed, total: stats.planned })}
            </Text>
            {Object.entries(stats.perType).map(([type, v]) => (
              <Text key={type} tone="muted">
                {`${t(`types.${type}` as 'types.gym', { defaultValue: type })} ${v.completed}/${v.planned}`}
              </Text>
            ))}
            {stats.extra ? (
              <Text tone="muted">{t('week.extra', { count: stats.extra })}</Text>
            ) : null}
            <Text tone="muted">{formatDuration(seconds)}</Text>
          </View>
        </View>
      ) : (
        <Text tone="muted">{t('week.nothingPlanned')}</Text>
      )}
    </Card>
  );
}

export function StreakCard() {
  const { t } = useTranslation('progress');
  const styles = useStyles();
  const s = useStreaks();
  return (
    <Card style={styles.gap} testID="streak-card">
      <View style={styles.head}>
        <Text variant="heading" style={styles.flex}>
          🔥 {t('streak.title')}
        </Text>
        <InfoButton keys={['streak']} />
      </View>
      <View style={styles.row}>
        <StatTile value={t('streak.days', { count: s.current })} label={t('streak.current')} />
        <StatTile value={t('streak.days', { count: s.longest })} label={t('streak.longest')} />
      </View>
    </Card>
  );
}

export function GoalsSummary() {
  const { t } = useTranslation('progress');
  const goals = useGoals('active');
  const list = (goals.data ?? []).filter((g) => g.targetValue !== null);
  return (
    <>
      <SectionHeader title={t('goals.title')} />
      {list.length === 0 ? (
        <Card>
          <ListRow title={t('goals.none')} onPress={() => router.push(routes.goals)} />
        </Card>
      ) : (
        list.map((g) => <GoalCard key={g.id} goal={g} />)
      )}
    </>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const { t, i18n } = useTranslation('progress');
  const styles = useStyles();
  const prefs = useUnitPrefs();
  const weight = useWeightTrend();
  const types = useMeasurementTypes();
  const measures = useMeasurements(goal.measurementTypeId ?? '');
  const week = useThisWeek();
  const markAchieved = useRepoMutation((r) => r.goals.setStatus(goal.id, 'achieved'), {
    invalidate: invalidates.goals,
  });
  const mType = (types.data ?? []).find((x) => x.id === goal.measurementTypeId);
  const mReadings = (measures.data ?? []).map((m) => ({
    t: Date.parse(m.recordedAt),
    value: m.value,
  }));
  let current: number | null = null;
  let perWeek: number | null = null;
  let fmt = (v: number) => `${Math.round(v * 10) / 10}`;
  if (goal.type === 'weight') {
    current = weight.entries.at(-1)?.valueKg ?? null;
    perWeek = weight.rate.perWeek;
    fmt = (v) => formatQuantity(v, 'bodyWeight', prefs, i18n.language);
  } else if (goal.type === 'measurement' && mType) {
    current = mReadings.at(-1)?.value ?? null;
    const r = rate28(mReadings, now().getTime());
    perWeek = r.perWeek;
    fmt = (v) => measurementText(mType, v, prefs, i18n.language);
  } else if (goal.type === 'frequency') {
    current = week.stats.completed + week.stats.extra;
  } else if (goal.type === 'consistency') {
    current = week.stats.rate === null ? null : Math.round(week.stats.rate * 100);
    fmt = (v) => `${v} %`;
  } else if (goal.type === 'running') {
    current = week.executions
      .filter((x) => x.type === 'running')
      .reduce((s, x) => s + (x.distanceKm ?? 0), 0);
    fmt = (v) => formatQuantity(v, 'distance', prefs, i18n.language);
  }
  const p = goalProgress(goal, current);
  const est =
    current !== null &&
    goal.targetValue !== null &&
    (goal.type === 'weight' || goal.type === 'measurement')
      ? estimateWeeks(current, goal.targetValue, perWeek)
      : null;
  return (
    <Card style={styles.gap} testID={`goal-${goal.id}`}>
      <ListRow title={goal.title} onPress={() => router.push(routes.goal(goal.id))} />
      {p.current !== null && p.target !== null ? (
        <>
          <Text variant="bodyStrong">
            {p.start !== null ? `${fmt(p.start)} → ` : ''}
            {fmt(p.current)} → {fmt(p.target)}
          </Text>
          <ProgressBar value={p.fraction ?? 0} />
          {p.remaining !== null && !p.reached ? (
            <Text tone="muted">{t('goals.remaining', { value: fmt(p.remaining) })}</Text>
          ) : null}
          {est && perWeek !== null ? (
            <Text variant="caption" tone="muted">
              {t('goals.estimate', {
                rate: `${perWeek > 0 ? '+' : '−'}${fmt(Math.abs(perWeek))}`,
                target: fmt(p.target),
                low: est[0],
                high: est[1],
              })}
            </Text>
          ) : null}
          {p.reached ? (
            <View style={styles.row}>
              <Text tone="primary" style={styles.flex}>
                {t('goals.reached')}
              </Text>
              <Button
                size="sm"
                label={t('goals.markAchieved')}
                onPress={() => markAchieved.mutate(undefined)}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

export function LatestRecords() {
  const { t, i18n } = useTranslation('progress');
  const prefs = useUnitPrefs();
  const catalog = useExerciseCatalog();
  const sets = useDoneSets();
  const rows = sets.data ?? [];
  const dateOf = new Map(rows.map((r) => [r.executionId, r.startedAt]));
  const records = exerciseRecords(
    rows.map((r) => ({
      exerciseId: r.exerciseId,
      executionId: r.executionId,
      date: r.startedAt,
      reps: r.reps,
      weightKg: r.weightKg,
      durationSeconds: r.durationSeconds,
    })),
  )
    .map((r) => ({
      r,
      last:
        Object.keys(r.setIn)
          .map((id) => dateOf.get(id) ?? '')
          .sort()
          .at(-1) ?? '',
    }))
    .filter((x) => x.last)
    .sort((a, b) => b.last.localeCompare(a.last))
    .slice(0, 3);
  return (
    <>
      <SectionHeader title={t('records.title')} />
      <Card>
        {records.length === 0 ? (
          <Text tone="muted">{t('records.none')}</Text>
        ) : (
          records.map(({ r }) => (
            <ListRow
              key={r.exerciseId}
              title={catalog.byId.get(r.exerciseId)?.label ?? '…'}
              subtitle={[
                r.heaviestKg
                  ? t('records.heaviest', {
                      value: formatQuantity(r.heaviestKg, 'load', prefs, i18n.language),
                    })
                  : null,
                r.best1RmKg
                  ? t('records.oneRm', {
                      value: formatQuantity(r.best1RmKg, 'load', prefs, i18n.language),
                    })
                  : null,
                r.mostReps ? t('records.reps', { value: r.mostReps }) : null,
                r.longestSeconds ? t('records.hold', { value: `${r.longestSeconds} s` }) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => router.push(routes.exercise(r.exerciseId))}
            />
          ))
        )}
      </Card>
    </>
  );
}

const useStyles = makeStyles((t) => ({
  gap: { gap: t.spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  flex: { flex: 1 },
}));
