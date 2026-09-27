import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { formatDay } from '@/components/planner/plannerUtils';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Header,
  IconButton,
  Input,
  ListRow,
  ScreenContainer,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { periodSummary, type WorkCount } from '@/domain/planner/progress';
import { addDaysIso, weekStart } from '@/domain/scheduling/recurrence';
import { useSessionWork, useSessionsForRange, useTemplate, useTemplates } from '@/hooks/data';
import { useAI } from '@/hooks/useAI';
import { useCoachData } from '@/hooks/useCoach';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { humanError, type AIMethod, type InsightResult } from '@/services/ai';
import { useSetting } from '@/store/settingsStore';
import { makeStyles, useTheme } from '@/theme';
import { greetingKey, today as todayFn } from '@/utils/dates';
import { now } from '@/utils/clock';
import { newId } from '@/utils/id';

import { InsightCard } from './InsightCard';
import { useAIRequest } from './useAIRequest';

type Params = {
  method?: string;
  templateId?: string;
  exerciseId?: string;
  reportId?: string;
};

const ACTIONS: {
  method: AIMethod;
  key: 'week' | 'progress' | 'schedule' | 'adapt' | 'running';
}[] = [
  { method: 'summarizeWeek', key: 'week' },
  { method: 'analyzeProgress', key: 'progress' },
  { method: 'improveSchedule', key: 'schedule' },
  { method: 'adaptWorkout', key: 'adapt' },
  { method: 'analyzeRunning', key: 'running' },
];

/** This week's facts, computed locally (useful offline and with AI off). */
function LocalWeek() {
  const { t } = useTranslation('settings');
  const styles = useStyles();
  const day = todayFn();
  const start = weekStart(day, 1);
  const prev = addDaysIso(start, -7);
  const sessions = useSessionsForRange(prev, addDaysIso(start, 6));
  const work = useSessionWork(prev, addDaysIso(start, 6));
  const map = useMemo(
    () => new Map<string, WorkCount>(Object.entries(work.data ?? {})),
    [work.data],
  );
  const all = sessions.data ?? [];
  const thisWeek = periodSummary(all, map, { from: start, to: addDaysIso(start, 6), today: day });
  const lastWeek = periodSummary(all, map, { from: prev, to: addDaysIso(prev, 6), today: day });
  const planned = all.filter(
    (s) => s.scheduledDate >= start && s.type !== 'rest' && s.status !== 'cancelled',
  ).length;
  const trend =
    thisWeek.progress === null || lastWeek.progress === null
      ? null
      : thisWeek.progress - lastWeek.progress;
  return (
    <Card style={styles.card} testID="coach-local">
      <Text variant="overline" tone="muted">
        {t('ai.coach.thisWeek')}
      </Text>
      <Text variant="heading">
        {t('ai.coach.completed', { done: thisWeek.sessionsDone, total: planned })}
      </Text>
      {thisWeek.progress !== null ? (
        <Text tone="muted">
          {t('ai.coach.completion', { pct: Math.round(thisWeek.progress * 100) })}
          {trend !== null && Math.abs(trend) >= 0.05
            ? ` · ${t(trend > 0 ? 'ai.coach.up' : 'ai.coach.down')}`
            : ''}
        </Text>
      ) : null}
    </Card>
  );
}

/**
 * AI Coach (step 32, UI §28): local week facts, report actions, recent reports and a chat
 * thread. Reached from Home "Ask your coach", contextual ✨ buttons, or Settings — not a tab.
 */
export function CoachScreen({ params }: { params: Params }) {
  const { t } = useTranslation('settings');
  const styles = useStyles();
  const theme = useTheme();
  const ai = useAI();
  const enabled = useSetting('ai.enabled');
  const request = useAIRequest();
  const [threadId, setThreadId] = useState<string | null>(null);
  const data = useCoachData(threadId);
  const catalog = useExerciseCatalog();
  const templates = useTemplates();
  const [adaptFor, setAdaptFor] = useState<string | null>(params.templateId ?? null);
  const [adapting, setAdapting] = useState(params.method === 'adaptWorkout');
  const [constraints, setConstraints] = useState('');
  const template = useTemplate(adaptFor ?? undefined);
  const [opened, setOpened] = useState<InsightResult | null>(null);
  const [question, setQuestion] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const autoRan = useRef(false);

  // Exercises the user can do (their equipment) — the only ids the AI may suggest.
  const candidates = (category?: string) =>
    catalog.items
      .filter((x) => x.available && (!category || x.category === category))
      .map((x) => ({ id: x.id, name: x.label }));
  const equipmentNames = [
    ...new Set(
      catalog.items.filter((x) => x.available).flatMap((x) => x.equipment.map((e) => e.name)),
    ),
  ];

  const runAdapt = () => {
    const tpl = template.data;
    if (!tpl) return;
    const categories = new Set(
      tpl.exercises.map((e) => catalog.byId.get(e.exerciseId)?.category).filter(Boolean),
    );
    void request.start('adaptWorkout', {
      extra: {
        workout: {
          templateId: tpl.id,
          name: tpl.name,
          exercises: tpl.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            exercise: catalog.byId.get(e.exerciseId)?.label ?? '',
            sets: e.sets,
            reps: e.targetReps,
          })),
        },
        constraints,
        equipment: equipmentNames,
        candidates: candidates().filter((c) => categories.has(catalog.byId.get(c.id)?.category)),
      },
    });
  };

  // Contextual entry points open the Coach with a method: run it once (payload preview
  // and consent still apply). "Adapt" waits for the user's constraint first.
  useEffect(() => {
    if (autoRan.current || !enabled || catalog.isLoading) return;
    const m = params.method as AIMethod | undefined;
    if (!m || m === 'adaptWorkout') return;
    autoRan.current = true;
    if (m === 'suggestAlternative' && params.exerciseId) {
      const ex = catalog.byId.get(params.exerciseId);
      void request.start('suggestAlternative', {
        extra: {
          exercise: {
            name: ex?.label ?? '',
            muscles: [ex?.primaryMuscle, ...(ex?.secondaryMuscles ?? [])].filter(
              (x): x is string => !!x,
            ),
          },
          equipment: equipmentNames,
          candidates: candidates(ex?.category).filter((c) => c.id !== params.exerciseId),
        },
      });
    } else {
      void request.start(m);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when data is ready
  }, [enabled, catalog.isLoading]);

  useEffect(() => {
    if (!params.reportId) return;
    let alive = true;
    void ai.report(params.reportId).then((r) => alive && setOpened(r));
    return () => {
      alive = false;
    };
  }, [ai, params.reportId]);

  const send = async () => {
    const text = question.trim();
    if (!text) return;
    const id = threadId ?? newId();
    setThreadId(id);
    setQuestion('');
    setChatBusy(true);
    setChatError(null);
    const r = await ai.chat(id, text);
    setChatBusy(false);
    if (!r.ok) setChatError(humanError(r.error));
    void data.refresh();
  };

  const shown = request.state.status === 'done' ? request.state.result : opened;
  const busy = request.state.status === 'preparing' || request.state.status === 'sending';

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('ai.coach.title')} onBack={() => goBack(routes.home)} />
      <Text variant="heading">{t(`ai.coach.${greetingKey(now())}`)} 👋</Text>
      <LocalWeek />

      {!enabled ? (
        <EmptyState
          icon="ai"
          title={t('ai.coach.offTitle')}
          body={t('ai.enableHint')}
          actionLabel={t('ai.title')}
          onAction={() => router.push('/settings/ai')}
        />
      ) : (
        <>
          <SectionHeader title={t('ai.coach.ask')} />
          <View style={styles.chips}>
            {ACTIONS.map((a) => (
              <Chip
                key={a.method}
                label={t(`ai.coach.actions.${a.key}`)}
                selected={a.method === 'adaptWorkout' && adapting}
                onPress={() => {
                  setOpened(null);
                  if (a.method === 'adaptWorkout') setAdapting(true);
                  else {
                    setAdapting(false);
                    void request.start(a.method);
                  }
                }}
              />
            ))}
          </View>

          {adapting ? (
            <Card style={styles.card}>
              <Text variant="bodyStrong">{t('ai.coach.adaptTitle')}</Text>
              <View style={styles.chips}>
                {(templates.data ?? [])
                  .filter((x) => x.type !== 'running' && !x.archivedAt)
                  .map((x) => (
                    <Chip
                      key={x.id}
                      label={x.name}
                      selected={adaptFor === x.id}
                      onPress={() => setAdaptFor(x.id)}
                    />
                  ))}
              </View>
              <Input
                value={constraints}
                onChangeText={setConstraints}
                placeholder={t('ai.coach.adaptHint')}
                maxLength={300}
              />
              <Button
                label={t('ai.coach.adaptRun')}
                icon="ai"
                disabled={!adaptFor || !template.data || busy}
                onPress={runAdapt}
              />
            </Card>
          ) : null}

          {busy ? (
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text tone="muted" style={styles.flex}>
                  {request.state.status === 'sending'
                    ? t('ai.sending', { provider: request.state.provider })
                    : t('ai.preparing')}
                </Text>
                {request.state.status === 'sending' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    label={t('ai.cancel')}
                    onPress={request.cancel}
                  />
                ) : null}
              </View>
              <Skeleton preset="card" />
            </Card>
          ) : null}
          {request.state.status === 'error' ? (
            <Text tone="danger">{request.state.message}</Text>
          ) : null}
          {shown ? (
            <InsightCard
              result={shown}
              {...(request.state.status === 'done' ? { onRefresh: request.refresh } : {})}
              onChanged={() => void data.refresh()}
            />
          ) : null}

          {(data.reports.data ?? []).length ? (
            <>
              <SectionHeader title={t('ai.coach.recent')} />
              <Card>
                {(data.reports.data ?? []).map((r) => (
                  <ListRow
                    key={r.id}
                    title={t(`ai.coach.kinds.${r.kind}`, { defaultValue: r.kind })}
                    subtitle={[
                      formatDay(r.createdAt.slice(0, 10), { day: 'numeric', month: 'short' }),
                      r.applied ? t('ai.coach.applied', { count: r.applied }) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    onPress={() => {
                      void ai.report(r.id).then((x) => setOpened(x));
                    }}
                  />
                ))}
              </Card>
            </>
          ) : null}

          <SectionHeader title={t('ai.coach.chat')} />
          <Card style={styles.card}>
            {(data.messages.data ?? []).map((m, i) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  m.role === 'user'
                    ? [styles.mine, { backgroundColor: theme.colors.primarySoft }]
                    : styles.theirs,
                ]}
              >
                <Text>{m.content}</Text>
              </View>
            ))}
            {chatBusy ? <Text tone="muted">{t('ai.coach.thinking')}</Text> : null}
            {chatError ? <Text tone="danger">{chatError}</Text> : null}
            <View style={styles.row}>
              <View style={styles.flex}>
                <Input
                  value={question}
                  onChangeText={setQuestion}
                  placeholder={t('ai.coach.askPlaceholder')}
                  maxLength={1000}
                  onSubmitEditing={() => void send()}
                  testID="coach-input"
                />
              </View>
              <IconButton
                icon="forward"
                accessibilityLabel={t('ai.coach.send')}
                disabled={!question.trim() || chatBusy}
                onPress={() => void send()}
                testID="coach-send"
              />
            </View>
            {threadId ? (
              <Button
                size="sm"
                variant="ghost"
                label={t('ai.coach.newChat')}
                onPress={() => setThreadId(null)}
              />
            ) : null}
          </Card>

          {(data.threads.data ?? []).length ? (
            <Card>
              {(data.threads.data ?? []).map((th) => (
                <ListRow
                  key={th.threadId}
                  title={th.last}
                  subtitle={formatDay(th.at.slice(0, 10), { day: 'numeric', month: 'short' })}
                  onPress={() => setThreadId(th.threadId)}
                  trailing={
                    <IconButton
                      icon="delete"
                      variant="plain"
                      size={36}
                      accessibilityLabel={t('ai.coach.deleteChat')}
                      onPress={() => {
                        void ai.deleteThread(th.threadId).then(() => {
                          if (threadId === th.threadId) setThreadId(null);
                          void data.refresh();
                        });
                      }}
                    />
                  }
                />
              ))}
            </Card>
          ) : null}
        </>
      )}
      {request.element}
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: t.spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  flex: { flex: 1 },
  bubble: { padding: t.spacing.md, borderRadius: t.radius.lg, maxWidth: '88%' },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start', backgroundColor: t.colors.surfaceRaised },
}));
