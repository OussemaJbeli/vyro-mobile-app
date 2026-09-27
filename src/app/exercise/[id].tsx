import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ExerciseHero } from '@/components/exercises/ExerciseHero';
import { ExerciseMediaSection } from '@/components/exercises/ExerciseMediaSection';
import { ExerciseStats } from '@/components/progress/ExerciseStats';
import { ExerciseRow } from '@/components/workout/ExerciseRow';
import {
  Button,
  Card,
  Chip,
  ConfirmDialog,
  Divider,
  EmptyState,
  Header,
  Icon,
  ScreenContainer,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { EquipmentVisual } from '@/components/equipment/EquipmentVisual';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { suggestAlternatives } from '@/domain/workouts/alternatives';
import { invalidates, useRepoMutation } from '@/hooks/data';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { makeStyles, useTheme } from '@/theme';
import { displayName } from '@/utils/seedNames';

/** Exercise detail (step 13): muscles, equipment, instructions, defaults, alternatives. */
export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation(['exercises', 'common']);
  const theme = useTheme();
  const styles = useStyles();
  const catalog = useExerciseCatalog();
  const item = catalog.byId.get(id);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const archive = useRepoMutation(
    (r, v: { id: string; archived: boolean }) =>
      v.archived ? r.exercises.archive(v.id) : r.exercises.unarchive(v.id),
    { invalidate: invalidates.exercises },
  );
  const duplicate = useRepoMutation(
    (r, v: { id: string; name: string }) => r.exercises.duplicate(v.id, v.name),
    {
      invalidate: invalidates.exercises,
      onSuccess: (copy) => router.replace({ pathname: '/exercise/new', params: { id: copy.id } }),
    },
  );

  if (catalog.isLoading) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <Skeleton preset="card" />
      </ScreenContainer>
    );
  }
  if (!item) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <Header title={t('title')} onBack={() => goBack(routes.exercises)} large={false} />
        <EmptyState title={t('empty.title')} />
      </ScreenContainer>
    );
  }

  const suggestions = suggestAlternatives(item, catalog.engine, 5);
  const mappedIds = new Set(item.alternatives.map((a) => a.alternativeId));
  const eqName = (e: { name: string; slug: string | null }) =>
    displayName('equipment', e, (k, o) =>
      t(k as 'exercises:title', { defaultValue: o?.defaultValue ?? k }),
    );
  const muscle = (m: string) => t(`muscles.${m}` as 'muscles.chest', { defaultValue: m });
  const steps = (item.instructions ?? '').split('\n').filter((s) => s.trim());
  const defaults =
    item.tracking === 'duration' || item.tracking === 'distance_duration'
      ? item.defaultSets && item.defaultSets > 1
        ? t('defaults.setsTime', {
            sets: item.defaultSets,
            seconds: item.defaultDurationSeconds ?? 0,
          })
        : t('defaults.duration', { minutes: Math.round((item.defaultDurationSeconds ?? 0) / 60) })
      : t('defaults.setsReps', { sets: item.defaultSets ?? 3, reps: item.defaultReps ?? 10 });

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header
        title={item.label}
        subtitle={[
          t(`categories.${item.category}`),
          item.difficulty ? t(`difficulty.${item.difficulty}`) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        onBack={() => goBack(routes.exercises)}
        large={false}
      />
      <ExerciseHero slug={item.slug} />
      {item.isCustom || item.archivedAt ? (
        <View style={styles.badges}>
          {item.isCustom ? <Chip label={t('detail.custom')} /> : null}
          {item.archivedAt ? <Chip label={t('detail.archived')} /> : null}
        </View>
      ) : null}

      <Card style={styles.card}>
        <Text variant="caption" tone="muted">
          {t('detail.primary')}
        </Text>
        <Text variant="heading">{muscle(item.primaryMuscle)}</Text>
        {item.secondaryMuscles.length ? (
          <>
            <Text variant="caption" tone="muted">
              {t('detail.secondary')}
            </Text>
            <View style={styles.chips}>
              {item.secondaryMuscles.map((m) => (
                <Chip key={m} label={muscle(m)} />
              ))}
            </View>
          </>
        ) : null}
      </Card>

      <ExerciseMediaSection exerciseId={item.id} editable />

      <SectionHeader title={t('detail.equipment')} />
      <Card>
        {item.equipment.length === 0 ? (
          <Text>{t('bodyweight')}</Text>
        ) : (
          item.equipment.map((e, i) => (
            <View key={e.id}>
              {i > 0 ? <Divider /> : null}
              <View
                style={styles.eqRow}
                accessible
                accessibilityLabel={`${eqName(e)}${e.available ? '' : `, ${t('unavailable')}`}`}
              >
                <EquipmentVisual item={e} size={32} />
                <Icon
                  name={e.available ? 'status-done' : 'error'}
                  size={20}
                  color={e.available ? theme.colors.primaryInk : theme.colors.warning}
                />
                <Text style={styles.flex}>{eqName(e)}</Text>
                {!e.available ? (
                  <Text variant="caption" style={{ color: theme.colors.warning }}>
                    {t('unavailable')}
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        )}
      </Card>

      <SectionHeader title={t('detail.defaults')} />
      <Card style={styles.card}>
        <Text variant="bodyStrong">{defaults}</Text>
        {item.defaultRestSeconds ? (
          <Text tone="muted">{t('defaults.rest', { seconds: item.defaultRestSeconds })}</Text>
        ) : null}
        <Text variant="caption" tone="muted">
          {t(`tracking.${item.tracking}`)}
        </Text>
      </Card>

      {steps.length ? (
        <>
          <SectionHeader title={t('detail.instructions')} />
          <Card style={styles.card}>
            {steps.map((s, i) => (
              <View key={i} style={styles.step}>
                <Text variant="bodyStrong" tone="primary" style={styles.stepNum}>
                  {i + 1}
                </Text>
                <Text style={styles.flex}>{s}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title={t('detail.alternatives')} />
      <Card>
        {suggestions.length === 0 ? (
          <Text tone="muted">{t('detail.noAlternatives')}</Text>
        ) : (
          suggestions.map((s, i) => {
            const alt = catalog.byId.get(s.exerciseId);
            if (!alt) return null;
            return (
              <View key={s.exerciseId}>
                {i > 0 ? <Divider /> : null}
                <ExerciseRow item={alt} onPress={() => router.push(routes.exercise(alt.id))} />
                <Text variant="caption" tone="muted" style={styles.reason}>
                  {s.reason === 'mapped' && mappedIds.has(s.exerciseId)
                    ? t('reason.mapped')
                    : t('reason.sameMuscle', { equipment: alt.equipmentLabel })}
                </Text>
              </View>
            );
          })
        )}
      </Card>

      <SectionHeader title={t('detail.stats')} />
      <ExerciseStats exerciseId={item.id} />

      <View style={styles.actions}>
        <Button
          label={t('actions.edit')}
          icon="edit"
          variant="secondary"
          fullWidth
          onPress={() => router.push({ pathname: '/exercise/new', params: { id: item.id } })}
          testID="exercise-edit"
        />
        <Button
          label={t('actions.duplicate')}
          icon="duplicate"
          variant="secondary"
          fullWidth
          loading={duplicate.isPending}
          onPress={() =>
            duplicate.mutate({ id: item.id, name: `${item.label} ${t('form.copySuffix')}` })
          }
          testID="exercise-duplicate"
        />
        {item.isCustom ? (
          <Button
            label={item.archivedAt ? t('actions.unarchive') : t('actions.archive')}
            variant={item.archivedAt ? 'secondary' : 'danger'}
            fullWidth
            onPress={() =>
              item.archivedAt
                ? archive.mutate({ id: item.id, archived: false })
                : setConfirmArchive(true)
            }
          />
        ) : null}
      </View>

      <ConfirmDialog
        visible={confirmArchive}
        title={t('actions.archive')}
        message={t('confirmArchive')}
        confirmLabel={t('actions.archive')}
        cancelLabel={t('common:cancel')}
        destructive
        onCancel={() => setConfirmArchive(false)}
        onConfirm={() => {
          setConfirmArchive(false);
          archive.mutate({ id: item.id, archived: true });
        }}
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: t.spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  badges: { flexDirection: 'row', gap: t.spacing.sm },
  eqRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: 44 },
  flex: { flex: 1 },
  step: { flexDirection: 'row', gap: t.spacing.md },
  stepNum: { width: 20 },
  reason: { marginLeft: 52, marginTop: -6, marginBottom: t.spacing.sm },
  actions: { gap: t.spacing.sm, marginTop: t.spacing.md },
}));
