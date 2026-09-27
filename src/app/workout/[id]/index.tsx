import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Button,
  Card,
  ConfirmDialog,
  CoverArt,
  Divider,
  EmptyState,
  Header,
  ScreenContainer,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useStartWorkout } from '@/components/execution/useStartWorkout';
import { TemplateStats } from '@/components/progress/TemplateStats';
import { CoachEntry } from '@/components/ai/CoachEntry';
import { CoverEditor } from '@/components/workout/CoverEditor';
import { ExerciseRow } from '@/components/workout/ExerciseRow';
import { coverType, templateSubtitle, useTemplateLabel } from '@/components/workout/templateInfo';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { invalidates, useRepoMutation, useTemplate, useUnitPrefs } from '@/hooks/data';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';
import { formatQuantity } from '@/utils/units';

/** Workout detail (step 14): plan overview, availability, and actions. */
export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const starter = useStartWorkout();
  const { t } = useTranslation(['train', 'exercises', 'common']);
  const { t: tTrain } = useTranslation('train');
  const { t: tAi } = useTranslation('settings');
  const styles = useStyles();
  const template = useTemplate(id);
  const catalog = useExerciseCatalog();
  const units = useUnitPrefs();
  const label = useTemplateLabel();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const duplicate = useRepoMutation((r, tid: string) => r.templates.duplicate(tid), {
    invalidate: invalidates.templates,
    onSuccess: (copy) => {
      toast.success(t('toast.duplicated'));
      router.replace(routes.workoutEdit(copy.id));
    },
  });
  const remove = useRepoMutation((r, tid: string) => r.templates.remove(tid), {
    invalidate: invalidates.templates,
    onSuccess: (result) => {
      toast.info(result === 'archived' ? t('toast.archivedInstead') : t('toast.deleted'));
      goBack(routes.train);
    },
  });

  const tpl = template.data;
  if (template.isLoading) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <Skeleton preset="card" />
      </ScreenContainer>
    );
  }
  if (!tpl) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <Header title={t('title')} onBack={() => goBack(routes.train)} large={false} />
        <EmptyState title={t('empty.filterTitle')} />
      </ScreenContainer>
    );
  }

  const target = (e: (typeof tpl.exercises)[number]) => {
    const main = e.targetDurationSeconds
      ? t('exercises:defaults.setsTime', { sets: e.sets, seconds: e.targetDurationSeconds })
      : t('exercises:defaults.setsReps', { sets: e.sets, reps: e.targetReps ?? 0 });
    const weight = e.targetWeightKg ? ` · ${formatQuantity(e.targetWeightKg, 'load', units)}` : '';
    const rest = e.restSeconds ? ` · ${t('detail.rest', { seconds: e.restSeconds })}` : '';
    return main + weight + rest;
  };

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={label(tpl)} onBack={() => goBack(routes.train)} large={false} />
      <Card variant="hero" style={styles.hero}>
        <CoverArt type={coverType(tpl.type)} coverKey={tpl.coverKey} size={84} />
        <View style={styles.flex}>
          <Text variant="title">{label(tpl)}</Text>
          <Text tone="muted">{templateSubtitle(tpl, tpl.exercises.length, tTrain)}</Text>
          {tpl.difficulty ? (
            <Text variant="caption" tone="muted">
              {t(`exercises:difficulty.${tpl.difficulty}`)}
            </Text>
          ) : null}
        </View>
      </Card>
      {tpl.description ? <Text tone="muted">{tpl.description}</Text> : null}
      <TemplateStats templateId={tpl.id} />
      <CoverEditor templateId={tpl.id} type={coverType(tpl.type)} coverKey={tpl.coverKey} />

      <Button
        label={t('detail.startNow')}
        icon="play"
        size="lg"
        fullWidth
        onPress={() => void starter.start({ templateId: tpl.id })}
        loading={starter.busy}
        testID="workout-start"
      />
      <CoachEntry method="adaptWorkout" templateId={tpl.id} label={tAi('ai.coach.adaptRun')} />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label={t('detail.schedule')}
            icon="plan"
            variant="secondary"
            fullWidth
            onPress={() =>
              router.push({ pathname: '/session/new', params: { templateId: tpl.id } })
            }
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={t('detail.edit')}
            icon="edit"
            variant="secondary"
            fullWidth
            onPress={() => router.push(routes.workoutEdit(tpl.id))}
            testID="workout-edit"
          />
        </View>
      </View>

      <SectionHeader title={t('detail.exercises')} />
      <Card>
        {tpl.exercises.map((e, i) => {
          const item = catalog.byId.get(e.exerciseId);
          if (!item) return null;
          return (
            <View key={e.id}>
              {i > 0 ? <Divider /> : null}
              <ExerciseRow item={item} onPress={() => router.push(routes.exercise(item.id))} />
              <Text variant="caption" tone="muted" style={styles.target}>
                {target(e)}
                {!item.available ? ` · ${t('detail.unavailable')}` : ''}
              </Text>
              {e.notes ? (
                <Text variant="caption" style={styles.target}>
                  {e.notes}
                </Text>
              ) : null}
            </View>
          );
        })}
      </Card>

      <Card>
        <Text tone="muted">{t('detail.historySoon')}</Text>
      </Card>

      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label={t('detail.duplicate')}
            icon="duplicate"
            variant="ghost"
            fullWidth
            loading={duplicate.isPending}
            onPress={() => duplicate.mutate(tpl.id)}
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={t('menu.delete')}
            icon="delete"
            variant="danger"
            fullWidth
            onPress={() => setConfirmDelete(true)}
          />
        </View>
      </View>

      <ConfirmDialog
        visible={confirmDelete}
        title={t('confirmDelete.title')}
        message={t('confirmDelete.body')}
        confirmLabel={t('menu.delete')}
        cancelLabel={t('common:cancel')}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          remove.mutate(tpl.id);
        }}
      />
      {starter.element}
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  hero: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.lg },
  flex: { flex: 1, gap: t.spacing.xs },
  row: { flexDirection: 'row', gap: t.spacing.sm },
  target: { marginLeft: 52, marginTop: -6, marginBottom: t.spacing.sm },
}));
