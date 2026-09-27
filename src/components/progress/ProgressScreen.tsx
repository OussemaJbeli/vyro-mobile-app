import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { measurementText } from '@/components/body/format';
import { QuickWeightSheet } from '@/components/body/QuickWeightSheet';
import { arrowFor } from '@/components/body/TrendBadge';
import { useWeightTrend } from '@/components/body/useWeightTrend';
import { AreaChart } from '@/components/charts/AreaChart';
import {
  Button,
  Card,
  ChipGroup,
  EmptyState,
  Icon,
  IconButton,
  ListRow,
  ScreenContainer,
  SectionHeader,
  Skeleton,
  Text,
  type IconName,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import { bmi } from '@/domain/progress/trend';
import { addDaysIso } from '@/domain/scheduling/recurrence';
import { useLatestMeasurements, useMeasurementTypes, useProfile, useUnitPrefs } from '@/hooks/data';
import { makeStyles, useTheme } from '@/theme';
import { asLocalDate, formatDuration, toDate, toLocalDate, today } from '@/utils/dates';
import { displayName } from '@/utils/seedNames';
import { formatQuantity, fromCanonical, unitLabel } from '@/utils/units';

import { HistoryTimeline } from './HistoryTimeline';
import { GoalsSummary, LatestRecords, StreakCard, WeekPlannedCard } from './OverviewCards';
import { useThisWeek } from './useProgressData';

type Segment = 'overview' | 'body' | 'photos' | 'history';

/**
 * Progress tab (UI §18): Overview · Body · Photos · History. The photos segment is
 * provided by step 23 through `photosSegment`; history arrives in step 24.
 */
export function ProgressScreen({
  photosSegment,
  overviewExtra,
}: {
  photosSegment?: ReactNode;
  overviewExtra?: ReactNode;
}) {
  const { t } = useTranslation('progress');
  const styles = useStyles();
  const [segment, setSegment] = useState<Segment>('overview');
  return (
    <ScreenContainer edges={['top']}>
      <View style={styles.titleRow}>
        <Text variant="title" accessibilityRole="header" style={styles.flex}>
          {t('title')}
        </Text>
        <IconButton
          icon="progress"
          variant="plain"
          accessibilityLabel={t('analytics.open')}
          onPress={() => router.push(routes.analytics)}
          testID="open-analytics-top"
        />
      </View>
      {/* Template: pill chips (Overview · Body · Photos · History). */}
      <ChipGroup
        options={(['overview', 'body', 'photos', 'history'] as const).map((value) => ({
          value,
          label: t(`segments.${value}`),
        }))}
        value={segment}
        onChange={setSegment}
        testID="progress-segments"
      />
      {segment === 'overview' ? (
        <>
          <Overview />
          {overviewExtra}
        </>
      ) : null}
      {segment === 'body' ? <BodySegment /> : null}
      {segment === 'photos' ? (photosSegment ?? <Soon body={t('soon.title')} />) : null}
      {segment === 'history' ? <HistoryTimeline /> : null}
    </ScreenContainer>
  );
}

function Soon({ body }: { body: string }) {
  const { t } = useTranslation('progress');
  return <EmptyState icon="clock" title={t('soon.title')} body={body} />;
}

/** Weight card: latest, trend badge, 4-week chart. */
export function WeightCard() {
  const { t, i18n } = useTranslation('progress');
  const styles = useStyles();
  const theme = useTheme();
  const prefs = useUnitPrefs();
  const [logging, setLogging] = useState(false);
  const from = new Date(`${addDaysIso(today(), -28)}T00:00:00`).toISOString();
  const trend = useWeightTrend(from);
  const latest = trend.entries.at(-1);
  const locale = i18n.language;
  const fmt = (kg: number) => formatQuantity(kg, 'bodyWeight', prefs, locale);
  if (trend.isLoading) return <Skeleton preset="card" />;
  // Latest reading per day over the last 7 days (template chart: Sep 17 … Sep 23).
  const byDay = new Map<string, number>();
  for (const e of trend.entries) byDay.set(toLocalDate(e.recordedAt), e.valueKg);
  const days = [...byDay.entries()].slice(-7);
  const unit = prefs.weight;
  const display = (kg: number) => Math.round(fromCanonical(kg, unit) * 10) / 10;
  if (!latest) {
    return (
      <Card style={styles.gap} testID="weight-card">
        <Text tone="muted">{t('weight.title')}</Text>
        <Text tone="muted">{t('weight.emptyBody')}</Text>
        <Button
          size="md"
          variant="secondary"
          icon="add"
          label={t('weight.log')}
          onPress={() => setLogging(true)}
          testID="weight-log"
        />
        <QuickWeightSheet visible={logging} onClose={() => setLogging(false)} />
      </Card>
    );
  }
  return (
    <Card
      style={styles.gap}
      onPress={() => router.push(routes.weight)}
      accessibilityLabel={t('weight.title')}
      testID="weight-card"
    >
      <View style={styles.weightHead}>
        <View style={styles.flex}>
          <Text variant="caption" tone="muted">
            {t('weight.title')}
          </Text>
          <Text>
            <Text variant="display">{display(latest.valueKg).toFixed(1)}</Text>
            <Text tone="muted">{` ${unitLabel(unit)}`}</Text>
          </Text>
          {trend.weekly !== null ? (
            <Text variant="bodyStrong" tone="primary" testID="weight-trend">
              {Math.abs(trend.weekly) < 0.05
                ? t('weight.stable')
                : t('weight.thisWeek', {
                    arrow: arrowFor(trend.weekly),
                    value: fmt(Math.abs(trend.weekly)),
                  })}
            </Text>
          ) : (
            <Text variant="caption" tone="muted">
              {t('weight.moreData')}
            </Text>
          )}
        </View>
        <Icon name="forward" size={22} color={theme.colors.primaryInk} />
      </View>
      {days.length >= 2 ? (
        <AreaChart
          values={days.map(([, kg]) => display(kg))}
          labels={days.map(([d]) =>
            toDate(asLocalDate(d)).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
          )}
          summary={t('analytics.summaryWeight', {
            from: fmt(days[0]![1]),
            to: fmt(days.at(-1)![1]),
          })}
        />
      ) : null}
    </Card>
  );
}

/** Template "Weekly Stats": icon rings, counts, separators. */
function WeeklyStatsCard() {
  const { t } = useTranslation(['progress', 'home']);
  const styles = useStyles();
  const theme = useTheme();
  const { executions } = useThisWeek();
  const count = (types: string[]) => executions.filter((x) => types.includes(x.type)).length;
  const seconds = executions.reduce((s, x) => s + (x.activeSeconds ?? 0), 0);
  const items: { icon: IconName; value: string; label: string }[] = [
    { icon: 'gym', value: String(count(['gym'])), label: t('home:weekGym') },
    { icon: 'running', value: String(count(['running'])), label: t('home:weekRuns') },
    { icon: 'abs', value: String(count(['abs', 'home'])), label: t('home:weekAbs') },
    { icon: 'timer', value: formatDuration(seconds), label: t('home:training') },
  ];
  return (
    <Card style={styles.gap} testID="weekly-stats">
      <Text variant="heading">{t('body.weeklyStats')}</Text>
      <View style={styles.statsRow}>
        {items.map((it, i) => (
          <View
            key={it.label}
            style={[styles.statCol, i > 0 && styles.statSep]}
            accessible
            accessibilityLabel={`${it.value} ${it.label}`}
          >
            <View style={styles.statRing}>
              <Icon name={it.icon} size={22} color={theme.colors.primaryInk} />
            </View>
            <Text variant="bodyStrong" numberOfLines={1}>
              {it.value}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {it.label}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function Overview() {
  const { t, i18n } = useTranslation('progress');
  const styles = useStyles();
  const prefs = useUnitPrefs();
  const profile = useProfile();
  const types = useMeasurementTypes();
  const latest = useLatestMeasurements();
  const trend = useWeightTrend();
  const height = profile.data?.heightCm ?? null;
  const lastKg = trend.entries.at(-1)?.valueKg ?? null;
  const index = bmi(lastKg, height);
  const fatType = (types.data ?? []).find((x) => x.slug === 'body_fat');
  const fat = fatType
    ? (latest.data ?? []).find((m) => m.measurementTypeId === fatType.id)
    : undefined;
  const row = (label: string, value: string, onPress?: () => void) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={styles.measureRow}
    >
      <Text style={styles.flex}>{label}</Text>
      <Text variant="bodyStrong">{value}</Text>
      {onPress ? <Icon name="forward" size={18} /> : null}
    </Pressable>
  );
  return (
    <>
      <WeightCard />
      <WeeklyStatsCard />
      <Card style={styles.gap} testID="body-measurements">
        <Text variant="heading">{t('body.measurements')}</Text>
        {row(
          t('body.height'),
          height ? formatQuantity(height, 'height', prefs, i18n.language) : '—',
          () => router.push(routes.settingsProfile),
        )}
        {index !== null
          ? row(t('body.bmi'), index.toFixed(1), () => router.push(routes.weight))
          : null}
        {fat && fatType
          ? row(t('body.bodyFat'), measurementText(fatType, fat.value, prefs, i18n.language), () =>
              router.push(routes.measurement(fatType.id)),
            )
          : row(t('body.logMeasurements'), '', () => router.push(routes.measure))}
      </Card>
      <WeekPlannedCard />
      <StreakCard />
      <GoalsSummary />
      <LatestRecords />
      <Button
        size="md"
        variant="secondary"
        icon="progress"
        label={t('analytics.open')}
        onPress={() => router.push(routes.analytics)}
        testID="open-analytics"
      />
      <View style={styles.spacer} />
    </>
  );
}

function BodySegment() {
  const { t, i18n } = useTranslation(['progress', 'seed']);
  const styles = useStyles();
  const prefs = useUnitPrefs();
  const profile = useProfile();
  const types = useMeasurementTypes();
  const latest = useLatestMeasurements();
  const trend = useWeightTrend();
  const [logging, setLogging] = useState(false);
  const lastKg = trend.entries.at(-1);
  const tr = (k: string, o?: { defaultValue?: string }) =>
    t(k as 'progress:title', { defaultValue: o?.defaultValue ?? k });
  return (
    <>
      <Card>
        <ListRow
          title={t('body.height')}
          trailing={
            <Text variant="bodyStrong">
              {profile.data?.heightCm
                ? formatQuantity(profile.data.heightCm, 'height', prefs, i18n.language)
                : '—'}
            </Text>
          }
          onPress={() => router.push(routes.settingsProfile)}
        />
        <ListRow
          title={t('weight.title')}
          subtitle={lastKg ? toLocalDate(lastKg.recordedAt) : t('weight.empty')}
          trailing={
            <Text variant="bodyStrong">
              {lastKg ? formatQuantity(lastKg.valueKg, 'bodyWeight', prefs, i18n.language) : '—'}
            </Text>
          }
          onPress={() => router.push(routes.weight)}
        />
      </Card>
      <View style={styles.row}>
        <Button size="md" icon="add" label={t('weight.log')} onPress={() => setLogging(true)} />
        <Button
          size="md"
          variant="secondary"
          icon="measure"
          label={t('body.logMeasurements')}
          onPress={() => router.push(routes.measure)}
        />
      </View>
      <SectionHeader title={t('body.measurements')} />
      <Card>
        {(types.data ?? []).map((type) => {
          const m = (latest.data ?? []).find((x) => x.measurementTypeId === type.id);
          return (
            <ListRow
              key={type.id}
              title={displayName('measurement', type, tr)}
              subtitle={m ? toLocalDate(m.recordedAt) : t('body.noValue')}
              trailing={
                <Text variant="bodyStrong">
                  {m ? measurementText(type, m.value, prefs, i18n.language) : '—'}
                </Text>
              }
              onPress={() => router.push(routes.measurement(type.id))}
              testID={`body-type-${type.slug ?? type.id}`}
            />
          );
        })}
        <ListRow title={t('body.manage')} onPress={() => router.push(routes.measurements)} />
      </Card>
      <QuickWeightSheet visible={logging} onClose={() => setLogging(false)} />
    </>
  );
}

const useStyles = makeStyles((t) => ({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  weightHead: { flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.sm },
  statsRow: { flexDirection: 'row' },
  statCol: { flex: 1, alignItems: 'center', gap: 4 },
  statSep: { borderLeftWidth: 1, borderLeftColor: t.colors.border },
  statRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: t.colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  measureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    minHeight: 44,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surfaceRaised,
  },
  gap: { gap: t.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, flexWrap: 'wrap' },
  flex: { flex: 1 },
  spacer: { height: t.spacing.lg },
}));
