import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  canonicalUnit,
  inputUnit,
  toCanonicalTarget,
  toDisplayTarget,
} from '@/components/goals/goalUnits';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { useUnsavedGuard } from '@/components/system/useUnsavedGuard';
import {
  Button,
  Card,
  ChipGroup,
  ConfirmDialog,
  Header,
  Input,
  ScreenContainer,
  Skeleton,
  Text,
} from '@/components/ui';
import {
  invalidates,
  useGoals,
  useLatestMeasurements,
  useLatestWeights,
  useMeasurementTypes,
  useRepoMutation,
  useUnitPrefs,
} from '@/hooks/data';
import { makeStyles } from '@/theme';
import { type BodyMeasurement, type Goal, type MeasurementType } from '@/types/domain';
import { GOAL_FORM_TYPES, QUALITATIVE_GOALS, goalFormSchema, type GoalForm } from '@/types/forms';
import { today } from '@/utils/dates';

type StatusAction = 'pause' | 'resume' | 'achieve' | 'abandon' | 'delete';
const NEXT_STATUS: Record<Exclude<StatusAction, 'delete'>, Goal['status']> = {
  pause: 'paused',
  resume: 'active',
  achieve: 'achieved',
  abandon: 'abandoned',
};

// Stable fallbacks: a fresh [] each render would retrigger the effects below.
const NO_TYPES: MeasurementType[] = [];
const NO_MEASUREMENTS: BodyMeasurement[] = [];

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

/** Create (id = "new") or edit a goal, plus its status lifecycle (step 12). */
export default function GoalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { t } = useTranslation(['goals', 'seed', 'common', 'settings']);
  const styles = useStyles();
  const units = useUnitPrefs();
  const goals = useGoals();
  const goal = isNew ? null : ((goals.data ?? []).find((g) => g.id === id) ?? null);
  const types = useMeasurementTypes().data ?? NO_TYPES;
  const latestWeight = useLatestWeights(1).data?.[0];
  const latestMeasurements = useLatestMeasurements().data ?? NO_MEASUREMENTS;
  const [confirm, setConfirm] = useState<StatusAction | null>(null);

  const { control, handleSubmit, reset, setValue, formState } = useForm<GoalForm>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      type: 'weight',
      title: '',
      target: '',
      start: '',
      measurementTypeId: null,
      startDate: today(),
      targetDate: '',
      notes: '',
    },
  });
  const type = useWatch({ control, name: 'type' });
  const measurementTypeId = useWatch({ control, name: 'measurementTypeId' });
  const guard = useUnsavedGuard(formState.isDirty);
  const measurement = types.find((m) => m.id === measurementTypeId) ?? null;

  // Load an existing goal into the form.
  useEffect(() => {
    if (!goal) return;
    const gt = (GOAL_FORM_TYPES as readonly string[]).includes(goal.type)
      ? (goal.type as GoalForm['type'])
      : 'custom';
    const m = types.find((x) => x.id === goal.measurementTypeId) ?? null;
    reset({
      type: gt,
      title: goal.title,
      target:
        goal.targetValue == null ? '' : String(toDisplayTarget(goal.targetValue, gt, units, m)),
      start: goal.startValue == null ? '' : String(toDisplayTarget(goal.startValue, gt, units, m)),
      measurementTypeId: goal.measurementTypeId,
      startDate: goal.startDate,
      targetDate: goal.targetDate ?? '',
      notes: goal.notes ?? '',
    });
  }, [goal, types, units, reset]);

  // New goals: prefill the starting value from the latest entry (FS §9).
  useEffect(() => {
    if (!isNew) return;
    if (type === 'weight' && latestWeight) {
      setValue('start', String(toDisplayTarget(latestWeight.valueKg, 'weight', units)));
    } else if (type === 'measurement' && measurement) {
      const last = latestMeasurements.find((x) => x.measurementTypeId === measurement.id);
      setValue(
        'start',
        last ? String(toDisplayTarget(last.value, 'measurement', units, measurement)) : '',
      );
    }
  }, [isNew, type, measurement, latestWeight, latestMeasurements, units, setValue]);

  const create = useRepoMutation(
    (r, g: Parameters<typeof r.goals.create>[0]) => r.goals.create(g),
    {
      invalidate: invalidates.goals,
      onSuccess: () => guard.leave(() => goBack(routes.goals)),
    },
  );
  const update = useRepoMutation(
    (r, v: { id: string; patch: Parameters<typeof r.goals.update>[1] }) =>
      r.goals.update(v.id, v.patch),
    { invalidate: invalidates.goals, onSuccess: () => guard.leave(() => goBack(routes.goals)) },
  );
  const setStatus = useRepoMutation(
    (r, v: { id: string; status: Goal['status'] }) => r.goals.setStatus(v.id, v.status),
    { invalidate: invalidates.goals },
  );
  const remove = useRepoMutation((r, gid: string) => r.goals.softDelete(gid), {
    invalidate: invalidates.goals,
    onSuccess: () => guard.leave(() => goBack(routes.goals)),
  });

  const onSubmit = handleSubmit((v) => {
    const target = num(v.target);
    const start = num(v.start);
    const fields = {
      type: v.type,
      title: v.title.trim(),
      targetValue: target == null ? null : toCanonicalTarget(target, v.type, units, measurement),
      unit: canonicalUnit(v.type, measurement),
      startValue: start == null ? null : toCanonicalTarget(start, v.type, units, measurement),
      measurementTypeId: v.type === 'measurement' ? v.measurementTypeId : null,
      startDate: v.startDate,
      targetDate: v.targetDate.trim() || null,
      notes: v.notes.trim() || null,
    };
    if (goal) update.mutate({ id: goal.id, patch: fields });
    else create.mutate({ ...fields, status: 'active', achievedAt: null });
  });

  const err = (key: keyof GoalForm) => {
    const msg = formState.errors[key]?.message;
    return msg ? { error: t(`form.${msg}` as 'form.required') } : {};
  };

  const actions: StatusAction[] = !goal
    ? []
    : goal.status === 'active'
      ? ['pause', 'achieve', 'abandon', 'delete']
      : goal.status === 'paused'
        ? ['resume', 'achieve', 'abandon', 'delete']
        : ['resume', 'delete'];

  if (!isNew && goals.isLoading) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <Skeleton preset="card" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header
        title={isNew ? t('form.newTitle') : t('form.editTitle')}
        onBack={() => goBack(routes.goals)}
        large={false}
      />
      <Card style={styles.card}>
        <Text variant="caption" tone="muted">
          {t('form.type')}
        </Text>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <ChipGroup
              options={GOAL_FORM_TYPES.map((v) => ({ value: v, label: t(`types.${v}`) }))}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <Input
              label={t('form.title')}
              placeholder={t('form.titlePlaceholder')}
              value={field.value}
              onChangeText={field.onChange}
              maxLength={80}
              {...err('title')}
              testID="goal-title"
            />
          )}
        />
        {type === 'measurement' ? (
          <>
            <Text variant="caption" tone="muted">
              {t('form.measurement')}
            </Text>
            <Controller
              control={control}
              name="measurementTypeId"
              render={({ field }) => (
                <ChipGroup
                  options={types.map((m) => ({
                    value: m.id,
                    label: m.slug
                      ? t(`seed:measurement.${m.slug}` as 'seed:measurement.waist', {
                          defaultValue: m.name,
                        })
                      : m.name,
                  }))}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            />
            {formState.errors.measurementTypeId ? (
              <Text tone="danger">{t('form.required')}</Text>
            ) : null}
          </>
        ) : null}
        {!QUALITATIVE_GOALS.includes(type) ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Controller
                control={control}
                name="start"
                render={({ field }) => (
                  <Input
                    label={`${t('form.start')} (${inputUnit(type, units, measurement)})`}
                    value={field.value}
                    onChangeText={field.onChange}
                    numeric
                    {...(type === 'weight' || type === 'measurement'
                      ? { helper: t('form.startHint') }
                      : {})}
                  />
                )}
              />
            </View>
            <View style={styles.flex}>
              <Controller
                control={control}
                name="target"
                render={({ field }) => (
                  <Input
                    label={`${t('form.target')} (${inputUnit(type, units, measurement)})`}
                    value={field.value}
                    onChangeText={field.onChange}
                    numeric
                    {...err('target')}
                    testID="goal-target"
                  />
                )}
              />
            </View>
          </View>
        ) : null}
        <View style={styles.row}>
          <View style={styles.flex}>
            <Controller
              control={control}
              name="startDate"
              render={({ field }) => (
                <Input
                  label={t('form.startDate')}
                  value={field.value}
                  onChangeText={field.onChange}
                  maxLength={10}
                  {...err('startDate')}
                />
              )}
            />
          </View>
          <View style={styles.flex}>
            <Controller
              control={control}
              name="targetDate"
              render={({ field }) => (
                <Input
                  label={t('form.targetDate')}
                  helper={t('form.targetDateHint')}
                  value={field.value}
                  onChangeText={field.onChange}
                  maxLength={10}
                  {...err('targetDate')}
                />
              )}
            />
          </View>
        </View>
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Input
              label={t('form.notes')}
              value={field.value}
              onChangeText={field.onChange}
              multiline
              maxLength={500}
            />
          )}
        />
      </Card>
      <Button
        label={t('settings:save')}
        size="lg"
        fullWidth
        onPress={onSubmit}
        loading={create.isPending || update.isPending}
        testID="goal-save"
      />
      {goal ? (
        <View style={styles.actions}>
          <Text variant="caption" tone="muted">
            {t('progressSoon')}
          </Text>
          {actions.map((a) => (
            <Button
              key={a}
              label={t(`actions.${a}`)}
              variant={a === 'delete' || a === 'abandon' ? 'danger' : 'secondary'}
              fullWidth
              onPress={() => setConfirm(a)}
              testID={`goal-${a}`}
            />
          ))}
        </View>
      ) : null}
      <ConfirmDialog
        visible={confirm !== null}
        title={confirm ? t(`confirm.${confirm}`) : ''}
        message={t('confirm.body')}
        confirmLabel={confirm ? t(`actions.${confirm}`) : ''}
        cancelLabel={t('common:cancel')}
        destructive={confirm === 'delete' || confirm === 'abandon'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const a = confirm;
          setConfirm(null);
          if (!goal || !a) return;
          if (a === 'delete') remove.mutate(goal.id);
          else setStatus.mutate({ id: goal.id, status: NEXT_STATUS[a] });
        }}
      />
      {guard.dialog}
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: t.spacing.md },
  row: { flexDirection: 'row', gap: t.spacing.md },
  flex: { flex: 1 },
  actions: { gap: t.spacing.sm },
}));
