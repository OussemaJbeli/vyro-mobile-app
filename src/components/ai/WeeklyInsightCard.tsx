import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { sessionProgress } from '@/domain/planner/progress';
import { addDaysIso, weekStart } from '@/domain/scheduling/recurrence';
import { useSessionWork, useSessionsForRange } from '@/hooks/data';
import { useLatestWeekInsight } from '@/hooks/useCoach';
import { useSetting } from '@/store/settingsStore';
import { makeStyles, useTheme } from '@/theme';
import { today } from '@/utils/dates';

import { CoachEntry } from './CoachEntry';

/**
 * Home weekly insight (FS §81): only with AI on. Shows this week's saved insight, or a
 * "Generate this week's insight" button — never an automatic call.
 */
export function WeeklyInsightCard() {
  const { t } = useTranslation('settings');
  const styles = useStyles();
  const theme = useTheme();
  const enabled = useSetting('ai.enabled');
  const latest = useLatestWeekInsight();
  const week = weekStart(today(), 1);
  const sessions = useSessionsForRange(week, addDaysIso(week, 6));
  const work = useSessionWork(week, addDaysIso(week, 6));
  if (!enabled) return null;
  // Local counts line (FS §81): "6 / 8 sessions · Gym 3/3 · Running 1/2 · Abs 2/3".
  const counted = (sessions.data ?? []).filter(
    (s) => s.type !== 'rest' && s.status !== 'cancelled',
  );
  const isDone = (s: (typeof counted)[number]) => (sessionProgress(s, work.data?.[s.id]) ?? 0) >= 1;
  const types = [...new Set(counted.map((s) => s.type))];
  const line = [
    t('ai.coach.sessions', { done: counted.filter(isDone).length, total: counted.length }),
    ...types.map((ty) => {
      const list = counted.filter((s) => s.type === ty);
      return `${t(`ai.coach.types.${ty}`, { defaultValue: ty })} ${list.filter(isDone).length}/${list.length}`;
    }),
  ].join(' · ');
  const insight = latest.data && latest.data.period?.start === week ? latest.data : null;
  return (
    <Card style={styles.card} testID="home-weekly-insight">
      <View style={styles.row}>
        <Icon name="ai" size={18} color={theme.colors.primaryInk} />
        <Text variant="overline" tone="muted" style={styles.flex}>
          {t('ai.coach.weekly')}
        </Text>
      </View>
      <Text variant="bodyStrong">{line}</Text>
      {insight ? (
        <>
          <Text variant="bodyStrong">{insight.insight.title}</Text>
          <Text tone="muted" numberOfLines={3}>
            {insight.insight.summary}
          </Text>
          <Button
            size="sm"
            variant="ghost"
            label={t('ai.coach.seeSuggestions')}
            onPress={() =>
              router.push({ pathname: '/coach', params: { reportId: insight.insightId } })
            }
          />
        </>
      ) : (
        <CoachEntry
          method="summarizeWeek"
          label={t('ai.coach.generate')}
          testID="home-generate-insight"
        />
      )}
      <CoachEntry label={t('ai.coach.askCoach')} variant="row" testID="home-ask-coach" />
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: t.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  flex: { flex: 1 },
}));
