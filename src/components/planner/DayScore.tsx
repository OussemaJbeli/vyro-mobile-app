import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, ProgressBar, Text, type IconName } from '@/components/ui';
import { type PeriodSummary, type Rating } from '@/domain/planner/progress';
import { makeStyles, useTheme } from '@/theme';
import { withAlpha } from '@/theme/color';

const RATING_ICON: Record<Rating, IconName> = {
  excellent: 'trophy',
  good: 'status-done',
  bad: 'trend_down',
};

/** Rating colours: excellent = accent, good = amber, bad = red. */
export function useRatingColor() {
  const t = useTheme();
  return (r: Rating) =>
    r === 'excellent' ? t.colors.primary : r === 'good' ? t.colors.warning : t.colors.danger;
}

/** "Excellent · 92 %" pill. */
export function RatingChip({ rating, progress }: { rating: Rating; progress: number }) {
  const { t } = useTranslation('plan');
  const styles = useStyles();
  const color = useRatingColor()(rating);
  return (
    <View
      style={[
        styles.chip,
        { borderColor: withAlpha(color, 0.6), backgroundColor: withAlpha(color, 0.1) },
      ]}
    >
      <Icon name={RATING_ICON[rating]} size={16} color={color} />
      <Text variant="bodyStrong" style={{ color }}>
        {t(`rating.${rating}`)} · {Math.round(progress * 100)} %
      </Text>
    </View>
  );
}

/** Score under the selected day: rating chip + bar, or "planned" for future days. */
export function DayScore({
  progress,
  future,
  count,
}: {
  progress: number | null;
  future: boolean;
  count: number;
}) {
  const { t } = useTranslation('plan');
  const styles = useStyles();
  if (progress === null) return null;
  if (future) {
    return (
      <Text variant="caption" tone="muted">
        {t('score.planned', { count })}
      </Text>
    );
  }
  const r = progress >= 0.85 ? 'excellent' : progress >= 0.5 ? 'good' : 'bad';
  return (
    <View style={styles.day} testID="plan-day-score">
      <RatingChip rating={r} progress={progress} />
      <ProgressBar value={progress} />
    </View>
  );
}

/** Month status: overall rating, days per rating, sessions done. */
export function PeriodSummaryCard({ title, summary }: { title: string; summary: PeriodSummary }) {
  const { t } = useTranslation('plan');
  const styles = useStyles();
  const color = useRatingColor();
  return (
    <View style={styles.summary} testID="plan-month-summary">
      <View style={styles.summaryHead}>
        <Text variant="heading" style={styles.flex}>
          {title}
        </Text>
        {summary.rating && summary.progress !== null ? (
          <RatingChip rating={summary.rating} progress={summary.progress} />
        ) : (
          <Text tone="muted">{t('score.none')}</Text>
        )}
      </View>
      {summary.progress !== null ? <ProgressBar value={summary.progress} /> : null}
      <View style={styles.stats}>
        {(['excellent', 'good', 'bad'] as const).map((r) => (
          <View key={r} style={styles.stat}>
            <View style={[styles.dot, { backgroundColor: color(r) }]} />
            <Text variant="heading">{summary.days[r]}</Text>
            <Text variant="caption" tone="muted">
              {t(`rating.${r}`)}
            </Text>
          </View>
        ))}
        <View style={styles.stat}>
          <Icon name="rest" size={14} />
          <Text variant="heading">{summary.restDays}</Text>
          <Text variant="caption" tone="muted">
            {t('score.rest')}
          </Text>
        </View>
      </View>
      <Text variant="caption" tone="muted">
        {t('score.sessions', { done: summary.sessionsDone, total: summary.sessionsTotal })}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: t.spacing.md,
    paddingVertical: 6,
    borderRadius: t.radius.pill,
    borderWidth: 1,
  },
  day: { gap: t.spacing.sm },
  summary: { gap: t.spacing.md },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', gap: 2, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
}));
