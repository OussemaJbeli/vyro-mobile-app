import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Icon, ProgressBar, StatusLabel, Text } from '@/components/ui';
import { makeStyles, useTheme } from '@/theme';
import { type ScheduledSession } from '@/types/domain';

import { sessionSubtitle, statusKind } from './activity';
import { SessionVisual } from './SessionVisual';

type Tpl = { name: string; durationMinutes: number | null; coverKey?: string | null } | undefined;

/** Template Plan "Today" row: time column, activity tile, title + subtitle. */
export function PlanTimedRow({
  session,
  tpl,
  progress = null,
  past = false,
  onPress,
}: {
  session: ScheduledSession;
  tpl: Tpl;
  /** 0…1 of the planned work done (null = not counted, e.g. rest). */
  progress?: number | null;
  /** The day is over or today: an untouched session reads "Not done". */
  past?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation('plan');
  const styles = useStyles();
  const theme = useTheme();
  const partial = progress !== null && progress > 0 && progress < 1;
  const done = session.status === 'completed' || session.status === 'modified';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.box, pressed && styles.pressed]}
      testID={`plan-row-${session.id}`}
    >
      <View style={styles.time}>
        <Text variant="bodyStrong">{session.startTime ?? t('anyTime', { defaultValue: '—' })}</Text>
        {session.endTime ? (
          <Text variant="caption" tone="muted">
            {session.endTime}
          </Text>
        ) : null}
      </View>
      <SessionVisual type={session.type} coverKey={tpl?.coverKey} size={44} done={done} />
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {session.type === 'rest' ? t('restDay') : session.title}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {sessionSubtitle(session, tpl)}
        </Text>
        {partial ? <ProgressBar value={progress} height={4} /> : null}
      </View>
      {partial ? (
        <Text variant="bodyStrong" style={{ color: theme.colors.warning }}>
          {t('progressPct', { pct: Math.round(progress * 100) })}
        </Text>
      ) : session.status !== 'planned' ? (
        <StatusLabel status={statusKind(session.status, false)} />
      ) : past && session.type !== 'rest' ? (
        <Text variant="caption" tone="muted">
          {t('notDone')}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Template Plan "Upcoming" row: date column, round icon, title + subtitle, chevron. */
export function PlanUpcomingRow({
  session,
  tpl,
  date,
  onPress,
}: {
  session: ScheduledSession;
  tpl: Tpl;
  date: string;
  onPress: () => void;
}) {
  const { t } = useTranslation('plan');
  const styles = useStyles();
  const theme = useTheme();
  const rest = session.type === 'rest';
  const subtitle = rest ? '' : sessionSubtitle(session, tpl);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.box, pressed && styles.pressed]}
      testID={`plan-upcoming-${session.id}`}
    >
      <Text variant="caption" tone="muted" style={styles.date} numberOfLines={1}>
        {date}
      </Text>
      {rest ? (
        <View style={styles.restRing} />
      ) : (
        <SessionVisual type={session.type} coverKey={tpl?.coverKey} size={40} />
      )}
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {rest ? t('restDay') : session.title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Icon name="forward" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 60,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceRaised,
  },
  pressed: { opacity: 0.85 },
  time: { width: 48 },
  date: { width: 72 },
  flex: { flex: 1 },
  restRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: t.colors.primaryInk,
    marginHorizontal: 6,
  },
}));
