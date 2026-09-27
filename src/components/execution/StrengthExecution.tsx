import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Pressable, View } from 'react-native';

import { ExerciseMediaSection } from '@/components/exercises/ExerciseMediaSection';
import { ExercisePickerSheet } from '@/components/workout/ExercisePickerSheet';
import {
  BottomSheet,
  Button,
  Card,
  EmptyState,
  Icon,
  NumberStepper,
  ScreenContainer,
  Skeleton,
  Text,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import {
  activeMs,
  prefill,
  restRemainingMs,
  roundOf,
  workElapsedMs,
  type ExecState,
  type Prefill,
} from '@/domain/execution';
import { formatMinSec } from '@/domain/running/intervals';
import {
  invalidates,
  useExecution,
  useExerciseMedia,
  useExerciseThumbs,
  useLastPerformance,
  useRepoMutation,
  useUnitPrefs,
} from '@/hooks/data';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { useNow } from '@/hooks/useNow';
import {
  engineNow,
  selectProgress,
  useExecutionStore,
  type EngineEvent,
} from '@/store/executionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from '@/store/uiStore';
import { mediaUri } from '@/services/media/exerciseMedia';
import { makeStyles } from '@/theme';
import { newId } from '@/utils/id';

import { bundledImage, bundledVideo } from '@/constants/bundledImages';

import { ExecutionShell } from './ExecutionShell';
import {
  ExecutionBackdrop,
  ExerciseImage,
  GlowRing,
  MetricCard,
  NextCard,
  PhaseStrip,
  PillButton,
} from './parts';
import { setDetail } from './format';
import { RestOverlay, RestPill } from './RestOverlay';
import { SetDots } from './SetDots';
import { EditSetSheet, NoteSheet, OverviewSheet, SwapSheet } from './sheets';
import { useExecutionExit } from './useExecutionExit';
import { useTimerCues } from './useTimerCues';
import { useWeightInput } from './useWeightInput';

type Sheet = null | 'overview' | 'swap' | 'picker' | 'exerciseNote' | 'sessionNote' | 'media';

/** Index of the next exercise (≠ current) that still has work, for the "Next" preview. */
function nextExerciseIndex(s: ExecState, from: number): number | null {
  const n = s.exercises.length;
  for (let k = 1; k < n; k++) {
    const i = (from + k) % n;
    const e = s.exercises[i]!;
    if (e.status !== 'skipped' && e.sets.some((x) => x.status === 'pending')) return i;
  }
  return null;
}

/**
 * Gym & home/abs execution (step 18, FS §76): what exercise, what set, what weight/reps,
 * rest, next. One tap per set in the common case.
 */
export function StrengthExecution({ executionId }: { executionId: string }) {
  const { t, i18n } = useTranslation(['execution', 'common', 'errors', 'exercises']);
  const styles = useStyles();
  const state = useExecutionStore((s) => s.state);
  const catalog = useExerciseCatalog();
  const prefs = useUnitPrefs();
  const weight = useWeightInput();
  const defaultRest = useSettingsStore((s) => s.values['training.defaultRestSeconds']);
  const live = state && state.executionId === executionId ? state : null;
  const { finish, discard, finishing } = useExecutionExit(executionId);
  const detail = useExecution(live ? executionId : undefined);
  const thumbs = useExerciseThumbs();
  const exMedia = useExerciseMedia(
    live?.cursor ? live.exercises[live.cursor.exercise]?.exerciseId : undefined,
  );
  const last = useLastPerformance(live?.exercises.map((e) => e.exerciseId) ?? [], executionId);
  useNow(250, !!live && live.lifecycle === 'active');
  const now = engineNow();

  const [overrides, setOverrides] = useState<Record<string, Partial<Prefill>>>({});
  const [sheet, setSheet] = useState<Sheet>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [minimizedFor, setMinimizedFor] = useState<string | null>(null);

  const exerciseNote = useRepoMutation(
    (r, v: { id: string; notes: string | null }) => r.executions.setExerciseNote(v.id, v.notes),
    { invalidate: invalidates.executionProgress },
  );
  const sessionNote = useRepoMutation(
    (r, notes: string | null) => r.executions.setNotes(executionId, notes),
    { invalidate: invalidates.executionProgress },
  );

  const dispatch = (event: EngineEvent) =>
    useExecutionStore
      .getState()
      .dispatch(event)
      .catch(() => toast.error(t('errors:DB_WRITE_FAILED')));

  // Timers: dispatch a TICK when a rest or timed set reaches zero (the reducer settles it).
  const restLeft = live?.rest ? restRemainingMs(live, now) : null;
  const work = live?.workTimer ?? null;
  const workElapsed = live && work ? workElapsedMs(live, now) : 0;
  const workLeft = work && work.targetMs > 0 ? work.targetMs - workElapsed : null;
  const due = (restLeft !== null && restLeft <= 0) || (workLeft !== null && workLeft <= 0);
  useEffect(() => {
    if (due) void useExecutionStore.getState().dispatch({ type: 'TICK' });
  }, [due]);
  useTimerCues(live?.lifecycle === 'active' ? (restLeft ?? workLeft) : null);

  // "Rest over" when a rest ran out on its own (also after coming back from the background).
  const restSetId = live?.rest?.forSetId ?? null;
  const prevRest = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevRest.current;
    prevRest.current = restSetId;
    if (!prev || restSetId || !live) return;
    const ex = live.exercises.find((e) => e.sets.some((s) => s.id === prev));
    const set = ex?.sets.find((s) => s.id === prev);
    if (
      ex?.restSeconds &&
      set?.restTakenSeconds !== null &&
      set!.restTakenSeconds! >= ex.restSeconds
    ) {
      toast.info(t('rest.over'));
      AccessibilityInfo.announceForAccessibility(t('rest.over'));
    }
  }, [restSetId, live, t]);

  if (!live) {
    return (
      <ScreenContainer edges={['top', 'bottom']} scroll={false}>
        {finishing ? (
          <Skeleton preset="card" />
        ) : (
          <EmptyState
            icon="status-done"
            title={t('ended.title')}
            body={t('ended.body')}
            actionLabel={t('ended.home')}
            onAction={() => router.replace(routes.home)}
          />
        )}
      </ScreenContainer>
    );
  }

  const nameOf = (id: string) => catalog.byId.get(id)?.label ?? '…';
  const cursor = live.cursor;
  const ex = cursor ? live.exercises[cursor.exercise]! : null;
  const set = ex && cursor ? ex.sets[cursor.set]! : null;
  const item = ex ? catalog.byId.get(ex.exerciseId) : undefined;
  const lastTime = ex ? last.data?.[ex.exerciseId] : undefined;
  const base =
    ex && cursor
      ? prefill(ex, cursor.set, lastTime, {
          reps: item?.defaultReps ?? null,
          durationSeconds: item?.defaultDurationSeconds ?? null,
        })
      : null;
  const values = base && set ? { ...base, ...overrides[set.id] } : null;
  const override = (patch: Partial<Prefill>) =>
    set && setOverrides((o) => ({ ...o, [set.id]: { ...o[set.id], ...patch } }));
  const timed = ex?.tracking === 'duration' || ex?.tracking === 'distance_duration';
  const progress = selectProgress(live);
  const round = live.circuit ? roundOf(live) : null;
  const paused = live.lifecycle === 'paused';
  const hasLogged =
    progress.done > 0 && live.exercises.some((e) => e.sets.some((s) => s.status === 'done'));
  const locale = i18n.language;

  const nextIndex = cursor ? nextExerciseIndex(live, cursor.exercise) : null;
  const nextEx = nextIndex !== null ? live.exercises[nextIndex]! : null;
  const nextText = nextEx
    ? `${nameOf(nextEx.exerciseId)} · ${nextEx.sets.filter((s) => s.status === 'pending').length}×${
        nextEx.sets[0]?.plannedReps ?? formatMinSec(nextEx.sets[0]?.plannedDurationSeconds ?? 0)
      }`
    : null;

  const completeSet = async () => {
    if (!cursor || !ex || !values) return;
    const n = cursor.set + 1;
    const payload =
      ex.tracking === 'weight_reps'
        ? { reps: values.reps, weightKg: weight.toKg(weight.toDisplay(values.weightKg)) }
        : ex.tracking === 'reps'
          ? { reps: values.reps }
          : { durationSeconds: values.durationSeconds };
    await dispatch({ type: 'COMPLETE_SET', ...payload });
    const after = useExecutionStore.getState().state;
    AccessibilityInfo.announceForAccessibility(
      t('setDone', { n }) +
        (after?.rest
          ? ` ${t('restAnnounce', { seconds: Math.round(after.rest.durationMs / 1000) })}`
          : ''),
    );
  };

  const move = (i: number, dir: -1 | 1) => {
    const ids = live.exercises.map((e) => e.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    void dispatch({ type: 'REORDER_REMAINING', order: ids });
  };

  const addExercises = (ids: string[]) => {
    setSheet(null);
    for (const id of ids) {
      const x = catalog.byId.get(id);
      if (!x) continue;
      const isTimed = x.tracking === 'duration' || x.tracking === 'distance_duration';
      void dispatch({
        type: 'ADD_EXERCISE',
        id: newId(),
        exerciseId: id,
        tracking: x.tracking,
        restSeconds: x.defaultRestSeconds ?? defaultRest,
        sets: Array.from({ length: x.defaultSets ?? 3 }, () => ({
          id: newId(),
          reps: isTimed ? null : (x.defaultReps ?? 10),
          weightKg: null,
          durationSeconds: isTimed ? (x.defaultDurationSeconds ?? 30) : null,
        })),
      });
    }
  };

  const editingSet = editing
    ? (live.exercises.flatMap((e) => e.sets).find((s) => s.id === editing) ?? null)
    : null;
  const editingTracking = editing
    ? (live.exercises.find((e) => e.sets.some((s) => s.id === editing))?.tracking ?? 'weight_reps')
    : 'weight_reps';
  const exNote = ex ? (detail.data?.exercises.find((e) => e.id === ex.id)?.notes ?? '') : '';
  const thumb = ex ? thumbs.data?.[ex.exerciseId] : undefined;
  // Picture: first image added in the app → bundled assets/images/exercises/<slug>.
  const slug = ex ? catalog.byId.get(ex.exerciseId)?.slug : undefined;
  // Demo loop when bundled, unless the user added their own picture for the exercise.
  const video = thumb ? null : bundledVideo(slug);
  const picture = thumb ? { uri: mediaUri(thumb) } : ex ? bundledImage('exercises', slug) : null;
  const mediaCount = exMedia.data?.length ?? 0;

  return (
    <ExecutionShell
      title={live.title}
      elapsedMs={activeMs(live, now)}
      paused={paused}
      onPauseToggle={() => void dispatch({ type: paused ? 'RESUME' : 'PAUSE' })}
      onFinish={() => void finish()}
      onDiscard={discard}
      hasLogged={hasLogged}
      backdrop={<ExecutionBackdrop kind={detail.data?.type === 'abs' ? 'abs' : 'gym'} />}
    >
      <View style={styles.body}>
        <MetricCard
          icon={detail.data?.type === 'abs' ? 'abs' : 'gym'}
          label={
            round
              ? t('roundOf', { current: round.round, total: round.rounds })
              : t('exerciseOf', {
                  current: Math.min(
                    (cursor?.exercise ?? live.exercises.length - 1) + 1,
                    live.exercises.length,
                  ),
                  total: live.exercises.length,
                })
          }
          value={`${progress.done}/${progress.total}`}
          unit={t('setsUnit')}
          level={progress.total ? progress.done / progress.total : 0}
          onPress={() => setSheet('overview')}
          testID="execution-overview"
        />

        {restLeft !== null && minimizedFor === restSetId ? (
          <RestPill remainingMs={restLeft} onPress={() => setMinimizedFor(null)} />
        ) : null}

        {ex && set && values && cursor ? (
          <View style={styles.main}>
            {picture || video ? (
              <ExerciseImage
                key={ex.id}
                source={picture}
                video={video}
                {...(mediaCount > 0
                  ? {
                      onPress: () => setSheet('media'),
                      badge: t('exercises:media.show'),
                      testID: 'execution-media',
                    }
                  : {})}
              />
            ) : null}
            <View style={styles.nameRow}>
              {mediaCount > 0 && !picture ? (
                <Pressable
                  onPress={() => setSheet('media')}
                  accessibilityRole="button"
                  accessibilityLabel={t('exercises:media.show')}
                  style={styles.mediaThumb}
                  testID="execution-media"
                >
                  {thumb ? (
                    <Image
                      source={{ uri: mediaUri(thumb) }}
                      style={styles.mediaThumbImage}
                      contentFit="cover"
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <Icon name="play" size={24} />
                  )}
                </Pressable>
              ) : null}
              <Text
                variant="title"
                style={styles.flex}
                numberOfLines={2}
                testID="execution-exercise"
              >
                {nameOf(ex.exerciseId)}
              </Text>
              <Button
                size="xl"
                variant="ghost"
                icon="swap"
                label={t('swap')}
                onPress={() => setSheet('swap')}
                testID="execution-swap"
              />
            </View>
            <View style={styles.meta}>
              <Text variant="bodyStrong" testID="execution-set">
                {t('setOf', { current: cursor.set + 1, total: ex.sets.length })}
              </Text>
              {lastTime ? (
                <Text variant="caption" tone="muted">
                  {t('lastTime', { value: setDetail(ex.tracking, lastTime, prefs, locale) })}
                </Text>
              ) : null}
            </View>

            {ex.tracking === 'weight_reps' ? (
              <Text variant="overline" tone="muted" align="center" importantForAccessibility="no">
                {t('weight')}
              </Text>
            ) : null}
            {ex.tracking === 'weight_reps' ? (
              <NumberStepper
                label={t('weight')}
                value={weight.toDisplay(values.weightKg)}
                onChange={(v) => override({ weightKg: weight.toKg(v) })}
                step={weight.step}
                min={0}
                max={weight.max}
                unit={weight.unit}
                size="xl"
                testID="stepper-weight"
              />
            ) : null}
            {!timed ? (
              <Text variant="overline" tone="muted" align="center" importantForAccessibility="no">
                {t('reps')}
              </Text>
            ) : null}
            {!timed ? (
              <NumberStepper
                label={t('reps')}
                value={values.reps}
                onChange={(v) => override({ reps: v })}
                min={0}
                max={200}
                size="xl"
                testID="stepper-reps"
              />
            ) : work ? (
              <View style={styles.center}>
                <GlowRing
                  value={work.targetMs > 0 ? (workLeft ?? 0) / work.targetMs : 1}
                  size={240}
                  accessibilityLabel={t('timer.a11y', { time: formatMinSec(workElapsed / 1000) })}
                >
                  <Text variant="timer" style={styles.tabular} testID="work-timer">
                    {formatMinSec(Math.ceil((workLeft ?? workElapsed) / 1000))}
                  </Text>
                  {work.targetMs > 0 ? (
                    <Text tone="muted">
                      {t('timer.target', { time: formatMinSec(work.targetMs / 1000) })}
                    </Text>
                  ) : null}
                </GlowRing>
              </View>
            ) : (
              <NumberStepper
                label={t('duration')}
                value={values.durationSeconds}
                onChange={(v) => override({ durationSeconds: v })}
                step={5}
                min={0}
                max={7200}
                unit="s"
                size="xl"
                testID="stepper-duration"
              />
            )}

            <SetDots sets={ex.sets} current={cursor.set} onEdit={setEditing} />

            {timed ? (
              work ? (
                <Button
                  size="xl"
                  icon="check"
                  label={t('stopTimer')}
                  fullWidth
                  onPress={() => void dispatch({ type: 'STOP_WORK_TIMER' })}
                  testID="work-stop"
                />
              ) : (
                <View style={styles.gap}>
                  <Button
                    size="xl"
                    icon="timer"
                    label={t('startTimer')}
                    fullWidth
                    onPress={() => void dispatch({ type: 'START_WORK_TIMER' })}
                    testID="work-start"
                  />
                  <Button
                    size="xl"
                    variant="secondary"
                    icon="check"
                    label={t('completeSet')}
                    fullWidth
                    onPress={() => void completeSet()}
                    testID="complete-set"
                  />
                </View>
              )
            ) : (
              <Button
                size="xl"
                icon="check"
                label={t('completeSet')}
                fullWidth
                onPress={() => void completeSet()}
                testID="complete-set"
              />
            )}

            <NextCard
              label={nextText ? t('nextUp') : ''}
              detail={nextText ?? t('lastExercise')}
              onPress={() => setSheet('overview')}
            />
            <View style={styles.row}>
              <PillButton
                icon="skip"
                tone="neutral"
                label={t('overview.skipSet')}
                onPress={() => void dispatch({ type: 'SKIP_SET' })}
              />
              <PillButton
                icon="edit"
                tone="neutral"
                label={t('notes.button')}
                onPress={() => setSheet('exerciseNote')}
                testID="execution-note"
              />
            </View>
            <PhaseStrip
              phases={live.exercises.map((e, i) => ({
                key: e.id,
                label: nameOf(e.exerciseId),
                state:
                  i === cursor.exercise
                    ? 'current'
                    : e.sets.every((s) => s.status !== 'pending')
                      ? 'done'
                      : 'pending',
              }))}
              onPress={(i) => void dispatch({ type: 'JUMP_TO_EXERCISE', index: i })}
            />
          </View>
        ) : (
          <Card style={styles.done}>
            <Text variant="heading">{t('allDone')}</Text>
            <Text tone="muted">{t('allDoneBody')}</Text>
            <Button
              size="xl"
              icon="check"
              label={t('finish')}
              fullWidth
              onPress={() => void finish()}
              testID="finish"
            />
            <Button
              size="xl"
              variant="secondary"
              icon="add"
              label={t('overview.add')}
              fullWidth
              onPress={() => setSheet('picker')}
            />
          </Card>
        )}
      </View>

      {restLeft !== null && live.rest && minimizedFor !== restSetId && !paused ? (
        <RestOverlay
          remainingMs={restLeft}
          totalMs={live.rest.durationMs}
          video={video}
          nextText={
            values && cursor && ex
              ? t('rest.nextSet', {
                  n: cursor.set + 1,
                  detail: setDetail(ex.tracking, values, prefs, locale),
                })
              : null
          }
          onSkip={() => void dispatch({ type: 'REST_SKIP' })}
          onAdjust={(deltaMs) => void dispatch({ type: 'REST_ADJUST', deltaMs })}
          onMinimize={() => setMinimizedFor(restSetId)}
        />
      ) : null}

      {paused ? (
        <View style={styles.pausedLayer}>
          <Card style={styles.done}>
            <Text variant="heading">{t('paused')}</Text>
            <Button
              size="xl"
              icon="play"
              label={t('exit.resume')}
              fullWidth
              onPress={() => void dispatch({ type: 'RESUME' })}
              testID="paused-resume"
            />
          </Card>
        </View>
      ) : null}

      <OverviewSheet
        visible={sheet === 'overview'}
        state={live}
        nameOf={nameOf}
        onClose={() => setSheet(null)}
        onJump={(i) => {
          setSheet(null);
          void dispatch({ type: 'JUMP_TO_EXERCISE', index: i });
        }}
        onMove={move}
        onSkipSet={() => {
          setSheet(null);
          void dispatch({ type: 'SKIP_SET' });
        }}
        onSkipExercise={() => {
          setSheet(null);
          void dispatch({ type: 'SKIP_EXERCISE' });
        }}
        onAddSet={() => {
          setSheet(null);
          void dispatch({ type: 'ADD_SET', id: newId() });
        }}
        onAddExercise={() => setSheet('picker')}
        onCircuit={(on) => void dispatch({ type: 'SET_CIRCUIT', on })}
        onSessionNote={() => setSheet('sessionNote')}
      />
      <SwapSheet
        visible={sheet === 'swap'}
        exerciseId={ex?.exerciseId ?? null}
        onClose={() => setSheet(null)}
        onPick={(exerciseId, tracking, reason) => {
          setSheet(null);
          void dispatch({ type: 'SUBSTITUTE_EXERCISE', exerciseId, tracking, reason });
        }}
      />
      <BottomSheet
        visible={sheet === 'media'}
        onClose={() => setSheet(null)}
        title={t('exercises:media.show')}
      >
        {ex ? <ExerciseMediaSection exerciseId={ex.exerciseId} title={false} /> : null}
      </BottomSheet>
      <ExercisePickerSheet
        visible={sheet === 'picker'}
        onClose={() => setSheet(null)}
        onAdd={addExercises}
      />
      <EditSetSheet
        key={editing ?? 'none'}
        set={editingSet}
        tracking={editingTracking}
        onClose={() => setEditing(null)}
        onSave={(v) => {
          if (editing) void dispatch({ type: 'EDIT_SET', setId: editing, ...v });
          setEditing(null);
        }}
      />
      <NoteSheet
        key={`ex-${ex?.id ?? ''}-${sheet === 'exerciseNote'}`}
        visible={sheet === 'exerciseNote'}
        title={t('notes.exercise', { name: ex ? nameOf(ex.exerciseId) : '' })}
        initial={exNote}
        onClose={() => setSheet(null)}
        onSave={(notes) => {
          setSheet(null);
          if (ex) exerciseNote.mutate({ id: ex.id, notes });
        }}
      />
      <NoteSheet
        key={`session-${sheet === 'sessionNote'}`}
        visible={sheet === 'sessionNote'}
        title={t('notes.session')}
        initial={detail.data?.notes ?? ''}
        onClose={() => setSheet(null)}
        onSave={(notes) => {
          setSheet(null);
          sessionNote.mutate(notes);
        }}
      />
    </ExecutionShell>
  );
}

const useStyles = makeStyles((t) => ({
  body: { flex: 1, gap: t.spacing.md },
  center: { alignItems: 'center' },
  row: { flexDirection: 'row', gap: t.spacing.md },
  progress: { gap: t.spacing.xs, minHeight: t.touch.execution, justifyContent: 'center' },
  main: { flex: 1, gap: t.spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  mediaThumb: {
    width: 56,
    height: 56,
    borderRadius: t.radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surfaceRaised,
  },
  mediaThumbImage: { width: '100%', height: '100%' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flex: { flex: 1 },
  gap: { gap: t.spacing.sm },
  tabular: { fontVariant: ['tabular-nums'] },
  timerCard: { alignItems: 'center', gap: t.spacing.xs, paddingVertical: t.spacing.lg },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto' },
  done: { gap: t.spacing.md, alignItems: 'stretch' },
  pausedLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    padding: t.spacing.md,
    backgroundColor: t.colors.overlay,
  },
}));
