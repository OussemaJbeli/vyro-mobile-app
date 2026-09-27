import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { routes } from '@/constants/routes';
import { useStartWorkout } from '@/components/execution/useStartWorkout';
import { BottomSheet, Button, Card, ConfirmDialog, ListRow, Text } from '@/components/ui';
import { detectConflicts, nextFreeDay, type Conflict } from '@/domain/scheduling/conflicts';
import { addDaysIso } from '@/domain/scheduling/recurrence';
import {
  invalidates,
  useProfile,
  useRepoMutation,
  useSessionsForDate,
  useSessionsForRange,
} from '@/hooks/data';
import { toast } from '@/store/uiStore';
import { makeStyles, useTheme } from '@/theme';
import { type ScheduledSession } from '@/types/domain';
import { today as todayFn } from '@/utils/dates';

import { DatePickerSheet, TimeField } from './Pickers';
import { formatDay } from './plannerUtils';

type MoveMode = 'move' | 'duplicate';

/**
 * Session actions (step 16): start, move (with conflict preview), quick reschedule,
 * duplicate, skip, cancel, restore, delete, stop a repeating plan. Returns `open(session)`
 * and the sheets to render.
 */
export function useSessionActions() {
  const { t } = useTranslation(['plan', 'common']);
  const starter = useStartWorkout();
  const theme = useTheme();
  const styles = useStyles();
  const today = todayFn();
  const weekStartsOn = useProfile().data?.weekStartsOn === 0 ? 0 : 1;
  const [session, setSession] = useState<ScheduledSession | null>(null);
  const [move, setMove] = useState<{ mode: MoveMode; date: string; time: string | null } | null>(
    null,
  );
  const [picking, setPicking] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'stopRule' | null>(null);
  const targetDay = useSessionsForDate(move?.date ?? today);
  const upcoming = useSessionsForRange(
    session?.scheduledDate ?? today,
    addDaysIso(session?.scheduledDate ?? today, 14),
  );

  const fmt = (d: string) => formatDay(d, { weekday: 'short', day: 'numeric', month: 'short' });
  const done = (message: string) => toast.success(message);

  const moveM = useRepoMutation(
    (r, v: { id: string; date: string; time: string | null }) =>
      r.schedule.move(v.id, v.date, v.time),
    {
      invalidate: invalidates.schedule,
      onSuccess: (_, v) => done(t('toast.moved', { date: fmt(v.date) })),
    },
  );
  const duplicateM = useRepoMutation(
    async (r, v: { id: string; date: string; time: string | null }) => {
      const copy = await r.schedule.duplicate(v.id, v.date);
      if (v.time !== copy.startTime) await r.schedule.move(copy.id, v.date, v.time);
      return copy;
    },
    {
      invalidate: invalidates.schedule,
      onSuccess: (_, v) => done(t('toast.duplicated', { date: fmt(v.date) })),
    },
  );
  const statusM = useRepoMutation(
    (r, v: { id: string; action: 'skip' | 'cancel' | 'restore' }) =>
      v.action === 'skip'
        ? r.schedule.skip(v.id)
        : v.action === 'cancel'
          ? r.schedule.cancel(v.id)
          : r.schedule.setStatus(v.id, 'planned'),
    {
      invalidate: invalidates.schedule,
      onSuccess: (_, v) =>
        done(
          t(
            v.action === 'skip'
              ? 'toast.skipped'
              : v.action === 'cancel'
                ? 'toast.cancelled'
                : 'toast.restored',
          ),
        ),
    },
  );
  const deleteM = useRepoMutation((r, id: string) => r.schedule.softDelete(id), {
    invalidate: invalidates.schedule,
    onSuccess: () => done(t('toast.deleted')),
  });
  const stopRuleM = useRepoMutation(
    (r, v: { ruleId: string; from: string }) => r.schedule.deleteRule(v.ruleId, v.from, today),
    {
      invalidate: invalidates.schedule,
      onSuccess: (_, v) => done(t('toast.ruleStopped', { date: fmt(v.from) })),
    },
  );

  const close = () => setSession(null);
  const startMove = (mode: MoveMode, date: string) =>
    session && setMove({ mode, date, time: session.startTime });

  const conflicts: Conflict[] =
    session && move
      ? detectConflicts(
          {
            ...session,
            id: move.mode === 'move' ? session.id : 'new',
            scheduledDate: move.date,
            startTime: move.time,
          },
          (targetDay.data ?? []).filter((s) => move.mode === 'duplicate' || s.id !== session.id),
        )
      : [];

  const conflictText = (c: Conflict) =>
    c.kind === 'time_overlap'
      ? t('move.time_overlap', { title: c.with.title, time: c.with.startTime ?? '' })
      : c.kind === 'same_type_same_day'
        ? t('move.same_type_same_day', { title: c.with.title })
        : c.kind === 'rest_day'
          ? t('move.rest_day')
          : t('move.heavy_day', { sessions: c.sessions, minutes: c.minutes });

  const past = session ? session.scheduledDate < today : false;
  const inactive = session ? session.status === 'skipped' || session.status === 'cancelled' : false;
  const finished = session
    ? session.status === 'completed' || session.status === 'modified'
    : false;
  const isRest = session?.type === 'rest';

  const run = (fn: () => void) => () => {
    fn();
    close();
  };

  const element = (
    <>
      <BottomSheet
        visible={session !== null && move === null}
        onClose={close}
        title={session ? session.title : t('actions.title')}
      >
        {session ? (
          <View style={styles.sheet}>
            {!isRest && !inactive && !finished && session.scheduledDate === today ? (
              <ListRow
                title={t('actions.start')}
                onPress={run(
                  () =>
                    void starter.start({
                      templateId: session.templateId,
                      scheduledSessionId: session.id,
                      title: session.title,
                      type: session.type,
                    }),
                )}
                showChevron={false}
              />
            ) : null}
            {!finished ? (
              <>
                <ListRow
                  title={t('actions.move')}
                  onPress={() => startMove('move', session.scheduledDate)}
                  showChevron={false}
                  testID="action-move"
                />
                <View style={styles.quick}>
                  <Button
                    label={t('actions.tomorrow')}
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      startMove('move', addDaysIso(past ? today : session.scheduledDate, 1))
                    }
                    testID="action-tomorrow"
                  />
                  <Button
                    label={t('actions.nextFree')}
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      const free = nextFreeDay(
                        past ? today : session.scheduledDate,
                        upcoming.data ?? [],
                      );
                      if (free) startMove('move', free);
                      else toast.info(t('toast.noFreeDay'));
                    }}
                  />
                </View>
              </>
            ) : null}
            <ListRow
              title={t('actions.duplicate')}
              onPress={() => startMove('duplicate', addDaysIso(session.scheduledDate, 1))}
              showChevron={false}
            />
            {!isRest && !inactive && !finished ? (
              <ListRow
                title={t('actions.skip')}
                onPress={run(() => statusM.mutate({ id: session.id, action: 'skip' }))}
                showChevron={false}
                testID="action-skip"
              />
            ) : null}
            {!isRest && !finished && past ? (
              <ListRow
                title={t('actions.complete')}
                onPress={run(() => router.push(routes.logSession(session.id)))}
                showChevron={false}
              />
            ) : null}
            {inactive ? (
              <ListRow
                title={t('actions.restore')}
                onPress={run(() => statusM.mutate({ id: session.id, action: 'restore' }))}
                showChevron={false}
              />
            ) : null}
            <ListRow
              title={t('actions.edit')}
              onPress={run(() =>
                router.push({ pathname: '/session/[id]', params: { id: session.id } }),
              )}
              showChevron={false}
            />
            {!inactive && !finished ? (
              <ListRow
                title={t('actions.cancel')}
                onPress={run(() => statusM.mutate({ id: session.id, action: 'cancel' }))}
                showChevron={false}
              />
            ) : null}
            {session.ruleId ? (
              <ListRow
                title={t('actions.stopRule')}
                onPress={() => setConfirm('stopRule')}
                showChevron={false}
              />
            ) : !finished ? (
              <ListRow
                title={t('actions.delete')}
                onPress={() => setConfirm('delete')}
                showChevron={false}
              />
            ) : null}
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={move !== null}
        onClose={() => setMove(null)}
        title={move?.mode === 'duplicate' ? t('move.duplicateTitle') : t('move.title')}
      >
        {move && session ? (
          <View style={styles.sheet}>
            <ListRow
              title={t('move.date')}
              subtitle={fmt(move.date)}
              onPress={() => setPicking(true)}
              testID="move-date"
            />
            {!isRest ? (
              <TimeField value={move.time} onChange={(time) => setMove({ ...move, time })} />
            ) : null}
            {conflicts.length ? (
              <Card
                style={[styles.warn, { borderColor: theme.colors.warning }]}
                testID="move-conflicts"
              >
                <Text variant="bodyStrong" style={{ color: theme.colors.warning }}>
                  ⚠ {t('move.conflicts')}
                </Text>
                {conflicts.map((c, i) => (
                  <Text key={i} variant="caption">
                    {conflictText(c)}
                  </Text>
                ))}
              </Card>
            ) : null}
            <Button
              label={
                move.mode === 'duplicate'
                  ? t('move.confirmDuplicate')
                  : conflicts.length
                    ? t('move.confirmAnyway')
                    : t('move.confirm')
              }
              fullWidth
              onPress={() => {
                const v = { id: session.id, date: move.date, time: isRest ? null : move.time };
                if (move.mode === 'move') moveM.mutate(v);
                else duplicateM.mutate(v);
                setMove(null);
                close();
              }}
              testID="move-confirm"
            />
          </View>
        ) : null}
      </BottomSheet>

      {move ? (
        <DatePickerSheet
          visible={picking}
          value={move.date}
          today={today}
          weekStartsOn={weekStartsOn}
          onPick={(date) => setMove({ ...move, date })}
          onClose={() => setPicking(false)}
        />
      ) : null}

      <ConfirmDialog
        visible={confirm !== null}
        title={
          confirm === 'stopRule' && session
            ? t('confirmStop', { date: fmt(session.scheduledDate) })
            : t('confirmDelete')
        }
        confirmLabel={confirm === 'stopRule' ? t('actions.stopRule') : t('actions.delete')}
        cancelLabel={t('common:cancel')}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (session && confirm === 'delete') deleteM.mutate(session.id);
          if (session?.ruleId && confirm === 'stopRule')
            stopRuleM.mutate({ ruleId: session.ruleId, from: session.scheduledDate });
          setConfirm(null);
          close();
        }}
      />
      {starter.element}
    </>
  );

  return { open: setSession, element };
}

const useStyles = makeStyles((t) => ({
  sheet: { gap: t.spacing.xs, paddingBottom: t.spacing.md },
  quick: { flexDirection: 'row', gap: t.spacing.sm, paddingBottom: t.spacing.sm },
  warn: { gap: t.spacing.xs, borderWidth: 1 },
}));
