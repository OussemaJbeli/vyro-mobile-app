import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { activityType } from '@/components/planner/activity';
import { formatDay } from '@/components/planner/plannerUtils';
import { useSessionActions } from '@/components/planner/useSessionActions';
import {
  ActivityIcon,
  Button,
  Card,
  EmptyState,
  Header,
  ListRow,
  ScreenContainer,
  Skeleton,
  StatusTag,
  Text,
} from '@/components/ui';
import { useTemplateLabel } from '@/components/workout/templateInfo';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { displayStatus } from '@/domain/scheduling/conflicts';
import { useSession } from '@/hooks/data';
import { makeStyles } from '@/theme';
import { today as todayFn } from '@/utils/dates';

/** Scheduled session detail (step 16): plan, reschedule history, linked workout, actions. */
export default function SessionDetailScreen() {
  const { id, action } = useLocalSearchParams<{ id: string; action?: string }>();
  const { t } = useTranslation(['plan', 'train']);
  const styles = useStyles();
  const session = useSession(id);
  const label = useTemplateLabel();
  const actions = useSessionActions();
  const today = todayFn();
  const s = session.data;
  // Missed-session follow-up notification → open the reschedule/skip sheet once (step 25).
  const [autoOpened, setAutoOpened] = useState(false);
  if (!autoOpened && action === 'reschedule' && s) {
    setAutoOpened(true);
    actions.open(s);
  }

  if (session.isLoading) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <Skeleton preset="card" />
      </ScreenContainer>
    );
  }
  if (!s) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <Header title={t('detail.title')} onBack={() => goBack(routes.plan)} large={false} />
        <EmptyState title={t('nothing')} />
      </ScreenContainer>
    );
  }

  const status = displayStatus(s, today);
  const title =
    s.type === 'rest'
      ? t('restDay')
      : s.templateId
        ? label({ id: s.templateId, name: s.title })
        : s.title;
  const when =
    formatDay(s.scheduledDate, { weekday: 'long', day: 'numeric', month: 'long' }) +
    (s.startTime ? ` · ${s.startTime}` : '');
  const moved = s.originalDate !== s.scheduledDate || s.originalStartTime !== s.startTime;

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('detail.title')} onBack={() => goBack(routes.plan)} large={false} />
      <Card variant="accent" style={styles.hero}>
        <ActivityIcon type={activityType(s.type)} size={56} />
        <View style={styles.flex}>
          <Text variant="title">{title}</Text>
          <Text tone="muted">{when}</Text>
          {s.durationMinutes ? (
            <Text variant="caption" tone="muted">
              {t('train:minutes', { count: s.durationMinutes })}
            </Text>
          ) : null}
        </View>
      </Card>
      {status !== 'rest' ? <StatusTag status={status} /> : null}

      <Card style={styles.card}>
        <Text variant="caption" tone="muted">
          {t('detail.planned')}
        </Text>
        {moved ? (
          <Text>
            {t('detail.originally', {
              date:
                formatDay(s.originalDate, { weekday: 'short', day: 'numeric', month: 'short' }) +
                (s.originalStartTime ? ` · ${s.originalStartTime}` : ''),
            })}
          </Text>
        ) : (
          <Text>{when}</Text>
        )}
        {s.rescheduleCount > 0 ? (
          <Text tone="muted">{t('detail.moved', { count: s.rescheduleCount })}</Text>
        ) : null}
        {s.ruleId ? (
          <Text variant="caption" tone="muted">
            {t('detail.repeating')}
          </Text>
        ) : null}
        {s.skipReason ? (
          <Text variant="caption" tone="muted">
            {t('detail.skipReason', { reason: s.skipReason })}
          </Text>
        ) : null}
      </Card>

      {s.templateId && s.type !== 'rest' ? (
        <Card>
          <ListRow
            title={t('detail.openWorkout')}
            subtitle={title}
            onPress={() =>
              router.push(
                s.type === 'running'
                  ? routes.running(s.templateId!)
                  : routes.workout(s.templateId!),
              )
            }
          />
        </Card>
      ) : null}
      {s.notes ? (
        <Card style={styles.card}>
          <Text variant="caption" tone="muted">
            {t('detail.notes')}
          </Text>
          <Text>{s.notes}</Text>
        </Card>
      ) : null}
      {status === 'completed' || status === 'modified' ? (
        <Text variant="caption" tone="muted">
          {t('detail.historySoon')}
        </Text>
      ) : null}

      <Button
        label={t('actions.title')}
        icon="more"
        variant="secondary"
        fullWidth
        onPress={() => actions.open(s)}
        testID="session-actions"
      />
      {actions.element}
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  hero: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.lg },
  flex: { flex: 1, gap: t.spacing.xs },
  card: { gap: t.spacing.xs },
}));
