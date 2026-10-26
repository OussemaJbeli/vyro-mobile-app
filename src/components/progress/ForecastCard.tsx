import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useWeightTrend } from '@/components/body/useWeightTrend';
import { LineChart } from '@/components/charts/LineChart';
import { Button, Card, Icon, Text } from '@/components/ui';
import { routes } from '@/constants/routes';
import { forecast, projectWeights } from '@/domain/progress/forecast';
import { addDaysIso, daysBetween } from '@/domain/scheduling/recurrence';
import { useCompletedBetween, useGoals, useSessionsForRange, useUnitPrefs } from '@/hooks/data';
import { makeStyles, useTheme } from '@/theme';
import { formatDay } from '@/components/planner/plannerUtils';
import { today } from '@/utils/dates';
import { formatQuantity } from '@/utils/units';

const TRAINING = new Set(['gym', 'running', 'abs', 'home']);

/**
 * Progress → Overview "Forecast" (1.3.0): calories burned by training, plan adherence and
 * missed days, and an estimated date to reach the weight goal, with a weekly line chart
 * (weigh-ins, then a dashed projection to the target). Estimates only, shown as such.
 */
export function ForecastCard() {
  const { t, i18n } = useTranslation('progress');
  const styles = useStyles();
  const theme = useTheme();
  const prefs = useUnitPrefs();
  const day = today();
  const from = addDaysIso(day, -27);
  const trend = useWeightTrend();
  const goals = useGoals('active');
  const done = useCompletedBetween(from, day);
  const sessions = useSessionsForRange(from, addDaysIso(day, 27));

  const goal = (goals.data ?? []).find((g) => g.type === 'weight' && g.targetValue !== null);
  const targetKg = goal?.targetValue ?? null;
  const weightKg = trend.entries.at(-1)?.valueKg ?? null;
  const all = sessions.data ?? [];
  const f = forecast({
    weightKg,
    targetKg,
    measuredPerWeek: trend.rate.insufficient ? null : trend.rate.perWeek,
    done: (done.data ?? []).map((x) => ({
      type: x.type,
      title: x.title,
      minutes: Math.max(1, Math.round((x.activeSeconds ?? 0) / 60)),
      daysAgo: daysBetween(x.startedAt.slice(0, 10), day),
    })),
    pastPlanned: all.filter(
      (s) => s.scheduledDate < day && TRAINING.has(s.type) && s.status !== 'cancelled',
    ).length,
    upcoming: all
      .filter((s) => s.scheduledDate >= day && TRAINING.has(s.type) && s.status === 'planned')
      .map((s) => ({ type: s.type, title: s.title, minutes: s.durationMinutes ?? 45 })),
  });

  const w = (kg: number) => formatQuantity(kg, 'bodyWeight', prefs, i18n.language);
  const kcal = (n: number) => new Intl.NumberFormat(i18n.language).format(n);

  // Chart: last 8 weekly weigh-ins (latest of each week), then the projection.
  const weekly: number[] = [];
  for (let k = 7; k >= 0; k--) {
    const end = Date.parse(addDaysIso(day, -7 * k)) + 86_400_000;
    const inWeek = trend.readings.filter((r) => r.t < end && r.t >= end - 7 * 86_400_000);
    if (inWeek.length) weekly.push(inWeek.at(-1)!.value);
  }
  const projection =
    weightKg !== null && f.perWeek !== null && f.perWeek < 0
      ? projectWeights(weightKg, f.perWeek, targetKg)
      : [];
  const values = [...weekly, ...projection];
  const goalDate = f.weeksToGoal ? addDaysIso(day, f.weeksToGoal * 7) : null;

  return (
    <Card style={styles.card} testID="forecast-card">
      <View style={styles.head}>
        <Icon name="trend_down" size={22} color={theme.colors.primary} />
        <Text variant="heading" style={styles.flex}>
          {t('forecast.title')}
        </Text>
        <Text variant="caption" tone="muted">
          {t('forecast.estimate')}
        </Text>
      </View>

      <View style={styles.stats}>
        <Stat value={kcal(f.burned7)} label={t('forecast.burned7', { count: f.sessions7 })} />
        <Stat
          value={f.adherence === null ? '—' : `${Math.round(f.adherence * 100)} %`}
          label={t('forecast.adherence', { count: f.missed28 })}
        />
        <Stat value={kcal(f.plannedPerWeek)} label={t('forecast.plannedWeek')} />
      </View>

      {values.length >= 2 ? (
        <LineChart
          values={values}
          height={140}
          {...(weekly.length && projection.length ? { dashedFrom: weekly.length } : {})}
          target={targetKg}
          labels={[
            weekly.length
              ? formatDay(addDaysIso(day, -7 * (weekly.length - 1)), {
                  day: 'numeric',
                  month: 'short',
                })
              : '',
            goalDate ? formatDay(goalDate, { day: 'numeric', month: 'short' }) : '',
          ]}
          summary={t('forecast.chartA11y')}
        />
      ) : null}

      {targetKg === null ? (
        <View style={styles.gap}>
          <Text tone="muted">{t('forecast.noGoal')}</Text>
          <Button
            size="sm"
            variant="secondary"
            label={t('forecast.setGoal')}
            onPress={() => router.push(routes.goals)}
          />
        </View>
      ) : weightKg === null ? (
        <Text tone="muted">{t('forecast.noWeight')}</Text>
      ) : f.weeksToGoal === 0 ? (
        <Text variant="bodyStrong">{t('forecast.reached', { target: w(targetKg) })}</Text>
      ) : f.weeksToGoal !== null && goalDate ? (
        <Text variant="bodyStrong">
          {t('forecast.eta', {
            weeks: f.weeksToGoal,
            target: w(targetKg),
            date: formatDay(goalDate, { day: 'numeric', month: 'long' }),
          })}
        </Text>
      ) : (
        <Text tone="muted">{t('forecast.noPace')}</Text>
      )}

      {f.perWeek !== null ? (
        <Text variant="caption" tone="muted">
          {f.basis === 'measured'
            ? t('forecast.basisMeasured', { pace: w(Math.abs(f.perWeek)) })
            : t('forecast.basisTraining', { pace: w(Math.abs(f.perWeek)) })}
        </Text>
      ) : null}
      <Text variant="caption" tone="muted">
        {t('forecast.disclaimer')}
      </Text>
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text variant="heading" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: t.spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  flex: { flex: 1 },
  gap: { gap: t.spacing.sm },
  stats: { flexDirection: 'row', gap: t.spacing.sm },
  stat: {
    flex: 1,
    gap: 2,
    padding: t.spacing.sm,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surfaceRaised,
  },
}));
