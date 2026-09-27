import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useWeightTrend } from '@/components/body/useWeightTrend';
import { BarChart, HBarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { Sparkline } from '@/components/charts/Sparkline';
import {
  Card,
  Header,
  ListRow,
  ScreenContainer,
  SectionHeader,
  SegmentedControl,
  Text,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import {
  muscleFrequency,
  reschedulingStats,
  runningTotals,
  trainingSeconds,
  weekly,
  weeklyRate,
} from '@/domain/analytics/metrics';
import { addDaysIso, weekStart } from '@/domain/scheduling/recurrence';
import { streakCalendar } from '@/domain/streaks/streak';
import { useDoneSets, useUnitPrefs } from '@/hooks/data';
import { makeStyles, useTheme } from '@/theme';
import { asLocalDate, formatDuration, toDate } from '@/utils/dates';
import { formatQuantity } from '@/utils/units';

import { InfoButton, StreakCard } from './OverviewCards';
import { usePeriod, useWeekBounds } from './useProgressData';

const PERIODS = { '4W': 4, '12W': 12, '6M': 26, '1Y': 52 } as const;
type Period = keyof typeof PERIODS;

/** Analytics (step 24, FS §32): training, running, body, consistency — honest and explained. */
export function AnalyticsScreen() {
  const { t, i18n } = useTranslation(['progress', 'exercises']);
  const styles = useStyles();
  const theme = useTheme();
  const prefs = useUnitPrefs();
  const [period, setPeriod] = useState<Period>('12W');
  const { day, from: thisWeek, startsOn } = useWeekBounds();
  const n = PERIODS[period];
  const from = addDaysIso(thisWeek, -(n - 1) * 7);
  const weeks = Array.from({ length: n }, (_, i) => addDaysIso(from, i * 7));
  const weekOf = (d: string) => weekStart(d, startsOn);
  const p = usePeriod(from, day);
  const sets = useDoneSets({ from, to: day });
  const weight = useWeightTrend(toDate(asLocalDate(from)).toISOString());
  const locale = i18n.language;
  const short = (d: string) =>
    toDate(asLocalDate(d)).toLocaleDateString(locale, { day: 'numeric', month: 'numeric' });
  const labels = weeks.map((w, i) => (n <= 12 || i % Math.ceil(n / 8) === 0 ? short(w) : ''));
  const buckets = weekly(p.executions, weeks, weekOf);
  const rates = weeklyRate(p.sessions, weeks, weekOf);
  const muscles = muscleFrequency(sets.data ?? []).slice(0, 8);
  const run = runningTotals(p.executions);
  const moved = reschedulingStats(p.sessions);
  const calendar = streakCalendar({
    sessions: p.sessions,
    adhocDates: p.executions.filter((x) => x.scheduledSessionId === null).map((x) => x.date),
    today: day,
    since: from,
  });
  const totalSessions = buckets.reduce((s, b) => s + b.sessions, 0);
  const none = <Text tone="muted">{t('analytics.insufficient')}</Text>;

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('analytics.title')} onBack={() => router.back()} large={false} />
      <SegmentedControl
        segments={(Object.keys(PERIODS) as Period[]).map((value) => ({
          value,
          label: t(`analytics.periods.${value}`),
        }))}
        value={period}
        onChange={setPeriod}
      />

      <View style={styles.head}>
        <SectionHeader title={t('analytics.training')} />
        <InfoButton keys={['planned', 'completed', 'rate', 'time', 'muscles']} />
      </View>
      <Card style={styles.gap}>
        <Text variant="bodyStrong">{t('analytics.sessionsPerWeek')}</Text>
        {totalSessions ? (
          <BarChart
            values={buckets.map((b) => b.sessions)}
            labels={labels}
            summary={t('analytics.summarySessions', { total: totalSessions, weeks: n })}
          />
        ) : (
          none
        )}
        <Text variant="bodyStrong">{t('analytics.completionRate')}</Text>
        {rates.some((r) => r !== null) ? (
          <LineChart
            values={rates.map((r) => (r === null ? null : Math.round(r * 100)))}
            labels={[short(weeks[0]!), short(weeks.at(-1)!)]}
            min={0}
            max={100}
            summary={t('analytics.summaryRate')}
          />
        ) : (
          none
        )}
        <Text variant="bodyStrong">{t('analytics.muscles')}</Text>
        {muscles.length ? (
          <HBarChart
            rows={muscles.map((m) => ({
              label: t(`exercises:muscles.${m.muscle}` as 'exercises:muscles.chest', {
                defaultValue: m.muscle,
              }),
              value: m.sets,
            }))}
            summary={muscles.map((m) => `${m.muscle} ${m.sets}`).join(', ')}
          />
        ) : (
          none
        )}
        <Text tone="muted">
          {t('analytics.totalTime', { time: formatDuration(trainingSeconds(p.executions)) })}
        </Text>
      </Card>

      <View style={styles.head}>
        <SectionHeader title={t('analytics.running')} />
        <InfoButton keys={['distance']} />
      </View>
      <Card style={styles.gap}>
        {run.runs ? (
          <>
            <Text>
              {t('analytics.runTotals', {
                runs: run.runs,
                distance: formatQuantity(run.distanceKm, 'distance', prefs, locale),
                time: formatDuration(run.seconds),
              })}
            </Text>
            <Text variant="bodyStrong">{t('analytics.distancePerWeek')}</Text>
            <BarChart
              values={buckets.map((b) => b.distanceKm)}
              labels={labels}
              format={(v) => v.toFixed(1)}
              summary={t('analytics.summaryDistance', {
                distance: formatQuantity(run.distanceKm, 'distance', prefs, locale),
                weeks: n,
              })}
            />
            {run.avgSpeedKmh ? (
              <Text tone="muted">
                {t('analytics.avgSpeed', {
                  value: formatQuantity(run.avgSpeedKmh, 'speed', prefs, locale),
                })}
              </Text>
            ) : null}
          </>
        ) : (
          none
        )}
      </Card>

      <SectionHeader title={t('analytics.body')} />
      <Card style={styles.gap}>
        <ListRow title={t('analytics.weightTrend')} onPress={() => router.push(routes.weight)} />
        {weight.points.length >= 2 ? (
          <Sparkline
            points={weight.points}
            height={120}
            accessibilityLabel={t('analytics.summaryWeight', {
              from: formatQuantity(weight.points[0]!.smooth, 'bodyWeight', prefs, locale),
              to: formatQuantity(weight.points.at(-1)!.smooth, 'bodyWeight', prefs, locale),
            })}
          />
        ) : (
          none
        )}
        <ListRow title={t('body.measurements')} onPress={() => router.push(routes.measurements)} />
      </Card>

      <SectionHeader title={t('analytics.consistency')} />
      <StreakCard />
      <Card style={styles.gap}>
        <Text variant="bodyStrong">{t('analytics.calendar')}</Text>
        <View style={styles.heat} accessible accessibilityLabel={t('analytics.calendar')}>
          {[...calendar.entries()].map(([d, s]) => (
            <View
              key={d}
              style={[
                styles.cell,
                {
                  backgroundColor:
                    s === 'satisfied'
                      ? theme.colors.primary
                      : s === 'broken'
                        ? theme.colors.danger
                        : theme.colors.surfaceRaised,
                },
              ]}
            />
          ))}
        </View>
        <Text variant="caption" tone="muted">
          {`■ ${t('analytics.legendDone')}   ■ ${t('analytics.legendMissed')}`}
        </Text>
        {moved.moved ? (
          <Text tone="muted">
            {t('analytics.rescheduled', {
              moved: moved.moved,
              days: moved.avgShiftDays.toFixed(1),
            })}
          </Text>
        ) : null}
      </Card>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  gap: { gap: t.spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heat: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  cell: { width: 12, height: 12, borderRadius: 2 },
}));
