import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BottomSheet, Input, ListRow, SectionHeader, Text } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useHistory, useTemplates } from '@/hooks/data';
import { matchesQuery, useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { makeStyles } from '@/theme';

/** Global search (FS §73): exercises, workouts and history, all local. */
export function SearchSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation('home');
  const styles = useStyles();
  const [q, setQ] = useState('');
  const catalog = useExerciseCatalog();
  const templates = useTemplates();
  const history = useHistory();
  const query = q.trim().toLowerCase();
  const has = (s: string) => s.toLowerCase().includes(query);
  const exercises = query
    ? catalog.items.filter((x) => !x.archivedAt && matchesQuery(x, q)).slice(0, 5)
    : [];
  const workouts = query ? (templates.data ?? []).filter((x) => has(x.name)).slice(0, 5) : [];
  const past = query
    ? (history.data?.pages.flatMap((p) => p.items) ?? []).filter((x) => has(x.title)).slice(0, 5)
    : [];
  const go = (href: Parameters<typeof router.push>[0]) => {
    onClose();
    setQ('');
    router.push(href);
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('search.title')}>
      <View style={styles.gap}>
        <Input
          value={q}
          onChangeText={setQ}
          placeholder={t('search.placeholder')}
          leftIcon="search"
          autoFocus
          testID="search-input"
        />
        {exercises.length ? <SectionHeader title={t('search.exercises')} /> : null}
        {exercises.map((x) => (
          <ListRow
            key={x.id}
            title={x.label}
            subtitle={x.equipmentLabel}
            onPress={() => go(routes.exercise(x.id))}
          />
        ))}
        {workouts.length ? <SectionHeader title={t('search.workouts')} /> : null}
        {workouts.map((x) => (
          <ListRow
            key={x.id}
            title={x.name}
            onPress={() => go(x.type === 'running' ? routes.running(x.id) : routes.workout(x.id))}
          />
        ))}
        {past.length ? <SectionHeader title={t('search.history')} /> : null}
        {past.map((x) => (
          <ListRow
            key={x.id}
            title={x.title}
            subtitle={x.startedAt.slice(0, 10)}
            onPress={() => go(routes.historyDetail(x.id))}
          />
        ))}
        {query && !exercises.length && !workouts.length && !past.length ? (
          <Text tone="muted">{t('search.none')}</Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles((t) => ({ gap: { gap: t.spacing.sm } }));
