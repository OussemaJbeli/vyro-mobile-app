import { router } from 'expo-router';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { executionRoute, useStartWorkout } from '@/components/execution/useStartWorkout';
import { statusKind } from '@/components/planner/activity';
import { formatDay } from '@/components/planner/plannerUtils';
import { SessionVisual } from '@/components/planner/SessionVisual';
import { QuickWeightSheet } from '@/components/body/QuickWeightSheet';
import { arrowFor } from '@/components/body/TrendBadge';
import { useWeightTrend } from '@/components/body/useWeightTrend';
import { useStartState } from '@/components/start/useStartState';
import {
  ActionTile,
  ActivityIcon,
  BottomSheet,
  Button,
  Card,
  IconTile,
  ListRow,
  ProgressBar,
  SectionHeader,
  Skeleton,
  Icon,
  StatusLabel,
  Text,
} from '@/components/ui';
import { featureFlags } from '@/constants/featureFlags';
import { routes } from '@/constants/routes';
import { isDoneSession } from '@/domain/execution';
import { weekSummary } from '@/domain/progress/weekly';
import { addDaysIso, weekStart } from '@/domain/scheduling/recurrence';
import {
  useCompletedBetween,
  useProfile,
  useSessionsForRange,
  useTemplates,
  useUnitPrefs,
} from '@/hooks/data';
import { makeStyles, useTheme } from '@/theme';
import { withAlpha } from '@/theme/color';
import { formatDuration, toLocalDate, today } from '@/utils/dates';
import { formatQuantity } from '@/utils/units';

/** Today card (UI §3–§6): training list + progress, rest, empty or complete. */
export const TodayStatusCard = memo(function TodayStatusCard() {
  const { t } = useTranslation(['home', 'execution']);
  const styles = useStyles();
  const theme = useTheme();
  const { day, sessions, state } = useStartState();
  const done = useCompletedBetween(day, day);
  const starter = useStartWorkout();
  const templates = useTemplates();
  const tplById = new Map((templates.data ?? []).map((x) => [x.id, x]));
  if (sessions.isLoading) return <Skeleton preset="card" />;

  const total = state.activities.length;
  const complete = total > 0 && state.fab === 'done';
  const nextId = state.primary?.kind === 'begin' ? state.primary.sessionId : null;

  if (total === 0) {
    const rest = state.fab === 'rest';
    return (
      <Card variant="accent" style={styles.gap} testID={rest ? 'home-rest' : 'home-empty'}>
        <IconTile icon={rest ? 'rest' : 'plan'} tone="accent" size={48} />
        <Text variant="heading">{rest ? t('restTitle') : t('emptyTitle')}</Text>
        {rest ? <Text tone="muted">{t('restBody')}</Text> : null}
        <View style={styles.row}>
          <Button
            size="md"
            variant="secondary"
            label={rest ? t('viewSchedule') : t('plan')}
            onPress={() => router.push(rest ? routes.plan : routes.sessionNew)}
          />
          {!rest ? (
            <Button
              size="md"
              label={t('quickStart')}
              icon="play"
              onPress={() => router.push(routes.start)}
            />
          ) : null}
        </View>
        {starter.element}
      </Card>
    );
  }

  const pct = total ? Math.round((state.done / total) * 100) : 0;
  // Template (docs/template/ui.png): intensity word under each activity.
  const intensity = (type: string, difficulty: string | null | undefined) =>
    type === 'gym'
      ? t('intensity.strength')
      : type === 'running'
        ? t('intensity.endurance')
        : difficulty === 'advanced'
          ? t('intensity.hard')
          : difficulty === 'beginner'
            ? t('intensity.easy')
            : t('intensity.moderate');
  return (
    <Card variant="accent" style={styles.today} testID="home-today">
      <View style={styles.todayHead}>
        <Icon name="plan" size={32} color={theme.colors.primary} />
        <View style={styles.flex}>
          <Text variant="title">{complete ? t('allDone') : t('today')}</Text>
          <Text tone="muted">{t('activities', { count: total })}</Text>
        </View>
        <Pressable
          onPress={() => router.push(routes.plan)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.datePill, pressed && styles.pressed]}
        >
          <Text tone="muted">
            {formatDay(day, { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
          <Icon name="forward" size={16} color={theme.colors.textMuted} />
        </Pressable>
      </View>
      <View>
        {state.activities.map((s, i) => {
          const tpl = s.templateId ? tplById.get(s.templateId) : undefined;
          const next = s.id === nextId;
          return (
            <Pressable
              key={s.id}
              onPress={() => router.push(routes.session(s.id))}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.activity,
                i > 0 && styles.divider,
                pressed && styles.pressed,
              ]}
              testID={`home-today-${s.id}`}
            >
              {next ? (
                <View style={[styles.nextBar, { backgroundColor: theme.colors.primary }]} />
              ) : null}
              <SessionVisual type={s.type} coverKey={tpl?.coverKey} size={64} width={96} />
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {s.title}
                </Text>
                <View style={styles.meta}>
                  {tpl?.durationMinutes ? (
                    <View style={styles.metaItem}>
                      <Icon name="clock" size={16} color={theme.colors.textMuted} />
                      <Text variant="caption" tone="muted">
                        {`${tpl.durationMinutes} min`}
                      </Text>
                    </View>
                  ) : null}
                  {s.type !== 'rest' ? (
                    <View style={styles.metaItem}>
                      <Icon name="progress" size={16} color={theme.colors.textMuted} />
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {intensity(s.type, tpl?.difficulty)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <StatusLabel status={statusKind(s.status, next)} pill />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.progress}>
        <Text variant="caption" tone="muted">
          {t('completedShort', { done: state.done, total })}
        </Text>
        <View style={styles.progressRow}>
          <View style={styles.flex}>
            <ProgressBar value={total ? state.done / total : 0} />
          </View>
          <Text variant="caption">{`${pct}%`}</Text>
        </View>
      </View>
      {complete ? (
        <Text tone="muted">
          {t('totalTime', {
            time: formatDuration(
              (done.data ?? []).reduce((acc, x) => acc + (x.activeSeconds ?? 0), 0),
            ),
          })}
        </Text>
      ) : null}
    </Card>
  );
});

/** Shown only while a workout is in progress (UI §12). */
export const ContinueBanner = memo(function ContinueBanner() {
  const { t } = useTranslation(['home', 'execution']);
  const styles = useStyles();
  const { active } = useStartState();
  if (!active) return null;
  const ex = active.cursor ? active.exercises[active.cursor.exercise] : undefined;
  const detail =
    active.kind === 'running'
      ? active.current
        ? t('execution:today.continueInterval', {
            current: active.current.index + 1,
            total: active.intervals.length,
          })
        : null
      : ex && active.cursor
        ? t('execution:today.continueDetail', {
            current: active.cursor.set + 1,
            total: ex.sets.length,
          })
        : null;
  return (
    <Card style={styles.banner} testID="home-continue">
      <View style={styles.flex}>
        <Text variant="bodyStrong">{t('continueTitle', { title: active.title })}</Text>
        {detail ? <Text tone="muted">{detail}</Text> : null}
      </View>
      <Button
        size="lg"
        icon="play"
        label={t('continue')}
        onPress={() => router.push(executionRoute(active))}
      />
    </Card>
  );
});

/** Quick actions (template: Workout · Running · Measure · Photo), square outlined tiles. */
export const QuickActions = memo(function QuickActions() {
  const { t } = useTranslation('home');
  const styles = useStyles();
  const starter = useStartWorkout();
  const [sheet, setSheet] = useState<null | 'workout' | 'running' | 'measure' | 'weight'>(null);
  const go = (fn: () => void) => () => {
    setSheet(null);
    fn();
  };
  return (
    <>
      <SectionHeader
        icon="streak"
        title={t('quickActions')}
        actionLabel={t('seeAll')}
        onAction={() => router.push(routes.train)}
      />
      <View style={styles.actions}>
        <ActionTile
          icon="act_dumbbell"
          label={t('qa.workout')}
          subtitle={t('qa.workoutSub')}
          onPress={() => setSheet('workout')}
          testID="qa-workout"
        />
        <ActionTile
          icon="running"
          label={t('qa.running')}
          subtitle={t('qa.runningSub')}
          onPress={() => setSheet('running')}
          testID="qa-running"
        />
        {featureFlags.measurements || featureFlags.weightLog ? (
          <ActionTile
            icon="measure"
            label={t('qa.measure')}
            subtitle={t('qa.measureSub')}
            onPress={() => setSheet('measure')}
            testID="qa-measure"
          />
        ) : null}
        {featureFlags.photos ? (
          <ActionTile
            icon="photo"
            label={t('qa.photo')}
            subtitle={t('qa.photoSub')}
            onPress={() => router.push(routes.photoCapture)}
            testID="qa-photo"
          />
        ) : null}
      </View>
      <BottomSheet
        visible={sheet === 'workout'}
        onClose={() => setSheet(null)}
        title={t('qa.workout')}
      >
        <ListRow
          title={t('qa.startEmpty')}
          onPress={go(
            () => void starter.start({ templateId: null, title: t('qa.workout'), type: 'gym' }),
          )}
          testID="qa-start-empty"
        />
        <ListRow title={t('qa.fromTemplate')} onPress={go(() => router.push(routes.train))} />
        <ListRow
          title={t('qa.logPast')}
          onPress={go(() => router.push(routes.logNew))}
          testID="qa-log-past"
        />
      </BottomSheet>
      <BottomSheet
        visible={sheet === 'running'}
        onClose={() => setSheet(null)}
        title={t('qa.running')}
      >
        <ListRow title={t('qa.startRun')} onPress={go(() => router.push(routes.train))} />
        <ListRow
          title={t('qa.logRun')}
          onPress={go(() => router.push(routes.logRun))}
          testID="qa-log-run"
        />
      </BottomSheet>
      <BottomSheet
        visible={sheet === 'measure'}
        onClose={() => setSheet(null)}
        title={t('qa.measureTitle')}
      >
        <ListRow title={t('qa.logWeight')} onPress={() => setSheet('weight')} testID="qa-weight" />
        <ListRow title={t('qa.logMeasurements')} onPress={go(() => router.push(routes.measure))} />
      </BottomSheet>
      <QuickWeightSheet visible={sheet === 'weight'} onClose={() => setSheet(null)} />
      {starter.element}
    </>
  );
});

function useWeekRange() {
  const profile = useProfile();
  const day = today();
  const from = weekStart(day, profile.data?.weekStartsOn === 0 ? 0 : 1);
  return { day, from, to: addDaysIso(from, 6) };
}

/** This Week (template): Gym · Runs · Abs counts in rings, total training time. */
export const WeeklySummary = memo(function WeeklySummary() {
  const { t } = useTranslation('home');
  const styles = useStyles();
  const { from, to } = useWeekRange();
  const week = useCompletedBetween(from, to);
  const weekSessions = useSessionsForRange(from, to);
  const s = weekSummary(
    (week.data ?? []).map((x) => ({
      date: toLocalDate(x.startedAt),
      type: x.type,
      activeSeconds: x.activeSeconds,
    })),
    (weekSessions.data ?? []).map((x) => ({
      date: x.scheduledDate,
      type: x.type,
      status: x.status,
    })),
  );
  return (
    <>
      <SectionHeader
        icon="progress"
        title={t('week')}
        actionLabel={t('viewPlan')}
        onAction={() => router.push(routes.plan)}
      />
      <Pressable
        onPress={() => router.push(routes.progress)}
        accessibilityRole="button"
        accessibilityLabel={t('week')}
        style={styles.week}
        testID="home-week"
      >
        <WeekStatCard type="gym" value={String(s.gym)} label={t('weekGym')} />
        <WeekStatCard type="running" value={String(s.runs)} label={t('weekRuns')} />
        <WeekStatCard type="abs" value={String(s.abs)} label={t('weekAbs')} />
        <WeekStatCard type="time" value={formatDuration(s.totalSeconds)} label={t('training')} />
      </Pressable>
    </>
  );
});

/** This Week card: activity-coloured glass gradient, icon tile, big number, label. */
function WeekStatCard({
  type,
  value,
  label,
}: {
  type: 'gym' | 'running' | 'abs' | 'time';
  value: string;
  label: string;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const color = type === 'time' ? theme.colors.primary : theme.colors.activity[type];
  return (
    <View
      style={[styles.weekCard, { borderColor: withAlpha(color, 0.25) }]}
      accessible
      accessibilityLabel={`${value} ${label}`}
    >
      <LinearGradient
        colors={[withAlpha(color, theme.scheme === 'dark' ? 0.12 : 0.1), 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {type === 'time' ? (
        <View style={[styles.weekIcon, { backgroundColor: color }]}>
          <Icon name="timer" size={16} color={theme.colors.onPrimary} />
        </View>
      ) : (
        <ActivityIcon type={type} size={28} />
      )}
      <Text
        variant={type === 'time' ? 'bodyStrong' : 'heading'}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Next non-rest sessions after today. */
export const Upcoming = memo(function Upcoming() {
  const { t } = useTranslation(['home', 'plan']);
  const day = today();
  const range = useSessionsForRange(addDaysIso(day, 1), addDaysIso(day, 14));
  const templates = useTemplates();
  const coverOf = (id: string | null) =>
    id ? (templates.data ?? []).find((x) => x.id === id)?.coverKey : null;
  const next = (range.data ?? [])
    .filter((s) => s.type !== 'rest' && !isDoneSession(s) && s.status === 'planned')
    .slice(0, 2);
  if (!next.length) return null;
  return (
    <>
      <SectionHeader title={t('upcoming')} />
      <Card>
        {next.map((s) => (
          <ListRow
            key={s.id}
            title={s.title}
            subtitle={[
              s.scheduledDate === addDaysIso(day, 1)
                ? t('tomorrow')
                : formatDay(s.scheduledDate, { weekday: 'short', day: 'numeric', month: 'short' }),
              s.durationMinutes ? `${s.durationMinutes} min` : null,
              s.startTime,
            ]
              .filter(Boolean)
              .join(' · ')}
            leading={<SessionVisual type={s.type} coverKey={coverOf(s.templateId)} size={44} />}
            onPress={() => router.push(routes.session(s.id))}
          />
        ))}
      </Card>
    </>
  );
});

/** One small insight line: latest weight and the smoothed weekly trend (step 22). */
export const SmallInsight = memo(function SmallInsight() {
  const { t, i18n } = useTranslation(['home', 'progress']);
  const prefs = useUnitPrefs();
  const trend = useWeightTrend(new Date(`${addDaysIso(today(), -28)}T00:00:00`).toISOString());
  const latest = trend.entries.at(-1);
  if (!latest) return null;
  const fmt = (kg: number) => formatQuantity(kg, 'bodyWeight', prefs, i18n.language);
  const parts = [t('insightWeight', { value: fmt(latest.valueKg) })];
  if (trend.weekly !== null && Math.abs(trend.weekly) >= 0.05) {
    parts.push(
      t('insightTrend', { arrow: arrowFor(trend.weekly), value: fmt(Math.abs(trend.weekly)) }),
    );
  }
  return (
    <Card>
      <ListRow
        title={parts.join(' · ')}
        onPress={() => router.push(routes.weight)}
        testID="home-insight"
      />
    </Card>
  );
});

const useStyles = makeStyles((t) => ({
  gap: { gap: t.spacing.sm },
  row: { flexDirection: 'row', gap: t.spacing.sm, flexWrap: 'wrap' },
  flex: { flex: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    borderColor: t.colors.primary,
    borderWidth: 1,
  },
  today: { gap: t.spacing.md },
  todayHead: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceRaised,
  },
  nextBar: { position: 'absolute', left: -12, top: 12, bottom: 12, width: 4, borderRadius: 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.sm,
    minHeight: 56,
  },
  divider: { borderTopWidth: 1, borderTopColor: t.colors.border },
  pressed: { opacity: 0.8 },
  progress: { gap: t.spacing.xs },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  actions: { flexDirection: 'row', gap: t.spacing.sm },
  week: { flexDirection: 'row', gap: t.spacing.sm },
  weekCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: t.spacing.md,
    paddingHorizontal: 4,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: t.colors.surface,
  },
  weekIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
