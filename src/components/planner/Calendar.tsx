import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Icon, IconButton, Text } from '@/components/ui';
import { makeStyles, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

import { type Rating } from '@/domain/planner/progress';

import { formatDay, type DayMarkers } from './plannerUtils';
import { useRatingColor } from './DayScore';

type DayProps = {
  date: string;
  selected: boolean;
  today: boolean;
  dimmed?: boolean;
  markers: DayMarkers | undefined;
  /** Past/today score: coloured ring under the number (excellent / good / bad). */
  score?: Rating | undefined;
  onPress: () => void;
  compact?: boolean;
};

function MarkerIcons({ m, color }: { m: DayMarkers | undefined; color: string }) {
  const theme = useTheme();
  if (!m) return <View style={{ height: 12 }} />;
  // Priority: missed > done > planned > rest. One icon keeps cells clean.
  const icon = m.missed
    ? 'status-missed'
    : m.done && !m.planned
      ? 'status-done'
      : m.planned
        ? null
        : m.rest
          ? 'rest'
          : null;
  if (!icon && m.planned)
    return (
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: color,
          marginTop: 3,
          marginBottom: 3,
        }}
      />
    );
  if (!icon) return <View style={{ height: 12 }} />;
  return <Icon name={icon} size={12} color={m.missed ? theme.colors.danger : color} />;
}

function Day({ date, selected, today, dimmed, markers, score, onPress, compact }: DayProps) {
  const scoreColor = useRatingColor();
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('plan');
  const parts = [
    formatDay(date, { weekday: 'long', day: 'numeric', month: 'long' }),
    markers?.planned ? t('markers.planned', { count: markers.planned }) : '',
    markers?.done ? t('markers.done') : '',
    markers?.rest ? t('markers.rest') : '',
    markers?.missed ? t('markers.missed') : '',
    score ? t(`rating.${score}`) : '',
  ].filter(Boolean);
  const fg = selected
    ? theme.colors.onPrimary
    : dimmed
      ? theme.colors.textMuted
      : theme.colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={parts.join(', ')}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={styles.dayCell}
      testID={`day-${date}`}
    >
      <View
        style={[
          styles.dayCircle,
          compact && styles.dayCircleCompact,
          selected && { backgroundColor: theme.colors.primary },
          today && !selected && { borderColor: theme.colors.primaryInk, borderWidth: 1.5 },
          score && !selected && !today && { borderColor: scoreColor(score), borderWidth: 2 },
        ]}
      >
        <Text variant={compact ? 'caption' : 'bodyStrong'} style={{ color: fg }}>
          {Number(date.slice(8, 10))}
        </Text>
      </View>
      {score ? (
        <View style={[styles.scoreDot, { backgroundColor: scoreColor(score) }]} />
      ) : (
        <MarkerIcons m={markers} color={theme.colors.primaryInk} />
      )}
    </Pressable>
  );
}

export function WeekdayHeader({ days }: { days: string[] }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      {days.map((d) => (
        <Text key={d} variant="caption" tone="muted" align="center" style={styles.flex}>
          {formatDay(d, { weekday: 'short' })}
        </Text>
      ))}
    </View>
  );
}

export type CalendarProps = {
  today: string;
  selected: string;
  markers: Map<string, DayMarkers>;
  scores?: Map<string, Rating>;
  onSelect: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
  title: string;
};

/** Week strip (template Plan screen): selected day filled, today outlined, icon markers. */
export function WeekStrip({
  days,
  hideNav = false,
  ...p
}: CalendarProps & { days: string[]; hideNav?: boolean }) {
  const styles = useStyles();
  const { t } = useTranslation('plan');
  return (
    <View style={styles.block}>
      {hideNav ? null : (
        <View style={styles.nav}>
          <IconButton
            icon="back"
            variant="plain"
            size={36}
            accessibilityLabel={t('prev')}
            onPress={p.onPrev}
            testID="week-prev"
          />
          <Text variant="bodyStrong" style={styles.flexCenter}>
            {p.title}
          </Text>
          <IconButton
            icon="forward"
            variant="plain"
            size={36}
            accessibilityLabel={t('next')}
            onPress={p.onNext}
            testID="week-next"
          />
        </View>
      )}
      <WeekdayHeader days={days} />
      <View style={styles.row}>
        {days.map((d) => (
          <Day
            key={d}
            date={d}
            selected={d === p.selected}
            today={d === p.today}
            markers={p.markers.get(d)}
            score={p.scores?.get(d)}
            onPress={() => p.onSelect(d)}
          />
        ))}
      </View>
    </View>
  );
}

/** Month grid; days outside the month are dimmed. */
export function MonthGrid({
  weeks,
  month,
  ...p
}: CalendarProps & { weeks: string[][]; month: string }) {
  const styles = useStyles();
  const { t } = useTranslation('plan');
  return (
    <View style={styles.block}>
      <View style={styles.nav}>
        <IconButton
          icon="back"
          variant="plain"
          size={36}
          accessibilityLabel={t('prev')}
          onPress={p.onPrev}
          testID="month-prev"
        />
        <Text variant="bodyStrong" style={styles.flexCenter}>
          {p.title}
        </Text>
        <IconButton
          icon="forward"
          variant="plain"
          size={36}
          accessibilityLabel={t('next')}
          onPress={p.onNext}
          testID="month-next"
        />
      </View>
      <WeekdayHeader days={weeks[0] ?? []} />
      {weeks.map((w) => (
        <View key={w[0]} style={styles.row}>
          {w.map((d) => (
            <Day
              key={d}
              date={d}
              compact
              selected={d === p.selected}
              today={d === p.today}
              dimmed={d.slice(0, 7) !== month}
              markers={p.markers.get(d)}
              score={p.scores?.get(d)}
              onPress={() => p.onSelect(d)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  block: { gap: t.spacing.sm },
  nav: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
  flexCenter: { flex: 1, textAlign: 'center' },
  dayCell: { flex: 1, alignItems: 'center', gap: 2, minHeight: t.touch.min },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleCompact: { width: 32, height: 32, borderRadius: 16 },
  selectedBg: { backgroundColor: t.colors.primarySoft },
  scoreDot: { width: 6, height: 6, borderRadius: 3, marginTop: 3, marginBottom: 3 },
}));
