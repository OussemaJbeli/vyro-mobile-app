import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { setDetail } from '@/components/execution/format';
import { EditSetSheet, NoteSheet } from '@/components/execution/sheets';
import {
  Button,
  Card,
  ConfirmDialog,
  Divider,
  Header,
  Icon,
  ScreenContainer,
  SectionHeader,
  Skeleton,
  StatusTag,
  Text,
} from '@/components/ui';
import { exerciseRecords } from '@/domain/analytics/records';
import { deriveOutcome, hydrate, type ExecSet } from '@/domain/execution';
import { formatMinSec } from '@/domain/running/intervals';
import {
  invalidates,
  useDoneSets,
  useExecution,
  useRepoMutation,
  useUnitPrefs,
} from '@/hooks/data';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { toast } from '@/store/uiStore';
import { makeStyles, useTheme } from '@/theme';
import { formatDuration } from '@/utils/dates';
import { formatQuantity } from '@/utils/units';

/** Execution detail (FS §71): rendered from the planned snapshot + logs (invariant 5). */
export function HistoryDetail({ executionId }: { executionId: string }) {
  const { t, i18n } = useTranslation(['progress', 'execution', 'running', 'common']);
  const styles = useStyles();
  const theme = useTheme();
  const prefs = useUnitPrefs();
  const catalog = useExerciseCatalog();
  const detail = useExecution(executionId);
  const sets = useDoneSets();
  const [editing, setEditing] = useState<ExecSet | null>(null);
  const [notes, setNotes] = useState(false);
  const [confirm, setConfirm] = useState<0 | 1 | 2>(0);

  const correct = useRepoMutation(
    async (
      r,
      v: {
        setId: string;
        reps: number | null;
        weightKg: number | null;
        durationSeconds: number | null;
      },
    ) => {
      await r.executions.correctSet(v.setId, {
        actualReps: v.reps,
        actualWeightKg: v.weightKg,
        actualDurationSeconds: v.durationSeconds,
      });
      const rows = await r.executions.get(executionId);
      if (rows.status === 'completed')
        await r.executions.setOutcome(
          executionId,
          deriveOutcome(hydrate(rows, { autoRest: false })),
        );
    },
    { invalidate: invalidates.executionFinished, onSuccess: () => setEditing(null) },
  );
  const saveNotes = useRepoMutation(
    (r, text: string | null) => r.executions.setNotes(executionId, text),
    {
      invalidate: invalidates.executionFinished,
      onSuccess: () => setNotes(false),
    },
  );
  const remove = useRepoMutation((r) => r.executions.deleteExecution(executionId), {
    invalidate: invalidates.executionFinished,
    onSuccess: () => {
      toast.info(t('history.detail.deleted'));
      router.back();
    },
  });

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
        <Header title={t('history.detail.title')} onBack={() => router.back()} large={false} />
      </ScreenContainer>
    );
  }
  const state = hydrate(x, { autoRest: false });
  const name = (id: string | null) => (id ? (catalog.byId.get(id)?.label ?? '…') : '');
  const locale = i18n.language;
  const records = exerciseRecords(
    (sets.data ?? []).map((r) => ({
      exerciseId: r.exerciseId,
      executionId: r.executionId,
      date: r.startedAt,
      reps: r.reps,
      weightKg: r.weightKg,
      durationSeconds: r.durationSeconds,
    })),
  ).filter((r) => r.setIn[executionId]?.length);

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header
        title={x.title}
        subtitle={new Date(x.startedAt).toLocaleString(locale, {
          dateStyle: 'full',
          timeStyle: 'short',
        })}
        onBack={() => router.back()}
        large={false}
      />
      <View style={styles.row}>
        {x.outcome ? (
          <StatusTag
            status={x.outcome === 'as_planned' ? 'completed' : 'modified'}
            label={t(`execution:complete.outcome.${x.outcome}`)}
          />
        ) : null}
        <Text tone="muted">{formatDuration(x.activeSeconds ?? 0)}</Text>
        {x.distanceKm ? (
          <Text tone="muted">{formatQuantity(x.distanceKm, 'distance', prefs, locale)}</Text>
        ) : null}
        {x.perceivedEffort ? (
          <Text tone="muted">{t('history.detail.effort', { value: x.perceivedEffort })}</Text>
        ) : null}
        {x.isRetroactive ? (
          <Text variant="caption" tone="muted">
            {t('history.detail.retro')}
          </Text>
        ) : null}
      </View>

      {records.length ? (
        <Card style={styles.gap}>
          <Text variant="bodyStrong">🏆 {t('history.detail.prs')}</Text>
          {records.map((r) => (
            <Text key={r.exerciseId} tone="muted">
              {`${name(r.exerciseId)} · ${r.setIn[executionId]!.map((k) =>
                t(
                  `records.${k === 'weight' ? 'heaviest' : k === '1rm' ? 'oneRm' : k === 'reps' ? 'reps' : 'hold'}`,
                  {
                    value:
                      k === 'weight'
                        ? formatQuantity(r.heaviestKg ?? 0, 'load', prefs, locale)
                        : k === '1rm'
                          ? formatQuantity(r.best1RmKg ?? 0, 'load', prefs, locale)
                          : k === 'reps'
                            ? r.mostReps
                            : `${r.longestSeconds} s`,
                  },
                ),
              ).join(', ')}`}
            </Text>
          ))}
        </Card>
      ) : null}

      {state.exercises.map((e) => (
        <View key={e.id} style={styles.gap}>
          <SectionHeader title={name(e.exerciseId)} />
          <Card>
            {e.plannedExerciseId && e.exerciseId !== e.plannedExerciseId ? (
              <Text variant="caption" tone="muted">
                {t('history.detail.swapped', {
                  from: name(e.plannedExerciseId),
                  to: name(e.exerciseId),
                })}
                {e.substitutionReason ? ` · ${e.substitutionReason}` : ''}
              </Text>
            ) : null}
            {e.sets.map((s, i) => {
              const planned = s.isExtra
                ? null
                : setDetail(
                    e.tracking,
                    {
                      reps: s.plannedReps,
                      weightKg: s.plannedWeightKg,
                      durationSeconds: s.plannedDurationSeconds,
                    },
                    prefs,
                    locale,
                  );
              const actual =
                s.status === 'done'
                  ? setDetail(
                      e.tracking,
                      {
                        reps: s.actualReps,
                        weightKg: s.actualWeightKg,
                        durationSeconds: s.actualDurationSeconds,
                      },
                      prefs,
                      locale,
                    )
                  : null;
              const differs = s.status !== 'done' || s.isExtra || planned !== actual;
              return (
                <View key={s.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={styles.setRow}>
                    <Icon
                      name={
                        s.status === 'skipped'
                          ? 'status-skipped'
                          : differs
                            ? 'status-modified'
                            : 'status-done'
                      }
                      size={18}
                      color={differs ? theme.colors.warning : theme.colors.primaryInk}
                    />
                    <Text style={styles.setLabel}>{t('history.detail.setLine', { n: i + 1 })}</Text>
                    <Text style={styles.flex} tone={differs ? 'default' : 'muted'}>
                      {s.status === 'skipped'
                        ? `${planned ?? ''} → ${t('execution:complete.skipped')}`
                        : planned && planned !== actual
                          ? `${planned} → ${actual}`
                          : (actual ?? '')}
                    </Text>
                    {s.status === 'done' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="edit"
                        label={t('history.detail.correct')}
                        onPress={() => setEditing(s)}
                      />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      ))}

      {state.intervals.length ? (
        <>
          <SectionHeader title={t('history.detail.intervals')} />
          <Card>
            {state.intervals.map((iv, i) => {
              const speed = (v: number | null) =>
                v ? formatQuantity(v, 'speed', prefs, locale) : '';
              return (
                <View key={iv.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={styles.setRow}>
                    <Text
                      style={styles.setLabel}
                    >{`${i + 1}. ${t(`running:kinds.${iv.kind}`)}`}</Text>
                    <Text style={styles.flex}>
                      {`${formatMinSec(iv.plannedDurationSeconds)} ${speed(iv.plannedSpeedKmh)} → ${
                        iv.status === 'skipped'
                          ? t('execution:complete.skipped')
                          : `${formatMinSec(iv.actualDurationSeconds ?? 0)} ${speed(iv.actualSpeedKmh ?? iv.plannedSpeedKmh)}`
                      }`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      <SectionHeader title={t('history.detail.notes')} />
      <Card style={styles.gap}>
        {x.notes ? <Text>{x.notes}</Text> : null}
        <Button
          size="sm"
          variant="ghost"
          icon="edit"
          label={t('history.detail.editNotes')}
          onPress={() => setNotes(true)}
        />
      </Card>
      <Button
        size="lg"
        variant="danger"
        label={t('history.detail.delete')}
        fullWidth
        onPress={() => setConfirm(1)}
        testID="history-delete"
      />

      <EditSetSheet
        key={editing?.id ?? 'none'}
        set={editing}
        tracking={
          state.exercises.find((e) => e.sets.some((s) => s.id === editing?.id))?.tracking ??
          'weight_reps'
        }
        onClose={() => setEditing(null)}
        onSave={(v) => editing && correct.mutate({ setId: editing.id, ...v })}
      />
      <NoteSheet
        key={`n-${notes}`}
        visible={notes}
        title={t('history.detail.editNotes')}
        initial={x.notes ?? ''}
        onClose={() => setNotes(false)}
        onSave={(v) => saveNotes.mutate(v)}
      />
      <ConfirmDialog
        visible={confirm === 1}
        title={t('history.detail.deleteTitle')}
        message={t('history.detail.deleteBody')}
        confirmLabel={t('history.detail.delete')}
        cancelLabel={t('common:cancel')}
        destructive
        onCancel={() => setConfirm(0)}
        onConfirm={() => setConfirm(2)}
      />
      <ConfirmDialog
        visible={confirm === 2}
        title={t('execution:exit.discardAgainTitle')}
        message={t('history.detail.deleteAgain')}
        confirmLabel={t('history.detail.delete')}
        cancelLabel={t('common:cancel')}
        destructive
        onCancel={() => setConfirm(0)}
        onConfirm={() => {
          setConfirm(0);
          remove.mutate(undefined);
        }}
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  gap: { gap: t.spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.spacing.sm },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, minHeight: 44 },
  setLabel: { width: 90 },
  flex: { flex: 1 },
}));
