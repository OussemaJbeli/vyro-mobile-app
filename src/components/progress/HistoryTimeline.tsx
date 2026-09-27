import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  IconTile,
  Input,
  ListRow,
  Skeleton,
  Text,
  useActivityIcon,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import { addDaysIso } from '@/domain/scheduling/recurrence';
import {
  invalidates,
  useAllPhotos,
  useFinishedBetween,
  useMeasurementsBetween,
  useRepoMutation,
  useSessionsForRange,
  useUnitPrefs,
  useWeights,
} from '@/hooks/data';
import { makeStyles } from '@/theme';
import { type IconName } from '@/components/ui/Icon';
import { formatDuration, toDate, toLocalDate, today, asLocalDate } from '@/utils/dates';
import { formatQuantity } from '@/utils/units';

type Filter = 'all' | 'gym' | 'running' | 'abs' | 'home' | 'rest' | 'body' | 'photos';
const FILTERS: Filter[] = ['all', 'gym', 'running', 'abs', 'home', 'rest', 'body', 'photos'];
const WINDOW = 30;

type Item = {
  key: string;
  kind: 'workout' | 'rest' | 'missed' | 'body' | 'photos';
  type: string;
  at: string;
  /** Local date the item belongs to (AD-05). */
  day: string;
  title: string;
  subtitle: string;
  icon: IconName;
  executionId?: string;
  sessionId?: string;
};

/** Unified history (step 24, FS §31): workouts, rest days, missed sessions, body, photos. */
export function HistoryTimeline() {
  const iconFor = useActivityIcon();
  const { t, i18n } = useTranslation(['progress', 'status', 'execution']);
  const styles = useStyles();
  const prefs = useUnitPrefs();
  const day = today();
  const [days, setDays] = useState(WINDOW);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const from = addDaysIso(day, -days);
  const finished = useFinishedBetween(from, day);
  const sessions = useSessionsForRange(from, addDaysIso(day, -1));
  const weights = useWeights({ from: toDate(asLocalDate(from)).toISOString() });
  const measures = useMeasurementsBetween(from, day);
  const photos = useAllPhotos();
  const skip = useRepoMutation((r, id: string) => r.schedule.skip(id, null), {
    invalidate: invalidates.schedule,
  });

  const items: Item[] = [];
  for (const x of finished.data ?? []) {
    const parts = [
      t(`progress:types.${x.type === 'home' ? 'abs' : x.type}` as 'progress:types.gym', {
        defaultValue: x.type,
      }),
    ];
    if (x.activeSeconds) parts.push(formatDuration(x.activeSeconds));
    if (x.distanceKm) parts.push(formatQuantity(x.distanceKm, 'distance', prefs, i18n.language));
    if (x.status === 'abandoned') parts.push(t('history.abandoned'));
    else if (x.outcome && x.outcome !== 'as_planned')
      parts.push(t(`execution:complete.outcome.${x.outcome}`));
    items.push({
      key: x.id,
      kind: 'workout',
      type: x.type,
      at: x.startedAt,
      day: toLocalDate(x.startedAt),
      title: x.title,
      subtitle: parts.join(' · '),
      icon: iconFor(x.type),
      executionId: x.id,
    });
  }
  for (const s of sessions.data ?? []) {
    const at = `${s.scheduledDate}T${s.startTime ?? '12:00'}:00`;
    if (s.type === 'rest' && s.status !== 'cancelled') {
      items.push({
        key: s.id,
        kind: 'rest',
        type: 'rest',
        at,
        day: s.scheduledDate,
        title: t('history.rest'),
        subtitle: '',
        icon: 'rest',
      });
    } else if (s.type !== 'rest' && (s.status === 'planned' || s.status === 'skipped')) {
      items.push({
        key: s.id,
        kind: 'missed',
        type: s.type,
        at,
        day: s.scheduledDate,
        title: s.title,
        subtitle: s.status === 'skipped' ? t('history.skipped') : t('history.missed'),
        icon: 'status-missed',
        sessionId: s.id,
      });
    }
  }
  for (const w of weights.data ?? []) {
    items.push({
      key: w.id,
      kind: 'body',
      type: 'body',
      at: w.recordedAt,
      day: toLocalDate(w.recordedAt),
      title: t('history.weight', {
        value: formatQuantity(w.valueKg, 'bodyWeight', prefs, i18n.language),
      }),
      subtitle: w.notes ?? '',
      icon: 'weight',
    });
  }
  const sessionsByTime = new Map<string, number>();
  for (const m of measures.data ?? [])
    sessionsByTime.set(m.recordedAt, (sessionsByTime.get(m.recordedAt) ?? 0) + 1);
  for (const [at, n] of sessionsByTime) {
    items.push({
      key: `m-${at}`,
      kind: 'body',
      type: 'body',
      at,
      day: toLocalDate(at),
      title: t('history.measurements', { count: n }),
      subtitle: '',
      icon: 'measure',
    });
  }
  const photosByDay = new Map<string, number>();
  for (const p of photos.data ?? []) {
    const d = toLocalDate(p.capturedAt);
    if (d >= from) photosByDay.set(d, (photosByDay.get(d) ?? 0) + 1);
  }
  for (const [d, n] of photosByDay) {
    items.push({
      key: `p-${d}`,
      kind: 'photos',
      type: 'photos',
      at: `${d}T12:00:00`,
      day: d,
      title: t('history.photos', { count: n }),
      subtitle: '',
      icon: 'photo',
    });
  }

  const q = query.trim().toLowerCase();
  const visible = items
    .filter((i) => {
      if (filter === 'all') return true;
      if (filter === 'body' || filter === 'photos' || filter === 'rest') return i.kind === filter;
      return (i.kind === 'workout' || i.kind === 'missed') && i.type === filter;
    })
    .filter((i) => !q || `${i.title} ${i.subtitle}`.toLowerCase().includes(q))
    .sort((a, b) => b.day.localeCompare(a.day) || b.at.localeCompare(a.at));
  const groups: { day: string; items: Item[] }[] = [];
  for (const i of visible) {
    const d = i.day;
    const g = groups.at(-1);
    if (g && g.day === d) g.items.push(i);
    else groups.push({ day: d, items: [i] });
  }

  if (finished.isLoading && sessions.isLoading) return <Skeleton preset="card" />;

  return (
    <View style={styles.gap}>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={t('history.search')}
        leftIcon="search"
        testID="history-search"
      />
      <View style={styles.chips}>
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={t(`history.filters.${f}`)}
            selected={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>
      <FlatList
        data={groups}
        scrollEnabled={false}
        keyExtractor={(g) => g.day}
        ListEmptyComponent={<EmptyState icon="clock" title={t('history.empty')} />}
        renderItem={({ item: g }) => (
          <View style={styles.day}>
            <Text variant="overline" tone="muted">
              {toDate(asLocalDate(g.day)).toLocaleDateString(i18n.language, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </Text>
            <Card>
              {g.items.map((i) => (
                <View key={i.key}>
                  <ListRow
                    title={i.title}
                    {...(i.subtitle ? { subtitle: i.subtitle } : {})}
                    leading={<IconTile icon={i.icon} size={36} />}
                    {...(i.executionId
                      ? { onPress: () => router.push(routes.historyDetail(i.executionId!)) }
                      : {})}
                    showChevron={!!i.executionId}
                    testID={`history-${i.key}`}
                  />
                  {i.kind === 'missed' && i.subtitle === t('history.missed') ? (
                    <View style={styles.actions}>
                      <Button
                        size="sm"
                        variant="secondary"
                        label={t('history.logIt')}
                        onPress={() => router.push(routes.logSession(i.sessionId!))}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        label={t('history.skip')}
                        onPress={() => skip.mutate(i.sessionId!)}
                      />
                    </View>
                  ) : null}
                </View>
              ))}
            </Card>
          </View>
        )}
      />
      <Button
        size="md"
        variant="ghost"
        label={t('history.loadMore')}
        onPress={() => setDays((d) => d + WINDOW)}
        testID="history-more"
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  gap: { gap: t.spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs },
  day: { gap: t.spacing.xs, marginBottom: t.spacing.sm },
  actions: {
    flexDirection: 'row',
    gap: t.spacing.sm,
    paddingLeft: 52,
    paddingBottom: t.spacing.xs,
  },
}));
