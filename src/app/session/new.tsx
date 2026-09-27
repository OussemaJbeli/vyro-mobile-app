import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DatePickerSheet, TimeField } from '@/components/planner/Pickers';
import { formatDay } from '@/components/planner/plannerUtils';
import { useUnsavedGuard } from '@/components/system/useUnsavedGuard';
import {
  Button,
  Card,
  ChipGroup,
  Header,
  Input,
  ListRow,
  NumberStepper,
  OptionCard,
  ScreenContainer,
  SectionHeader,
  Text,
  useActivityIcon,
} from '@/components/ui';
import { useTemplateLabel } from '@/components/workout/templateInfo';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { detectConflicts } from '@/domain/scheduling/conflicts';
import { endDateAfterCount, isoWeekday, type RuleLike } from '@/domain/scheduling/recurrence';
import {
  invalidates,
  useProfile,
  useRepoMutation,
  useSessionsForDate,
  useTemplates,
} from '@/hooks/data';
import { makeStyles, useTheme } from '@/theme';
import { SESSION_TYPES, type SessionType } from '@/types/enums';
import { today as todayFn } from '@/utils/dates';

type Repeat = 'never' | 'daily' | 'weekly' | 'monthly' | 'custom';
type Ends = 'never' | 'onDate' | 'afterCount';
const REMIND = ['none', '5', '15', '30', '60'] as const;
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/** Schedule an activity (UI §25): what, when, repeat, ends, reminder, with conflict preview. */
export default function ScheduleFormScreen() {
  const iconFor = useActivityIcon();
  const params = useLocalSearchParams<{ templateId?: string; date?: string }>();
  const { t } = useTranslation(['plan', 'train']);
  const theme = useTheme();
  const styles = useStyles();
  const today = todayFn();
  const weekStartsOn = useProfile().data?.weekStartsOn === 0 ? 0 : 1;
  const templates = useTemplates();
  const label = useTemplateLabel();
  const initialTemplate = templates.data?.find((x) => x.id === params.templateId);

  const [type, setType] = useState<SessionType | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(params.templateId ?? null);
  const [customTitle, setCustomTitle] = useState('');
  const [date, setDate] = useState(params.date && params.date >= today ? params.date : today);
  const [time, setTime] = useState<string | null>('18:00');
  const [duration, setDuration] = useState<number | null>(null);
  const [repeat, setRepeat] = useState<Repeat>('never');
  const [interval, setInterval] = useState(1);
  const [days, setDays] = useState<number[]>([]);
  const [ends, setEnds] = useState<Ends>('never');
  const [endDate, setEndDate] = useState<string | null>(null);
  const [count, setCount] = useState(8);
  const [remind, setRemind] = useState<(typeof REMIND)[number]>('15');
  const [picking, setPicking] = useState<'date' | 'end' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Effective values: a template passed in the URL prefills type and duration.
  const effType: SessionType = type ?? initialTemplate?.type ?? 'gym';
  const template = templates.data?.find((x) => x.id === templateId && x.type === effType) ?? null;
  const effDuration = duration ?? template?.durationMinutes ?? (effType === 'rest' ? null : 45);
  const effDays = days.length ? days : [isoWeekday(date)];
  const options = (templates.data ?? []).filter((x) => x.type === effType);
  const title = effType === 'rest' ? 'Rest' : template ? label(template) : customTitle.trim();

  const guard = useUnsavedGuard(touched);
  const touch =
    <A extends unknown[]>(fn: (...a: A) => void) =>
    (...a: A) => {
      setTouched(true);
      fn(...a);
    };

  const sameDay = useSessionsForDate(date);
  // The React Compiler memoizes this; no manual useMemo.
  const conflicts = detectConflicts(
    {
      id: 'new',
      type: effType,
      title,
      scheduledDate: date,
      startTime: effType === 'rest' ? null : time,
      durationMinutes: effDuration,
      status: 'planned',
    },
    sameDay.data ?? [],
  );

  const save = useRepoMutation(
    async (r) => {
      const base = {
        templateId: effType === 'rest' ? null : (template?.id ?? null),
        title,
        type: effType,
        durationMinutes: effDuration,
        reminderOffsetMinutes: remind === 'none' || effType === 'rest' ? null : Number(remind),
      };
      const startTime = effType === 'rest' ? null : time;
      if (repeat === 'never') {
        await r.schedule.create({
          ...base,
          scheduledDate: date,
          startTime,
          endTime: null,
          orderInDay: 99,
          skipReason: null,
          notes: null,
        });
        return;
      }
      const freq = repeat === 'custom' ? 'weekly' : repeat;
      const rule: RuleLike = {
        id: 'draft',
        freq,
        interval: repeat === 'weekly' || repeat === 'monthly' ? 1 : interval,
        byWeekday: freq === 'weekly' ? effDays : null,
        byMonthDay: freq === 'monthly' ? Number(date.slice(8, 10)) : null,
        startDate: date,
        endDate: null,
        active: true,
      };
      const end =
        ends === 'onDate'
          ? endDate
          : ends === 'afterCount'
            ? endDateAfterCount(rule, count, weekStartsOn)
            : null;
      await r.schedule.createRule(
        {
          ...base,
          freq: rule.freq,
          interval: rule.interval,
          byWeekday: rule.byWeekday,
          byMonthDay: rule.byMonthDay,
          startDate: date,
          endDate: end,
          startTime,
          active: true,
          materializedUntil: null,
        },
        today,
      );
    },
    {
      invalidate: invalidates.schedule,
      successMessage: t('toast.saved'),
      onSuccess: () => guard.leave(() => goBack(routes.plan)),
    },
  );

  const onSave = () => {
    if (!title) return setError(t('form.errors.title'));
    if ((repeat === 'weekly' || repeat === 'custom') && effDays.length === 0)
      return setError(t('form.errors.days'));
    if (repeat !== 'never' && ends === 'onDate' && (!endDate || endDate <= date))
      return setError(t('form.errors.endBefore'));
    setError(null);
    save.mutate(undefined);
  };

  const fmt = (d: string) => formatDay(d, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('form.title')} onBack={() => goBack(routes.plan)} large={false} />

      <SectionHeader title={t('form.what')} />
      <ChipGroup<SessionType>
        options={SESSION_TYPES.map((v) => ({ value: v, label: t(`types.${v}`) }))}
        value={effType}
        onChange={touch((v: SessionType) => {
          setType(v);
          setTemplateId(null);
          setDuration(null);
        })}
        testID="form-type"
      />
      {effType !== 'rest' ? (
        <Card style={styles.card}>
          <Text variant="caption" tone="muted">
            {t('form.template')}
          </Text>
          {options.length === 0 ? <Text tone="muted">{t('form.noTemplates')}</Text> : null}
          {options.map((x) => (
            <OptionCard
              key={x.id}
              icon={iconFor(x.type)}
              title={label(x)}
              {...(x.durationMinutes
                ? { description: t('train:minutes', { count: x.durationMinutes }) }
                : {})}
              selected={template?.id === x.id}
              onPress={touch(() => {
                setTemplateId(template?.id === x.id ? null : x.id);
                setDuration(null);
              })}
              testID={`form-template-${x.id}`}
            />
          ))}
          {!template ? (
            <Input
              label={t('form.customTitle')}
              value={customTitle}
              onChangeText={touch(setCustomTitle)}
              maxLength={60}
              testID="form-title"
            />
          ) : null}
        </Card>
      ) : null}

      <SectionHeader title={t('form.when')} />
      <Card style={styles.card}>
        <ListRow
          title={t('form.date')}
          subtitle={fmt(date)}
          onPress={() => setPicking('date')}
          testID="form-date"
        />
        {effType !== 'rest' ? (
          <>
            <TimeField value={time} onChange={touch(setTime)} />
            <Text variant="caption" tone="muted">
              {t('form.duration')}
            </Text>
            <NumberStepper
              label={t('form.duration')}
              value={effDuration ?? 45}
              onChange={touch(setDuration)}
              step={5}
              min={5}
              max={300}
              unit="min"
            />
          </>
        ) : null}
        {conflicts.length ? (
          <View
            style={[styles.warn, { borderColor: theme.colors.warning }]}
            testID="form-conflicts"
          >
            <Text variant="bodyStrong" style={{ color: theme.colors.warning }}>
              ⚠ {t('move.conflicts')}
            </Text>
            {conflicts.map((c, i) => (
              <Text key={i} variant="caption">
                {c.kind === 'time_overlap'
                  ? t('move.time_overlap', { title: c.with.title, time: c.with.startTime ?? '' })
                  : c.kind === 'same_type_same_day'
                    ? t('move.same_type_same_day', { title: c.with.title })
                    : c.kind === 'rest_day'
                      ? t('move.rest_day')
                      : t('move.heavy_day', { sessions: c.sessions, minutes: c.minutes })}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>

      <SectionHeader title={t('form.repeat')} />
      <Card style={styles.card}>
        <ChipGroup<Repeat>
          options={(['never', 'daily', 'weekly', 'monthly', 'custom'] as const).map((v) => ({
            value: v,
            label: t(`form.repeatOptions.${v}`),
          }))}
          value={repeat}
          onChange={touch(setRepeat)}
          testID="form-repeat"
        />
        {repeat === 'daily' || repeat === 'custom' ? (
          <>
            <Text variant="caption" tone="muted">
              {t('form.every')}{' '}
              {repeat === 'daily'
                ? t('form.everyDays', { count: interval })
                : t('form.everyWeeks', { count: interval })}
            </Text>
            <NumberStepper
              label={t('form.every')}
              value={interval}
              onChange={touch(setInterval)}
              min={1}
              max={repeat === 'daily' ? 30 : 8}
            />
          </>
        ) : null}
        {repeat === 'weekly' || repeat === 'custom' ? (
          <>
            <Text variant="caption" tone="muted">
              {t('form.days')}
            </Text>
            <ChipGroup
              multiple
              options={WEEKDAYS.map((d) => ({
                value: String(d),
                label: formatDay(`2026-09-${String(20 + d).padStart(2, '0')}`, {
                  weekday: 'short',
                }),
              }))}
              value={effDays.map(String)}
              onChange={touch((v: string[]) => setDays(v.map(Number)))}
              testID="form-days"
            />
          </>
        ) : null}
        {repeat !== 'never' ? (
          <>
            <Text variant="caption" tone="muted">
              {t('form.ends')}
            </Text>
            <ChipGroup<Ends>
              options={(['never', 'onDate', 'afterCount'] as const).map((v) => ({
                value: v,
                label: t(`form.endOptions.${v}`),
              }))}
              value={ends}
              onChange={touch(setEnds)}
            />
            {ends === 'onDate' ? (
              <ListRow
                title={t('form.endDate')}
                subtitle={endDate ? fmt(endDate) : '—'}
                onPress={() => setPicking('end')}
              />
            ) : null}
            {ends === 'afterCount' ? (
              <NumberStepper
                label={t('form.occurrences')}
                value={count}
                onChange={touch(setCount)}
                min={1}
                max={200}
                unit="×"
              />
            ) : null}
          </>
        ) : null}
      </Card>

      {effType !== 'rest' ? (
        <>
          <SectionHeader title={t('form.remind')} />
          <Card style={styles.card}>
            <ChipGroup
              options={REMIND.map((v) => ({ value: v, label: t(`form.remindOptions.${v}`) }))}
              value={remind}
              onChange={touch(setRemind)}
            />
            <Text variant="caption" tone="muted">
              {t('form.remindHint')}
            </Text>
          </Card>
        </>
      ) : null}

      {error ? <Text tone="danger">{error}</Text> : null}
      <Button
        label={t('form.save')}
        size="lg"
        fullWidth
        loading={save.isPending}
        onPress={onSave}
        testID="form-save"
      />

      <DatePickerSheet
        visible={picking !== null}
        value={picking === 'end' ? (endDate ?? date) : date}
        today={today}
        weekStartsOn={weekStartsOn}
        onPick={touch((d: string) => (picking === 'end' ? setEndDate(d) : setDate(d)))}
        onClose={() => setPicking(null)}
      />
      {guard.dialog}
      <View style={{ height: 8 }} />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: t.spacing.sm },
  warn: { gap: t.spacing.xs, borderWidth: 1, borderRadius: t.radius.md, padding: t.spacing.md },
}));
