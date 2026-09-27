import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  Header,
  Input,
  ScreenContainer,
  SectionHeader,
  Skeleton,
  StatTile,
  StatusTag,
  Text,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import {
  hydrate,
  plannedVsActual,
  resolveStartState,
  runSummary,
  summarize,
} from '@/domain/execution';
import { formatMinSec } from '@/domain/running/intervals';
import {
  invalidates,
  useExecution,
  useRepoMutation,
  useSessionsForDate,
  useUnitPrefs,
} from '@/hooks/data';
import { toLocalDate, today } from '@/utils/dates';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';
import { formatQuantity, toCanonical, unitLabel } from '@/utils/units';

import { setsText } from './format';

const EFFORT = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Finish flow (step 18): summary, planned vs actual, optional effort and notes. */
export function CompletionSummary({ executionId }: { executionId: string }) {
  const { t, i18n } = useTranslation(['execution', 'common', 'running']);
  const styles = useStyles();
  const detail = useExecution(executionId);
  const catalog = useExerciseCatalog();
  const prefs = useUnitPrefs();
  const client = useQueryClient();
  const [effort, setEffort] = useState<number | null | undefined>(undefined);
  const [notes, setNotes] = useState<string | undefined>(undefined);
  const [distance, setDistance] = useState('');

  const todaySessions = useSessionsForDate(today());
  const link = useRepoMutation(
    (r, sessionId: string) => r.executions.linkToSession(executionId, sessionId),
    { invalidate: invalidates.executionFinished },
  );
  const after = resolveStartState(todaySessions.data ?? [], null);
  const save = useRepoMutation(
    async (
      r,
      v: { perceivedEffort: number | null; notes: string | null; distanceKm?: number | null },
    ) => {
      await r.executions.saveReview(executionId, v);
      // Where the day goes next (step 20): the next activity, Today complete, or Home.
      const day = today();
      const x = await r.executions.get(executionId);
      const linkedToday = x.scheduledSessionId
        ? (await r.schedule.getSession(x.scheduledSessionId)).scheduledDate === day
        : false;
      return { next: resolveStartState(await r.schedule.sessionsForDate(day), null), linkedToday };
    },
    {
      invalidate: invalidates.executionFinished,
      onSuccess: ({ next, linkedToday }) => {
        toast.success(t('complete.saved'));
        void client.invalidateQueries({ queryKey: ['history'] });
        if (next.fab === 'start') router.replace(routes.start);
        else if (next.fab === 'done' && linkedToday) router.replace(routes.todayComplete);
        else router.replace(routes.home);
      },
    },
  );

  if (detail.isLoading) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <Skeleton preset="card" />
      </ScreenContainer>
    );
  }
  const x = detail.data;
  if (!x) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <EmptyState
          title={t('ended.title')}
          actionLabel={t('ended.home')}
          onAction={() => router.replace(routes.home)}
        />
      </ScreenContainer>
    );
  }

  const state = hydrate(x, { autoRest: false });
  const linkable =
    !x.scheduledSessionId && x.status === 'completed' && toLocalDate(x.startedAt) === today()
      ? (todaySessions.data ?? []).find((s) => s.type === x.type && s.status === 'planned')
      : undefined;
  const summary = summarize(state);
  const diffs = plannedVsActual(state);
  const locale = i18n.language;
  const name = (id: string | null) => (id ? (catalog.byId.get(id)?.label ?? '…') : '');
  const effortValue = effort === undefined ? x.perceivedEffort : effort;
  const run = runSummary(state);
  const estimate = Math.round(run.distanceKm * 1000) / 1000;
  const distanceKm = x.distanceKm ?? estimate;
  const estimated = Math.abs(distanceKm - estimate) < 1e-6;
  const plannedSeconds = state.intervals
    .filter((i) => !i.isRepeat)
    .reduce((s, i) => s + i.plannedDurationSeconds, 0);
  const typed = Number(distance.replace(',', '.'));
  const enteredKm =
    distance.trim() && Number.isFinite(typed) && typed > 0
      ? toCanonical(typed, prefs.distance)
      : null;
  const notesValue = notes ?? x.notes ?? '';

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('complete.title')} subtitle={x.title} large />
      {x.outcome ? (
        <StatusTag
          status={x.outcome === 'as_planned' ? 'completed' : 'modified'}
          label={t(`complete.outcome.${x.outcome}`)}
          testID="complete-outcome"
        />
      ) : null}

      {linkable ? (
        <Card style={styles.link} testID="complete-link">
          <Text style={styles.flex}>{t('complete.linkPrompt', { title: linkable.title })}</Text>
          <Button
            size="md"
            label={t('complete.link')}
            loading={link.isPending}
            onPress={() => link.mutate(linkable.id)}
            testID="complete-link-button"
          />
        </Card>
      ) : null}

      {state.kind === 'running' ? (
        <>
          <View style={styles.tiles}>
            <StatTile
              icon="clock"
              value={formatMinSec(run.totalSeconds)}
              label={t('complete.duration')}
            />
            <StatTile
              icon="running"
              value={formatQuantity(distanceKm, 'distance', prefs, locale)}
              label={
                estimated
                  ? `${t('complete.distance')} · ${t('complete.estimated')}`
                  : t('complete.distance')
              }
              testID="complete-distance"
            />
          </View>
          <View style={styles.tiles}>
            <StatTile
              icon="timer"
              value={formatQuantity(run.avgSpeedKmh, 'speed', prefs, locale)}
              label={t('complete.avgSpeed')}
            />
            <StatTile
              icon="check"
              value={`${run.intervalsDone}/${run.intervalsTotal}`}
              label={t('complete.intervals')}
            />
          </View>

          <SectionHeader title={t('complete.diffTitle')} />
          <Text variant="caption" tone="muted">
            {`${t('complete.planned')} ${formatMinSec(plannedSeconds)} → ${t('complete.actual')} ${formatMinSec(run.totalSeconds)}`}
          </Text>
          <Card>
            {state.intervals.map((iv, i) => {
              const pace = (sec: number | null, kmh: number | null) =>
                [
                  sec !== null ? formatMinSec(sec) : null,
                  kmh ? formatQuantity(kmh, 'speed', prefs, locale) : null,
                ]
                  .filter(Boolean)
                  .join(' @ ');
              const actualSpeed = iv.actualSpeedKmh ?? iv.plannedSpeedKmh;
              const same =
                !iv.isRepeat &&
                iv.status === 'done' &&
                iv.actualDurationSeconds === iv.plannedDurationSeconds &&
                actualSpeed === iv.plannedSpeedKmh;
              const tag = iv.isRepeat
                ? t('complete.repeat')
                : iv.status === 'skipped'
                  ? t('complete.skipped')
                  : iv.status === 'partial'
                    ? t('complete.partial')
                    : same
                      ? t('complete.asPlanned')
                      : '';
              return (
                <View key={iv.id} style={styles.diff} testID={`diff-${i}`}>
                  {i > 0 ? <Divider /> : null}
                  <View style={styles.diffHead}>
                    <Text variant="bodyStrong" style={styles.flex}>
                      {`${i + 1}. ${t(`running:kinds.${iv.kind}`)}`}
                    </Text>
                    <Text variant="caption" tone={same ? 'primary' : 'muted'}>
                      {tag}
                    </Text>
                  </View>
                  <Text variant="caption" tone={same ? 'muted' : 'default'}>
                    {same
                      ? pace(iv.plannedDurationSeconds, iv.plannedSpeedKmh)
                      : `${t('complete.planned')} ${pace(iv.plannedDurationSeconds, iv.plannedSpeedKmh)} → ${
                          iv.status === 'skipped'
                            ? t('complete.skipped')
                            : `${t('complete.actual')} ${pace(iv.actualDurationSeconds, actualSpeed)}`
                        }`}
                  </Text>
                </View>
              );
            })}
          </Card>

          <SectionHeader title={t('complete.distanceEntry')} />
          <Input
            value={distance}
            onChangeText={setDistance}
            numeric
            placeholder={unitLabel(prefs.distance)}
            helper={t('complete.distanceHint')}
            accessibilityLabel={t('complete.distanceEntry')}
            testID="complete-distance-input"
          />
        </>
      ) : (
        <>
          <View style={styles.tiles}>
            <StatTile
              icon="clock"
              value={formatMinSec(x.activeSeconds ?? 0)}
              label={t('complete.duration')}
            />
            <StatTile
              icon="check"
              value={`${summary.doneSets}/${summary.plannedSets}`}
              label={t('complete.sets')}
              testID="complete-sets"
            />
          </View>
          <View style={styles.tiles}>
            <StatTile
              icon="weight"
              value={formatQuantity(summary.volumeKg, 'load', prefs, locale)}
              label={t('complete.volume')}
            />
            <StatTile
              icon="gym"
              value={`${summary.exercisesDone}/${summary.exercisesTotal}`}
              label={t('complete.exercises')}
            />
          </View>
          <Text variant="caption" tone="muted">
            {t('complete.prSoon')}
          </Text>

          <SectionHeader title={t('complete.diffTitle')} />
          <Card>
            {diffs.map((d, i) => {
              const ex = state.exercises[i]!;
              return (
                <View key={d.id} style={styles.diff} testID={`diff-${i}`}>
                  {i > 0 ? <Divider /> : null}
                  <View style={styles.diffHead}>
                    <Text variant="bodyStrong" style={styles.flex}>
                      {name(d.exerciseId)}
                    </Text>
                    {!d.changed ? (
                      <Text variant="caption" tone="primary">
                        {t('complete.asPlanned')}
                      </Text>
                    ) : null}
                  </View>
                  {d.substituted ? (
                    <Text variant="caption" tone="muted">
                      {t('complete.swapped', { name: name(d.plannedExerciseId) })}
                    </Text>
                  ) : null}
                  {d.added ? (
                    <Text variant="caption" tone="muted">
                      {t('complete.added')}
                    </Text>
                  ) : null}
                  {d.changed ? (
                    <Text variant="caption">
                      {d.added
                        ? ''
                        : `${t('complete.planned')} ${setsText(d.planned, ex.tracking, prefs, locale)} → `}
                      {d.skipped
                        ? t('complete.skipped')
                        : `${t('complete.actual')} ${setsText(d.actual, ex.tracking, prefs, locale)}`}
                    </Text>
                  ) : (
                    <Text variant="caption" tone="muted">
                      {setsText(d.actual, ex.tracking, prefs, locale)}
                    </Text>
                  )}
                </View>
              );
            })}
          </Card>
        </>
      )}

      <SectionHeader title={t('complete.effort')} />
      <Text variant="caption" tone="muted">
        {t('complete.effortHint')}
      </Text>
      <View style={styles.chips}>
        {EFFORT.map((n) => (
          <Chip
            key={n}
            label={String(n)}
            selected={effortValue === n}
            onPress={() => setEffort(effortValue === n ? null : n)}
            testID={`effort-${n}`}
          />
        ))}
      </View>

      <SectionHeader title={t('complete.notes')} />
      <Input
        value={notesValue}
        onChangeText={setNotes}
        placeholder={t('notes.placeholder')}
        multiline
        maxLength={500}
        accessibilityLabel={t('complete.notes')}
      />

      <Button
        size="xl"
        label={after.fab === 'start' ? t('complete.continue') : t('complete.save')}
        fullWidth
        loading={save.isPending}
        onPress={() =>
          save.mutate({
            perceivedEffort: effortValue ?? null,
            notes: notesValue.trim() ? notesValue.trim() : null,
            ...(enteredKm !== null ? { distanceKm: enteredKm } : {}),
          })
        }
        testID="complete-save"
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  tiles: { flexDirection: 'row', gap: t.spacing.sm },
  diff: { gap: 2, paddingVertical: t.spacing.xs },
  diffHead: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  link: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
}));
