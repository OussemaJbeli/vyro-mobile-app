import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoachEntry } from '@/components/ai/CoachEntry';
import { MonthGrid, WeekStrip } from '@/components/planner/Calendar';
import { DayScore, PeriodSummaryCard } from '@/components/planner/DayScore';
import { formatDay, markersByDay } from '@/components/planner/plannerUtils';
import { PlanTimedRow, PlanUpcomingRow } from '@/components/planner/PlanRows';
import { useSessionActions } from '@/components/planner/useSessionActions';
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  SegmentedControl,
  Skeleton,
  Text,
} from '@/components/ui';
import {
  dayProgress,
  periodSummary,
  rating,
  sessionProgress,
  type Rating,
  type WorkCount,
} from '@/domain/planner/progress';
import { addDaysIso } from '@/domain/scheduling/recurrence';
import { useProfile, useSessionWork, useSessionsForRange, useTemplates } from '@/hooks/data';
import { usePlannerStore } from '@/store/plannerStore';
import { makeStyles } from '@/theme';
import { type ScheduledSession } from '@/types/domain';
import { addMonthsLocal, asLocalDate, monthGrid, today as todayFn, weekDays } from '@/utils/dates';

/**
 * Plan (UI §24): Week view (Monday–Sunday, tap a day for its activities and score) and
 * Month view (history with a coloured score per day and the month's status).
 */
export default function PlanScreen() {
  const { t } = useTranslation('plan');
  const { t: tAi } = useTranslation('settings');
  const styles = useStyles();
  const today = todayFn();
  const weekStartsOn = useProfile().data?.weekStartsOn === 0 ? 0 : 1;
  const selected = usePlannerStore((s) => s.selectedDate);
  const view = usePlannerStore((s) => s.view);
  const select = usePlannerStore((s) => s.select);
  const setView = usePlannerStore((s) => s.setView);
  const actions = useSessionActions();
  const templates = useTemplates();

  const week = weekDays(asLocalDate(selected), weekStartsOn);
  const grid = monthGrid(asLocalDate(selected), weekStartsOn);
  const rangeStart = view === 'month' ? grid[0]![0]! : week[0]!;
  const gridEnd = view === 'month' ? grid.at(-1)!.at(-1)! : week[6]!;
  const upcomingEnd = addDaysIso(selected, 7);
  const rangeEnd = upcomingEnd > gridEnd ? upcomingEnd : gridEnd;
  const sessions = useSessionsForRange(rangeStart, rangeEnd);
  const workQuery = useSessionWork(rangeStart, gridEnd);

  const all = useMemo(() => sessions.data ?? [], [sessions.data]);
  const markers = useMemo(() => markersByDay(all, today), [all, today]);
  const work = useMemo(
    () => new Map<string, WorkCount>(Object.entries(workQuery.data ?? {})),
    [workQuery.data],
  );
  // Coloured score per past day (today included): excellent / good / bad.
  const scores = useMemo(() => {
    const byDay = new Map<string, typeof all>();
    for (const s of all) {
      if (s.scheduledDate > today) continue;
      byDay.set(s.scheduledDate, [...(byDay.get(s.scheduledDate) ?? []), s]);
    }
    const out = new Map<string, Rating>();
    for (const [d, list] of byDay) {
      const p = dayProgress(list, work);
      if (p !== null) out.set(d, rating(p));
    }
    return out;
  }, [all, work, today]);
  const dayList = all.filter((s) => s.scheduledDate === selected && s.status !== 'cancelled');
  const upcoming = all.filter(
    (s) => s.scheduledDate > selected && s.scheduledDate <= upcomingEnd && s.status !== 'cancelled',
  );
  const isRestDay = dayList.length > 0 && dayList.every((s) => s.type === 'rest');
  const dayScore = dayProgress(dayList, work);
  const counted = dayList.filter((s) => s.type !== 'rest').length;
  const month = selected.slice(0, 7);
  const monthSummary = periodSummary(all, work, {
    from: `${month}-01`,
    to: `${month}-31`,
    today,
  });

  const shift = (dir: -1 | 1) =>
    select(
      view === 'month' ? addMonthsLocal(asLocalDate(selected), dir) : addDaysIso(selected, dir * 7),
    );

  const tplById = new Map((templates.data ?? []).map((x) => [x.id, x]));
  const tplOf = (s: ScheduledSession) => (s.templateId ? tplById.get(s.templateId) : undefined);
  const monthOpen = view === 'month';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title" accessibilityRole="header" style={styles.title}>
          {t('title')}
        </Text>
        <SegmentedControl
          segments={[
            { value: 'week', label: t('views.week') },
            { value: 'month', label: t('views.month') },
          ]}
          value={monthOpen ? 'month' : 'week'}
          onChange={(v) => setView(v)}
          testID="plan-view"
        />
        <View style={styles.monthRow}>
          <Text variant="heading" style={styles.flex}>
            {monthOpen
              ? formatDay(selected, { month: 'long', year: 'numeric' })
              : `${formatDay(week[0]!, { day: 'numeric', month: 'short' })} – ${formatDay(week[6]!, { day: 'numeric', month: 'short' })}`}
          </Text>
          {selected !== today ? (
            <Button label={t('goToday')} size="sm" variant="ghost" onPress={() => select(today)} />
          ) : null}
          <IconButton
            icon="back"
            variant="plain"
            size={36}
            accessibilityLabel={t('prev')}
            onPress={() => shift(-1)}
            testID="plan-prev"
          />
          <IconButton
            icon="forward"
            variant="plain"
            size={36}
            accessibilityLabel={t('next')}
            onPress={() => shift(1)}
            testID="plan-next"
          />
        </View>
        {monthOpen ? (
          <Card>
            <MonthGrid
              weeks={grid}
              month={selected.slice(0, 7)}
              title={formatDay(selected, { month: 'long', year: 'numeric' })}
              today={today}
              selected={selected}
              markers={markers}
              scores={scores}
              onSelect={select}
              onPrev={() => shift(-1)}
              onNext={() => shift(1)}
            />
          </Card>
        ) : (
          <WeekStrip
            hideNav
            days={week}
            title=""
            today={today}
            selected={selected}
            markers={markers}
            scores={scores}
            onSelect={select}
            onPrev={() => shift(-1)}
            onNext={() => shift(1)}
          />
        )}

        {monthOpen ? (
          <Card>
            <PeriodSummaryCard
              title={t('score.month', { month: formatDay(selected, { month: 'long' }) })}
              summary={monthSummary}
            />
          </Card>
        ) : null}

        <CoachEntry method="improveSchedule" label={tAi('ai.coach.actions.schedule')} />
        <Card style={styles.gap} testID="plan-day">
          <View>
            <Text variant="heading">
              {selected === today ? t('today') : formatDay(selected, { weekday: 'long' })}
            </Text>
            <Text tone="muted">
              {formatDay(selected, { weekday: 'long', day: 'numeric', month: 'short' })}
            </Text>
          </View>
          <DayScore progress={dayScore} future={selected > today} count={counted} />
          {sessions.isLoading ? (
            <Skeleton preset="card" />
          ) : dayList.length === 0 ? (
            <EmptyState icon="plan" title={t('nothing')} body={t('nothingBody')} />
          ) : (
            dayList.map((s) => (
              <PlanTimedRow
                key={s.id}
                session={s}
                tpl={tplOf(s)}
                progress={selected > today ? null : sessionProgress(s, work.get(s.id))}
                past={selected <= today}
                onPress={() => actions.open(s)}
              />
            ))
          )}
          {isRestDay ? <Text tone="muted">☕ {t('restDay')}</Text> : null}
        </Card>

        {monthOpen ? null : (
          <Card style={styles.gap} testID="plan-upcoming">
            <Text variant="heading">{t('upcoming')}</Text>
            {upcoming.length === 0 ? <Text tone="muted">{t('nothing')}</Text> : null}
            {upcoming.map((s) => (
              <PlanUpcomingRow
                key={s.id}
                session={s}
                tpl={tplOf(s)}
                date={[
                  formatDay(s.scheduledDate, { weekday: 'short' }),
                  formatDay(s.scheduledDate, { day: 'numeric' }),
                  formatDay(s.scheduledDate, { month: 'short' }),
                ].join(' ')}
                onPress={() => actions.open(s)}
              />
            ))}
          </Card>
        )}
      </ScrollView>
      <View style={[styles.footer, styles.footerRow]}>
        <Button
          label={t('cycle.edit')}
          icon="repeat"
          size="lg"
          variant="secondary"
          onPress={() => router.push('/cycle')}
          testID="plan-edit-cycle"
        />
        <View style={styles.flex}>
          <Button
            label={t('addActivity')}
            icon="add"
            size="lg"
            fullWidth
            onPress={() => router.push({ pathname: '/session/new', params: { date: selected } })}
            testID="plan-add"
          />
        </View>
      </View>
      {actions.element}
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.bg },
  content: { paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.xxl, gap: t.spacing.md },
  footerRow: { flexDirection: 'row', gap: t.spacing.sm },
  footer: {
    paddingHorizontal: t.spacing.lg,
    paddingBottom: t.spacing.xxxl,
    paddingTop: t.spacing.sm,
  },
  title: { paddingTop: t.spacing.sm },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
  flex: { flex: 1 },
  gap: { gap: t.spacing.sm },
}));
