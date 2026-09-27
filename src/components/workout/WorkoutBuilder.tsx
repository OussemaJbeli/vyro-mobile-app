import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useUnsavedGuard } from '@/components/system/useUnsavedGuard';
import {
  BottomSheet,
  Button,
  Card,
  ChipGroup,
  CoverArt,
  Header,
  IconButton,
  Input,
  ListRow,
  NumberStepper,
  ScreenContainer,
  SectionHeader,
  Text,
  Toggle,
} from '@/components/ui';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { estimateMinutes } from '@/domain/workouts/duration';
import { suggestAlternatives } from '@/domain/workouts/alternatives';
import { invalidates, useRepoMutation, useUnitPrefs, type TemplateDetail } from '@/hooks/data';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { canPickCoverPhoto, pickCoverPhoto } from '@/services/photos/covers';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from '@/store/uiStore';
import { makeStyles, useTheme } from '@/theme';

import {
  durationItems,
  emptyState,
  isValid,
  itemFromExercise,
  moveItem,
  stateFromTemplate,
  toTemplateInput,
  usesDuration,
  validate,
  type BuilderErrors,
  type BuilderItem,
  type BuilderState,
} from './builderModel';
import { ExercisePickerSheet } from './ExercisePickerSheet';
import { ExerciseRow } from './ExerciseRow';

const TYPES = ['gym', 'home', 'abs', 'recovery', 'other'] as const;

/** Create/edit a gym, home, abs, recovery or other workout (step 14, FS §68). */
export function WorkoutBuilder({
  template,
  initialType = 'gym',
}: {
  template?: TemplateDetail;
  initialType?: BuilderState['type'];
}) {
  const { t } = useTranslation(['train', 'exercises']);
  const theme = useTheme();
  const styles = useStyles();
  const units = useUnitPrefs();
  const catalog = useExerciseCatalog();
  const defaultRest = useSettingsStore((s) => s.values['training.defaultRestSeconds']);
  // The edit route renders this only once the template is loaded, so state starts from it.
  const [state, setState] = useState<BuilderState>(() =>
    template ? stateFromTemplate(template, units) : emptyState(initialType),
  );
  const [baseline] = useState(() => JSON.stringify(state));
  const [errors, setErrors] = useState<BuilderErrors>({});
  const [picking, setPicking] = useState(false);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [replacing, setReplacing] = useState<number | null>(null);

  const tracking = (id: string) => catalog.byId.get(id)?.tracking;
  const estimate = useMemo(
    () => estimateMinutes(durationItems(state, (id) => catalog.byId.get(id)?.tracking)),
    [state, catalog.byId],
  );
  const dirty = JSON.stringify(state) !== baseline;
  const guard = useUnsavedGuard(dirty);

  const save = useRepoMutation(
    async (r, s: BuilderState) => {
      const input = toTemplateInput(s, units, tracking);
      if (template) {
        await r.templates.update(template.id, input);
        return template.id;
      }
      return (await r.templates.create(input)).id;
    },
    {
      invalidate: invalidates.templates,
      onSuccess: (id) => {
        toast.success(t('toast.saved'));
        guard.leave(() =>
          template ? goBack(routes.workout(id)) : router.replace(routes.workout(id)),
        );
      },
    },
  );

  const set = (patch: Partial<BuilderState>) => setState((s) => ({ ...s, ...patch }));
  const setItem = (index: number, patch: Partial<BuilderItem>) =>
    setState((s) => ({
      ...s,
      items: s.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    }));

  const onSave = () => {
    const e = validate(state, tracking);
    setErrors(e);
    if (isValid(e)) save.mutate(state);
    else
      toast.error(
        e.name
          ? t('builder.errors.name')
          : e.exercises
            ? t('builder.errors.exercises')
            : t('builder.errors.target'),
      );
  };

  const addExercises = (ids: string[]) =>
    setState((s) => ({
      ...s,
      items: [
        ...s.items,
        ...ids
          .map((id) => catalog.byId.get(id))
          .filter((x) => !!x)
          .map((x) => itemFromExercise(x!, defaultRest)),
      ],
    }));

  const itemAction = (action: 'up' | 'down' | 'duplicate' | 'replace' | 'remove') => {
    const i = menuFor;
    setMenuFor(null);
    if (i === null) return;
    if (action === 'up' || action === 'down')
      set({ items: moveItem(state.items, i, action === 'up' ? -1 : 1) });
    if (action === 'duplicate') {
      const copy = { ...state.items[i]!, key: `${state.items[i]!.key}-copy-${Date.now()}` };
      set({ items: [...state.items.slice(0, i + 1), copy, ...state.items.slice(i + 1)] });
    }
    if (action === 'replace') setReplacing(i);
    if (action === 'remove') set({ items: state.items.filter((_, j) => j !== i) });
  };

  const replaceItem = (exerciseId: string) => {
    const i = replacing;
    setReplacing(null);
    const ex = catalog.byId.get(exerciseId);
    if (i === null || !ex) return;
    const fresh = itemFromExercise(ex, defaultRest);
    setItem(i, { exerciseId, reps: fresh.reps, duration: fresh.duration, weight: '' });
  };

  const replacingItem =
    replacing !== null ? catalog.byId.get(state.items[replacing]?.exerciseId ?? '') : undefined;
  const suggestions = replacingItem ? suggestAlternatives(replacingItem, catalog.engine, 8) : [];

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header
        title={template ? t('builder.editTitle') : t('builder.newTitle')}
        onBack={() => goBack(template ? routes.workout(template.id) : routes.train)}
        large={false}
      />

      <Card style={styles.card}>
        <Input
          label={t('builder.name')}
          placeholder={t('builder.namePlaceholder')}
          value={state.name}
          onChangeText={(name) => set({ name })}
          maxLength={60}
          {...(errors.name ? { error: t('builder.errors.name') } : {})}
          testID="builder-name"
        />
        <Text variant="caption" tone="muted">
          {t('builder.type')}
        </Text>
        <ChipGroup
          options={TYPES.map((v) => ({ value: v, label: t(`types.${v}`) }))}
          value={state.type}
          onChange={(type) => set({ type })}
        />
        <Input
          label={t('builder.description')}
          value={state.description}
          onChangeText={(description) => set({ description })}
          multiline
          maxLength={300}
        />
        <Text variant="caption" tone="muted">
          {t('builder.difficulty')}
        </Text>
        <ChipGroup
          options={(['beginner', 'intermediate', 'advanced'] as const).map((d) => ({
            value: d,
            label: t(`exercises:difficulty.${d}`),
          }))}
          value={state.difficulty ?? 'intermediate'}
          onChange={(difficulty) => set({ difficulty })}
        />
      </Card>

      <Card style={styles.rowCard}>
        <CoverArt type={state.type} coverKey={state.coverKey} size={64} />
        <View style={styles.flex}>
          <Text variant="caption" tone="muted">
            {t('builder.cover')}
          </Text>
          <View style={styles.wrap}>
            {canPickCoverPhoto ? (
              <Button
                label={t('builder.coverPhoto')}
                size="sm"
                variant="secondary"
                onPress={async () => {
                  const key = await pickCoverPhoto().catch(() => null);
                  if (key) set({ coverKey: key });
                }}
              />
            ) : null}
            {state.coverKey ? (
              <Button
                label={t('builder.coverRemove')}
                size="sm"
                variant="ghost"
                onPress={() => set({ coverKey: null })}
              />
            ) : (
              <Text variant="caption" tone="muted">
                {t('builder.coverAuto')}
              </Text>
            )}
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="caption" tone="muted">
          {t('builder.estimate')}
        </Text>
        <Text variant="heading" testID="builder-estimate">
          {state.durationOverride === null
            ? t('builder.estimateAuto', { minutes: estimate })
            : t('minutes', { count: state.durationOverride })}
        </Text>
        <ListRow
          title={t('builder.manual')}
          trailing={
            <Toggle
              value={state.durationOverride !== null}
              onChange={(on) => set({ durationOverride: on ? Math.max(estimate, 5) : null })}
              accessibilityLabel={t('builder.manual')}
            />
          }
        />
        {state.durationOverride !== null ? (
          <NumberStepper
            label={t('builder.minutes')}
            value={state.durationOverride}
            onChange={(v) => set({ durationOverride: v })}
            step={5}
            min={5}
            max={240}
            unit="min"
          />
        ) : null}
      </Card>

      <SectionHeader title={t('builder.exercises')} />
      {errors.exercises ? <Text tone="danger">{t('builder.errors.exercises')}</Text> : null}
      {state.items.map((item, i) => {
        const ex = catalog.byId.get(item.exerciseId);
        if (!ex) return null;
        const duration = usesDuration(ex.tracking);
        const hasError = errors.targets?.includes(item.key);
        return (
          <Card
            key={item.key}
            style={[styles.card, hasError ? { borderColor: theme.colors.danger } : null]}
          >
            <ExerciseRow
              item={{ ...ex, label: `${i + 1}. ${ex.label}` }}
              trailing={
                <IconButton
                  icon="more"
                  variant="plain"
                  accessibilityLabel={`${t('builder.itemMenu')}: ${ex.label}`}
                  onPress={() => setMenuFor(i)}
                  testID={`item-menu-${i}`}
                />
              }
            />
            <View style={styles.fields}>
              <Field
                label={t('builder.sets')}
                value={item.sets}
                onChange={(sets) => setItem(i, { sets })}
              />
              {duration ? (
                <Field
                  label={t('builder.duration')}
                  value={item.duration}
                  onChange={(v) => setItem(i, { duration: v })}
                />
              ) : (
                <Field
                  label={t('builder.reps')}
                  value={item.reps}
                  onChange={(reps) => setItem(i, { reps })}
                  testID={`item-reps-${i}`}
                />
              )}
              {ex.tracking === 'weight_reps' ? (
                <Field
                  label={t('builder.weight', { unit: units.weight })}
                  value={item.weight}
                  onChange={(weight) => setItem(i, { weight })}
                />
              ) : null}
              <Field
                label={t('builder.rest')}
                value={item.rest}
                onChange={(rest) => setItem(i, { rest })}
              />
            </View>
            <Input
              placeholder={t('builder.notes')}
              accessibilityLabel={t('builder.notes')}
              value={item.notes}
              onChangeText={(notes) => setItem(i, { notes })}
              maxLength={200}
            />
            {hasError ? <Text tone="danger">{t('builder.errors.target')}</Text> : null}
          </Card>
        );
      })}
      <Button
        label={t('builder.addExercises')}
        icon="add"
        variant="secondary"
        fullWidth
        onPress={() => setPicking(true)}
        testID="builder-add"
      />
      <Button
        label={t('builder.save')}
        size="lg"
        fullWidth
        loading={save.isPending}
        onPress={onSave}
        testID="builder-save"
      />

      <ExercisePickerSheet
        visible={picking}
        onClose={() => setPicking(false)}
        onAdd={addExercises}
      />

      <BottomSheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={t('builder.itemMenu')}
      >
        <View style={styles.sheet}>
          {menuFor !== null && menuFor > 0 ? (
            <ListRow
              title={t('builder.moveUp')}
              onPress={() => itemAction('up')}
              showChevron={false}
            />
          ) : null}
          {menuFor !== null && menuFor < state.items.length - 1 ? (
            <ListRow
              title={t('builder.moveDown')}
              onPress={() => itemAction('down')}
              showChevron={false}
            />
          ) : null}
          <ListRow
            title={t('builder.duplicateItem')}
            onPress={() => itemAction('duplicate')}
            showChevron={false}
          />
          <ListRow
            title={t('builder.replace')}
            onPress={() => itemAction('replace')}
            showChevron={false}
          />
          <ListRow
            title={t('builder.remove')}
            onPress={() => itemAction('remove')}
            showChevron={false}
            testID="item-remove"
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={replacing !== null}
        onClose={() => setReplacing(null)}
        title={t('builder.replaceTitle')}
      >
        <View style={styles.sheet}>
          {suggestions.length === 0 ? (
            <Text tone="muted">{t('builder.noAlternatives')}</Text>
          ) : null}
          {suggestions.map((s) => {
            const alt = catalog.byId.get(s.exerciseId);
            return alt ? (
              <ExerciseRow key={alt.id} item={alt} onPress={() => replaceItem(alt.id)} />
            ) : null;
          })}
        </View>
      </BottomSheet>
      {guard.dialog}
    </ScreenContainer>
  );
}

function Field({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Input
        label={label}
        value={value}
        onChangeText={onChange}
        numeric
        maxLength={5}
        {...(testID ? { testID } : {})}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: t.spacing.sm },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.lg },
  flex: { flex: 1, gap: t.spacing.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.spacing.sm },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  field: { flexGrow: 1, flexBasis: 70 },
  sheet: { gap: t.spacing.xs, paddingBottom: t.spacing.md },
}));
