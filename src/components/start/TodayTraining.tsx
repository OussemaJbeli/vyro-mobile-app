import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { executionRoute, useStartWorkout } from '@/components/execution/useStartWorkout';
import { activityType, statusKind } from '@/components/planner/activity';
import { formatDay } from '@/components/planner/plannerUtils';
import {
  ActivityIcon,
  Button,
  Card,
  CoverArt,
  IconTile,
  ListRow,
  ProgressBar,
  ScreenContainer,
  SectionHeader,
  Skeleton,
  StatusLabel,
  Text,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import { isPendingSession, type StartSession } from '@/domain/execution';
import { addDaysIso } from '@/domain/scheduling/recurrence';
import { useHistory, useSessionsForRange, useTemplate, useTemplates } from '@/hooks/data';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { makeStyles, useTheme } from '@/theme';
import { withAlpha } from '@/theme/color';
import { type ScheduledSession } from '@/types/domain';

import { PreStartSwapSheet } from './PreStartSwapSheet';
import { useStartState } from './useStartState';

/** Seed recovery template (stable id), used by "Log a light activity" on rest days. */
const RECOVERY_TEMPLATE = 'seed-tpl-recovery';

/**
 * Start tab (step 20, template screen 3): today's activities in order, the next one as
 * the hero, rest/empty states and quick start. The day becomes a guided flow.
 */
export function TodayTraining() {
  const { t } = useTranslation(['execution', 'plan', 'common']);
  const styles = useStyles();
  const { day, sessions, active, state } = useStartState();
  const starter = useStartWorkout();
  const [promoted, setPromoted] = useState<string | null>(null);
  const all = (sessions.data ?? []) as ScheduledSession[];

  const pending = state.activities.filter(isPendingSession);
  const beginId = state.primary?.kind === 'begin' ? state.primary.sessionId : null;
  const heroSession =
    (promoted ? pending.find((s) => s.id === promoted) : undefined) ??
    (beginId ? pending.find((s) => s.id === beginId) : undefined);
  const inProgress = active ? state.activities.find((s) => s.status === 'in_progress') : undefined;
  const others = pending.filter((s) => s.id !== heroSession?.id && s.id !== inProgress?.id);

  if (sessions.isLoading) {
    return (
      <ScreenContainer edges={['top']}>
        <Skeleton preset="card" />
      </ScreenContainer>
    );
  }

  const total = state.activities.length;
  const hasTraining = total > 0;

  return (
    <ScreenContainer edges={['top']}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header" style={styles.flex}>
          {t('today.title')}
        </Text>
        {hasTraining ? (
          <Text
            variant="bodyStrong"
            tone="muted"
            accessibilityLabel={t('today.progressA11y', { done: state.done, total })}
            testID="today-progress"
          >
            {t('today.progress', { done: state.done, total })}
          </Text>
        ) : null}
      </View>
      {hasTraining ? <ProgressBar value={total ? state.done / total : 0} /> : null}

      {hasTraining ? (
        <Card style={styles.list}>
          {state.activities.map((s, i) => {
            const isHero = s.id === heroSession?.id && !active;
            const canPromote = isPendingSession(s) && !active && !isHero;
            const done = s.status === 'completed' || s.status === 'modified';
            return (
              <Animated.View key={`${s.id}-${s.status}`} entering={FadeIn.duration(250)}>
                <Pressable
                  onPress={canPromote ? () => setPromoted(s.id) : undefined}
                  disabled={!canPromote}
                  accessibilityRole={canPromote ? 'button' : undefined}
                  style={[styles.activity, i > 0 && styles.divider]}
                  testID={`today-${s.id}`}
                >
                  <ActivityIcon
                    type={activityType(s.type)}
                    size={34}
                    state={
                      done ? 'done' : isHero || s.status === 'in_progress' ? 'default' : 'muted'
                    }
                  />
                  <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                    {s.title}
                  </Text>
                  <StatusLabel status={statusKind(s.status, isHero)} />
                </Pressable>
              </Animated.View>
            );
          })}
        </Card>
      ) : null}

      {active ? (
        <HeroCard
          session={inProgress}
          title={active.title}
          type={inProgress?.type ?? (active.kind === 'running' ? 'running' : 'gym')}
          templateId={inProgress?.templateId ?? null}
          cta={t('today.continue')}
          detail={
            active.kind === 'running'
              ? active.current
                ? t('today.continueInterval', {
                    current: active.current.index + 1,
                    total: active.intervals.length,
                  })
                : null
              : active.cursor
                ? t('today.continueDetail', {
                    current: active.cursor.set + 1,
                    total: active.exercises[active.cursor.exercise]?.sets.length ?? 0,
                  })
                : null
          }
          onPress={() => router.push(executionRoute(active))}
        />
      ) : heroSession ? (
        <HeroCard
          key={heroSession.id}
          session={heroSession}
          title={heroSession.title}
          type={heroSession.type}
          templateId={heroSession.templateId}
          cta={heroSession.type === 'running' ? t('today.startRun') : t('today.startWorkout')}
          detail={null}
          busy={starter.busy}
          onPress={(swaps) =>
            void starter.start(
              {
                templateId: heroSession.templateId,
                scheduledSessionId: heroSession.id,
                title: heroSession.title,
                type: heroSession.type,
              },
              swaps,
            )
          }
        />
      ) : state.fab === 'done' ? (
        <Card style={styles.gap}>
          <IconTile icon="check" tone="accent" size={56} />
          <Text variant="heading">{t('today.doneTitle')}</Text>
          <Text tone="muted">{t('today.doneBody')}</Text>
        </Card>
      ) : state.fab === 'rest' ? (
        <RestCard day={day} onLight={() => void starter.start({ templateId: RECOVERY_TEMPLATE })} />
      ) : (
        <Card style={styles.gap} testID="today-empty">
          <Text variant="heading">{t('today.emptyTitle')}</Text>
          <Text tone="muted">{t('today.emptyBody')}</Text>
          <Button
            size="lg"
            icon="play"
            label={t('today.emptyWorkout')}
            fullWidth
            onPress={() =>
              void starter.start({
                templateId: null,
                title: t('today.emptyWorkoutTitle'),
                type: 'gym',
              })
            }
            testID="today-empty-workout"
          />
          <Button
            size="lg"
            variant="secondary"
            icon="plan"
            label={t('today.planSomething')}
            fullWidth
            onPress={() => router.push(routes.sessionNew)}
          />
        </Card>
      )}

      {others.length ? (
        <>
          <SectionHeader title={t('today.nextUp')} />
          <Card>
            {others.map((s) => (
              <NextRow
                key={s.id}
                session={s}
                onPress={() => (active ? undefined : setPromoted(s.id))}
              />
            ))}
          </Card>
        </>
      ) : null}

      <QuickStart onStart={(templateId) => void starter.start({ templateId })} all={all} />
      {starter.element}
    </ScreenContainer>
  );
}

function HeroCard({
  session,
  title,
  type,
  templateId,
  cta,
  detail,
  busy,
  onPress,
}: {
  session: StartSession | undefined;
  title: string;
  type: ScheduledSession['type'];
  templateId: string | null;
  cta: string;
  detail: string | null;
  busy?: boolean;
  onPress: (swaps?: Parameters<ReturnType<typeof useStartWorkout>['start']>[1]) => void;
}) {
  const { t } = useTranslation('execution');
  const styles = useStyles();
  const theme = useTheme();
  const template = useTemplate(templateId ?? undefined);
  const catalog = useExerciseCatalog();
  const [swapOpen, setSwapOpen] = useState(false);
  const tpl = template.data;
  const minutes =
    (session && 'durationMinutes' in session
      ? (session as ScheduledSession).durationMinutes
      : null) ??
    tpl?.durationMinutes ??
    null;
  const unavailable = (tpl?.exercises ?? [])
    .map((e) => e.exerciseId)
    .filter((id, i, a) => a.indexOf(id) === i && catalog.byId.get(id)?.available === false);
  const meta = [
    minutes ? t('today.minutes', { count: minutes }) : null,
    tpl
      ? tpl.type === 'running'
        ? t('today.intervals', { count: tpl.intervals.length })
        : t('today.exercises', { count: tpl.exercises.length })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const coverType = type === 'rest' ? 'rest' : type;

  return (
    <Card variant="accent" style={styles.hero} testID="today-hero">
      {/* Template: the cover fills the top of the card, the workout name sits on the image. */}
      <View style={styles.coverBox}>
        <CoverArt
          type={coverType}
          coverKey={tpl?.coverKey ?? null}
          iconSize={56}
          style={styles.cover}
        />
        <LinearGradient
          colors={['transparent', withAlpha(theme.colors.surface, 0.95)]}
          locations={[0.35, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.coverText}>
          <Text variant="title" numberOfLines={1}>
            {tpl?.name?.replace(/\s*\(.*\)\s*$/, '') ?? title}
          </Text>
          {meta ? <Text>{meta}</Text> : null}
        </View>
      </View>
      <View style={styles.heroBody}>
        {detail ? <Text tone="primary">{detail}</Text> : null}
        {unavailable.length && !detail ? (
          <Button
            size="md"
            variant="ghost"
            icon="error"
            label={`${t('today.unavailable', { count: unavailable.length })} · ${t('today.reviewSwaps')}`}
            onPress={() => setSwapOpen(true)}
            testID="today-swaps"
          />
        ) : null}
        <Button
          size="xl"
          icon="play"
          label={cta}
          fullWidth
          loading={busy ?? false}
          onPress={() => onPress()}
          testID="today-cta"
        />
      </View>
      <PreStartSwapSheet
        visible={swapOpen}
        exerciseIds={unavailable}
        onClose={() => setSwapOpen(false)}
        onStart={(swaps) => {
          setSwapOpen(false);
          onPress(swaps);
        }}
      />
    </Card>
  );
}

function NextRow({ session, onPress }: { session: StartSession; onPress: () => void }) {
  const { t } = useTranslation(['execution', 'plan']);
  const template = useTemplate(session.templateId ?? undefined);
  const minutes =
    (session as ScheduledSession).durationMinutes ?? template.data?.durationMinutes ?? null;
  return (
    <ListRow
      title={session.title}
      subtitle={[
        minutes ? t('today.minutes', { count: minutes }) : null,
        template.data
          ? template.data.name.replace(/\s*\(.*\)\s*$/, '')
          : t(`plan:types.${session.type}`, { defaultValue: session.type }),
      ]
        .filter(Boolean)
        .join(' · ')}
      leading={
        <CoverArt
          type={session.type === 'rest' ? 'rest' : session.type}
          coverKey={template.data?.coverKey ?? null}
          size={48}
        />
      }
      onPress={onPress}
    />
  );
}

function RestCard({ day, onLight }: { day: string; onLight: () => void }) {
  const { t } = useTranslation('execution');
  const styles = useStyles();
  const upcoming = useSessionsForRange(addDaysIso(day, 1), addDaysIso(day, 14));
  const next = (upcoming.data ?? []).find((s) => s.type !== 'rest' && s.status === 'planned');
  return (
    <Card style={styles.gap} testID="today-rest">
      <IconTile icon="rest" tone="accent" size={56} />
      <Text variant="heading">{t('today.restTitle')}</Text>
      <Text tone="muted">{t('today.restBody')}</Text>
      {next ? (
        <Text>
          {t('today.nextActivity', {
            title: next.title,
            date: formatDay(next.scheduledDate, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            }),
          })}
        </Text>
      ) : null}
      <Button
        size="lg"
        variant="secondary"
        icon="plan"
        label={t('today.viewSchedule')}
        fullWidth
        onPress={() => router.push(routes.plan)}
      />
      <Button size="md" variant="ghost" label={t('today.lightActivity')} onPress={onLight} />
    </Card>
  );
}

function QuickStart({
  onStart,
  all,
}: {
  onStart: (templateId: string) => void;
  all: ScheduledSession[];
}) {
  const { t } = useTranslation('execution');
  const templates = useTemplates();
  const history = useHistory();
  const byId = new Map((templates.data ?? []).map((x) => [x.id, x]));
  const recent: string[] = [];
  for (const x of history.data?.pages[0]?.items ?? []) {
    if (x.templateId && byId.has(x.templateId) && !recent.includes(x.templateId))
      recent.push(x.templateId);
  }
  for (const x of templates.data ?? []) {
    if (recent.length >= 3) break;
    if (!recent.includes(x.id) && !all.some((s) => s.templateId === x.id)) recent.push(x.id);
  }
  const picks = recent.slice(0, 3).flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []));
  if (!picks.length) return null;
  return (
    <>
      <SectionHeader title={t('today.quickStart')} />
      <Card>
        {picks.map((x) => (
          <ListRow
            key={x.id}
            title={x.name}
            {...(x.durationMinutes
              ? { subtitle: t('today.minutes', { count: x.durationMinutes }) }
              : {})}
            leading={<CoverArt type={x.type} coverKey={x.coverKey} size={48} />}
            onPress={() => onStart(x.id)}
            testID={`quick-${x.id}`}
          />
        ))}
        <ListRow title={t('today.browse')} onPress={() => router.push(routes.train)} />
      </Card>
    </>
  );
}

const useStyles = makeStyles((t) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  flex: { flex: 1 },
  gap: { gap: t.spacing.sm },
  hero: { padding: 0, gap: 0 },
  coverBox: { height: 190 },
  cover: { width: '100%', height: 190, borderRadius: 0 },
  coverText: {
    position: 'absolute',
    left: t.spacing.lg,
    right: t.spacing.lg,
    bottom: t.spacing.md,
    gap: 2,
  },
  heroBody: { padding: t.spacing.lg, paddingTop: t.spacing.sm, gap: t.spacing.sm },
  list: { paddingVertical: t.spacing.xs },
  activity: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: 56 },
  divider: { borderTopWidth: 1, borderTopColor: t.colors.border },
}));
