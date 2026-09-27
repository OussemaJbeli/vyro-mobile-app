import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ActivityIcon, ListRow, StatusTag, Text } from '@/components/ui';
import { useTemplateLabel } from '@/components/workout/templateInfo';
import { displayStatus } from '@/domain/scheduling/conflicts';
import { makeStyles } from '@/theme';
import { type ScheduledSession } from '@/types/domain';

import { activityType } from './activity';

/** Planner row: time · icon · title · type/duration · status (never colour alone). */
export function SessionRow({
  session,
  today,
  onPress,
  showDate,
}: {
  session: ScheduledSession;
  today: string;
  onPress?: () => void;
  showDate?: string;
}) {
  const { t } = useTranslation(['plan', 'train']);
  const styles = useStyles();
  const label = useTemplateLabel();
  const status = displayStatus(session, today);
  const title =
    session.type === 'rest'
      ? t('restDay')
      : session.templateId
        ? label({ id: session.templateId, name: session.title })
        : session.title;
  const subtitle = [
    t(`types.${session.type}`),
    session.durationMinutes ? t('train:minutes', { count: session.durationMinutes }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <ListRow
      title={title}
      subtitle={session.type === 'rest' ? (showDate ?? '') || subtitle : subtitle}
      leading={
        <View style={styles.leading}>
          <Text variant="caption" tone="muted" style={styles.time}>
            {showDate ?? session.startTime ?? ''}
          </Text>
          <ActivityIcon
            type={activityType(session.type)}
            size={40}
            state={status === 'planned' || status === 'in_progress' ? 'default' : 'muted'}
          />
        </View>
      }
      trailing={
        status === 'rest' ? undefined : (
          <StatusTag
            status={status}
            {...(status === 'planned' ? { appearance: 'outline' as const } : {})}
          />
        )
      }
      {...(onPress ? { onPress } : {})}
      testID={`session-${session.id}`}
    />
  );
}

const useStyles = makeStyles((t) => ({
  leading: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  time: { width: 44, fontVariant: ['tabular-nums'] },
}));
