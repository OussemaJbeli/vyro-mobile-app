import { router } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATEGORY_ICON, ExerciseRow } from '@/components/workout/ExerciseRow';
import {
  Button,
  ChipGroup,
  EmptyState,
  Header,
  Input,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { matchesQuery, useExerciseCatalog, type CatalogExercise } from '@/hooks/useExerciseCatalog';
import { makeStyles } from '@/theme';
import { EXERCISE_CATEGORIES } from '@/types/enums';

type Scope = 'all' | 'available' | 'custom';
type Category = (typeof EXERCISE_CATEGORIES)[number] | 'any';

/** Exercise library (step 13): local search, category/availability filters, grouped list. */
export default function ExerciseLibraryScreen() {
  const { t } = useTranslation('exercises');
  const styles = useStyles();
  const catalog = useExerciseCatalog();
  const [query, setQuery] = useState('');
  // Deferred value keeps typing smooth; the list re-filters just after the keystroke.
  const deferredQuery = useDeferredValue(query);
  const [scope, setScope] = useState<Scope>('all');
  const [category, setCategory] = useState<Category>('any');

  const sections = useMemo(() => {
    const visible = catalog.items.filter(
      (x) =>
        !x.archivedAt &&
        (scope !== 'available' || x.available) &&
        (scope !== 'custom' || x.isCustom) &&
        (category === 'any' || x.category === category) &&
        matchesQuery(x, deferredQuery),
    );
    return EXERCISE_CATEGORIES.map((c) => ({
      key: c,
      title: t(`categories.${c}`),
      data: visible.filter((x) => x.category === c).sort((a, b) => a.label.localeCompare(b.label)),
    })).filter((s) => s.data.length > 0);
  }, [catalog.items, scope, category, deferredQuery, t]);

  const total = sections.reduce((n, s) => n + s.data.length, 0);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Header title={t('title')} onBack={() => goBack(routes.train)} />
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t('search')}
          accessibilityLabel={t('search')}
          leftIcon="search"
          autoCorrect={false}
          testID="exercise-search"
        />
        <ChipGroup<Scope>
          options={(['all', 'available', 'custom'] as const).map((v) => ({
            value: v,
            label: t(`filters.${v}`),
          }))}
          value={scope}
          onChange={setScope}
        />
        <ChipGroup<Category>
          scrollable
          options={[
            { value: 'any', label: t('filters.all') },
            ...EXERCISE_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) })),
          ]}
          value={category}
          onChange={setCategory}
        />
        <Text variant="caption" tone="muted">
          {t('count', { count: total })}
        </Text>
      </View>
      {catalog.isLoading ? (
        <View style={styles.pad}>
          <Skeleton preset="row" />
          <Skeleton preset="row" />
        </View>
      ) : (
        <SectionList<CatalogExercise>
          sections={sections}
          keyExtractor={(x) => x.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
          renderItem={({ item }) => (
            <ExerciseRow item={item} onPress={() => router.push(routes.exercise(item.id))} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={scope === 'custom' ? CATEGORY_ICON.full_body : 'search'}
              title={scope === 'custom' ? t('empty.customTitle') : t('empty.title')}
              body={scope === 'custom' ? t('empty.customBody') : t('empty.body')}
              actionLabel={t('empty.action')}
              onAction={() => router.push('/exercise/new')}
            />
          }
        />
      )}
      <View style={styles.footer}>
        <Button
          label={t('actions.new')}
          icon="add"
          fullWidth
          onPress={() => router.push('/exercise/new')}
          testID="exercise-new"
        />
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.bg },
  top: { paddingHorizontal: t.spacing.lg, gap: t.spacing.md },
  pad: { padding: t.spacing.lg, gap: t.spacing.md },
  list: { paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.xl },
  footer: { padding: t.spacing.lg, paddingTop: t.spacing.sm },
}));
