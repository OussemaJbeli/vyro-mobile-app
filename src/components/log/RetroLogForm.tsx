import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DatePickerSheet, TimeField } from '@/components/planner/Pickers';
import { formatDay } from '@/components/planner/plannerUtils';
import {
  Button,
  Card,
  Checkbox,
  Header,
  ListRow,
  NumberStepper,
  ScreenContainer,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import { goBack } from '@/constants/navigation';
import {
  buildSnapshot,
  hydrate,
  retroLog,
  toRuntime,
  type RetroInterval,
  type RetroSet,
} from '@/domain/execution';
import {
  invalidates,
  useProfile,
  useRepositories,
  useSession,
  useTemplate,
  useTemplates,
  useUnitPrefs,
  type TemplateDetail,
} from '@/hooks/data';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';
import { asLocalDate, toDate, today, type WeekStart } from '@/utils/dates';
import { logger } from '@/utils/logger';
import { fromCanonical, toCanonical, unitLabel } from '@/utils/units';

import { useWeightInput } from '../execution/useWeightInput';

type Params = { sessionId?: string; templateId?: string; type?: string };

/**
 * Retroactive log (FS §76, step 21): prefilled with the plan, the user edits actuals, and
 * the same engine replays them (is_retroactive = 1). From a missed/planned session, the
 * Home "Log past workout" / "Log a run" actions.
 */
export function RetroLogForm({ sessionId, templateId: initialTemplate, type }: Params) {
  const { t } = useTranslation(['execution', 'running', 'common']);
  const session = useSession(sessionId);
  const running = type === 'running' || session.data?.type === 'running';
  const [picked, setPicked] = useState<string | null>(initialTemplate ?? null);
  const templateId = session.data?.templateId ?? picked;
  const template = useTemplate(templateId ?? undefined);
  const templates = useTemplates();

  if (sessionId && session.isLoading) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <Skeleton preset="card" />
      </ScreenContainer>
    );
  }

  const title = running ? t('log.titleRun') : t('log.title');
  if (!templateId || !template.data) {
    const options = (templates.data ?? []).filter((x) =>
      running ? x.type === 'running' : x.type !== 'running',
    );
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <Header title={title} onBack={() => goBack(routes.home)} large={false} />
        <SectionHeader title={t('log.pickTemplate')} />
        <Card>
          {options.map((x) => (
            <ListRow
              key={x.id}
              title={x.name}
              onPress={() => setPicked(x.id)}
              testID={`log-pick-${x.id}`}
            />
          ))}
        </Card>
      </ScreenContainer>
    );
  }
  return (
    <Editor
      key={template.data.id}
      title={title}
      template={template.data}
      sessionId={sessionId ?? null}
      sessionDate={session.data?.scheduledDate ?? null}
      sessionTime={session.data?.startTime ?? null}
      sessionTitle={session.data?.title ?? null}
      {...(!session.data ? { onChange: () => setPicked(null) } : {})}
    />
  );
}

function Editor({
  title,
  template,
  sessionId,
  sessionDate,
  sessionTime,
  sessionTitle,
  onChange,
}: {
  title: string;
  template: TemplateDetail;
  sessionId: string | null;
  sessionDate: string | null;
  sessionTime: string | null;
  sessionTitle: string | null;
  onChange?: () => void;
}) {
  const { t } = useTranslation(['execution', 'running', 'common']);
  const styles = useStyles();
  const repos = useRepositories();
  const client = useQueryClient();
  const catalog = useExerciseCatalog();
  const profile = useProfile();
  const prefs = useUnitPrefs();
  const weight = useWeightInput();
  const running = template.type === 'running';
  const [date, setDate] = useState(sessionDate && sessionDate <= today() ? sessionDate : today());
  const [time, setTime] = useState<string | null>(sessionTime ?? '18:00');
  const [pickDate, setPickDate] = useState(false);
  const [minutes, setMinutes] = useState(template.durationMinutes ?? 45);
  const [saving, setSaving] = useState(false);
  const exercises = [...template.exercises].sort((a, b) => a.orderIndex - b.orderIndex);
  const intervalsPlan = [...template.intervals].sort((a, b) => a.orderIndex - b.orderIndex);
  const [sets, setSets] = useState<RetroSet[][]>(() =>
    exercises.map((e) =>
      Array.from({ length: e.sets }, () => ({
        done: true,
        reps: e.targetReps ?? 10,
        weightKg: e.targetWeightKg ?? 0,
        durationSeconds: e.targetDurationSeconds ?? 30,
      })),
    ),
  );
  const [intervals, setIntervals] = useState<RetroInterval[]>(() =>
    intervalsPlan.map((iv) => ({
      done: true,
      durationSeconds: iv.durationSeconds,
      speedKmh: iv.speedKmh,
    })),
  );

  const patchSet = (e: number, i: number, p: Partial<RetroSet>) =>
    setSets((all) =>
      all.map((row, ei) => (ei !== e ? row : row.map((s, si) => (si === i ? { ...s, ...p } : s)))),
    );
  const patchInterval = (i: number, p: Partial<RetroInterval>) =>
    setIntervals((all) => all.map((iv, k) => (k === i ? { ...iv, ...p } : iv)));

  const save = async () => {
    setSaving(true);
    try {
      const [h, m] = (time ?? '18:00').split(':').map(Number) as [number, number];
      const startDate = toDate(asLocalDate(date));
      startDate.setHours(h, m, 0, 0);
      const startMs = startDate.getTime();
      const snapshot = buildSnapshot(template, (id) => {
        const x = catalog.byId.get(id);
        return x ? { name: x.label, tracking: x.tracking } : undefined;
      });
      const id = await repos.executions.logRetroactive(
        {
          scheduledSessionId: sessionId,
          templateId: template.id,
          type: template.type,
          title: sessionTitle ?? template.name,
          snapshot,
          startedAt: new Date(startMs).toISOString(),
        },
        (rows) => {
          const r = retroLog(hydrate(rows, { autoRest: false }), {
            sets: sets.map((row, e) =>
              row.map((s) => {
                const tracking =
                  catalog.byId.get(exercises[e]!.exerciseId)?.tracking ?? 'weight_reps';
                return {
                  ...s,
                  weightKg:
                    tracking === 'weight_reps'
                      ? weight.toKg(weight.toDisplay(s.weightKg ?? 0))
                      : null,
                };
              }),
            ),
            intervals,
            endMs: startMs + minutes * 60_000,
          });
          return { changes: r.changes, runtime: toRuntime(r.state) };
        },
      );
      await Promise.all(
        invalidates.executionFinished.map((queryKey) =>
          client.invalidateQueries({ queryKey: [...queryKey] }),
        ),
      );
      router.replace(routes.executeComplete(id));
    } catch (error) {
      logger.error('Retro log failed', { error });
      toast.error(t('log.failed'));
      setSaving(false);
    }
  };

  const speedUnit = prefs.speed;
  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header
        title={title}
        subtitle={sessionTitle ?? template.name}
        onBack={() => goBack(routes.home)}
        large={false}
      />
      {onChange ? (
        <Button size="sm" variant="ghost" label={t('log.change')} onPress={onChange} />
      ) : null}
      <Card style={styles.gap}>
        <ListRow
          title={t('log.date')}
          trailing={
            <Text variant="bodyStrong">
              {formatDay(date, { weekday: 'short', day: 'numeric', month: 'short' })}
            </Text>
          }
          onPress={() => setPickDate(true)}
          showChevron={false}
        />
        <View style={styles.timeRow}>
          <Text style={styles.flex}>{t('log.start')}</Text>
          <TimeField value={time} onChange={setTime} />
        </View>
        {!running ? (
          <NumberStepper
            label={t('log.duration')}
            value={minutes}
            onChange={setMinutes}
            step={5}
            min={5}
            max={300}
            unit="min"
          />
        ) : null}
      </Card>

      {!running ? (
        exercises.map((e, ei) => {
          const item = catalog.byId.get(e.exerciseId);
          const tracking = item?.tracking ?? 'weight_reps';
          const timed = tracking === 'duration' || tracking === 'distance_duration';
          return (
            <View key={e.id} style={styles.gap}>
              <SectionHeader title={item?.label ?? '…'} />
              <Card style={styles.gap}>
                {sets[ei]!.map((s, si) => (
                  <View key={si} style={styles.setRow}>
                    <Checkbox
                      label={t('log.set', { n: si + 1 })}
                      checked={s.done}
                      onChange={(done) => patchSet(ei, si, { done })}
                    />
                    {s.done ? (
                      <View style={styles.steppers}>
                        {tracking === 'weight_reps' ? (
                          <NumberStepper
                            label={t('weight')}
                            value={weight.toDisplay(s.weightKg ?? 0)}
                            onChange={(v) => patchSet(ei, si, { weightKg: weight.toKg(v) })}
                            step={weight.step}
                            min={0}
                            max={weight.max}
                            unit={weight.unit}
                          />
                        ) : null}
                        {timed ? (
                          <NumberStepper
                            label={t('duration')}
                            value={s.durationSeconds ?? 0}
                            onChange={(v) => patchSet(ei, si, { durationSeconds: v })}
                            step={5}
                            min={0}
                            max={7200}
                            unit="s"
                          />
                        ) : (
                          <NumberStepper
                            label={t('reps')}
                            value={s.reps ?? 0}
                            onChange={(v) => patchSet(ei, si, { reps: v })}
                            min={0}
                            max={200}
                          />
                        )}
                      </View>
                    ) : null}
                  </View>
                ))}
              </Card>
            </View>
          );
        })
      ) : (
        <Card style={styles.gap}>
          {intervals.map((iv, i) => (
            <View key={i} style={styles.setRow}>
              <Checkbox
                label={t('log.interval', {
                  n: i + 1,
                  kind: t(`running:kinds.${intervalsPlan[i]!.kind}`),
                })}
                checked={iv.done}
                onChange={(done) => patchInterval(i, { done })}
              />
              {iv.done ? (
                <View style={styles.steppers}>
                  <NumberStepper
                    label={t('log.seconds')}
                    value={iv.durationSeconds}
                    onChange={(v) => patchInterval(i, { durationSeconds: v })}
                    step={30}
                    min={30}
                    max={7200}
                    unit="s"
                  />
                  {iv.speedKmh !== null ? (
                    <NumberStepper
                      label={t('run.speed')}
                      value={Math.round(fromCanonical(iv.speedKmh, speedUnit) * 10) / 10}
                      onChange={(v) => patchInterval(i, { speedKmh: toCanonical(v, speedUnit) })}
                      step={0.1}
                      min={0}
                      max={Math.round(fromCanonical(30, speedUnit))}
                      unit={unitLabel(speedUnit)}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
        </Card>
      )}

      <Button
        size="xl"
        label={t('log.save')}
        fullWidth
        loading={saving}
        onPress={() => void save()}
        testID="log-save"
      />
      <DatePickerSheet
        visible={pickDate}
        value={date}
        today={today()}
        weekStartsOn={(profile.data?.weekStartsOn ?? 1) as WeekStart}
        onPick={(d) => {
          setDate(d > today() ? today() : d);
          setPickDate(false);
        }}
        onClose={() => setPickDate(false)}
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  gap: { gap: t.spacing.sm },
  setRow: { gap: t.spacing.xs },
  steppers: { gap: t.spacing.xs, paddingLeft: t.spacing.lg },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  flex: { flex: 1 },
}));
