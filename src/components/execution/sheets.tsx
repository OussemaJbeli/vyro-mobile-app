import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { CoachEntry } from '@/components/ai/CoachEntry';
import { ExerciseRow } from '@/components/workout/ExerciseRow';
import {
  BottomSheet,
  Button,
  Chip,
  Divider,
  Icon,
  IconButton,
  Input,
  ListRow,
  NumberStepper,
  Text,
  Toggle,
} from '@/components/ui';
import { type ExecSet, type ExecState, type Tracking } from '@/domain/execution';
import { suggestAlternatives } from '@/domain/workouts/alternatives';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { makeStyles, useTheme } from '@/theme';
import { type IconName } from '@/components/ui/Icon';

import { useWeightInput } from './useWeightInput';

/** Edit an already-logged set. Mounted with `key={set.id}` so it starts from the set. */
export function EditSetSheet({
  set,
  tracking,
  onClose,
  onSave,
}: {
  set: ExecSet | null;
  tracking: Tracking;
  onClose: () => void;
  onSave: (v: {
    reps: number | null;
    weightKg: number | null;
    durationSeconds: number | null;
  }) => void;
}) {
  const { t } = useTranslation(['execution', 'common']);
  const styles = useStyles();
  const weight = useWeightInput();
  const [reps, setReps] = useState(set?.actualReps ?? 0);
  const [kg, setKg] = useState(set?.actualWeightKg ?? 0);
  const [duration, setDuration] = useState(set?.actualDurationSeconds ?? 0);
  const timed = tracking === 'duration' || tracking === 'distance_duration';
  return (
    <BottomSheet
      visible={set !== null}
      onClose={onClose}
      title={set ? t('editSet.title', { n: set.index + 1 }) : ''}
    >
      <View style={styles.gap}>
        {tracking === 'weight_reps' ? (
          <NumberStepper
            label={t('weight')}
            value={weight.toDisplay(kg)}
            onChange={(v) => setKg(weight.toKg(v))}
            step={weight.step}
            min={0}
            max={weight.max}
            unit={weight.unit}
            size="xl"
            testID="edit-weight"
          />
        ) : null}
        {!timed ? (
          <NumberStepper
            label={t('reps')}
            value={reps}
            onChange={setReps}
            min={0}
            max={200}
            size="xl"
            testID="edit-reps"
          />
        ) : (
          <NumberStepper
            label={t('duration')}
            value={duration}
            onChange={setDuration}
            step={5}
            min={0}
            max={7200}
            unit="s"
            size="xl"
          />
        )}
        <Button
          size="xl"
          label={t('common:save')}
          fullWidth
          onPress={() =>
            onSave(
              timed
                ? { reps: null, weightKg: null, durationSeconds: duration }
                : {
                    reps,
                    weightKg: tracking === 'weight_reps' ? weight.toKg(weight.toDisplay(kg)) : null,
                    durationSeconds: null,
                  },
            )
          }
          testID="edit-save"
        />
      </View>
    </BottomSheet>
  );
}

/** Optional note (never required). Mounted with a key so it starts from `initial`. */
export function NoteSheet({
  visible,
  title,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  initial: string;
  onClose: () => void;
  onSave: (text: string | null) => void;
}) {
  const { t } = useTranslation(['execution', 'common']);
  const styles = useStyles();
  const [text, setText] = useState(initial);
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.gap}>
        <Input
          value={text}
          onChangeText={setText}
          placeholder={t('notes.placeholder')}
          multiline
          maxLength={500}
          accessibilityLabel={title}
          testID="note-input"
        />
        <Button
          size="lg"
          label={t('common:save')}
          fullWidth
          onPress={() => onSave(text.trim() ? text.trim() : null)}
          testID="note-save"
        />
      </View>
    </BottomSheet>
  );
}

const REASONS = ['busy', 'equipment', 'pain', 'preference'] as const;

/** Swap ⇄: alternatives from step 13 (available first, with the reason). */
export function SwapSheet({
  visible,
  exerciseId,
  onClose,
  onPick,
}: {
  visible: boolean;
  exerciseId: string | null;
  onClose: () => void;
  onPick: (exerciseId: string, tracking: Tracking, reason: string | null) => void;
}) {
  const { t } = useTranslation(['execution', 'exercises']);
  const styles = useStyles();
  const { t: tAi } = useTranslation('settings');
  const catalog = useExerciseCatalog();
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const item = exerciseId ? catalog.byId.get(exerciseId) : undefined;
  const suggestions = item ? suggestAlternatives(item, catalog.engine, 8) : [];
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('swapSheet.title')}>
      <View style={styles.gap}>
        <Text variant="caption" tone="muted">
          {t('swapSheet.reason')}
        </Text>
        <View style={styles.chips}>
          {REASONS.map((r) => (
            <Chip
              key={r}
              label={t(`swapSheet.reasons.${r}`)}
              selected={reason === r}
              onPress={() => setReason(reason === r ? null : r)}
            />
          ))}
        </View>
        {suggestions.length === 0 ? (
          <Text tone="muted">{t('swapSheet.none')}</Text>
        ) : (
          suggestions.map((s, i) => {
            const alt = catalog.byId.get(s.exerciseId);
            if (!alt) return null;
            return (
              <View key={alt.id}>
                {i > 0 ? <Divider /> : null}
                <ExerciseRow
                  item={alt}
                  onPress={() =>
                    onPick(alt.id, alt.tracking, reason ? t(`swapSheet.reasons.${reason}`) : null)
                  }
                />
              </View>
            );
          })
        )}
        {exerciseId ? (
          <CoachEntry
            method="suggestAlternative"
            exerciseId={exerciseId}
            label={tAi('ai.coach.more')}
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

const STATUS_ICON: Record<string, IconName> = {
  pending: 'status-pending',
  active: 'status-next',
  done: 'status-done',
  skipped: 'status-skipped',
};

/** Exercise overview: status, jump, reorder remaining, skip, add, circuit mode, notes. */
export function OverviewSheet({
  visible,
  state,
  nameOf,
  onClose,
  onJump,
  onMove,
  onSkipSet,
  onSkipExercise,
  onAddSet,
  onAddExercise,
  onCircuit,
  onSessionNote,
}: {
  visible: boolean;
  state: ExecState;
  nameOf: (exerciseId: string) => string;
  onClose: () => void;
  onJump: (index: number) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onSkipSet: () => void;
  onSkipExercise: () => void;
  onAddSet: () => void;
  onAddExercise: () => void;
  onCircuit: (on: boolean) => void;
  onSessionNote: () => void;
}) {
  const { t } = useTranslation('execution');
  const theme = useTheme();
  const styles = useStyles();
  const current = state.cursor?.exercise ?? null;
  const movable = (i: number) => state.exercises[i]?.status === 'pending';
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('overview.title')}>
      <View style={styles.gap}>
        {state.exercises.map((e, i) => {
          const name = nameOf(e.exerciseId);
          const done = e.sets.filter((s) => s.status === 'done').length;
          return (
            <View key={e.id} style={styles.exRow}>
              <Icon
                name={STATUS_ICON[i === current ? 'active' : e.status] ?? 'status-pending'}
                size={22}
                color={i === current ? theme.colors.primaryInk : theme.colors.textMuted}
              />
              <View style={styles.flex}>
                <ListRow
                  title={name}
                  subtitle={`${done}/${e.sets.length}`}
                  onPress={() => onJump(i)}
                  showChevron={false}
                  testID={`overview-${i}`}
                />
              </View>
              {movable(i) ? (
                <>
                  <IconButton
                    icon="up"
                    variant="plain"
                    accessibilityLabel={t('overview.moveUp', { name })}
                    disabled={i === 0 || !movable(i - 1)}
                    onPress={() => onMove(i, -1)}
                  />
                  <IconButton
                    icon="down"
                    variant="plain"
                    accessibilityLabel={t('overview.moveDown', { name })}
                    disabled={i === state.exercises.length - 1 || !movable(i + 1)}
                    onPress={() => onMove(i, 1)}
                  />
                </>
              ) : null}
            </View>
          );
        })}
        <Divider />
        {state.cursor ? (
          <View style={styles.actions}>
            <Button
              size="lg"
              variant="secondary"
              icon="skip"
              label={t('overview.skipSet')}
              onPress={onSkipSet}
            />
            <Button
              size="lg"
              variant="secondary"
              icon="skip"
              label={t('overview.skip')}
              onPress={onSkipExercise}
              testID="overview-skip-exercise"
            />
          </View>
        ) : null}
        <View style={styles.actions}>
          <Button
            size="lg"
            variant="secondary"
            icon="add"
            label={t('overview.addSet')}
            onPress={onAddSet}
            testID="overview-add-set"
          />
          <Button
            size="lg"
            variant="secondary"
            icon="add"
            label={t('overview.add')}
            onPress={onAddExercise}
            testID="overview-add-exercise"
          />
        </View>
        <View style={styles.circuit}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{t('overview.circuit')}</Text>
            <Text variant="caption" tone="muted">
              {t('overview.circuitHint')}
            </Text>
          </View>
          <Toggle
            value={state.circuit}
            onChange={onCircuit}
            accessibilityLabel={t('overview.circuit')}
            testID="overview-circuit"
          />
        </View>
        <ListRow title={t('overview.notes')} onPress={onSessionNote} testID="overview-note" />
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles((t) => ({
  gap: { gap: t.spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  circuit: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: 52 },
}));
