import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';

import { useUnsavedGuard } from '@/components/system/useUnsavedGuard';
import {
  BottomSheet,
  Button,
  Card,
  ChipGroup,
  Divider,
  Header,
  IconButton,
  Input,
  ListRow,
  ScreenContainer,
  Text,
} from '@/components/ui';
import { ExerciseRow } from '@/components/workout/ExerciseRow';
import { MUSCLES } from '@/constants/muscles';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { invalidates, useEquipment, useRepoMutation } from '@/hooks/data';
import { matchesQuery, useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';
import { EXERCISE_CATEGORIES, EXERCISE_TRACKING } from '@/types/enums';
import { exerciseFormSchema, type ExerciseForm } from '@/types/forms';
import { logger } from '@/utils/logger';
import { displayName } from '@/utils/seedNames';

const int = (v: string) => (v.trim() === '' ? null : Number(v));

/** Create a custom exercise, or edit one (`?id=`). Library exercises: name and defaults only. */
export default function ExerciseFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation(['exercises', 'equipment', 'seed', 'common', 'errors']);
  const styles = useStyles();
  const catalog = useExerciseCatalog();
  const equipment = useEquipment().data ?? [];
  const existing = id ? catalog.byId.get(id) : undefined;
  const seeded = !!existing && !existing.isCustom;
  const [picking, setPicking] = useState(false);
  const [pickQuery, setPickQuery] = useState('');

  const { control, handleSubmit, reset, setValue, formState } = useForm<ExerciseForm>({
    resolver: zodResolver(exerciseFormSchema),
    defaultValues: {
      name: '',
      category: 'chest',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      tracking: 'weight_reps',
      equipmentIds: [],
      sets: '3',
      reps: '10',
      duration: '',
      rest: '60',
      difficulty: 'beginner',
      instructions: '',
      alternatives: [],
    },
  });
  const guard = useUnsavedGuard(formState.isDirty);
  const tracking = useWatch({ control, name: 'tracking' });
  const alternatives = useWatch({ control, name: 'alternatives' });

  // Load each exercise into the form once (catalog refreshes must not wipe edits).
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!existing || loadedFor.current === existing.id) return;
    loadedFor.current = existing.id;
    reset({
      name: existing.label,
      category: existing.category,
      primaryMuscle: existing.primaryMuscle,
      secondaryMuscles: existing.secondaryMuscles,
      tracking: existing.tracking,
      equipmentIds: existing.equipmentIds,
      sets: existing.defaultSets?.toString() ?? '',
      reps: existing.defaultReps?.toString() ?? '',
      duration: existing.defaultDurationSeconds?.toString() ?? '',
      rest: existing.defaultRestSeconds?.toString() ?? '',
      difficulty: existing.difficulty,
      instructions: existing.instructions ?? '',
      alternatives: existing.alternatives.map((a) => a.alternativeId),
    });
  }, [existing, reset]);

  const save = useRepoMutation(
    async (r, v: ExerciseForm) => {
      const defaults = {
        defaultSets: int(v.sets) || null,
        defaultReps:
          v.tracking === 'weight_reps' || v.tracking === 'reps' ? int(v.reps) || null : null,
        defaultDurationSeconds:
          v.tracking === 'duration' || v.tracking === 'distance_duration'
            ? int(v.duration) || null
            : null,
        defaultRestSeconds: int(v.rest),
      };
      if (existing && seeded) {
        await r.exercises.update(existing.id, { name: v.name.trim(), ...defaults });
        return existing.id;
      }
      const fields = {
        slug: null,
        name: v.name.trim(),
        category: v.category,
        primaryMuscle: v.primaryMuscle,
        secondaryMuscles: v.secondaryMuscles.filter((m) => m !== v.primaryMuscle),
        tracking: v.tracking,
        instructions: v.instructions.trim() || null,
        difficulty: v.difficulty,
        ...defaults,
      };
      const exId = existing
        ? (await r.exercises.update(existing.id, fields, v.equipmentIds), existing.id)
        : (await r.exercises.create(fields, v.equipmentIds)).id;
      await r.exercises.setAlternatives(exId, v.alternatives);
      return exId;
    },
    {
      invalidate: invalidates.exercises,
      onSuccess: (exId) =>
        guard.leave(() =>
          existing ? goBack(routes.exercise(exId)) : router.replace(routes.exercise(exId)),
        ),
    },
  );

  const err = (k: keyof ExerciseForm) => (formState.errors[k] ? { error: t('form.required') } : {});

  const pickable = useMemo(
    () =>
      catalog.items.filter(
        (x) =>
          !x.archivedAt &&
          x.id !== existing?.id &&
          !alternatives.includes(x.id) &&
          matchesQuery(x, pickQuery),
      ),
    [catalog.items, existing?.id, alternatives, pickQuery],
  );

  const move = (i: number, dir: -1 | 1) => {
    const next = [...alternatives];
    const [x] = next.splice(i, 1);
    next.splice(i + dir, 0, x!);
    setValue('alternatives', next, { shouldDirty: true });
  };

  const eqName = (e: (typeof equipment)[number]) =>
    displayName('equipment', e, (k, o) =>
      t(k as 'exercises:title', { defaultValue: o?.defaultValue ?? k }),
    );
  const muscleOptions = MUSCLES.map((m) => ({ value: m, label: t(`muscles.${m}`) }));
  const isDuration = tracking === 'duration' || tracking === 'distance_duration';

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header
        title={existing ? t('form.editTitle') : t('form.newTitle')}
        onBack={() => goBack(existing ? routes.exercise(existing.id) : routes.exercises)}
        large={false}
      />
      {seeded ? <Text tone="muted">{t('form.seededHint')}</Text> : null}

      <Card style={styles.card}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Input
              label={t('form.name')}
              value={field.value}
              onChangeText={field.onChange}
              maxLength={60}
              {...err('name')}
              testID="exercise-name"
            />
          )}
        />
        {!seeded ? (
          <>
            <Label text={t('form.category')} />
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <ChipGroup
                  options={EXERCISE_CATEGORIES.map((c) => ({
                    value: c,
                    label: t(`categories.${c}`),
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Label text={t('form.primary')} />
            <Controller
              control={control}
              name="primaryMuscle"
              render={({ field }) => (
                <ChipGroup
                  scrollable
                  options={muscleOptions}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Label text={t('form.secondary')} />
            <Controller
              control={control}
              name="secondaryMuscles"
              render={({ field }) => (
                <ChipGroup
                  scrollable
                  multiple
                  options={muscleOptions}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Label text={t('form.tracking')} />
            <Controller
              control={control}
              name="tracking"
              render={({ field }) => (
                <ChipGroup
                  options={EXERCISE_TRACKING.map((v) => ({ value: v, label: t(`tracking.${v}`) }))}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <View style={styles.row}>
          <Field control={control} name="sets" label={t('form.sets')} error={t('form.required')} />
          {isDuration ? (
            <Field
              control={control}
              name="duration"
              label={t('form.duration')}
              error={t('form.required')}
            />
          ) : (
            <Field
              control={control}
              name="reps"
              label={t('form.reps')}
              error={t('form.required')}
            />
          )}
          <Field control={control} name="rest" label={t('form.rest')} error={t('form.required')} />
        </View>
        {!seeded ? (
          <>
            <Label text={t('form.difficulty')} />
            <Controller
              control={control}
              name="difficulty"
              render={({ field }) => (
                <ChipGroup
                  options={(['beginner', 'intermediate', 'advanced'] as const).map((d) => ({
                    value: d,
                    label: t(`difficulty.${d}`),
                  }))}
                  value={field.value ?? 'beginner'}
                  onChange={field.onChange}
                />
              )}
            />
          </>
        ) : null}
      </Card>

      {!seeded ? (
        <>
          <Card style={styles.card}>
            <Label text={t('form.equipment')} />
            <Text variant="caption" tone="muted">
              {t('form.equipmentHint')}
            </Text>
            <Controller
              control={control}
              name="equipmentIds"
              render={({ field }) => (
                <ChipGroup
                  multiple
                  options={equipment.map((e) => ({ value: e.id, label: eqName(e) }))}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </Card>
          <Card style={styles.card}>
            <Controller
              control={control}
              name="instructions"
              render={({ field }) => (
                <Input
                  label={t('form.instructions')}
                  helper={t('form.instructionsHint')}
                  value={field.value}
                  onChangeText={field.onChange}
                  multiline
                  maxLength={1500}
                />
              )}
            />
          </Card>
          <Card style={styles.card}>
            <Label text={t('form.alternatives')} />
            {alternatives.map((altId, i) => {
              const alt = catalog.byId.get(altId);
              if (!alt) return null;
              return (
                <View key={altId}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    title={`${i + 1}. ${alt.label}`}
                    subtitle={alt.equipmentLabel}
                    trailing={
                      <View style={styles.row}>
                        <IconButton
                          icon="down"
                          variant="plain"
                          size={36}
                          accessibilityLabel={t('form.moveDown')}
                          disabled={i === alternatives.length - 1}
                          onPress={() => move(i, 1)}
                        />
                        <IconButton
                          icon="back"
                          variant="plain"
                          size={36}
                          accessibilityLabel={t('form.moveUp')}
                          disabled={i === 0}
                          onPress={() => move(i, -1)}
                        />
                        <IconButton
                          icon="close"
                          variant="plain"
                          size={36}
                          accessibilityLabel={t('form.remove')}
                          onPress={() =>
                            setValue(
                              'alternatives',
                              alternatives.filter((x) => x !== altId),
                              { shouldDirty: true },
                            )
                          }
                        />
                      </View>
                    }
                  />
                </View>
              );
            })}
            <Button
              label={t('form.addAlternative')}
              icon="add"
              variant="ghost"
              onPress={() => setPicking(true)}
            />
          </Card>
        </>
      ) : null}

      <Button
        label={t('form.save')}
        size="lg"
        fullWidth
        onPress={handleSubmit(
          (v) => save.mutate(v),
          (errors) => {
            logger.warn('Exercise form invalid', { fields: Object.keys(errors) });
            toast.error(t('errors:VALIDATION'));
          },
        )}
        loading={save.isPending}
        testID="exercise-save"
      />

      <BottomSheet
        visible={picking}
        onClose={() => setPicking(false)}
        title={t('form.addAlternative')}
      >
        <Input
          value={pickQuery}
          onChangeText={setPickQuery}
          placeholder={t('search')}
          leftIcon="search"
        />
        <FlatList
          style={styles.pickList}
          data={pickable}
          keyExtractor={(x) => x.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ExerciseRow
              item={item}
              onPress={() => {
                setValue('alternatives', [...alternatives, item.id], { shouldDirty: true });
                setPicking(false);
                setPickQuery('');
              }}
            />
          )}
        />
      </BottomSheet>
      {guard.dialog}
    </ScreenContainer>
  );
}

function Label({ text }: { text: string }) {
  return (
    <Text variant="caption" tone="muted">
      {text}
    </Text>
  );
}

function Field({
  control,
  name,
  label,
  error,
}: {
  control: ReturnType<typeof useForm<ExerciseForm>>['control'];
  name: 'sets' | 'reps' | 'duration' | 'rest';
  label: string;
  error: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.flex}>
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <Input
            label={label}
            value={field.value}
            onChangeText={field.onChange}
            numeric
            {...(fieldState.error ? { error } : {})}
          />
        )}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: t.spacing.sm },
  row: { flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' },
  flex: { flex: 1 },
  pickList: { maxHeight: 420 },
}));
